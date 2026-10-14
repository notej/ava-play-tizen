/**
 * The film catalogue: loading it from an Xtream login or an M3U link, caching it, the details of one film,
 * and the helpers the Movies page needs (genres, title cleaning, quality badges, "Picked for you").
 * Ported from XtreamApi.kt, Genres.kt, Theme.kt (displayTitle, hasMultiSub) and AppViewModel.picks().
 */
import { XtreamClient } from './XtreamClient.js';
import { M3UParser } from './M3UParser.js';
import { normalizeServer } from './LiveSource.js';
import { idbGet, idbSet, idbDelete } from './Idb.js';
import { viaProxy } from '../core/net.js';

// ---------- title helpers ----------
const BRACKET = /\s*\[[^\]]*]/g;
const LANG_PREFIX = /^\s*[A-Za-z]{2,3}\s*\|\s*/;
const TRAILING_YEAR = /\s*[-–(]\s*(19|20)\d{2}\)?\s*$/;
const MULTI_SUB = /\[\s*MULTI[-\s]?SUB(TITLES?)?\s*]/i;

export function displayTitle(raw) {
  const cleaned = (raw || '').replace(BRACKET, '').replace(LANG_PREFIX, '').replace(TRAILING_YEAR, '').trim();
  return cleaned || (raw || '').trim();
}

export const hasMultiSub = (raw) => MULTI_SUB.test(raw || '');

export function qualityBadge(name) {
  const n = (name || '').toUpperCase();
  if (/\b(4K|UHD|2160P?)\b/.test(n)) return '4K';
  if (/\b(FHD|1080P?)\b/.test(n)) return 'FHD';
  if (/\b(HD|720P?)\b/.test(n)) return 'HD';
  return '';
}

/** Provider lengths arrive as "02:06:07" or "126"; show "2h 6m". */
export function runtime(raw) {
  const parts = String(raw || '').trim().split(':').map((p) => parseInt(p, 10));
  if (!parts.length || parts.some(Number.isNaN)) return String(raw || '').trim();
  const minutes = parts.length === 3 ? parts[0] * 60 + parts[1] : parts[0];
  if (minutes <= 0) return '';
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// Titles are filed by cleaned name + year for the duplicate filter
export function duplicateKey(item) {
  const plain = displayTitle(item.name).normalize('NFD').replace(/\p{Mn}+/gu, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const year = (item.name.replace(BRACKET, '').match(/\b((?:19|20)\d{2})\b/) || [])[1] || item.year || '';
  return `${plain}|${year}`;
}

// ---------- genres ----------
export const GENRES = [
  ['Action', ['action']], ['Adventure', ['adventure']], ['Animation', ['animation', 'animated', 'cartoon', 'anime']],
  ['Comedy', ['comedy', 'comedies', 'comedie']], ['Crime', ['crime']], ['Documentary', ['documentar']], ['Drama', ['drama']],
  ['Family', ['family', 'kids']], ['Fantasy', ['fantasy']], ['History', ['history', 'biograph']], ['Horror', ['horror']],
  ['Music', ['music', 'concert']], ['Mystery', ['mystery']], ['Romance', ['romance', 'romantic']],
  ['Sci-Fi', ['sci-fi', 'sci fi', 'scifi', 'science fiction']], ['Thriller', ['thriller']], ['War', ['war']], ['Western', ['western']]
];

function wordHit(text, word) {
  return word.length <= 3 ? new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text) : text.includes(word);
}

/** Genres named in a piece of text (a genre line, a category name, a synopsis). */
export function genresOf(text) {
  const t = (text || '').toLowerCase();
  if (!t.trim()) return [];
  return GENRES.filter(([, words]) => words.some((w) => wordHit(t, w))).map(([name]) => name);
}

/** Title-style family for the big title on the details page, chosen from the genre line. */
const TITLE_KINDS = [
  ['dread', ['horror', 'thriller', 'suspense', 'orrore', 'brivido']],
  ['scifi', ['sci-fi', 'science fiction', 'fantascienza']],
  ['fantasy', ['fantasy', 'romance', 'history', 'historical', 'storico', 'romantico']],
  ['action', ['action', 'adventure', 'war', 'western', 'sport', 'azione', 'avventura', 'guerra']],
  ['playful', ['comedy', 'family', 'animation', 'kids', 'children', 'commedia', 'famiglia', 'animazione']],
  ['factual', ['documentary', 'reality', 'news', 'talk', 'music', 'documentario']],
  ['drama', ['drama', 'mystery', 'crime', 'dramma', 'giallo', 'crimine']]
];

export function titleKindFor(genre) {
  const parts = (genre || '').toLowerCase().split(/[,/&]/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const hit = TITLE_KINDS.find(([, words]) => words.some((w) => part.includes(w)));
    if (hit) return hit[0];
  }
  return 'drama';
}

// ---------- loading ----------
const cacheKey = (id, kind = 'MOVIE') => (kind === 'SHOW' ? `series_${id}` : `movies_${id}`);

function backdropOf(j) {
  const v = j.backdrop_path;
  const first = Array.isArray(v) ? v.find((s) => typeof s === 'string' && s.trim()) : (typeof v === 'string' ? v : '');
  return first && /^https?:/i.test(first.trim()) ? first.trim() : '';
}

function memberships(j) {
  const all = Array.isArray(j.category_ids) ? j.category_ids.map(String).filter((s) => s && s !== '0') : [];
  if (all.length) return all;
  const one = j.category_id == null ? '' : String(j.category_id);
  return one && one !== '0' ? [one] : [];
}

async function loadXtream(connection) {
  const client = new XtreamClient({ ...connection, server: normalizeServer(connection.server) });
  const [cats, rows] = await Promise.all([
    client.fetchJson('get_vod_categories', {}, 30000),
    client.fetchJson('get_vod_streams', {}, 20 * 60 * 1000)
  ]);
  if (!Array.isArray(rows)) throw new Error('The provider did not return a film list. It may be limiting connections; wait a minute and retry.');
  const groups = (Array.isArray(cats) ? cats : [])
    .filter((c) => c.category_id != null && String(c.category_id).trim())
    .map((c) => ({ id: String(c.category_id), name: c.category_name || 'Unnamed category' }));
  const seen = new Set();
  const items = [];
  for (const j of rows) {
    if (!j || j.stream_id == null) continue;
    const id = String(j.stream_id);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      key: `MOVIE:${id}`,
      name: j.name || 'Unnamed title',
      groups: memberships(j),
      image: j.stream_icon || '',
      ext: /^[A-Za-z0-9]{1,8}$/.test(j.container_extension || '') ? j.container_extension : 'mp4',
      year: String(j.year || (j.releaseDate || '').slice(0, 4) || ''),
      rating: String(j.rating || ''),
      genre: j.genre || '',
      added: Number(j.added) || 0,
      backdrop: backdropOf(j)
    });
  }
  return { groups, items };
}

