/**
 * Movies: the browse bar, the poster grid, the groups panel, the cinematic hero, sort / filter / genre / search,
 * the film's own page and the film options. Modelled on BrowseGrid.kt, MovieShowcase.kt, MoviePage.kt and SearchScreen.kt.
 */
import { settings } from '../data/AppSettings.js';
import { storage } from '../data/StorageManager.js';
import { movieStore } from '../data/MovieStore.js';
import {
  loadMovies, readMovieCache, writeMovieCache, clearMovieCache, movieUrl, loadMovieInfo, pickedForYou,
  displayTitle, hasMultiSub, qualityBadge, runtime, duplicateKey, genresOf, GENRES, titleKindFor,
  loadSeries, loadSeriesInfo, episodeUrl, episodeTitle, numberedTitle, seasonLabel, episodeLength
} from '../data/MovieSource.js';
import { SeriesPage } from './SeriesPage.js';
import { setMarquee } from './marquee.js';
import { player } from '../player/TizenAVPlayer.js';
import { isAdultName } from '../data/LiveSource.js';
import { VodPlayer } from './VodPlayer.js';
import { glyphFor, glyphHtml, flagHtml } from './Glyphs.js';
import { countryOf } from '../data/Countries.js';

const COLUMNS = 8;
const CARD_W = 215;
const CARD_H = 323;
const GAP = 16;
const ROW_PITCH = CARD_H + GAP;
const GRID_X = 44;
const GRID_TOP = 192;
const CINEMA_TOP = 737;
const REST_MS = 3000;
const PREVIEW_DELAY = 1500;
const PREVIEW_PLAY = 30000;
const RECENT_COUNT = 24;

const SORTS = [['PLAYLIST', 'By playlist order'], ['RATING', 'By rating'], ['RECENT', 'By date added'], ['RANDOM', 'Random']];

// A handful of films that play from public sample streams, so Movies can be tried before a playlist is added
const DEMO_FILMS = [
  ['Big Buck Bunny', 'BigBuckBunny', 'Animation, Family', '2008', '7.6', '00:10:00', 'A giant rabbit takes revenge on three bullying rodents.'],
  ['Elephants Dream', 'ElephantsDream', 'Animation, Sci-Fi', '2006', '6.8', '00:11:00', 'Two strange characters explore a capricious machine world.'],
  ['Sintel', 'Sintel', 'Animation, Fantasy', '2010', '7.4', '00:15:00', 'A lonely young woman searches for the dragon she once befriended.'],
  ['Tears of Steel', 'TearsOfSteel', 'Sci-Fi, Action', '2012', '6.9', '00:12:00', 'A group of warriors and scientists try to save the world from robots.'],
  ['For Bigger Blazes', 'ForBiggerBlazes', 'Action', '2013', '5.5', '00:00:15', 'A short sample clip.'],
  ['For Bigger Escapes', 'ForBiggerEscapes', 'Adventure', '2013', '5.7', '00:00:15', 'A short sample clip.'],
  ['For Bigger Fun', 'ForBiggerFun', 'Comedy', '2013', '5.4', '00:01:00', 'A short sample clip.'],
  ['For Bigger Joyrides', 'ForBiggerJoyrides', 'Drama', '2013', '5.6', '00:00:15', 'A short sample clip.']
];
const DEMO_STREAM = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

// Posters drawn on the spot, so the demo needs no network for its pictures
function demoArt(index, wide, title = (DEMO_FILMS[index] || [''])[0]) {
  const hue = (index * 47) % 360;
  const [w, h] = wide ? [1280, 720] : [430, 645];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},50%,34%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},50%,16%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="50%" fill="rgba(255,255,255,0.85)" font-size="${wide ? 120 : 84}" font-family="Arial" font-weight="700" text-anchor="middle">${String(title).replace(/&/g, '&amp;')}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function demoCatalogue() {
  const groups = [{ id: 'demo-a', name: 'DEMO Animation' }, { id: 'demo-b', name: 'DEMO Action & Adventure' }, { id: 'demo-c', name: 'DEMO Drama & Comedy' }];
  const place = (genre) => (/Animation/.test(genre) ? 'demo-a' : /Action|Adventure|Sci-Fi/.test(genre) ? 'demo-b' : 'demo-c');
  const items = DEMO_FILMS.map(([name, , genre, year, rating, duration, plot], i) => ({
    id: `demo${i}`, key: `MOVIE:demo${i}`, name, groups: [place(genre)],
    image: demoArt(i, false), ext: 'mp4', year, rating, genre, added: 1700000000 - i * 1000, backdrop: demoArt(i, true),
    url: DEMO_STREAM, duration, plot
  }));
  return { groups, items };
}

const DEMO_SHOWS = [
  ['Flower Stories', 'Drama, Mystery', '2021', '8.1', 'A slow anthology about small things that grow. Each episode follows a different garden.'],
  ['Night Signal', 'Sci-Fi, Thriller', '2023', '7.6', 'A radio engineer picks up a message that should not exist.']
];

