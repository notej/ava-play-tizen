/**
 * Loads the Live TV catalogue (groups + channels) from a saved playlist: Xtream login or M3U link.
 * Mirrors what Repository.kt / XtreamApi.kt / M3uParser.kt do for live channels on Android.
 */
import { XtreamClient, ConnectionError } from './XtreamClient.js';
import { M3UParser } from './M3UParser.js';
import { storage } from './StorageManager.js';
import { viaProxy } from '../core/net.js';

const ADULT = /adult|xxx|porn|18\s*\+|erotic|sex/i;

export function isAdultName(name) { return ADULT.test(name || ''); }

/** Accepts a get.php / player_api.php link that carries the login and returns {server, username, password}. */
export function parseXtreamLink(text) {
  try {
    const url = new URL(text.trim());
    const username = url.searchParams.get('username');
    const password = url.searchParams.get('password');
    if (username && password) return { server: `${url.protocol}//${url.host}`, username, password };
  } catch (e) { /* not a link */ }
  return null;
}

export function normalizeServer(server) {
  let s = (server || '').trim();
  if (s && !/^https?:\/\//i.test(s)) s = `http://${s}`;
  return s.replace(/\/+$/, '');
}

export function streamUrl(connection, streamId, format) {
  const server = normalizeServer(connection.server);
  return `${server}/live/${encodeURIComponent(connection.username)}/${encodeURIComponent(connection.password)}/${streamId}.${format}`;
}

function initials(name) {
  const words = (name || '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'TV';
  return (words.length === 1 ? words[0].slice(0, 3) : words.slice(0, 2).map((w) => w[0]).join('')).toUpperCase();
}

async function loadXtream(connection, format) {
  const client = new XtreamClient({ ...connection, server: normalizeServer(connection.server) });
  const [cats, streams] = await Promise.all([
    client.fetchJson('get_live_categories', {}, 30000),
    client.fetchJson('get_live_streams', {}, 120000)
  ]);
  if (!Array.isArray(streams)) throw new Error('The provider did not return a channel list. It may be limiting connections; wait a minute and retry.');
  const groups = (Array.isArray(cats) ? cats : []).map((c) => ({ id: String(c.category_id), name: c.category_name || 'Unnamed group' }));
  const names = new Map(groups.map((g) => [g.id, g.name]));
  const channels = streams.map((s, i) => ({
    id: `x${s.stream_id}`,
    name: s.name || 'Unnamed channel',
    number: Number(s.num) || i + 1,
    groupId: String(s.category_id || ''),
    groupRaw: names.get(String(s.category_id)) || '',
    icon: s.stream_icon || '',
    epgId: s.epg_channel_id || '',
    streamId: s.stream_id
  }));
  return { groups, channels };
}

async function loadM3u(connection) {
  const response = await fetch(viaProxy(connection.server));
  if (response.status === 502 || response.status === 504) throw new ConnectionError('unreachable', 'Could not reach the provider.', (await response.text().catch(() => '')).replace(/^Proxy error:\s*/, '').slice(0, 80));
  if (response.status === 401 || response.status === 403) throw new ConnectionError('blocked', 'The provider refused the connection.', `HTTP ${response.status}`);
  if (!response.ok) throw new ConnectionError('http', `The playlist could not be loaded (HTTP ${response.status}).`, `HTTP ${response.status}`);
  const { channels } = M3UParser.parse(await response.text());
  const live = channels.filter((c) => c.type === 'LIVE');
  const groupNames = [...new Set(live.map((c) => c.group || 'General'))];
  return {
    groups: groupNames.map((n) => ({ id: n, name: n })),
    channels: live.map((c, i) => ({
      id: `m${i}`,
      name: c.name,
      number: i + 1,
      groupId: c.group || 'General',
      groupRaw: c.group || 'General',
      icon: c.logo || '',
      epgId: c.epgId || '',
      url: c.streamUrl
    }))
  };
}

export async function loadLive(connection, format) {
  const data = connection.isM3u ? await loadM3u(connection) : await loadXtream(connection, format);
  data.channels.forEach((c) => {
    c.logoText = initials(c.name);
    c.streamUrl = c.url || streamUrl(connection, c.streamId, format);
  });
  return data;
}

/** Account details for the Playlists page (status, connections, expiry) */
export async function checkAccount(connection) {
  const client = new XtreamClient({ ...connection, server: normalizeServer(connection.server) });
  return client.authenticate();
}

// ---- cache, so the list shows at once on the next start ----
const cacheKey = (id) => `avaplay_cache_live_${id}`;

export function readCache(id) {
  return storage.get(cacheKey(id), null);
}

export function writeCache(id, data) {
  // Channels can number in the thousands; the cache is optional, so a full quota is ignored.
  try {
    storage.set(cacheKey(id), {
      at: Date.now(),
      groups: data.groups,
      channels: data.channels.map(({ streamUrl, ...rest }) => rest)
    });
  } catch (e) { /* ignore */ }
}

export function clearCache(id) {
  try { localStorage.removeItem(cacheKey(id)); } catch (e) { /* ignore */ }
}


// ---- what to try, for each way a connection can fail ----
const TIPS = {
  unreachable: [
    'Check the address: it starts with http:// and has the port if your provider gives one (for example :8080).',
    'If your provider lists a separate address for Samsung or LG TVs, use that one.',
    'Check that the TV is online: another app should load. Some providers block certain networks, so try again later or ask them.'
  ],
  timeout: [
    'The server may be busy or down. Check that the TV is online, then try again in a minute.',
    'Ask your provider whether their server is running.'
  ],
  blocked: [
    'Some providers only answer known apps. Ask them to allow this TV, or ask which address to use for Samsung TVs.',
    'You can also set a User-Agent in Settings > System & help (for example VLC/3.0.20 LibVLC/3.0.20) and try again.'
  ],
  notxtream: [
    'Enter only the server address, without /get.php or /player_api.php. A full get.php link with your login also works.',
    'If you have a playlist link (.m3u), use the M3U link tab instead.'
  ],
  http: ['Try again in a minute. If it keeps happening, ask your provider.'],
  auth: [
    'The address works, but the username or password is wrong. Check them with your provider: capital letters count.',
    'Some providers give the Samsung TV address a different login.'
  ],
  inactive: ['Ask your provider to renew or reactivate the account.']
};

/** { message, tips[], detail } for anything thrown while connecting to a provider */
export function explainConnectionError(err) {
  if (err instanceof ConnectionError) return { message: err.message, tips: TIPS[err.kind] || [], detail: err.detail || '' };
  const text = String((err && err.message) || err || 'Something went wrong.');
  // Playlist links fail inside fetch as a TypeError
  if (err instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(text)) return { message: 'Could not reach the provider.', tips: TIPS.unreachable, detail: '' };
  if (/^Account|account is /i.test(text)) return { message: text, tips: TIPS.inactive, detail: '' };
  return { message: text, tips: [], detail: '' };
}