async function loadM3u(connection) {
  const response = await fetch(viaProxy(connection.server));
  if (!response.ok) throw new Error(`Playlist request failed (HTTP ${response.status}).`);
  const { channels } = M3UParser.parse(await response.text());
  const films = channels.filter((c) => c.type === 'MOVIE');
  const names = [...new Set(films.map((c) => c.group || 'Movies'))];
  return {
    groups: names.map((n) => ({ id: n, name: n })),
    items: films.map((c, i) => ({
      id: `m${i}`, key: `MOVIE:m${i}`, name: c.name, groups: [c.group || 'Movies'], image: c.logo || '', ext: 'mp4',
      year: '', rating: '', genre: '', added: 0, backdrop: '', url: c.streamUrl
    }))
  };
}

export async function loadMovies(connection) {
  return connection.isM3u ? loadM3u(connection) : loadXtream(connection);
}

export async function readMovieCache(connectionId, kind = 'MOVIE') { return idbGet(cacheKey(connectionId, kind)); }
export async function writeMovieCache(connectionId, data, kind = 'MOVIE') { return idbSet(cacheKey(connectionId, kind), { at: Date.now(), groups: data.groups, items: data.items }); }
export async function clearMovieCache(connectionId) { await idbDelete(cacheKey(connectionId, 'MOVIE')); await idbDelete(cacheKey(connectionId, 'SHOW')); }

export function movieUrl(connection, item) {
  if (item.url) return item.url;
  const server = normalizeServer(connection.server);
  return `${server}/movie/${encodeURIComponent(connection.username)}/${encodeURIComponent(connection.password)}/${item.id}.${item.ext || 'mp4'}`;
}

// The details come on demand: plot, cast, the wide picture and the exact length
const decode = (value) => {
  // Some providers send the plot as base64
  if (!/^[A-Za-z0-9+/]{16,}={0,2}$/.test(value)) return value;
  try {
    const bin = atob(value);
    const text = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    return /[\uFFFD\u0000-\u0008]/.test(text) ? value : text;
  } catch (e) { return value; }
};