function demoSeriesCatalogue() {
  const groups = [{ id: 'sdemo-a', name: 'DEMO Drama' }, { id: 'sdemo-b', name: 'DEMO Sci-Fi' }];
  const items = DEMO_SHOWS.map(([name, genre, year, rating, plot], i) => {
    const show = {
      id: `sdemo${i}`, key: `SHOW:sdemo${i}`, kind: 'SHOW', name, groups: [i === 0 ? 'sdemo-a' : 'sdemo-b'],
      image: demoArt(i + 20, false, name), year, rating, genre, added: 1700000000 - i * 5000, backdrop: demoArt(i + 20, true, name), plot, cast: 'Alex Morgan, Sam Rivera', director: 'Riley Stone'
    };
    show.demoEpisodes = [1, 2, 3].flatMap((season) => [1, 2, 3, 4].map((ep) => ({
      id: `sdemo${i}s${season}e${ep}`, key: `EPISODE:sdemo${i}s${season}e${ep}`, name: `${name} - S0${season}E0${ep} - ${['The Beginning', 'Roots', 'Signal', 'Static'][ep - 1]}`,
      season, episode: ep, image: '', description: `Season ${season}, episode ${ep} of ${name}.`, duration: '00:00:05', ext: 'mp4', parentId: show.id, parentKey: show.key, url: DEMO_STREAM
    })));
    return show;
  });
  return { groups, items };
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICONS = {
  sliders: '<svg viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>',
  speakerOn: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>',
  speakerOff: '<svg viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/></svg>',
  restart: '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z"/></svg>',
  saveOutline: '<svg viewBox="0 0 24 24"><path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2zm0 15-5-2.18L7 18V5h10v13z"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M1 21h4V9H1v12zm22-11a2 2 0 0 0-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59A1.99 1.99 0 0 0 7 9v10a2 2 0 0 0 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2a2 2 0 0 0 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>',
  tick: '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
  hide: '<svg viewBox="0 0 24 24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.8 11.8 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2z"/></svg>'
};

export class MoviesView {
  constructor(app) {
    this.app = app;
    this.nav = app.nav;
    this.root = document.getElementById('view-movies');
    this.vod = new VodPlayer(app, this);

    // Movies and TV Shows are one browse screen; each kind keeps its own catalogue, group, sort and place
    this.kind = 'MOVIE';
    this.bags = {};
    this.connection = null;
    this.isDemo = true;
    this.resetKindState();
    this.cards = new Map();
    this.series = new SeriesPage(app, this);
    this.mode = 'grid';          // grid | groups | panel | genre | search | details
    this.cinema = false;
    this.restTimer = null;
    this.infoTimer = null;
    this.previewTimers = [];
    this.previewing = null;
    this.menuShown = false;
    this.panelIds = [];
    this.detailsIds = [];
    this.query = '';

    this.build();
    movieStore.subscribe(() => this.onStoreChanged());
  }

  // ---- the state that belongs to one kind (movies or shows) ----
  static get KIND_FIELDS() { return ['items', 'groups', 'itemsByKey', 'infos', 'loaded', 'loading', 'loadError', 'loadedAt', 'group', 'genre', 'sort', 'shuffle', 'list', 'focused', 'topRow', 'picksCache']; }

  resetKindState() {
    this.items = [];
    this.groups = [];
    this.itemsByKey = new Map();
    this.infos = {};
    this.loaded = false;
    this.loading = false;
    this.loadError = '';
    this.loadedAt = 0;
    this.group = 'CONTINUE';
    this.genre = null;
    this.sort = 'PLAYLIST';
    this.shuffle = null;
    this.list = [];
    this.focused = 0;
    this.topRow = 0;
    this.picksCache = null;
  }

  get isShow() { return this.kind === 'SHOW'; }

  switchKind(kind) {
    if (kind === this.kind) return;
    const saved = {};
    MoviesView.KIND_FIELDS.forEach((f) => { saved[f] = this[f]; });
    this.bags[this.kind] = saved;
    this.kind = kind;
    const bag = this.bags[kind];
    if (bag) MoviesView.KIND_FIELDS.forEach((f) => { this[f] = bag[f]; });
    else this.resetKindState();
    this.stopPreview();
  }

  /** The saved catalogue of one kind, whichever is on screen (Settings lists both kinds' groups) */
  bagOf(kind) {
    if (kind === this.kind) return this;
    return this.bags[kind] || null;
  }

  // Hidden-group keys: films use the provider's group id, shows are marked so the two id ranges cannot meet
  groupKey(id) { return this.isShow ? `SHOW:${id}` : id; }

  findItem(key) {
    const own = this.itemsByKey.get(key);
    if (own) return own;
    for (const bag of Object.values(this.bags)) { const f = bag.itemsByKey && bag.itemsByKey.get(key); if (f) return f; }
    return null;
  }

  // =============================================================== frame
  build() {
    this.root.innerHTML = `
      <div class="mv-layout" id="mv-layout">
        <div class="mv-cinema" id="mv-cinema">
          <div class="mv-cinema-bg" id="mv-cinema-bg"></div>
          <div class="mv-cinema-shade"></div>
          <div class="mv-cinema-text" id="mv-cinema-text"></div>
        </div>
        <div class="mv-bar" id="mv-bar"></div>
        <div class="mv-head" id="mv-head"></div>
        <div class="mv-grid" id="mv-grid"></div>
        <div class="mv-empty" id="mv-empty"></div>
        <div class="mv-groups" id="mv-groups"><div class="mv-groups-title">Groups</div><div class="mv-groups-list" id="mv-groups-list"></div></div>
        <div class="mv-panel" id="mv-panel"></div>
        <div class="mv-genre" id="mv-genre"></div>
        <div class="mv-search" id="mv-search"></div>
        <div class="mv-details" id="mv-details"></div>
      </div>`;
    this.el = {
      layout: this.root.querySelector('#mv-layout'),
      cinema: this.root.querySelector('#mv-cinema'),
      cinemaBg: this.root.querySelector('#mv-cinema-bg'),
      cinemaText: this.root.querySelector('#mv-cinema-text'),
      bar: this.root.querySelector('#mv-bar'),
      head: this.root.querySelector('#mv-head'),
      grid: this.root.querySelector('#mv-grid'),
      empty: this.root.querySelector('#mv-empty'),
      groups: this.root.querySelector('#mv-groups'),
      groupsList: this.root.querySelector('#mv-groups-list'),
      panel: this.root.querySelector('#mv-panel'),
      genre: this.root.querySelector('#mv-genre'),
      search: this.root.querySelector('#mv-search'),
      details: this.root.querySelector('#mv-details')
    };
    this.registerGrid();
    this.renderBar();
  }

  // =============================================================== open / close
  open(kind = 'MOVIE') {
    this.switchKind(kind);
    this.root.classList.add('open');
    document.getElementById('app').classList.add('view-movies');
    this.app.suspendLivePreview();
    this.menuShown = false;
    this.setHeaderShown(false);
    this.autoFocus = true;
    this.ensureLoaded();
    this.refresh(true);
    this.focusGrid();
  }

  close() {
    this.stopPreview();
    this.vod.close(false);
    this.series.close(false);
    this.cancelTimers();
    this.setCinema(false);
    this.root.classList.remove('open');
    document.getElementById('app').classList.remove('view-movies', 'mv-menu');
    this.hideOverlays();
  }

  hideOverlays() {
    this.closeGroups(false);
    this.closePanel(false);
    this.closeGenre(false);
    this.closeSearch(false);
    this.closeDetails(false);
    this.series.close(false);
  }

  setHeaderShown(shown) {
    this.menuShown = shown;
    document.getElementById('app').classList.toggle('mv-menu', shown);
  }

  cancelTimers() {
    clearTimeout(this.restTimer);
    clearTimeout(this.infoTimer);
  }

  // =============================================================== data
  setPlaylist(connection) {
    this.connection = connection || null;
    this.isDemo = !connection;
    this.bags = {};
    this.resetKindState();
    movieStore.setPlaylist(connection ? connection.id : 'demo');
    if (this.root.classList.contains('open')) { this.ensureLoaded(); this.refresh(true); }
  }

  setCatalogue(data) {
    this.groups = data.groups;
    this.items = data.items;
    this.itemsByKey = new Map(this.items.map((i) => [i.key, i]));
    this.loaded = true;
    this.picksCache = null;
    this.infos = {};
    this.items.forEach((i) => { if (i.plot) this.infos[i.key] = { description: i.plot, duration: i.duration, cast: i.cast || '', director: i.director || '' }; });
    // Without anything to continue, open on everything
    if (this.group === 'CONTINUE' && !this.continueItems().length) this.group = 'ALL';
  }

  async ensureLoaded(force = false) {
    if (this.loading) return;
    if (this.isDemo) {
      if (!this.loaded) { this.setCatalogue(this.isShow ? demoSeriesCatalogue() : demoCatalogue()); this.refresh(true); }
      return;
    }
    if (this.loaded && !force) return;
    this.loading = true;
    this.loadError = '';
    const conn = this.connection;
    const kind = this.kind;
    try {
      if (!force) {
        const cached = await readMovieCache(conn.id, kind);
        if (cached && cached.items) {
          this.setCatalogue({ groups: cached.groups, items: cached.items });
          this.loadedAt = cached.at || 0;
          this.refresh(true);
        }
      }
      const age = Date.now() - this.loadedAt;
      if (force || !this.loaded || age > 24 * 3600 * 1000) {
        this.renderEmpty();
        const data = this.isShow ? await loadSeries(conn) : await loadMovies(conn);
        if (this.connection !== conn || this.kind !== kind) { this.loading = false; return; }
        this.setCatalogue(data);
        this.loadedAt = Date.now();
        writeMovieCache(conn.id, data, kind);
        this.refresh(this.root.classList.contains('open'));
      }
    } catch (err) {
      this.loadError = err.message || `Could not load the ${this.isShow ? 'TV shows' : 'films'}.`;
      this.renderEmpty();
    }
    this.loading = false;
    this.renderEmpty();
  }

  /** Downloads one kind's catalogue without showing it (first-time setup), then leaves the view as it was */
  async preload(kind) {
    const prev = this.kind;
    this.switchKind(kind);
    this.loaded = false;
    this.loading = false;
    await this.ensureLoaded(true);
    const result = { items: this.items, groups: this.groups, error: this.loaded ? '' : this.loadError };
    this.switchKind(prev);
    return result;
  }

  async reload() {
    await clearMovieCache(this.connection ? this.connection.id : 'demo');
    this.loaded = false;
    this.infos = {};
    await this.ensureLoaded(true);
  }

  continueItems() {
    const keys = this.isShow ? movieStore.continueShowKeys() : movieStore.continueKeys();
    return keys.map((k) => this.itemsByKey.get(k)).filter((i) => i && !this.isHidden(i));
  }

  // Groups whose names mark them as adult, hidden while Settings > Content > Hide adult categories is on
  adultIds() {
    if (this._adultFor !== this.groups) {
      this._adultFor = this.groups;
      this._adult = new Set(this.groups.filter((g) => isAdultName(g.name)).map((g) => g.id));
    }
    return this._adult;
  }

  isHidden(item) {
    if (movieStore.hidden.has(item.key)) return true;
    const adult = settings.get().hideAdult ? this.adultIds() : null;
    return item.groups.length > 0 && item.groups.every((g) => movieStore.hiddenGroups.has(this.groupKey(g)) || (adult && adult.has(g)));
  }

  visibleItems() {
    const s = settings.get();
    let items = this.items.filter((i) => !this.isHidden(i));
    if (s.onlyMultiSub && !this.isShow) items = items.filter((i) => hasMultiSub(i.name));
    if (s.hideDuplicates) {
      const best = new Map();
      const score = (i) => (hasMultiSub(i.name) ? 10 : 0) + { '4K': 3, FHD: 2, HD: 1 }[qualityBadge(i.name)] || 0;
      items.forEach((i) => {
        const k = duplicateKey(i);
        const cur = best.get(k);
        if (!cur || score(i) > score(cur)) best.set(k, i);
      });
      items = items.filter((i) => best.get(duplicateKey(i)) === i);
    }
    return items;
  }

  groupNames() { return new Map(this.groups.map((g) => [g.id, g.name])); }

  picks() {
    if (!this.picksCache) {
      this.picksCache = pickedForYou({
        items: this.visibleItems(), groups: this.groups, progress: this.isShow ? movieStore.showProgress() : movieStore.progress, library: movieStore.library,
        ratings: movieStore.ratings, infos: this.infos, hidden: movieStore.hidden
      });
    }
    return this.picksCache;
  }

  matchesGenre(item, genre, names) {
    if (genresOf(this.infos[item.key] && this.infos[item.key].genre ? this.infos[item.key].genre : item.genre).includes(genre)) return true;
    return item.groups.some((g) => genresOf(names.get(g) || '').includes(genre));
  }

  computeList() {
    const visible = this.visibleItems();
    const visibleKeys = new Set(visible.map((i) => i.key));
    const names = this.groupNames();
    let list;
    let sortable = true;
    const g = this.group;
    if (g === 'CONTINUE') { list = this.continueItems().filter((i) => visibleKeys.has(i.key)); sortable = false; }
    else if (g === 'PICKS') { list = this.picks(); sortable = false; }
    else if (g === 'RECENT') { list = [...visible].filter((i) => i.added > 0).sort((a, b) => b.added - a.added).slice(0, RECENT_COUNT); sortable = false; }
    else if (g === 'ALL') list = visible;
    else if (g.startsWith('g:')) { const id = g.slice(2); list = visible.filter((i) => i.groups.includes(id)); }
    else list = visible;

    if (this.genre) list = list.filter((i) => this.matchesGenre(i, this.genre, names));

    if (sortable) {
      if (this.sort === 'RATING') list = [...list].sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
      else if (this.sort === 'RECENT') list = [...list].sort((a, b) => b.added - a.added);
      else if (this.sort === 'RANDOM') {
        if (!this.shuffle) this.shuffle = new Map();
        list = [...list].sort((a, b) => this.rank(a.key) - this.rank(b.key));
      }
    }
    return list;
  }

  rank(key) {
    if (!this.shuffle.has(key)) this.shuffle.set(key, Math.random());
    return this.shuffle.get(key);
  }

  groupTitle() {
    if (this.group === 'CONTINUE') return 'Continue watching';
    if (this.group === 'PICKS') return 'Picked for you';
    if (this.group === 'RECENT') return 'Recently added';
    if (this.group === 'ALL') return this.isShow ? 'All shows' : 'All movies';
    return this.app.displayName(this.groupNames().get(this.group.slice(2)) || (this.isShow ? 'TV Shows' : 'Movies'));
  }

  // Everything that depends on the data or the preferences is redrawn here
  refresh(resetFocus = false) {
    if (resetFocus) { this.focused = 0; this.topRow = 0; this.shuffle = null; }
    this.list = this.computeList();
    this.focused = Math.min(this.focused, Math.max(0, this.list.length - 1));
    this.renderBar();
    this.renderHead();
    this.renderGrid(true);
    this.renderEmpty();
    this.scheduleInfo();
    if (this.mode === 'groups') this.renderGroups();
    // The first data arrives after the page opened: give the remote somewhere to be
    if (this.mode === 'grid' && this.root.classList.contains('open') && this.app.isBrowse()) {
      const at = this.nav.currentFocusedId || '';
      if (!at || (this.autoFocus && at.startsWith('mv-bar-') && this.list.length)) this.focusGrid();
      if (this.list.length) this.autoFocus = false;
    }
  }

  onStoreChanged() {
    this.picksCache = null;
    if (!this.root.classList.contains('open')) return;
    const keep = this.list[this.focused];
    this.list = this.computeList();
    const at = keep ? this.list.indexOf(keep) : -1;
    this.focused = at >= 0 ? at : Math.min(this.focused, Math.max(0, this.list.length - 1));
    this.renderGrid(true);
    this.renderHead();
    this.renderEmpty();
  }

  onSettingsChanged(keys) {
    if (keys.some((k) => ['onlyMultiSub', 'hideDuplicates', 'hideCountryNames', 'labelColor', 'moviePreview', 'hideAdult'].includes(k))) {
      this.picksCache = null;
      if (this.root.classList.contains('open')) this.refresh(false);
    }
  }

  // =============================================================== bar
  renderBar() {
    const hadFocus = this.nav.currentFocusedId;
    const s = settings.get();
    const names = this.groupNames();
    const genres = this.availableGenres();
    const bar = this.el.bar;
    const btn = (id, label, on, extra = '') => `<div class="mv-btn${on ? ' on' : ''}" id="${id}" ${extra}>${label}</div>`;
    bar.innerHTML = `
      ${genres.length ? btn('mv-bar-genre', `Genre: ${esc(this.genre || 'All')} <i>▾</i>`, !!this.genre) : ''}
      ${btn('mv-bar-search', 'Search', false)}
      ${btn('mv-bar-sort', 'Sort', this.sort !== 'PLAYLIST')}
      ${btn('mv-bar-filter', 'Filter', (s.onlyMultiSub && !this.isShow) || s.hideDuplicates)}
      <span class="mv-spacer"></span>
      ${btn('mv-bar-quick', ICONS.sliders, false, 'data-icon="1"')}
      ${s.moviePreview !== 'OFF' && !this.isShow ? btn('mv-bar-sound', s.moviePreview === 'SOUND' ? ICONS.speakerOn : ICONS.speakerOff, false, 'data-icon="1"') : ''}`;
    void names;

    const order = [];
    if (genres.length) order.push('mv-bar-genre');
    order.push('mv-bar-search', 'mv-bar-sort', 'mv-bar-filter', 'mv-bar-quick');
    if (s.moviePreview !== 'OFF' && !this.isShow) order.push('mv-bar-sound');
    ['mv-bar-genre', 'mv-bar-search', 'mv-bar-sort', 'mv-bar-filter', 'mv-bar-quick', 'mv-bar-sound'].forEach((id) => this.nav.unregister(id));
    const actions = {
      'mv-bar-genre': () => this.openGenre(),
      'mv-bar-search': () => this.openSearch(),
      'mv-bar-sort': () => this.openSortPanel(),
      'mv-bar-filter': () => this.openFilterPanel(),
      'mv-bar-quick': () => this.openQuick(),
      'mv-bar-sound': () => this.cycleSound()
    };
    order.forEach((id, i) => {
      const el = document.getElementById(id);
      this.nav.register({
        id, el, scope: 'main',
        left: i > 0 ? order[i - 1] : null,
        right: i < order.length - 1 ? order[i + 1] : null,
        up: () => { this.setHeaderShown(true); return 'tab-movies'; },
        down: () => { this.focusGrid(); return null; },
        onFocus: () => { this.cancelTimers(); this.setCinema(false); },
        onSelect: actions[id]
      });
      el.addEventListener('click', () => { this.nav.focus(id); actions[id](); });
    });
    this.barOrder = order;
    // Redrawing the bar must not drop the remote's place
    if (hadFocus && hadFocus.startsWith('mv-bar-') && this.nav.nodes.has(hadFocus) && this.nav.currentFocusedId !== hadFocus) this.nav.focus(hadFocus);
  }

  availableGenres() {
    const names = this.groupNames();
    const found = new Set();
    this.items.forEach((i) => { genresOf(i.genre).forEach((g) => found.add(g)); });
    this.groups.forEach((g) => genresOf(g.name).forEach((x) => found.add(x)));
    return GENRES.map(([n]) => n).filter((n) => found.has(n) && names);
  }

  cycleSound() {
    const next = { SOUND: 'SILENT', SILENT: 'OFF', OFF: 'SOUND' }[settings.get().moviePreview] || 'SOUND';
    settings.update({ moviePreview: next });
    this.app.showToast(`Movie previews: ${{ SOUND: 'with sound', SILENT: 'silent', OFF: 'off' }[next]}`);
    this.renderBar();
    this.nav.focus(next === 'OFF' ? 'mv-bar-quick' : 'mv-bar-sound');
  }

  // =============================================================== header (title + focused film)
  renderHead() {
    const film = this.list[this.focused];
    const count = this.list.length;
    this.el.head.innerHTML = `
      <i class="mv-head-bar"></i>
      <span class="mv-head-title">${esc(this.groupTitle())}</span>
      ${count ? `<span class="mv-head-count">·  ${count}</span>` : ''}
      <span class="mv-spacer"></span>
      ${film ? `<span class="mv-head-film">${esc(displayTitle(film.name))}</span><span class="mv-head-facts">${esc(this.facts(film, false))}</span>` : ''}`;
  }

  facts(film, withLeft = true) {
    const info = this.infos[film.key] || {};
    const progress = this.isShow ? null : movieStore.getProgress(film.key);
    const left = withLeft && progress && progress.duration > 0 && progress.position > 0 && !progress.watched
      ? `${Math.max(1, Math.round((progress.duration - progress.position) / 60000))} min left` : '';
    const rating = parseFloat(info.rating || film.rating);
    return [
      info.year || film.year,
      (info.genre || film.genre || '').split(/[,/]/)[0].trim(),
      runtime(info.duration || film.duration || ''),
      rating > 0 ? `★ ${rating.toFixed(1)}` : '',
      left
    ].filter(Boolean).join('  •  ');
  }

  // =============================================================== grid
  registerGrid() {
    this.nav.register({
      id: 'mv-grid', el: this.el.grid, scope: 'main',
      left: () => {
        if (this.focused % COLUMNS === 0) { this.openGroups(); return null; }
        this.moveFocus(this.focused - 1);
        return null;
      },
      right: () => {
        if (this.focused % COLUMNS < COLUMNS - 1 && this.focused + 1 < this.list.length) this.moveFocus(this.focused + 1);
        return null;
      },
      up: () => {
        if (this.cinema) { this.setCinema(false); return null; }
        if (this.focused < COLUMNS) { this.focusBar(); return null; }
        this.moveFocus(this.focused - COLUMNS);
        return null;
      },
      down: () => {
        if (this.cinema) { this.setCinema(false); return null; }
        const next = this.focused + COLUMNS;
        if (next < this.list.length) this.moveFocus(next);
        else if (Math.floor(this.focused / COLUMNS) < Math.floor((this.list.length - 1) / COLUMNS)) this.moveFocus(this.list.length - 1);
        return null;
      },
      onFocus: () => { this.renderGrid(false); this.armRest(); },
      onBlur: () => { this.renderGrid(false); this.cancelTimers(); },
      onSelect: () => { const f = this.list[this.focused]; if (f) this.openDetails(f); },
      onHoldSelect: () => { const f = this.list[this.focused]; if (f) this.openCardMenu(f); }
    });
  }

  focusGrid() {
    if (!this.list.length) { this.focusBar(); return; }
    this.nav.focus('mv-grid');
  }

  focusBar() {
    this.nav.focus(this.barOrder && this.barOrder.length ? this.barOrder[0] : 'mv-bar-search');
  }

  moveFocus(index) {
    this.focused = Math.max(0, Math.min(this.list.length - 1, index));
    this.setCinema(false);
    this.stopPreview();
    this.renderGrid(false);
    this.renderHead();
    this.armRest();
    this.scheduleInfo();
  }

  // The posters around the focus only; a library can hold tens of thousands of films
  renderGrid(forceRebuild) {
    const grid = this.el.grid;
    const list = this.list;
    const row = Math.floor(this.focused / COLUMNS);
    if (row < this.topRow) this.topRow = row;
    else if (row > this.topRow + 1) this.topRow = row - 1;
    if (this.cinema) this.topRow = row;

    const firstRow = Math.max(0, this.topRow - 1);
    const lastRow = this.topRow + 3;
    const from = firstRow * COLUMNS;
    const to = Math.min(list.length, (lastRow + 1) * COLUMNS);
    const hasFocus = this.nav.currentFocusedId === 'mv-grid';

    if (forceRebuild) { grid.innerHTML = ''; this.cards.clear(); }
    for (const [i, el] of this.cards) {
      if (i < from || i >= to) { el.remove(); this.cards.delete(i); }
    }
    const top0 = this.cinema ? CINEMA_TOP : GRID_TOP;
    for (let i = from; i < to; i++) {
      let el = this.cards.get(i);
      if (!el) { el = this.buildCard(list[i], i); grid.appendChild(el); this.cards.set(i, el); }
      const r = Math.floor(i / COLUMNS);
      el.style.left = `${GRID_X + (i % COLUMNS) * (CARD_W + GAP)}px`;
      el.style.top = `${top0 + (r - this.topRow) * ROW_PITCH}px`;
      const active = i === this.focused;
      el.classList.toggle('focused', active && hasFocus);
      el.classList.toggle('current', active);
      el.classList.toggle('dim', this.cinema && r !== row);
      setMarquee(el, active && hasFocus);
    }
  }

  buildCard(film, index) {
    const el = document.createElement('div');
    el.className = 'mv-card';
    const progress = this.isShow ? null : movieStore.getProgress(film.key);
    const pct = progress && progress.duration > 0 && progress.position > 0 && !progress.watched ? Math.min(100, (progress.position / progress.duration) * 100) : 0;
    el.innerHTML = `
      <div class="mv-card-art"></div>
      ${hasMultiSub(film.name) ? '<span class="mv-cc">CC</span>' : ''}
      ${!this.isShow && movieStore.isWatched(film.key) ? '<span class="mv-watched">✓</span>' : ''}
      <div class="mv-card-band"><span><em></em></span></div>
      ${pct ? `<i class="mv-card-progress" style="width:${pct}%"></i>` : ''}`;
    el.querySelector('.mv-card-band em').textContent = displayTitle(film.name);
    this.fillPoster(el.querySelector('.mv-card-art'), film);
    el.addEventListener('click', () => { this.focused = index; this.nav.focus('mv-grid'); this.openDetails(film); });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); this.openCardMenu(film); });
    return el;
  }

  fillPoster(box, film) {
    const initials = () => {
      box.innerHTML = '<span></span>';
      box.querySelector('span').textContent = displayTitle(film.name).slice(0, 2).toUpperCase();
    };
    if (!film.image) { initials(); return; }
    const img = document.createElement('img');
    img.referrerPolicy = 'no-referrer';
    img.loading = 'lazy';
    img.alt = '';
    img.onerror = initials;
    img.src = film.image;
    box.appendChild(img);
  }

  renderEmpty() {
    const el = this.el.empty;
    let text = '';
    const things = this.isShow ? 'shows' : 'films';
    if (this.loading && !this.items.length) text = `Loading ${this.isShow ? 'TV shows' : 'films'}…`;
    else if (this.loadError && !this.items.length) text = this.loadError;
    else if (!this.list.length) {
      if (this.group === 'CONTINUE') text = `Nothing to continue yet. ${this.isShow ? 'Shows' : 'Films'} you start appear here.`;
      else if (this.group === 'PICKS') text = `Watch, like or save a few ${things} and picks for you appear here.`;
      else if (this.genre || this.sort !== 'PLAYLIST') text = `No ${things} match. Try another genre or group.`;
      else text = `No ${things} in this group.`;
    }
    el.textContent = text;
    el.style.display = text ? 'block' : 'none';
  }

  // =============================================================== resting on a poster: details, hero, preview
  armRest() {
    clearTimeout(this.restTimer);
    if (this.mode !== 'grid' || !this.list.length) return;
    this.restTimer = setTimeout(() => {
      if (this.nav.currentFocusedId !== 'mv-grid' || this.mode !== 'grid') return;
      this.setCinema(true);
    }, REST_MS);
  }

  scheduleInfo() {
    clearTimeout(this.infoTimer);
    const film = this.list[this.focused];
    if (!film || this.infos[film.key] && this.infos[film.key].loaded) return;
    this.infoTimer = setTimeout(() => this.loadInfo(film), 250);
  }

  async loadInfo(film) {
    if (this.infos[film.key] && this.infos[film.key].loaded) return this.infos[film.key];
    if (this.isShow && this.isDemo) { this.infos[film.key] = { ...(this.infos[film.key] || {}), episodes: film.demoEpisodes || [], loaded: true }; return this.infos[film.key]; }
    if (this.isDemo || !this.connection) return (this.infos[film.key] = { ...(this.infos[film.key] || {}), loaded: true });
    try {
      const info = this.isShow ? await loadSeriesInfo(this.connection, film) : await loadMovieInfo(this.connection, film);
      this.infos[film.key] = { ...info, loaded: true };
    } catch (e) {
      this.infos[film.key] = { ...(this.infos[film.key] || {}), loaded: true };
    }
    if (this.list[this.focused] === film) { this.renderHead(); if (this.cinema) this.renderCinemaText(film); }
    if (this.detailsFilm === film && this.mode === 'details') this.renderDetails(film, true);
    if (this.series.show === film && this.mode === 'series') this.series.refresh();
    return this.infos[film.key];
  }

  setCinema(on) {
    if (on === this.cinema) return;
    this.cinema = on;
    this.el.layout.classList.toggle('cinema', on);
    if (on) {
      const film = this.list[this.focused];
      if (!film) { this.cinema = false; this.el.layout.classList.remove('cinema'); return; }
      this.renderCinemaText(film);
      this.startPreviewSoon(film);
    } else {
      this.stopPreview();
    }
    this.renderGrid(false);
  }

  renderCinemaText(film) {
    const info = this.infos[film.key] || {};
    const progress = movieStore.getProgress(film.key);
    const started = this.isShow ? this.showStarted(film) : movieStore.isStarted(film.key);
    const plot = (info.description || film.plot || '').trim();
    this.el.cinemaBg.style.backgroundImage = `url("${info.backdrop || film.backdrop || info.image || film.image}")`;
    this.el.cinemaText.innerHTML = `
      <div class="mv-cin-group">${esc(this.groupTitle().toUpperCase())}</div>
      <div class="mv-cin-title">${esc(displayTitle(film.name))}</div>
      <div class="mv-cin-facts">${esc(this.facts(film, true))}</div>
      ${plot ? `<div class="mv-cin-plot">${esc(plot)}</div>` : ''}
      <div class="mv-cin-actions">
        <span class="mv-band"><b>OK</b>${started ? 'Resume' : (this.isShow ? 'Open' : 'Watch now')}</span>
        <b class="mv-keycap">Hold OK</b><span class="mv-cin-opt">Options</span>
      </div>`;
  }

  // ---- the stretch of the film that plays behind the hero ----
  startPreviewSoon(film) {
    this.stopPreview();
    const mode = settings.get().moviePreview;
    if (this.isShow || mode === 'OFF' || !this.connection && !film.url) return;
    this.previewing = film;
    this.previewTimers.push(setTimeout(() => this.startPreview(film), PREVIEW_DELAY));
  }

  startPreview(film) {
    if (this.previewing !== film || !this.cinema) return;
    const url = film.url || movieUrl(this.connection, film);
    const video = document.getElementById('avplay-html5-fallback');
    this.previewUnsub = player.subscribe((event, data) => {
      if (event === 'durationChange' && this.previewing === film && !this.previewSeeked && data > 0) {
        this.previewSeeked = true;
        player.seekTo(Math.floor(data * (0.35 + Math.random() * 0.3)));
      }
      if (event === 'buffering' && data === false && this.previewSeeked && this.previewing === film) this.showPreview(true);
    });
    this.previewSeeked = false;
    if (video) {
      video.volume = settings.get().moviePreview === 'SOUND' ? 0.5 : 0;
      video.muted = settings.get().moviePreview !== 'SOUND';
      video.addEventListener('loadedmetadata', this.onMeta = () => {
        if (this.previewing !== film || this.previewSeeked || !(video.duration > 0)) return;
        this.previewSeeked = true;
        video.currentTime = video.duration * (0.35 + Math.random() * 0.3);
      }, { once: true });
      video.addEventListener('playing', this.onPlaying = () => { if (this.previewSeeked && this.previewing === film) this.showPreview(true); }, { once: true });
    }
    player.play(url, false);
    this.previewTimers.push(setTimeout(() => this.stopPreview(), PREVIEW_PLAY + 4000));
  }

  showPreview(show) {
    if (player.hasNativeAvplay) player.setRect(0, 0, 1920, 1080);
    this.app.setVideoHole(show ? 'full' : null);
    const video = document.getElementById('avplay-html5-fallback');
    if (video) {
      Object.assign(video.style, { position: 'fixed', ...this.app.fullVideoBox(), zIndex: '0', objectFit: 'cover', transform: 'none', visibility: show ? 'visible' : 'hidden' });
    }
    this.el.cinema.classList.toggle('playing', show);
  }

  stopPreview() {
    this.previewTimers.forEach(clearTimeout);
    this.previewTimers = [];
    if (this.previewUnsub) { this.previewUnsub(); this.previewUnsub = null; }
    const video = document.getElementById('avplay-html5-fallback');
    if (video) {
      if (this.onMeta) video.removeEventListener('loadedmetadata', this.onMeta);
      if (this.onPlaying) video.removeEventListener('playing', this.onPlaying);
      video.muted = false;
      video.volume = 1;
    }
    this.onMeta = this.onPlaying = null;
    if (this.previewing) { this.previewing = null; player.stop(); }
    this.el.cinema.classList.remove('playing');
    this.app.setVideoHole(null);
    if (video) video.style.visibility = 'hidden';
  }

  // =============================================================== groups panel
  groupEntries() {
    const visible = this.visibleItems();
    const inGroup = (id) => visible.filter((i) => i.groups.includes(id)).length;
    const entries = [
      { id: 'CONTINUE', name: 'Continue watching', glyph: 'reel', count: this.continueItems().length },
      { id: 'PICKS', name: 'Picked for you', glyph: 'star', count: this.picks().length },
      { id: 'RECENT', name: 'Recently added', glyph: 'sparkles', count: Math.min(RECENT_COUNT, visible.filter((i) => i.added > 0).length) },
      { id: 'ALL', name: this.isShow ? 'All shows' : 'All movies', glyph: 'grid', count: visible.length, divider: true }
    ];
    this.groups.forEach((g, i) => {
      if (movieStore.hiddenGroups.has(this.groupKey(g.id))) return;
      const count = inGroup(g.id);
      if (!count) return;
      entries.push({ id: `g:${g.id}`, name: this.app.displayName(g.name), glyph: glyphFor(g.name), flag: countryOf(g.name), count, divider: i === 0 || undefined, raw: g.name });
    });
    const firstProvider = entries.findIndex((e) => e.id.startsWith('g:'));
    entries.forEach((e, i) => { e.divider = e.id === 'ALL' || i === firstProvider; });
    return entries;
  }

  openGroups() {
    this.mode = 'groups';
    this.pendingGroup = this.group;
    this.cancelTimers();
    this.setCinema(false);
    this.el.groups.classList.add('open');
    this.renderGroups();
    const idx = this.groupList.findIndex((g) => g.id === this.group);
    this.nav.focus(`mv-grp-${Math.max(0, idx)}`);
  }

  renderGroups() {
    this.groupIds && this.groupIds.forEach((id) => this.nav.unregister(id));
    this.groupList = this.groupEntries();
    const list = this.el.groupsList;
    list.innerHTML = '';
    this.groupIds = [];
    this.groupList.forEach((g, i) => {
      if (g.divider) { const hr = document.createElement('div'); hr.className = 'mv-grp-rule'; list.appendChild(hr); }
      const row = document.createElement('div');
      row.className = `mv-grp${g.id === this.group ? ' selected' : ''}`;
      row.innerHTML = `<span class="mv-glyph">${g.flag ? flagHtml(g.flag) : glyphHtml(g.glyph)}</span><span class="mv-grp-name"></span><span class="mv-grp-count">${g.count == null ? '' : g.count}</span>`;
      row.querySelector('.mv-grp-name').textContent = g.name;
      list.appendChild(row);
      const id = `mv-grp-${i}`;
      this.groupIds.push(id);
      this.nav.register({
        id, el: row, scope: 'main',
        left: null,
        right: () => { this.closeGroups(true); return null; },
        up: i > 0 ? `mv-grp-${i - 1}` : null,
        down: i < this.groupList.length - 1 ? `mv-grp-${i + 1}` : null,
        onFocus: () => {
          // The grid follows the focus a moment later
          clearTimeout(this.groupTimer);
          this.groupTimer = setTimeout(() => { if (this.mode === 'groups') { this.selectGroup(g.id); } }, 140);
          this.scrollGroups(i);
        },
        onSelect: () => this.closeGroups(true)
      });
      row.addEventListener('click', () => { this.nav.focus(id); this.selectGroup(g.id); this.closeGroups(true); });
    });
  }

  scrollGroups(i) {
    const list = this.el.groupsList;
    const row = list.children[0] ? list.querySelectorAll('.mv-grp')[i] : null;
    if (!row) return;
    const target = row.offsetTop - 360;
    list.scrollTop = Math.max(0, target);
  }

  selectGroup(id) {
    if (this.group === id) return;
    this.group = id;
    this.genre = this.genre; // a genre keeps applying across groups
    this.shuffle = null;
    this.focused = 0;
    this.topRow = 0;
    this.list = this.computeList();
    this.renderBar();
    this.renderHead();
    this.renderGrid(true);
    this.renderEmpty();
    this.groupList.forEach((g, i) => this.el.groupsList.querySelectorAll('.mv-grp')[i] && this.el.groupsList.querySelectorAll('.mv-grp')[i].classList.toggle('selected', g.id === id));
  }

  closeGroups(focusGrid) {
    clearTimeout(this.groupTimer);
    if (!this.el.groups.classList.contains('open')) return;
    this.el.groups.classList.remove('open');
    this.groupIds && this.groupIds.forEach((id) => this.nav.unregister(id));
    this.groupIds = [];
    this.mode = 'grid';
    if (focusGrid) this.focusGrid();
  }

  // =============================================================== drop-down panels (sort, filter, quick settings)
  openPanel(anchorId, items, { width = 330 } = {}) {
    this.closePanel(false);
    const anchor = document.getElementById(anchorId);
    const rect = anchor ? anchor.getBoundingClientRect() : { left: 40, top: 48, bottom: 96, right: 300 };
    const panel = this.el.panel;
    panel.style.left = `${Math.max(20, Math.min(1900 - width, rect.right - width))}px`;
    panel.style.top = `${rect.bottom + 8}px`;
    panel.style.width = `${width}px`;
    panel.innerHTML = '';
    this.mode = 'panel';
    this.panelReturn = anchorId;
    this.nav.setScope('mvpanel');
    this.panelIds = [];
    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = `mv-panel-item${item.on ? ' on' : ''}`;
      el.textContent = item.label;
      panel.appendChild(el);
      const id = `mv-pnl-${i}`;
      this.panelIds.push(id);
      this.nav.register({
        id, el, scope: 'mvpanel', left: null, right: null,
        up: i > 0 ? `mv-pnl-${i - 1}` : null,
        down: i < items.length - 1 ? `mv-pnl-${i + 1}` : null,
        onSelect: () => { item.action(); if (item.close !== false) this.closePanel(true); else { el.classList.toggle('on', item.toggled ? item.toggled() : false); el.textContent = item.label; } }
      });
      el.addEventListener('click', () => { this.nav.focus(id); item.action(); if (item.close !== false) this.closePanel(true); });
    });
    panel.classList.add('open');
    const first = Math.max(0, items.findIndex((x) => x.focus));
    this.nav.focus(`mv-pnl-${first}`);
  }

  closePanel(refocus) {
    if (!this.el.panel.classList.contains('open')) return;
    this.el.panel.classList.remove('open');
    this.panelIds.forEach((id) => this.nav.unregister(id));
    this.panelIds = [];
    this.nav.setScope('main');
    this.mode = 'grid';
    if (refocus && this.panelReturn && this.nav.nodes.has(this.panelReturn)) this.nav.focus(this.panelReturn);
  }

  openSortPanel() {
    this.openPanel('mv-bar-sort', SORTS.map(([key, label]) => ({
      label, on: this.sort === key, focus: this.sort === key,
      action: () => { this.sort = key; this.shuffle = null; this.refresh(true); this.renderBar(); }
    })), { width: 330 });
  }

  openFilterPanel() {
    const s = settings.get();
    const items = [
      !this.isShow && { key: 'onlyMultiSub', label: 'Multi-sub films only' },
      { key: 'hideDuplicates', label: 'Hide duplicates' }
    ].filter(Boolean).map(({ key, label }, i) => {
      const fmt = () => `${settings.get()[key] ? '✓  ' : '     '}${label}`;
      return { label: fmt(), on: s[key], focus: i === 0, close: false, toggled: () => settings.get()[key], action: () => { settings.update({ [key]: !settings.get()[key] }); items[i].label = fmt(); } };
    });
    this.openPanel('mv-bar-filter', items, { width: 400 });
  }

  openQuick() {
    const s = settings.get();
    const mk = (label, field) => {
      const fmt = () => `${settings.get()[field] ? '✓  ' : '     '}${label}`;
      const it = { label: fmt(), on: s[field], close: false, toggled: () => settings.get()[field], action: () => { settings.update({ [field]: !settings.get()[field] }); it.label = fmt(); } };
      return it;
    };
    const refresh = { label: `     ${this.isShow ? 'Refresh TV shows now' : 'Refresh films now'}`, action: () => { this.app.showToast(this.isShow ? 'Refreshing TV shows…' : 'Refreshing films…'); this.reload(); } };
    this.openPanel('mv-bar-quick', [...(this.isShow ? [] : [mk('Multi-sub films only', 'onlyMultiSub')]), mk('Hide duplicates', 'hideDuplicates'), mk('Hide country names', 'hideCountryNames'), refresh], { width: 470 });
  }

  // =============================================================== genre sheet
  openGenre() {
    this.closePanel(false);
    const genres = ['All genres', ...this.availableGenres()];
    const sheet = this.el.genre;
    sheet.innerHTML = `<div class="mv-genre-head"><span>Browse by genre</span><span class="mv-genre-hint"><b class="mv-keycap">Back</b> to close</span></div><div class="mv-genre-grid"></div>`;
    const grid = sheet.querySelector('.mv-genre-grid');
    this.mode = 'genre';
    this.nav.setScope('mvgenre');
    this.genreIds = [];
    genres.forEach((name, i) => {
      const value = i === 0 ? null : name;
      const el = document.createElement('div');
      el.className = 'mv-genre-tile';
      el.style.background = i === 0 ? '#262a33' : `hsl(${(i * 37) % 360}, 45%, 24%)`;
      el.innerHTML = `<span></span>${value === this.genre ? '<em>SHOWING</em>' : ''}`;
      el.querySelector('span').textContent = name;
      grid.appendChild(el);
      const id = `mv-gen-${i}`;
      this.genreIds.push(id);
      const cols = 5;
      this.nav.register({
        id, el, scope: 'mvgenre',
        left: i % cols > 0 ? `mv-gen-${i - 1}` : null,
        right: i % cols < cols - 1 && i + 1 < genres.length ? `mv-gen-${i + 1}` : null,
        up: i - cols >= 0 ? `mv-gen-${i - cols}` : null,
        down: i + cols < genres.length ? `mv-gen-${i + cols}` : null,
        onSelect: () => { this.genre = value; this.closeGenre(true); this.refresh(true); }
      });
      el.addEventListener('click', () => { this.genre = value; this.closeGenre(true); this.refresh(true); });
    });
    sheet.classList.add('open');
    const at = Math.max(0, genres.findIndex((n, i) => (i === 0 ? null : n) === this.genre));
    this.nav.focus(`mv-gen-${at}`);
  }

  closeGenre(refocus) {
    if (!this.el.genre.classList.contains('open')) return;
    this.el.genre.classList.remove('open');
    (this.genreIds || []).forEach((id) => this.nav.unregister(id));
    this.genreIds = [];
    this.nav.setScope('main');
    this.mode = 'grid';
    if (refocus) this.focusBar();
  }

  // =============================================================== film options (hold OK on a poster)
  openCardMenu(film) {
    const app = this.app;
    const saved = movieStore.inLibrary(film.key);
    const watched = movieStore.isWatched(film.key);
    const items = [{ label: saved ? 'Remove from My List' : 'Watch later', action: () => movieStore.toggleLibrary(film.key) }];
    // A show is watched episode by episode, so only a film is marked whole
    if (!this.isShow) items.push({ label: watched ? 'Mark as not watched' : 'Mark as watched', action: () => movieStore.markWatched(film.key, !watched) });
    if (!this.isShow && movieStore.isStarted(film.key)) items.push({ label: 'Start from the beginning', action: () => this.play(film, true) });
    items.push({ label: 'Hide this title', action: () => { this.focused = Math.max(0, Math.min(this.focused, this.list.length - 2)); movieStore.hide(film.key); app.showToast(`Title hidden. Settings > Content > ${this.isShow ? 'Hidden shows' : 'Hidden films'} brings it back.`); } });
    app.openDialog(displayTitle(film.name), items);
  }

  // =============================================================== search
  openSearch() {
    this.mode = 'search';
    this.query = '';
    this.nav.setScope('mvsearch');
    this.cancelTimers();
    this.setCinema(false);
    const root = this.el.search;
    const keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
    root.innerHTML = `
      <div class="mv-sr-left">
        <div class="mv-sr-input"><span id="mv-sr-text">${this.isShow ? 'Search TV shows' : 'Search movies'}</span></div>
        <div class="mv-sr-keys" id="mv-sr-keys"></div>
      </div>
      <div class="mv-sr-right"><div class="mv-sr-label" id="mv-sr-label"></div><div class="mv-sr-results" id="mv-sr-results"></div></div>`;
    const wrap = root.querySelector('#mv-sr-keys');
    this.searchIds = [];
    const cols = 6;
    const defs = keys.map((k) => ({ label: k, run: () => this.typeSearch(k) }));
    defs.push({ label: 'space', wide: 3, run: () => this.typeSearch(' ') }, { label: '⌫', wide: 3, run: () => { this.query = this.query.slice(0, -1); this.updateSearch(); } });
    let col = 0; let row = 0;
    const layout = [];
    defs.forEach((d) => {
      const span = d.wide || 1;
      if (col + span > cols) { col = 0; row++; }
      layout.push({ ...d, col, row, span });
      col += span;
    });
    layout.forEach((d, i) => {
      const el = document.createElement('div');
      el.className = 'mv-key';
      el.style.gridColumn = `${d.col + 1} / span ${d.span}`;
      el.style.gridRow = String(d.row + 1);
      el.textContent = d.label;
      wrap.appendChild(el);
      const id = `mv-key-${i}`;
      this.searchIds.push(id);
      const at = (c, r) => { const j = layout.findIndex((x) => x.row === r && c >= x.col && c < x.col + x.span); return j >= 0 ? `mv-key-${j}` : null; };
      this.nav.register({
        id, el, scope: 'mvsearch',
        left: () => (d.col > 0 ? at(d.col - 1, d.row) : null),
        right: () => (d.col + d.span < cols ? at(d.col + d.span, d.row) : this.firstResultId()),
        up: () => (d.row > 0 ? at(d.col, d.row - 1) : null),
        down: () => at(d.col, d.row + 1),
        onSelect: d.run
      });
      el.addEventListener('click', () => { this.nav.focus(id); d.run(); });
    });
    root.classList.add('open');
    this.updateSearch();
    this.nav.focus('mv-key-0');
  }

  typeSearch(ch) {
    if (this.query.length >= 40) return;
    if (ch === ' ' && (!this.query || this.query.endsWith(' '))) return;
    this.query += ch.toLowerCase();
    this.updateSearch();
  }

  searchResults() {
    const norm = (s) => s.normalize('NFD').replace(/\p{Mn}+/gu, '').toLowerCase();
    const q = norm(this.query).trim();
    const visible = this.visibleItems();
    if (!q) return { label: 'Suggestions', items: [...visible].filter((i) => i.added > 0).sort((a, b) => b.added - a.added).slice(0, 12) };
    const words = q.split(/\s+/);
    const hits = visible.filter((i) => { const t = norm(displayTitle(i.name)); return words.every((w) => t.includes(w)); })
      .sort((a, b) => { const ta = norm(displayTitle(a.name)); const tb = norm(displayTitle(b.name)); return (ta.startsWith(q) ? 0 : 1) - (tb.startsWith(q) ? 0 : 1) || ta.length - tb.length; })
      .slice(0, 40);
    return { label: hits.length ? `Results for “${this.query.trim()}”` : `No matches for “${this.query.trim()}”`, items: hits };
  }

  firstResultId() { return this.resultIds && this.resultIds.length ? this.resultIds[0] : null; }

  updateSearch() {
    document.getElementById('mv-sr-text').textContent = this.query || (this.isShow ? 'Search TV shows' : 'Search movies');
    document.getElementById('mv-sr-text').classList.toggle('empty', !this.query);
    const { label, items } = this.searchResults();
    document.getElementById('mv-sr-label').textContent = label;
    const box = document.getElementById('mv-sr-results');
    (this.resultIds || []).forEach((id) => this.nav.unregister(id));
    this.resultIds = [];
    box.innerHTML = '';
    const cols = 4;
    items.forEach((film, i) => {
      const el = document.createElement('div');
      el.className = 'mv-card mv-sr-card';
      el.innerHTML = '<div class="mv-card-art"></div><div class="mv-card-band"><span><em></em></span></div>';
      el.querySelector('.mv-card-band em').textContent = displayTitle(film.name);
      this.fillPoster(el.querySelector('.mv-card-art'), film);
      box.appendChild(el);
      const id = `mv-res-${i}`;
      this.resultIds.push(id);
      this.nav.register({
        id, el, scope: 'mvsearch',
        left: () => (i % cols === 0 ? 'mv-key-5' : `mv-res-${i - 1}`),
        right: i % cols < cols - 1 && i + 1 < items.length ? `mv-res-${i + 1}` : null,
        up: i - cols >= 0 ? `mv-res-${i - cols}` : null,
        down: i + cols < items.length ? `mv-res-${i + cols}` : null,
        onFocus: () => { const top = el.offsetTop; box.scrollTop = Math.max(0, top - 20); },
        onSelect: () => this.openDetails(film)
      });
      el.addEventListener('click', () => { this.nav.focus(id); this.openDetails(film); });
    });
  }

  closeSearch(refocus) {
    if (!this.el.search.classList.contains('open')) return;
    this.el.search.classList.remove('open');
    (this.searchIds || []).forEach((id) => this.nav.unregister(id));
    (this.resultIds || []).forEach((id) => this.nav.unregister(id));
    this.searchIds = []; this.resultIds = [];
    this.nav.setScope('main');
    this.mode = 'grid';
    if (refocus) this.nav.focus('mv-bar-search');
  }

  // =============================================================== the film's own page
  openDetails(film) {
    if (this.isShow) { this.cancelTimers(); this.stopPreview(); this.setCinema(false); this.detailsFrom = this.mode; this.series.open(film); return; }
    this.cancelTimers();
    this.stopPreview();
    this.setCinema(false);
    this.detailsFilm = film;
    this.detailsFrom = this.mode;
    this.mode = 'details';
    this.nav.setScope('mvdetails');
    this.el.details.classList.add('open');
    this.renderDetails(film, false);
    this.loadInfo(film);
  }

  renderDetails(film, keepFocus) {
    const info = this.infos[film.key] || {};
    const merged = {
      ...film,
      description: info.description || film.plot || '',
      backdrop: info.backdrop || film.backdrop,
      image: info.image || film.image,
      year: info.year || film.year,
      genre: info.genre || film.genre,
      duration: info.duration || film.duration,
      rating: info.rating || film.rating,
      cast: info.cast || '',
      director: info.director || ''
    };
    const progress = movieStore.getProgress(film.key);
    const started = movieStore.isStarted(film.key);
    const watched = movieStore.isWatched(film.key);
    const saved = movieStore.inLibrary(film.key);
    const rating = movieStore.rating(film.key);
    const kind = titleKindFor(merged.genre);
    const title = displayTitle(film.name);
    const shown = kind === 'playful' ? title : title.toUpperCase();
    // The size follows the length, so a long title wraps over a few lines instead of running wide
    const base = title.length <= 12 ? 128 : title.length <= 26 ? 96 : 76;
    const titleSize = Math.round(base * ({ action: 1.1, scifi: 0.85, playful: 1.15, factual: 0.9, dread: 0.9 }[kind] || 1));
    const left = started && progress && progress.duration > 0 ? ` • ${Math.max(1, Math.round((progress.duration - progress.position) / 60000))}m left` : '';
    const q = qualityBadge(film.name);
    const rate = parseFloat(merged.rating);
    const meta = [merged.year, merged.genre, runtime(merged.duration), rate > 0 ? `★ ${rate.toFixed(1)}` : '', watched ? 'Watched' : ''].filter(Boolean).join(' • ');
    const credits = [merged.cast && ['STARRING', merged.cast], merged.director && ['DIRECTED BY', merged.director]].filter(Boolean);
    const buttons = [
      { id: 'play', cls: 'band', label: `${started ? 'Resume' : 'Play'}${left}`, hint: '', run: () => this.play(film, false) },
      started && { id: 'restart', icon: ICONS.restart, hint: 'Start from the beginning', run: () => this.play(film, true) },
      { id: 'save', icon: saved ? ICONS.save : ICONS.saveOutline, on: saved, accent: true, hint: saved ? 'Remove from My List' : 'Watch later', run: () => movieStore.toggleLibrary(film.key) },
      { id: 'like', icon: ICONS.up, on: rating > 0, hint: rating > 0 ? 'Liked' : 'Like', run: () => movieStore.rate(film.key, 1) },
      { id: 'dislike', icon: ICONS.down, on: rating < 0, hint: rating < 0 ? 'Disliked' : 'Dislike', run: () => movieStore.rate(film.key, -1) },
      { id: 'watched', icon: ICONS.tick, on: watched, hint: watched ? 'Mark as not watched' : 'Mark as watched', run: () => movieStore.markWatched(film.key, !watched) },
      { id: 'hide', icon: ICONS.hide, hint: 'Hide this film', run: () => { movieStore.hide(film.key); this.closeDetails(true); } }
    ].filter(Boolean);

    this.detailsButtons = buttons;
    const d = this.el.details;
    d.innerHTML = `
      <div class="mv-d-art"><div class="mv-d-img"></div><i class="mv-d-shade-l"></i><i class="mv-d-shade-b"></i></div>
      <div class="mv-d-title kind-${kind}" style="font-size:${titleSize}px">${esc(shown)}</div>
      <div class="mv-d-info">
        <div class="mv-d-meta">${q ? `<b class="mv-badge">${q}</b>` : ''}<span>${esc(meta)}</span></div>
        <div class="mv-d-plot">${esc(merged.description || (this.infos[film.key] && this.infos[film.key].loaded ? '' : 'Loading details…'))}</div>
        <div class="mv-d-buttons">${buttons.map((b) => (b.cls === 'band'
          ? `<span class="mv-d-play" data-b="${b.id}">${esc(b.label)}</span>`
          : `<span class="mv-d-round${b.on ? ' on' : ''}${b.accent && b.on ? ' accent' : ''}" data-b="${b.id}">${b.icon}</span>`)).join('')}</div>
        <div class="mv-d-hint" id="mv-d-hint"></div>
      </div>
      <div class="mv-d-credits">${credits.map(([k, v]) => `<div class="mv-d-credit"><em>${k}</em><span>${esc(v)}</span></div>`).join('')}</div>`;
    d.querySelector('.mv-d-img').style.backgroundImage = `url("${merged.backdrop || merged.image}")`;

    const previous = keepFocus ? this.nav.currentFocusedId : null;
    (this.detailsIds || []).forEach((id) => this.nav.unregister(id));
    this.detailsIds = [];
    const els = d.querySelectorAll('[data-b]');
    buttons.forEach((b, i) => {
      const id = `mv-det-${i}`;
      this.detailsIds.push(id);
      this.nav.register({
        id, el: els[i], scope: 'mvdetails',
        left: i > 0 ? `mv-det-${i - 1}` : null,
        right: i < buttons.length - 1 ? `mv-det-${i + 1}` : null,
        up: null, down: null,
        onFocus: () => { document.getElementById('mv-d-hint').textContent = b.hint; },
        onSelect: () => { b.run(); if (this.mode === 'details') this.renderDetails(film, true); }
      });
      els[i].addEventListener('click', () => { this.nav.focus(id); b.run(); if (this.mode === 'details') this.renderDetails(film, true); });
    });
    const keep = previous && this.nav.nodes.has(previous) ? previous : 'mv-det-0';
    this.nav.focus(keep);
  }

  closeDetails(refocus) {
    if (!this.el.details.classList.contains('open')) return;
    this.el.details.classList.remove('open');
    (this.detailsIds || []).forEach((id) => this.nav.unregister(id));
    this.detailsIds = [];
    this.nav.setScope('main');
    const back = this.detailsFrom === 'search' && this.el.search.classList.contains('open');
    if (back) { this.mode = 'search'; this.nav.setScope('mvsearch'); this.nav.focus(this.firstResultId() || 'mv-key-0'); return; }
    this.mode = 'grid';
    if (refocus) {
      this.list = this.computeList();
      this.focused = Math.min(this.focused, Math.max(0, this.list.length - 1));
      this.renderGrid(true);
      this.renderHead();
      this.renderEmpty();
      this.focusGrid();
    }
  }

  // A show is started when one of its episodes was begun, or when any was watched
  showStarted(show) {
    return movieStore.continueShowKeys().includes(show.key);
  }

  // =============================================================== playing
  play(film, fromStart) {
    const url = film.url || movieUrl(this.connection, film);
    const progress = movieStore.getProgress(film.key);
    const resume = !fromStart && movieStore.isStarted(film.key) && progress ? progress.position : 0;
    this.stopPreview();
    this.vod.open(film, url, resume);
  }

  // Back from the film player returns to the page it was started from
  // Back from a show's episode returns to the show's page
  afterPlayer(film) {
    this.picksCache = null;
    if (this.mode === 'series') { this.series.refresh(true); return; }
    if (this.mode === 'details' && this.detailsFilm) this.renderDetails(this.detailsFilm, true);
    else { this.renderGrid(true); this.renderHead(); this.focusGrid(); }
    void film;
  }

  // =============================================================== keys the app routes here
  handleBack() {
    if (this.vod.isOpen) return this.vod.handleBack();
    if (this.mode === 'panel') { this.closePanel(true); return true; }
    if (this.mode === 'genre') { this.closeGenre(true); return true; }
    if (this.mode === 'search') { this.closeSearch(true); return true; }
    if (this.mode === 'details') { this.closeDetails(true); return true; }
    if (this.mode === 'series') return this.series.handleBack();
    if (this.mode === 'groups') { this.closeGroups(true); return true; }
    if (this.cinema) { this.setCinema(false); return true; }
    if (this.menuShown) { this.setHeaderShown(false); this.focusGrid(); return true; }
    const id = this.nav.currentFocusedId || '';
    if (id === 'mv-grid') { this.focusBar(); return true; }
    return false; // the app takes Back to Live TV
  }
}