export async function loadMovieInfo(connection, item) {
  if (connection.isM3u) return {};
  const client = new XtreamClient({ ...connection, server: normalizeServer(connection.server) });
  const data = await client.fetchJson('get_vod_info', { vod_id: item.id });
  const info = data && data.info ? data.info : {};
  const movie = data && data.movie_data ? data.movie_data : {};
  const text = (v) => (v == null ? '' : String(v));
  return {
    description: decode(text(info.plot || info.description)),
    image: text(info.cover_big || info.movie_image || info.cover),
    backdrop: backdropOf(info),
    year: text(info.releasedate || info.releaseDate || '').slice(0, 4),
    genre: text(info.genre),
    rating: text(info.rating),
    duration: text(info.duration),
    cast: decode(text(info.cast)),
    director: decode(text(info.director)),
    trailer: text(info.youtube_trailer).trim(),
    ext: movie.container_extension || ''
  };
}

/**
 * "Picked for you": films not yet started, from the genres the viewer watches, liked or saved.
 * Taste is read from what is already on the device (progress, My List, likes), each counted towards the genres of
 * its own genre line (full), of its category names (half) and of its synopsis (quarter). Best rated first.
 */
export function pickedForYou({ items, groups, progress, library, ratings, infos, hidden, limit = 30 }) {
  const byKey = new Map(items.map((i) => [i.key, i]));
  const names = new Map(groups.map((g) => [g.id, g.name]));
  const started = Object.entries(progress).filter(([, p]) => p.position > 0 || p.watched).sort((a, b) => (b[1].updated || 0) - (a[1].updated || 0)).map(([k]) => k).slice(0, 30);
  const liked = [...new Set([...started, ...library.slice(0, 30), ...Object.keys(ratings)])].map((k) => byKey.get(k)).filter(Boolean);
  if (!liked.length) return [];

  const weights = new Map();
  const add = (genre, w) => weights.set(genre, (weights.get(genre) || 0) + w);
  for (const item of liked) {
    const r = ratings[item.key] || 0;
    const weight = r > 0 ? 1.5 : r < 0 ? -1 : started.includes(item.key) ? 1 : 0.6;
    const info = infos[item.key] || {};
    genresOf(info.genre || item.genre).forEach((g) => add(g, weight));
    [...new Set(item.groups.flatMap((g) => genresOf(names.get(g) || '')))].forEach((g) => add(g, weight * 0.5));
    genresOf(info.description || '').forEach((g) => add(g, weight * 0.25));
  }
  const top = [...weights.entries()].filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const seen = new Set([...started, ...Object.keys(progress), ...Object.entries(ratings).filter(([, v]) => v < 0).map(([k]) => k)]);
  const rating = (i) => parseFloat(i.rating) || 0;
  const out = new Map();

  if (!top.length) {
    // Categories are not named after genres: use the categories the watched films sit in
    const shared = new Map();
    liked.forEach((i) => i.groups.forEach((g) => shared.set(g, (shared.get(g) || 0) + 1)));
    for (const [group] of [...shared.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
      items.filter((i) => i.groups.includes(group) && !seen.has(i.key) && !hidden.has(i.key) && !out.has(i.key))
        .sort((a, b) => rating(b) - rating(a) || b.added - a.added).slice(0, Math.ceil(limit / 3)).forEach((i) => out.set(i.key, i));
    }
    return [...out.values()].slice(0, limit);
  }

  const total = top.reduce((s, [, w]) => s + w, 0);
  for (const [genre, weight] of top) {
    const share = Math.max(4, Math.floor((limit * weight) / total));
    items.filter((i) => !seen.has(i.key) && !hidden.has(i.key) && !out.has(i.key)
      && (genresOf(i.genre).includes(genre) || i.groups.some((g) => genresOf(names.get(g) || '').includes(genre))))
      .sort((a, b) => rating(b) - rating(a) || b.added - a.added).slice(0, share).forEach((i) => out.set(i.key, i));
  }
  return [...out.values()].slice(0, limit);
}


// ======================================================================= TV shows
async function loadSeriesXtream(connection) {
  const client = new XtreamClient({ ...connection, server: normalizeServer(connection.server) });
  const [cats, rows] = await Promise.all([
    client.fetchJson('get_series_categories', {}, 30000),
    client.fetchJson('get_series', {}, 20 * 60 * 1000)
  ]);
  if (!Array.isArray(rows)) throw new Error('The provider did not return a TV show list. It may be limiting connections; wait a minute and retry.');
  const groups = (Array.isArray(cats) ? cats : [])
    .filter((c) => c.category_id != null && String(c.category_id).trim())
    .map((c) => ({ id: String(c.category_id), name: c.category_name || 'Unnamed category' }));
  const seen = new Set();
  const items = [];
  for (const j of rows) {
    if (!j || j.series_id == null) continue;
    const id = String(j.series_id);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      key: `SHOW:${id}`,
      kind: 'SHOW',
      name: j.name || 'Unnamed title',
      groups: memberships(j),
      image: j.cover || '',
      year: String(j.year || (j.releaseDate || j.release_date || '').slice(0, 4) || ''),
      rating: String(j.rating || ''),
      genre: j.genre || '',
      added: Number(j.last_modified) || 0,
      backdrop: backdropOf(j),
      plot: decode(String(j.plot || '')),
      cast: decode(String(j.cast || '')),
      director: decode(String(j.director || ''))
    });
  }
  return { groups, items };
}

export async function loadSeries(connection) {
  if (connection.isM3u) throw new Error('An M3U link has no series structure (seasons and episodes). Add an Xtream login to browse TV shows.');
  return loadSeriesXtream(connection);
}

const sortSeason = (n) => (n === 0 ? Number.MAX_SAFE_INTEGER : n);

/** Details and the whole episode list of one show */
export async function loadSeriesInfo(connection, show) {
  if (connection.isM3u) return {};
  const client = new XtreamClient({ ...connection, server: normalizeServer(connection.server) });
  const data = await client.fetchJson('get_series_info', { series_id: show.id }, 60000);
  const info = (data && data.info) || {};
  const text = (v) => (v == null ? '' : String(v));
  const seasons = (data && data.episodes) || {};
  const episodes = [];
  const lists = Array.isArray(seasons) ? seasons.map((l, i) => [String(i + 1), l]) : Object.entries(seasons);
  for (const [seasonKey, list] of lists) {
    for (const ep of Array.isArray(list) ? list : []) {
      if (ep == null || ep.id == null || String(ep.id).trim() === '') continue;
      const meta = ep.info || {};
      const season = Number.isFinite(Number(ep.season)) && ep.season !== '' && ep.season != null ? Number(ep.season) : (parseInt(seasonKey, 10) || 0);
      episodes.push({
        id: String(ep.id),
        key: `EPISODE:${ep.id}`,
        name: text(ep.title) || `Episode ${ep.episode_num}`,
        season,
        episode: Number(ep.episode_num) || 0,
        image: text(meta.movie_image),
        description: decode(text(meta.plot)),
        duration: text(meta.duration),
        ext: /^[A-Za-z0-9]{1,8}$/.test(ep.container_extension || '') ? ep.container_extension : 'mp4',
        parentId: show.id,
        parentKey: show.key
      });
    }
  }
  episodes.sort((a, b) => sortSeason(a.season) - sortSeason(b.season) || a.episode - b.episode);
  return {
    description: decode(text(info.plot || info.description)),
    image: text(info.cover_big || info.cover || ''),
    backdrop: backdropOf(info),
    year: text(info.releaseDate || info.releasedate || '').slice(0, 4),
    genre: text(info.genre),
    rating: text(info.rating),
    cast: decode(text(info.cast)),
    director: decode(text(info.director)),
    episodes
  };
}

export function episodeUrl(connection, ep) {
  if (ep.url) return ep.url;
  const server = normalizeServer(connection.server);
  return `${server}/series/${encodeURIComponent(connection.username)}/${encodeURIComponent(connection.password)}/${ep.id}.${ep.ext || 'mp4'}`;
}

// ---- episode titles: the provider repeats the show name and an "S01E01" code in them ----
const EP_TAGS = /\s*\[[^\]]*]/g;
const EP_CODE = /\s*[-–:]?\s*S\d{1,2}\s*E\d{1,3}.*$/i;

export function episodeTitle(ep, show) {
  let t = (ep.name || '').replace(EP_TAGS, '').replace(/^\s*[A-Za-z]{2,3}\s*\|\s*/, '').trim();
  const showName = displayTitle(show.name);
  if (t.toLowerCase().startsWith(showName.toLowerCase())) t = t.slice(showName.length).replace(/^[\s\-–:.]+/, '');
  t = t.replace(/^S\d{1,2}\s*E\d{1,3}\s*[-–:]?\s*/i, '').replace(EP_CODE, '').trim();
  return t || `Episode ${ep.episode}`;
}

export function numberedTitle(ep, show) {
  const t = episodeTitle(ep, show);
  return t === `Episode ${ep.episode}` ? t : `${ep.episode}. ${t}`;
}

export const seasonLabel = (n) => (n === 0 ? 'Specials' : `Season ${n}`);

export function episodeLength(raw) {
  const parts = String(raw || '').trim().split(':').map((p) => parseInt(p, 10)).filter((n) => !Number.isNaN(n));
  const minutes = parts.length === 3 ? parts[0] * 60 + parts[1] : parts.length === 2 ? parts[0] : null;
  if (minutes === null) return String(raw || '').trim();
  return minutes > 0 ? `${minutes}m` : '';
}
