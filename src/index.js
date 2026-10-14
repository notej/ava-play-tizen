/**
 * AvaPlay Tizen TV - Section 1: Live TV Implementation
 * Matching android_tv_live.png with authentic categories, real-time EPG timeline, and hardware playback.
 */

import { SpatialNavigationEngine, TVKeys } from './core/SpatialNavigation.js';
import { player, PlayerState, iso2 } from './player/TizenAVPlayer.js';
import { storage } from './data/StorageManager.js';
import { DEMO_DATA } from './data/DemoData.js';
import { VirtualRemote } from './core/VirtualRemote.js';
import { settings, SYNC_STEPS, SUBTITLE_SIZES, SUBTITLE_BGS } from './data/AppSettings.js';
import { loadLive, readCache, writeCache, streamUrl, isAdultName, explainConnectionError } from './data/LiveSource.js';
import { SettingsView } from './ui/SettingsView.js';
import { MoviesView } from './ui/MoviesView.js';
import { SetupView } from './ui/SetupView.js';
import { displayTitle, qualityBadge } from './data/MovieSource.js';

class AvaPlayApp {
  constructor() {
    this.nav = new SpatialNavigationEngine();
    this.currentView = 'livetv';
    this.activeCategoryIndex = 0;
    this.activeChannelIndex = 0;
    this.groupsOpen = true;
    // Comprehensive channels lineup across Albanian, International & Premium categories
    this.channels = [
      // GJENERALE
      {
        id: 'ch_top_channel',
        name: 'TOP CHANNEL HD',
        logoText: 'TCH',
        logoClass: 'channel-logo-topchannel',
        group: 'GJENERALE',
        currentShow: 'Portokalli • Sezoni i Ri',
        favorite: true,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },
      {
        id: 'ch_klan',
        name: 'TV KLAN HD',
        logoText: 'KLAN',
        logoClass: 'channel-logo-klan',
        group: 'GJENERALE',
        currentShow: 'Opinion me Blendi Fevziu',
        favorite: true,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },
      {
        id: 'ch_rtv21',
        name: 'RTV 21 HD',
        logoText: '21',
        logoClass: 'channel-logo-rtv21',
        group: 'GJENERALE',
        currentShow: 'Lajmet e Mbrëmjes',
        favorite: true,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },
      {
        id: 'ch_klan_kosova',
        name: 'KLAN KOSOVA HD',
        logoText: 'KK',
        logoClass: 'channel-logo-klan',
        group: 'GJENERALE',
        currentShow: 'Info Magazine',
        favorite: false,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },
      {
        id: 'ch_vizion_plus',
        name: 'VIZION PLUS HD',
        logoText: 'V+',
        logoClass: 'channel-logo-vizion',
        group: 'GJENERALE',
        currentShow: 'Zonë e Lirë',
        favorite: false,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },

      // FILMA
      {
        id: 'ch_film_nje',
        name: 'FILM NJË HD',
        logoText: 'F1',
        logoClass: 'channel-logo-filma',
        group: 'FILMA',
        currentShow: 'Gladiator II (2024)',
        favorite: true,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },
      {
        id: 'ch_film_dy',
        name: 'FILM DY HD',
        logoText: 'F2',
        logoClass: 'channel-logo-filma',
        group: 'FILMA',
        currentShow: 'Inception (Sci-Fi Thriller)',
        favorite: false,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },
      {
        id: 'ch_eurofilm',
        name: 'EUROFILM HD',
        logoText: 'EF',
        logoClass: 'channel-logo-filma',
        group: 'FILMA',
        currentShow: 'The Dark Knight',
        favorite: false,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },
      {
        id: 'ch_cinema_1',
        name: 'CINEMA 1 HD',
        logoText: 'C1',
        logoClass: 'channel-logo-filma',
        group: 'FILMA',
        currentShow: 'Interstellar • IMAX Edition',
        favorite: false,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },

      // LAJME
      {
        id: 'ch_top_news',
        name: 'TOP NEWS HD',
        logoText: 'TN',
        logoClass: 'channel-logo-topnews',
        group: 'LAJME',
        currentShow: 'Edicioni Informativ 24/7',
        favorite: true,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },
      {
        id: 'ch_a2_cnn',
        name: 'A2 CNN HD',
        logoText: 'A2',
        logoClass: 'channel-logo-topnews',
        group: 'LAJME',
        currentShow: 'CNN Breaking Headlines',
        favorite: false,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },

      // SPORTS
      {
        id: 'ch_supersport_1',
        name: 'SUPERSPORT 1 HD',
        logoText: 'SS1',
        logoClass: 'channel-logo-supersport',
        group: 'SPORTS',
        currentShow: 'UEFA Champions League Live',
        favorite: true,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },
      {
        id: 'ch_supersport_2',
        name: 'SUPERSPORT 2 HD',
        logoText: 'SS2',
        logoClass: 'channel-logo-supersport',
        group: 'SPORTS',
        currentShow: 'Premier League Matchday',
        favorite: false,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },

      // FEMIJET & KIDS
      {
        id: 'ch_cufo',
        name: 'ÇUFO HD',
        logoText: 'ÇU',
        logoClass: 'channel-logo-kids',
        group: 'FEMIJET',
        currentShow: 'Tom & Jerry Classic',
        favorite: false,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },
      {
        id: 'ch_bang_bang',
        name: 'BANG BANG HD',
        logoText: 'BB',
        logoClass: 'channel-logo-kids',
        group: 'KIDS',
        currentShow: 'Peppa Pig • Ep 45',
        favorite: false,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },

      // DOKUMENTARE
      {
        id: 'ch_explorer_natyra',
        name: 'EXPLORER NATYRA',
        logoText: 'EXP',
        logoClass: 'channel-logo-doc',
        group: 'DOKUMENTARE',
        currentShow: 'Planet Earth • Deep Oceans',
        favorite: false,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },

      // SWEDEN
      {
        id: 'ch_svt1',
        name: 'SVT 1 HD',
        logoText: 'SVT',
        logoClass: 'channel-logo-doc',
        group: 'SWEDEN',
        currentShow: 'Rapport • Nyheter',
        favorite: false,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },

      // MUZIKE
      {
        id: 'ch_my_music',
        name: 'MY MUSIC HD',
        logoText: 'MM',
        logoClass: 'channel-logo-music',
        group: 'MUZIKE',
        currentShow: 'Top Hit Parade 2026',
        favorite: false,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      },

      // EXYU
      {
        id: 'ch_rts1',
        name: 'RTS 1 HD',
        logoText: 'RTS',
        logoClass: 'channel-logo-doc',
        group: 'EXYU',
        currentShow: 'Dnevnik 2',
        favorite: false,
        streamUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
      }
    ];

    this.demoChannels = this.channels.map((c) => ({ ...c, groupId: c.group, groupRaw: c.group }));
    this.channels = [];
    this.groups = [];
    this.groupDefs = [];
    this.hiddenGroupKeys = new Set();
    this.hiddenIds = new Set();
    this.isDemo = true;
    this.playlistId = 'demo';
    this.playlist = null;
    this.refreshedAt = 0;
    this.loadState = 'idle';
    this.loadError = '';
    this.loadToken = 0;
    this.catCount = 0;

    this.currentChannel = null;
    this.infoChannel = null;
    this.currentDisplayList = [];
    this.activeChannelIndex = 0;
    this.timelineOffset = 0; // guide scroll, in 30-minute steps
    this.sortMode = 'default';
    this.lastZapTime = 0;
    this.fsOsdTimer = null;
    this.recentsOpen = false;
    this.recentsIndex = 0;
    this.recentsTimer = null;
    this.historyOpen = false;
    this.historyIndex = 0;
    this.menuOpen = false;
    this.menuIndex = 0;
    this.submenuOpen = false;
    this.submenuIndex = 0;
    this.toastTimer = null;
    this.dialogOpen = false;
    this.dialogReturnFocus = null;
    this.dialogReturnScope = 'main';
    this.rowEdit = 'NONE';        // NONE | HIDE | REORDER: what holding OK on a channel put the list into
    this.reorderChannel = null;   // the channel picked up while reordering
    this.browserOpen = false;     // the channel browser over the player
    this.manage = null;           // Manage groups
    this.groupReorder = false;    // Reorder groups mode (hold OK on a group)
    this.movingGroup = null;      // the group picked up while reordering groups
    this.channelOrder = {};       // group key -> channel ids in the viewer's order
    this.groupOrder = [];         // provider group ids in the viewer's order
    // Fullscreen player settings
    this.videoResolution = 'Auto';
    this.audioTrack = 'Default';
    this.subtitleTrack = 'Off';
    this.screenSize = 'Normal';
    this.soundDelay = 0;
    this.recentChannels = [];
    this.isFullscreen = false;

    this.init();
  }

  init() {
    console.log('[AvaPlay] Bootstrapping Live TV section...');
    // The picture lives on a layer behind the page, with a hole cut in the page where it shows (as on the TV)
    document.getElementById('app').classList.add('native');
    document.documentElement.classList.add('native');
    this.setupSubtitleLayer();
    this.applySettings();
    settings.subscribe((values, keys) => this.onSettingsChanged(keys));
    this.setupClock();
    this.setupHeaderTabs();
    this.setupGuideList();
    this.setupPreviewPlayer();
    this.setupGlobalShortcuts();
    this.setupPlayerEvents();
    this.settingsView = new SettingsView(this);
    this.moviesView = new MoviesView(this);
    this.setupView = new SetupView(this);

    // Groups first (just Favorites / All channels), so the list can be focused while channels load
    this.buildGroupDefs();
    this.renderCategoryDrawer();
    if (SetupView.needed()) {
      // No playlist yet: setup stands alone over the app until it is finished
      this.setupView.open();
    } else {
      this.loadCatalogue();
      setTimeout(() => { if (this.nav.nodes.has('cat-0')) this.nav.focus('cat-0'); }, 150);
    }
  }

  // ---------- Settings that change how the UI looks or behaves ----------
  applySettings() {
    const s = settings.get();
    const root = document.documentElement;
    root.style.setProperty('--avaplay-accent', settings.accent());
    root.style.setProperty('--avaplay-band', settings.band());
    const layout = document.getElementById('livetv-layout');
    if (layout) layout.classList.toggle('hide-numbers', !s.showNumbers);
    const hidden = new Set(s.hiddenSections);
    [['tab-livetv', 'LIVE'], ['tab-movies', 'MOVIE'], ['tab-series', 'SHOW']].forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.style.display = hidden.has(key) ? 'none' : '';
    });
    root.style.setProperty('--sub-scale', String(parseInt((SUBTITLE_SIZES.find((x) => x[0] === s.subtitleSize) || SUBTITLE_SIZES[1])[2], 10) / 100));
    root.style.setProperty('--sub-size', (SUBTITLE_SIZES.find((x) => x[0] === s.subtitleSize) || SUBTITLE_SIZES[1])[2]);
    root.style.setProperty('--sub-bg', (SUBTITLE_BGS.find((x) => x[0] === s.subtitleBg) || SUBTITLE_BGS[0])[2]);
    player.userAgent = s.userAgent;
    player.bufferSeconds = { SMALL: 1, NORMAL: 2, LARGE: 4, XLARGE: 8 }[s.buffer] || 2;
    this.screenSize = ['Normal', 'Stretch', 'Zoom'][s.aspect] || 'Normal';
    this.soundDelay = s.audioSync;
    const fsClock = document.getElementById('fs-clock');
    if (fsClock) fsClock.style.display = s.playerClock ? '' : 'none';
    if (this.isFullscreen) this.applyScreenSize(this.screenSize);
  }

  onSettingsChanged(keys) {
    this.applySettings();
    if (this.moviesView) this.moviesView.onSettingsChanged(keys);
    const listAffecting = ['hideAdult', 'hideCountryNames', 'showNumbers'];
    if (keys.some((k) => listAffecting.includes(k))) this.refreshCatalogueView();
    if (keys.includes('liveFormat')) this.rebuildStreamUrls();
    if (keys.includes('clock24')) this.renderTimeline();
  }

  // Marks "UK | News" as "News" when Hide country names is on
  displayName(raw) {
    return settings.get().hideCountryNames ? (raw || '').replace(/^\s*[A-Za-z]{2,3}\s*(\||:|-|•)\s*/, '') : (raw || '');
  }

  chName(ch) { return this.displayName(ch.name); }

  // ---------- Playlist data ----------
  stateKey(name) { return `avaplay_live_${name}_${this.playlistId}`; }

  restoreChannelState() {
    this.channelOrder = storage.get(this.stateKey('chorder'), {}) || {};
    this.groupOrder = storage.get(this.stateKey('grouporder'), []) || [];
    const favs = storage.get(this.stateKey('favorites'), null);
    if (Array.isArray(favs)) {
      const set = new Set(favs);
      this.channels.forEach((c) => { c.favorite = set.has(c.id); });
    }
    this.hiddenIds = new Set(storage.get(this.stateKey('hidden'), []));
    this.hiddenGroupKeys = new Set(storage.get(this.stateKey('hiddenGroups'), []));
  }

  saveChannelState() {
    storage.set(this.stateKey('favorites'), this.channels.filter((c) => c.favorite).map((c) => c.id));
    storage.set(this.stateKey('hidden'), Array.from(this.hiddenIds));
    storage.set(this.stateKey('hiddenGroups'), Array.from(this.hiddenGroupKeys));
    storage.set(this.stateKey('chorder'), this.channelOrder);
    storage.set(this.stateKey('grouporder'), this.groupOrder);
  }

  toggleGroupHidden(groupId) {
    if (this.hiddenGroupKeys.has(groupId)) this.hiddenGroupKeys.delete(groupId);
    else this.hiddenGroupKeys.add(groupId);
    this.saveChannelState();
    this.refreshCatalogueView();
  }

  clearRecents() {
    this.recentChannels = [];
    storage.saveRecentChannels([]);
  }

  clearFavorites() {
    this.channels.forEach((c) => { c.favorite = false; });
    this.saveChannelState();
    this.refreshCatalogueView();
  }

  liveFormat() { return settings.get().liveFormat; }

  rebuildStreamUrls() {
    if (this.isDemo || !this.playlist) return;
    const fmt = this.liveFormat();
    this.channels.forEach((c) => {
      c.streamUrl = c.url || streamUrl(this.playlist, c.streamId, fmt);
    });
  }

  /** Loads the active playlist (or the demo channels when none is saved). */
  async loadCatalogue(force = false, keepPlaying = false) {
    const token = ++this.loadToken;
    const conn = storage.getActiveConnection();
    if (this.moviesView && (this.moviesView.connection ? this.moviesView.connection.id : null) !== (conn ? conn.id : null)) this.moviesView.setPlaylist(conn);
    if (!keepPlaying && (this.playlist ? this.playlist.id : null) !== (conn ? conn.id : null)) this.currentChannel = null;

    if (!conn) {
      this.playlist = null;
      this.playlistId = 'demo';
      this.loadError = '';
      this.loadState = 'ready';
      this.setCatalogue({ groups: [...new Set(this.demoChannels.map((c) => c.group))].map((n) => ({ id: n, name: n })), channels: this.demoChannels.map((c) => ({ ...c })) }, true);
      return;
    }

    this.playlist = conn;
    this.playlistId = conn.id;
    const cached = readCache(conn.id);
    if (cached) {
      this.refreshedAt = cached.at || 0;
      this.setCatalogue({ groups: cached.groups, channels: cached.channels.map((c) => ({ ...c })) }, false);
    } else {
      this.channels = [];
      this.groups = [];
    }
    const fresh = cached && Date.now() - cached.at < 3 * 3600 * 1000;
    if (fresh && !force) { this.loadState = 'ready'; return; }

    this.loadState = 'loading';
    this.loadError = '';
    this.loadErrorInfo = null;
    if (!cached) { this.buildGroupDefs(); this.renderCategoryDrawer(); this.renderCategoryChannels(this.activeGroupKey(), true); }
    try {
      const data = await loadLive(conn, this.liveFormat());
      if (token !== this.loadToken) return; // another load started meanwhile
      writeCache(conn.id, data);
      this.refreshedAt = Date.now();
      this.loadState = 'ready';
      this.setCatalogue(data, false);
    } catch (err) {
      if (token !== this.loadToken) return;
      this.loadState = 'error';
      this.loadErrorInfo = explainConnectionError(err);
      this.loadError = err.message || 'Could not load the channels.';
      this.renderCategoryChannels(this.activeGroupKey(), true);
    }
  }

  setCatalogue(data, demo) {
    this.isDemo = demo;
    this.groups = data.groups;
    this.channels = data.channels;
    this.channels.forEach((c) => {
      if (c.favorite === undefined) c.favorite = false;
      if (!c.groupRaw) c.groupRaw = c.groupId;
    });
    this.channels.sort((a, b) => a.number - b.number);
    if (!demo) this.rebuildStreamUrls();
    this.restoreChannelState();
    this.loadRecentChannels();

    const previousKey = this.activeGroupKey();
    this.buildGroupDefs();
    const idx = Math.max(0, this.groupDefs.findIndex((d) => d.key === previousKey));
    this.activeCategoryIndex = idx;
    const hadFocus = this.nav.currentFocusedId;
    this.renderCategoryDrawer();

    let ch = this.currentChannel ? this.channels.find((c) => c.id === this.currentChannel.id) : null;
    if (!ch && settings.get().resumeSession) {
      const lastId = storage.get(this.stateKey('last'), null);
      ch = this.channels.find((c) => c.id === lastId) || null;
    }
    ch = ch || this.getVisibleChannels()[0] || null;
    const changed = !this.currentChannel || !ch || this.currentChannel.id !== ch.id;
    this.currentChannel = ch;

    this.renderCategoryChannels(this.groupDefs[idx].key, true);
    if (ch && changed) this.tuneChannel(ch, false);
    else if (ch) this.updateChannelInfo(ch);

    if (!hadFocus || !this.nav.nodes.has(hadFocus)) {
      if (this.currentView === 'livetv' && this.nav.activeScope === 'main') this.nav.focus(`cat-${idx}`);
    }
  }

  // Everything that depends on settings or hidden groups, redrawn in place
  refreshCatalogueView() {
    const previousKey = this.activeGroupKey();
    this.buildGroupDefs();
    this.activeCategoryIndex = Math.max(0, this.groupDefs.findIndex((d) => d.key === previousKey));
    const hadFocus = this.nav.currentFocusedId;
    this.renderCategoryDrawer();
    this.renderCategoryChannels(this.groupDefs[this.activeCategoryIndex].key, true);
    if (hadFocus && this.nav.nodes.has(hadFocus)) this.nav.focus(hadFocus);
  }

  // --- Clock and programme guide timeline ---
  formatClock(now) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}, ${this.fmtTime(now.getTime())}`;
  }

  fmtTime(ms) {
    const d = new Date(ms);
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (settings.get().clock24) return `${String(d.getHours()).padStart(2, '0')}:${mm}`;
    const h = d.getHours() % 12 || 12;
    return `${h}:${mm} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
  }

  setupClock() {
    this.renderTimeline();
    setInterval(() => {
      this.renderTimeline();
      const fsClock = document.getElementById('fs-clock');
      if (fsClock) fsClock.textContent = this.formatClock(new Date());
    }, 15000);
  }

  guideStageWidth() {
    return this.groupsOpen ? 1890 - 538 : 1890 - 32;
  }

  // First visible half hour of the guide (the current half hour plus any scroll)
  guideWindowStart() {
    const d = new Date();
    d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0);
    return d.getTime() + this.timelineOffset * 30 * 60000;
  }

  renderTimeline() {
    const PX_PER_MIN = 320 / 30;
    const INFO_W = 508;
    const now = new Date();
    const clockEl = document.getElementById('timeline-clock');
    const hint = this.editHint();
    if (clockEl) { clockEl.textContent = hint || this.formatClock(now); clockEl.classList.toggle('hint', !!hint); }

    const ws = this.guideWindowStart();
    const width = this.guideStageWidth();
    const ticksEl = document.getElementById('timeline-ticks');
    if (ticksEl) {
      ticksEl.innerHTML = '';
      for (let i = 0; INFO_W + i * 320 <= width - 30; i++) {
        const tick = document.createElement('span');
        tick.className = 'tl-tick';
        tick.style.left = `${INFO_W + 2 + i * 320}px`;
        tick.textContent = this.fmtTime(ws + i * 30 * 60000);
        ticksEl.appendChild(tick);
      }
    }

    const cursor = document.getElementById('timeline-cursor');
    if (cursor) {
      const x = INFO_W + ((now.getTime() - ws) / 60000) * PX_PER_MIN;
      cursor.style.display = x >= INFO_W && x <= width ? 'block' : 'none';
      cursor.style.left = `${x}px`;
    }
    this.renderProgrammes();
  }

  // Programme blocks inside every visible row's track
  renderProgrammes() {
    const PX_PER_MIN = 320 / 30;
    const ws = this.guideWindowStart();
    document.querySelectorAll('.channel-guide-row').forEach((row) => {
      const ch = this.currentDisplayList[Number(row.dataset.index)];
      const track = row.querySelector('.epg-track');
      if (!ch || !track) return;
      track.innerHTML = '';
      this.getChannelSchedule(ch).forEach((p) => {
        const start = Math.max(p.start, ws);
        if (p.end <= ws) return;
        const left = ((start - ws) / 60000) * PX_PER_MIN;
        const width = ((p.end - start) / 60000) * PX_PER_MIN - 4;
        if (left > track.clientWidth + 400 || width < 20) return;
        const el = document.createElement('div');
        el.className = `epg-prog${p.current ? ' current' : ''}`;
        el.style.left = `${left}px`;
        el.style.width = `${width}px`;
        el.innerHTML = `<span class="epg-prog-title"></span><span class="epg-prog-time">${this.fmtTime(p.start)} - ${this.fmtTime(p.end)}</span>`;
        el.querySelector('.epg-prog-title').textContent = p.title;
        track.appendChild(el);
      });
    });
  }

  // Demo guide. Groups listed here stay empty, like a playlist without EPG data.
  getChannelSchedule(channel) {
    if (Array.isArray(channel.schedule)) return channel.schedule;
    if (!this.isDemo) return []; // real playlists: no guide data in this build
    if (['SWEDEN', 'KIDS', 'MUZIKE', 'EXYU', 'DOKUMENTARE', 'FEMIJET'].includes(channel.group)) return [];

    const fillers = ['Live Broadcast', 'News & Weather', 'Prime Time Movie', 'Talk Show', 'Documentary Hour', 'Late Night Replay', 'Morning Magazine'];
    const base = new Date();
    base.setMinutes(base.getMinutes() < 30 ? 0 : 30, 0, 0);
    let t = base.getTime() - 30 * 60000;
    const lengths = [60, 30, 90, 60, 30, 60, 90, 30, 60, 60, 30, 60];
    const out = [];
    lengths.forEach((len, i) => {
      const end = t + len * 60000;
      out.push({
        start: t,
        end,
        current: Date.now() >= t && Date.now() < end,
        title: i === 0 ? (channel.currentShow || 'Live Broadcast') : fillers[(channel.name.length + i * 3) % fillers.length]
      });
      t = end;
    });
    return out;
  }

  currentProgramme(channel) {
    return this.getChannelSchedule(channel).find(p => p.current) || null;
  }

  setGroupsOpen(open) {
    this.groupsOpen = open;
    const layout = document.getElementById('livetv-layout');
    if (layout) layout.classList.toggle('groups-closed', !open);
    this.updateHeaderNavLinks();
    this.renderTimeline();

    // Give the CSS transition time to finish, then re-seat the preview video
    setTimeout(() => this.updatePreviewVideoPosition(), 260);
  }

  headerDownTarget() {
    if (this.currentView === 'settings') return `set-menu-${this.settingsView.sectionIndex}`;
    if (this.isBrowse()) { this.moviesView.setHeaderShown(false); return this.moviesView.barOrder && this.moviesView.barOrder[0]; }
    if (this.currentView !== 'livetv') return null;
    return this.groupsOpen ? `cat-${this.activeCategoryIndex}` : 'guide-list';
  }

  updateHeaderNavLinks() {
    const downTarget = () => this.headerDownTarget();

    ['tab-livetv', 'tab-movies', 'tab-series'].forEach(id => {
      const reg = this.nav.nodes.get(id);
      if (reg) reg.down = downTarget;
    });
  }

  setupHeaderTabs() {
    const getDownTarget = () => this.headerDownTarget();

    const order = ['tab-livetv', 'tab-movies', 'tab-series'];
    const shown = () => order.filter((t) => document.getElementById(t).style.display !== 'none');
    const neighbour = (id, delta) => {
      const list = shown();
      const i = list.indexOf(id) + delta;
      if (i < 0) return null;
      return i < list.length ? list[i] : 'btn-filter';
    };
    const tab = (id, left, right, view) => this.nav.register({
      id,
      el: document.getElementById(id),
      scope: 'main',
      left: () => neighbour(id, -1),
      right: () => neighbour(id, 1),
      up: null,
      down: getDownTarget,
      onSelect: () => this.switchView(view)
    });
    tab('tab-livetv', null, 'tab-movies', 'livetv');
    tab('tab-movies', 'tab-livetv', 'tab-series', 'movies');
    tab('tab-series', 'tab-movies', 'btn-filter', 'series');

    this.nav.register({
      id: 'btn-filter',
      el: document.getElementById('btn-filter'),
      scope: 'main',
      left: () => { const list = shown(); return list.length ? list[list.length - 1] : null; },
      right: 'btn-settings',
      up: null,
      down: () => (this.currentView === 'livetv' ? 'btn-favorite-star' : null),
      onSelect: () => this.openSortDialog()
    });

    this.nav.register({
      id: 'btn-settings',
      el: document.getElementById('btn-settings'),
      scope: 'main',
      left: 'btn-filter',
      right: null,
      up: null,
      down: () => (this.currentView === 'livetv' ? 'btn-favorite-star' : null),
      onSelect: () => this.switchView('settings')
    });

    // Mouse / touch support for the browser build
    ['tab-livetv', 'tab-movies', 'tab-series', 'btn-filter', 'btn-settings'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => { this.nav.focus(id); this.nav.nodes.get(id).onSelect(); });
    });
  }

  activeGroupKey() {
    const def = this.groupDefs[this.activeCategoryIndex];
    return def ? def.key : 'ALL';
  }

  getVisibleChannels(withHidden = false) {
    const hideAdult = settings.get().hideAdult;
    return this.channels.filter((c) => (withHidden || !this.hiddenIds.has(c.id))
      && !this.hiddenGroupKeys.has(c.groupId)
      && !(hideAdult && (isAdultName(c.groupRaw) || isAdultName(c.name))));
  }

  // The viewer's own order first, then the rest as the provider sent them
  inOrder(list, order) {
    if (!order || !order.length) return list;
    const rank = new Map();
    order.forEach((id, i) => { if (!rank.has(id)) rank.set(id, i); });
    return [...list].sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 1e9) - (rank.has(b.id) ? rank.get(b.id) : 1e9));
  }

  getChannelsFor(key, withHidden = false) {
    const all = this.getVisibleChannels(withHidden);
    let list;
    if (key === 'ALL') list = all;
    else if (key === 'FAVORITES') list = all.filter((c) => c.favorite);
    else list = all.filter((c) => c.groupId === key);

    if (this.sortMode === 'az') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (this.sortMode === 'za') list = [...list].sort((a, b) => b.name.localeCompare(a.name));
    else list = this.inOrder(list, this.channelOrder[key]);
    return list;
  }

  buildGroupDefs() {
    const counts = new Map();
    this.getVisibleChannels().forEach((c) => counts.set(c.groupId, (counts.get(c.groupId) || 0) + 1));
    const defs = [{ key: 'FAVORITES', label: 'Favorites', fixed: true }, { key: 'ALL', label: 'All channels', fixed: true }];
    const rank = new Map(this.groupOrder.map((id, i) => [id, i]));
    const ordered = [...this.groups].sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 1e9) - (rank.has(b.id) ? rank.get(b.id) : 1e9));
    ordered.forEach((g) => {
      if (counts.get(g.id)) defs.push({ key: g.id, label: this.displayName(g.name) });
    });
    this.groupDefs = defs;
  }

  renderCategoryDrawer() {
    const listEl = document.getElementById('category-list');
    if (!listEl) return;
    for (let i = 0; i < this.catCount; i++) this.nav.unregister(`cat-${i}`);
    listEl.innerHTML = '';
    this.catCount = this.groupDefs.length;
    if (this.activeCategoryIndex >= this.catCount) this.activeCategoryIndex = 0;

    this.groupDefs.forEach((def, idx) => {
      const item = document.createElement('div');
      item.id = `cat-${idx}`;
      const carried = this.groupReorder && this.movingGroup === def.key;
      item.className = `category-item ${idx === this.activeCategoryIndex ? 'active-pill' : ''}${carried ? ' moving' : ''}`;
      item.innerHTML = '<span class="cat-label"></span>';
      item.querySelector('.cat-label').textContent = def.label;
      if (this.groupReorder && !def.fixed) item.insertAdjacentHTML('beforeend', `<span class="row-icon">${this.dialogIcons().reorder}</span>`);
      listEl.appendChild(item);

      item.addEventListener('click', () => {
        this.nav.focus(`cat-${idx}`);
        this.selectCategory(idx);
      });

      this.nav.register({
        id: `cat-${idx}`,
        el: item,
        scope: 'main',
        left: null,
        // Right drops into the channel list and tucks the group list away
        right: () => {
          if (!this.groupReorder) this.selectCategory(idx);
          return null;
        },
        up: () => {
          if (this.movingGroup) { this.moveGroup(-1); return null; }
          return idx === 0 ? 'tab-livetv' : `cat-${idx - 1}`;
        },
        down: () => {
          if (this.movingGroup) { this.moveGroup(1); return null; }
          return idx < this.groupDefs.length - 1 ? `cat-${idx + 1}` : null;
        },
        onFocus: () => {
          this.activeCategoryIndex = idx;
          document.querySelectorAll('.category-item').forEach((el) => el.classList.remove('active-pill'));
          item.classList.add('active-pill');
          // Keep the focused group inside the 948px-tall column
          listEl.style.transform = `translateY(${-Math.max(0, idx - 9) * 76}px)`;
          this.onCategoryChange(def.key);
        },
        onSelect: () => (this.groupReorder ? this.pickGroup(def) : this.selectCategory(idx)),
        onHoldSelect: () => (this.groupReorder ? this.pickGroup(def) : (!def.fixed && this.openGroupDialog(def)))
      });
    });
    listEl.style.transform = `translateY(${-Math.max(0, this.activeCategoryIndex - 9) * 76}px)`;
  }

  selectCategory(idx) {
    this.activeCategoryIndex = idx;
    this.onCategoryChange(this.groupDefs[idx].key);
    if (!this.currentDisplayList.length) return; // nothing to move into

    this.setGroupsOpen(false);
    // Land on the channel that is already playing in this group, else the first
    const playing = this.currentDisplayList.indexOf(this.currentChannel);
    this.setActiveRow(playing >= 0 ? playing : 0);
    setTimeout(() => this.nav.focus('guide-list'), 30);
  }

  onCategoryChange(key) {
    this.timelineOffset = 0;
    this.renderCategoryChannels(key);
  }

  renderCategoryChannels(key, keepIndex = false) {
    const noticeEl = document.getElementById('epg-empty-notice');
    const guideEl = document.querySelector('.guide');

    const displayList = this.getChannelsFor(key, this.rowEdit === 'HIDE');
    this.currentDisplayList = displayList;
    this.activeChannelIndex = keepIndex ? Math.min(this.activeChannelIndex, Math.max(0, displayList.length - 1)) : 0;

    if (guideEl) guideEl.classList.toggle('empty', displayList.length === 0);
    if (noticeEl) {
      if (this.loadState === 'loading' && !this.channels.length) noticeEl.textContent = 'Loading channels…';
      else if (this.loadState === 'error' && !this.channels.length) noticeEl.textContent = this.loadError;
      else if (key === 'FAVORITES') noticeEl.textContent = 'No favourite channels yet. Hold OK on a channel and choose Favourite.';
      else noticeEl.textContent = 'No channels in this group.';
    }

    this.renderRows();
    const shown = displayList[this.activeChannelIndex] || this.currentChannel;
    if (shown) this.updateChannelInfo(shown);
  }

  // The list can hold thousands of channels, so only the rows around the selection exist in the DOM.
  renderRows() {
    const container = document.getElementById('guide-rows');
    if (!container) return;
    const list = this.currentDisplayList;
    const start = Math.max(0, this.activeChannelIndex - 3);
    container.innerHTML = '';

    for (let i = start; i < Math.min(list.length, start + 9); i++) {
      const ch = list[i];
      const row = document.createElement('div');
      row.dataset.index = String(i);
      row.style.top = `${(i - start) * 78}px`;
      const hiddenNow = this.hiddenIds.has(ch.id);
      row.className = `channel-guide-row${ch === this.currentChannel ? ' playing' : ''}${i === this.activeChannelIndex ? ' active' : ''}${ch === this.reorderChannel ? ' reordering' : ''}${this.rowEdit === 'HIDE' && hiddenNow ? ' hidden-ch' : ''}`;
      const I = this.dialogIcons();
      const marker = this.rowEdit === 'HIDE' ? `<span class="row-icon">${hiddenNow ? I.hide : I.eye}</span>`
        : this.rowEdit === 'REORDER' ? `<span class="row-icon">${I.reorder}</span>` : '<span class="now-arrow">▶</span>';
      row.innerHTML = `
        <div class="channel-badge-container">
          <span class="guide-channel-number">${ch.number}</span>
          <div class="channel-logo-icon ${ch.logoClass || 'channel-logo-topnews'}"></div>
          <span class="guide-channel-name"></span>
          ${marker}
        </div>
        <div class="epg-track"></div>`;
      row.querySelector('.guide-channel-name').textContent = this.chName(ch);
      this.fillLogo(row.querySelector('.channel-logo-icon'), ch);
      container.appendChild(row);

      row.addEventListener('click', () => {
        this.setActiveRow(i);
        this.nav.focus('guide-list');
        this.activateChannel(ch);
      });
      row.addEventListener('dblclick', () => this.openFullscreenPlayer(ch));
      row.addEventListener('contextmenu', (e) => { e.preventDefault(); this.openChannelDialog(ch); });
    }
    this.renderProgrammes();
  }

  // Channel logo from the playlist, falling back to the channel's initials
  fillLogo(tile, ch) {
    const text = () => {
      tile.innerHTML = '<span></span>';
      tile.querySelector('span').textContent = ch.logoText || 'TV';
    };
    if (!ch.icon) { text(); return; }
    const img = document.createElement('img');
    img.className = 'logo-img';
    img.referrerPolicy = 'no-referrer';
    img.alt = '';
    img.onerror = () => { ch.icon = ''; text(); };
    img.src = ch.icon;
    tile.appendChild(img);
  }

  setActiveRow(i) {
    this.activeChannelIndex = i;
    this.renderRows();
    const ch = this.currentDisplayList[i];
    if (ch) this.updateChannelInfo(ch);
  }

  setupGuideList() {
    this.nav.register({
      id: 'guide-list',
      el: document.getElementById('guide-rows'),
      scope: 'main',
      left: () => {
        if (this.rowEdit !== 'NONE') return null;
        if (this.timelineOffset > 0) {
          this.panTimeline(-1);
          return null;
        }
        this.setGroupsOpen(true);
        return `cat-${this.activeCategoryIndex}`;
      },
      right: () => {
        if (this.rowEdit === 'NONE') this.panTimeline(1);
        return null;
      },
      up: () => {
        if (this.reorderChannel) { this.moveReorder(-1); return null; }
        // Up from the first channel carries on from the last one
        const n = this.currentDisplayList.length;
        if (n > 1) this.setActiveRow(this.activeChannelIndex <= 0 ? n - 1 : this.activeChannelIndex - 1);
        return null;
      },
      down: () => {
        if (this.reorderChannel) { this.moveReorder(1); return null; }
        // Down from the last channel carries on from the first one
        const n = this.currentDisplayList.length;
        if (n > 1) this.setActiveRow(this.activeChannelIndex >= n - 1 ? 0 : this.activeChannelIndex + 1);
        return null;
      },
      onFocus: () => this.renderRows(),
      onBlur: () => this.renderRows(),
      onSelect: () => {
        const ch = this.currentDisplayList[this.activeChannelIndex];
        if (!ch) return;
        if (this.rowEdit !== 'NONE') this.editRow(ch);
        else this.activateChannel(ch);
      },
      onHoldSelect: () => {
        const ch = this.currentDisplayList[this.activeChannelIndex];
        if (!ch) return;
        // In Hide / Reorder every press acts on the row; otherwise holding opens the channel's menu
        if (this.rowEdit !== 'NONE') this.editRow(ch);
        else this.openChannelDialog(ch);
      }
    });
  }

  // First OK loads the preview; OK on the playing channel goes fullscreen
  activateChannel(ch) {
    if (this.currentChannel === ch) this.openFullscreenPlayer(ch);
    else this.tuneChannel(ch);
  }

  panTimeline(direction) {
    const next = Math.max(0, Math.min(10, this.timelineOffset + direction));
    if (next === this.timelineOffset) return;
    this.timelineOffset = next;
    this.renderTimeline();
  }

  updateChannelInfo(ch) {
    if (!ch) return;
    this.infoChannel = ch;
    const nameEl = document.getElementById('live-channel-name');
    if (nameEl) nameEl.textContent = this.chName(ch);

    const sub = document.getElementById('live-guide-subtitle');
    if (sub) {
      const prog = this.currentProgramme(ch);
      if (prog) {
        sub.innerHTML = '<b></b><br><span></span>';
        sub.querySelector('b').textContent = prog.title;
        sub.querySelector('span').textContent = `${this.fmtTime(prog.start)} - ${this.fmtTime(prog.end)}`;
      } else {
        sub.textContent = 'No programme guide for this playlist · add a guide link in Settings > TV guide';
      }
    }

    const star = document.getElementById('btn-favorite-star');
    if (star) star.classList.toggle('starred', !!ch.favorite);
    const group = document.getElementById('live-group-label');
    if (group) group.textContent = this.displayName(ch.groupRaw || ch.group || '');
  }

  toggleFavorite(ch) {
    if (!ch) return;
    ch.favorite = !ch.favorite;
    this.saveChannelState();
    this.updateChannelInfo(ch);
    this.showToast(ch.favorite ? `Added ${ch.name} to favorites` : `Removed ${ch.name} from favorites`);
    // The Favorites group changes under us
    if (this.activeGroupKey() === 'FAVORITES') {
      const keep = this.activeChannelIndex;
      this.activeChannelIndex = keep;
      this.renderCategoryChannels('FAVORITES', true);
      if (this.currentDisplayList.length && !this.groupsOpen) this.nav.focus('guide-list');
      else if (!this.currentDisplayList.length) this.setGroupsOpen(true);
    }
  }

  // --- Dialog (long-press OK on a channel, sort & filter) ---
  openDialog(title, items, body = '') {
    const scrim = document.getElementById('dialog');
    const titleEl = document.getElementById('dialog-title');
    const listEl = document.getElementById('dialog-list');
    if (!scrim || !listEl) return;

    this.dialogOpen = true;
    this.dialogReturnFocus = this.nav.currentFocusedId;
    this.dialogReturnScope = this.nav.activeScope;
    titleEl.textContent = title;
    let bodyEl = document.getElementById('dialog-body');
    if (!bodyEl) {
      bodyEl = document.createElement('p');
      bodyEl.id = 'dialog-body';
      bodyEl.className = 'dialog-body';
      titleEl.insertAdjacentElement('afterend', bodyEl);
    }
    bodyEl.textContent = body;
    bodyEl.style.display = body ? '' : 'none';
    listEl.innerHTML = '';
    this.nav.setScope('dialog');

    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = `dialog-item${item.current ? ' current' : ''}`;
      el.innerHTML = `${item.icon || ''}<span></span>${item.value ? '<span class="value"></span>' : ''}`;
      el.querySelector('span').textContent = item.label;
      if (item.value) el.querySelector('.value').textContent = item.value;
      listEl.appendChild(el);

      const run = () => {
        this.closeDialog();
        item.action();
      };
      el.addEventListener('click', () => { this.nav.focus(`dlg-${i}`); run(); });
      this.nav.register({
        id: `dlg-${i}`,
        el,
        scope: 'dialog',
        left: null,
        right: null,
        up: i > 0 ? `dlg-${i - 1}` : null,
        down: i < items.length - 1 ? `dlg-${i + 1}` : null,
        onFocus: () => el.scrollIntoView({ block: 'nearest' }),
        onSelect: run
      });
    });

    scrim.classList.add('active');
    this.dialogItemCount = items.length;
    const first = Math.max(0, items.findIndex(it => it.current));
    this.nav.focus(`dlg-${first}`);
  }

  closeDialog() {
    if (!this.dialogOpen) return;
    this.dialogOpen = false;
    const scrim = document.getElementById('dialog');
    if (scrim) scrim.classList.remove('active');
    for (let i = 0; i < (this.dialogItemCount || 0); i++) this.nav.unregister(`dlg-${i}`);
    this.nav.setScope(this.dialogReturnScope || 'main');
    if (this.dialogReturnFocus && this.nav.nodes.has(this.dialogReturnFocus)) this.nav.focus(this.dialogReturnFocus);
  }

  dialogIcons() {
    return {
      star: '<svg viewBox="0 0 24 24"><path d="M22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"/></svg>',
      starOn: '<svg viewBox="0 0 24 24"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
      hide: '<svg viewBox="0 0 24 24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.8 11.8 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>',
      dup: '<svg viewBox="0 0 24 24"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>',
      reorder: '<svg viewBox="0 0 24 24"><path d="M9 3 5 6.99h3V14h2V6.99h3L9 3zm7 14.01V10h-2v7.01h-3L15 21l4-3.99h-3z"/></svg>',
      eye: '<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
      sort: '<svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>'
    };
  }

  openChannelDialog(ch) {
    const I = this.dialogIcons();
    this.openDialog(ch.name, [
      {
        label: ch.favorite ? 'Remove from favorites' : 'Add to favorites',
        icon: ch.favorite ? I.starOn : I.star,
        action: () => this.toggleFavorite(ch)
      },
      { label: 'Hide channels', icon: I.hide, action: () => this.startEdit('HIDE') },
      { label: 'Hide duplicate channels', icon: I.dup, action: () => this.hideDuplicates() },
      { label: 'Reorder channels', icon: I.reorder, action: () => this.startEdit('REORDER') }
    ]);
  }

  openSortDialog() {
    const I = this.dialogIcons();
    const modes = [['default', 'Provider order'], ['az', 'Name A–Z'], ['za', 'Name Z–A']];
    this.openDialog('Sort channels', modes.map(([mode, label]) => ({
      label,
      icon: I.sort,
      value: this.sortMode === mode ? 'Selected' : '',
      current: this.sortMode === mode,
      action: () => {
        this.sortMode = mode;
        this.renderCategoryChannels(this.activeGroupKey(), true);
        this.showToast(`Sorted: ${label}`);
      }
    })));
  }

  refreshAfterListChange() {
    this.buildGroupDefs();
    this.activeCategoryIndex = Math.max(0, this.groupDefs.findIndex((d) => d.key === this.activeGroupKey()));
    const hadGuideFocus = this.nav.currentFocusedId === 'guide-list';
    this.renderCategoryDrawer();
    this.renderCategoryChannels(this.groupDefs[this.activeCategoryIndex].key, true);
    if (this.groupsOpen) return;
    if (this.currentDisplayList.length) { if (hadGuideFocus || this.nav.currentFocusedId === null) this.nav.focus('guide-list'); }
    else { this.setGroupsOpen(true); this.nav.focus(`cat-${this.activeCategoryIndex}`); }
  }

  // ---- Hide channels / Reorder channels: the whole group goes into a mode with every row marked ----
  editHint() {
    if (this.groupReorder) return this.movingGroup ? 'Up and Down move the group. OK puts it down.' : 'Reorder groups: OK picks a group up. Back when done.';
    if (this.rowEdit === 'HIDE') return 'Hide channels: OK hides or shows a channel. Back when done.';
    if (this.rowEdit === 'REORDER') return this.reorderChannel ? 'Up and Down move the channel. OK puts it down.' : 'Reorder channels: OK picks a channel up. Back when done.';
    return '';
  }

  syncEditMode() {
    const editing = this.rowEdit !== 'NONE' || this.groupReorder;
    const guide = document.querySelector('.guide');
    if (guide) guide.classList.toggle('editing', editing);
    this.renderTimeline();
  }

  startEdit(mode) {
    this.rowEdit = mode;
    this.reorderChannel = null;
    this.renderCategoryChannels(this.activeGroupKey(), true);
    this.syncEditMode();
    if (this.currentDisplayList.length) this.nav.focus('guide-list');
  }

  // OK on a row in a mode: show or hide it, or pick it up or put it down
  editRow(ch) {
    if (this.rowEdit === 'HIDE') {
      if (this.hiddenIds.has(ch.id)) this.hiddenIds.delete(ch.id); else this.hiddenIds.add(ch.id);
      this.saveChannelState();
      this.renderRows();
    } else if (this.rowEdit === 'REORDER') {
      this.reorderChannel = this.reorderChannel === ch ? null : ch;
      if (!this.reorderChannel) this.saveChannelState();
      this.renderRows();
      this.syncEditMode();
    }
  }

  // Back: put a picked-up channel or group down first, then leave the mode
  exitEdit() {
    if (this.reorderChannel || this.movingGroup) {
      this.reorderChannel = null;
      this.movingGroup = null;
      this.saveChannelState();
      this.renderRows();
      this.renderCategoryDrawer();
      this.syncEditMode();
      return;
    }
    const wasGroups = this.groupReorder;
    this.rowEdit = 'NONE';
    this.groupReorder = false;
    this.syncEditMode();
    this.saveChannelState();
    if (wasGroups) { this.renderCategoryDrawer(); this.nav.focus(`cat-${this.activeCategoryIndex}`); return; }
    this.refreshAfterListChange();
  }

  moveReorder(delta) {
    const ch = this.reorderChannel;
    const list = this.currentDisplayList;
    const at = list.indexOf(ch);
    const to = at + delta;
    if (at < 0 || to < 0 || to >= list.length) return;
    const ids = list.map((c) => c.id);
    [ids[at], ids[to]] = [ids[to], ids[at]];
    this.channelOrder[this.activeGroupKey()] = ids;
    const keepSort = this.sortMode;
    this.sortMode = 'default';
    this.renderCategoryChannels(this.activeGroupKey(), true);
    this.sortMode = keepSort;
    this.setActiveRow(this.currentDisplayList.indexOf(ch));
  }

  // Hide duplicates, in bulk: every copy of a channel but its sharpest goes onto the hidden list, and shows in Hide channels to be brought back
  hideDuplicates() {
    // What copies of one channel have in common: its name without tags, quality marks and backup markers ("Top", "Top HD", "Top BK")
    const QUALITY = /\b(UHD|4K|2160P?|FHD|1080[PI]?|HD|720P?|SD|HEVC|H\.?26[45]|RAW|BK|BACKUP|\d{2}\s?FPS)\b/gi;
    const keyOf = (raw) => {
      const plain = displayTitle(raw).replace(QUALITY, '').normalize('NFD').replace(/\p{Mn}+/gu, '').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');
      return plain || String(raw).trim().toUpperCase();
    };
    // Which of two copies to keep: the sharper picture; a backup copy last
    const rank = (raw) => ({ '4K': 4, FHD: 3, HD: 2 }[qualityBadge(raw)] || 1) - (/\b(BK|BACKUP)\b/i.test(raw) ? 1 : 0);
    const list = this.getChannelsFor(this.activeGroupKey(), true).filter((c) => !this.hiddenIds.has(c.id));
    const best = new Map();
    const copies = [];
    list.forEach((c) => {
      const k = keyOf(c.name);
      const kept = best.get(k);
      if (!kept) best.set(k, c);
      else if (rank(c.name) > rank(kept.name)) { copies.push(kept); best.set(k, c); }
      else copies.push(c);
    });
    copies.forEach((c) => this.hiddenIds.add(c.id));
    this.saveChannelState();
    this.showToast(copies.length ? `Hid ${copies.length} duplicate channel${copies.length === 1 ? '' : 's'}` : 'No duplicate channels found');
    if (copies.length) this.refreshAfterListChange();
  }

  // ---- groups: hold OK ----
  openGroupDialog(def) {
    const I = this.dialogIcons();
    this.openDialog(def.label, [
      { label: 'Hide this group', icon: I.hide, action: () => this.hideGroup(def) },
      { label: 'Hide groups…', icon: I.eye, action: () => this.openManageGroups() },
      { label: 'Reorder groups', icon: I.reorder, action: () => { this.groupReorder = true; this.movingGroup = null; this.syncEditMode(); this.renderCategoryDrawer(); this.nav.focus(`cat-${this.activeCategoryIndex}`); } }
    ]);
  }

  // Hides one group at once and leaves the remote on the group that took its place
  hideGroup(def) {
    const at = this.groupDefs.findIndex((d) => d.key === def.key);
    this.hiddenGroupKeys.add(def.key);
    this.saveChannelState();
    this.showToast(`Hidden ${def.label}`);
    this.activeCategoryIndex = Math.max(0, at);
    this.refreshCatalogueView();
    this.activeCategoryIndex = Math.min(this.activeCategoryIndex, this.groupDefs.length - 1);
    this.nav.focus(`cat-${this.activeCategoryIndex}`);
  }

  // ---- Manage groups: every group with a switch, over the page; saved when it closes (Back) ----
  openManageGroups() {
    this.manage = { open: true, changes: new Map(), index: 0, scroll: 0, returnFocus: this.nav.currentFocusedId };
    this.manage.rows = [
      { kind: 'action', label: 'Show all groups', run: (m) => this.groups.forEach((g) => m.changes.set(g.id, false)) },
      { kind: 'action', label: 'Hide all groups', run: (m) => this.groups.forEach((g) => m.changes.set(g.id, true)) },
      ...this.groups.map((g) => ({ kind: 'group', g, count: this.channels.filter((c) => c.groupId === g.id).length })).filter((r) => r.count > 0)
    ];
    let panel = document.getElementById('manage');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'manage';
      panel.className = 'manage';
      document.getElementById('app').appendChild(panel);
    }
    panel.innerHTML = '<div class="manage-title">Manage groups</div><div class="manage-sub">A group that is switched off is hidden everywhere. Back saves.</div><div class="manage-view" id="manage-view"><div id="manage-rows"></div></div>';
    panel.classList.add('open');
    this.nav.setScope('manage');
    this.nav.register({ id: 'manage-list', el: panel.querySelector('#manage-view'), scope: 'manage',
      left: null, right: null,
      up: () => { this.manage.index = this.manage.index <= 0 ? this.manage.rows.length - 1 : this.manage.index - 1; this.drawManage(); return null; },
      down: () => { this.manage.index = this.manage.index >= this.manage.rows.length - 1 ? 0 : this.manage.index + 1; this.drawManage(); return null; },
      onFocus: () => this.drawManage(), onBlur: () => this.drawManage(),
      onSelect: () => this.toggleManageRow() });
    panel.querySelector('#manage-view').addEventListener('click', (e) => {
      const el = e.target.closest('[data-i]');
      if (el) { this.manage.index = +el.dataset.i; this.nav.focus('manage-list'); this.toggleManageRow(); }
    });
    this.nav.focus('manage-list');
  }

  manageHidden(g) {
    return this.manage.changes.has(g.id) ? this.manage.changes.get(g.id) : this.hiddenGroupKeys.has(g.id);
  }

  toggleManageRow() {
    const m = this.manage;
    const row = m.rows[m.index];
    if (!row) return;
    if (row.kind === 'action') row.run(m);
    else m.changes.set(row.g.id, !this.manageHidden(row.g));
    this.drawManage();
  }

  drawManage() {
    const m = this.manage;
    const view = document.getElementById('manage-view');
    const rows = document.getElementById('manage-rows');
    if (!m || !m.open || !view) return;
    const H = 84;
    const vh = view.clientHeight || 780;
    const perPage = Math.max(1, Math.floor(vh / H));
    if (m.index * H < m.scroll) m.scroll = m.index * H;
    else if ((m.index + 1) * H > m.scroll + vh) m.scroll = (m.index + 1) * H - vh;
    const first = Math.max(0, Math.floor(m.scroll / H) - 1);
    const last = Math.min(m.rows.length, first + perPage + 3);
    const focused = this.nav.currentFocusedId === 'manage-list';
    let html = '';
    for (let i = first; i < last; i++) {
      const row = m.rows[i];
      const on = row.kind === 'group' ? !this.manageHidden(row.g) : false;
      const cls = `manage-row${i === m.index && focused ? ' focused' : ''}${row.kind === 'action' ? ' action' : ''}`;
      const inner = row.kind === 'action'
        ? `<span class="manage-name">${row.label}</span>`
        : `<span class="manage-name">${this.displayName(row.g.name).replace(/[&<>]/g, '')}</span><span class="manage-count">${row.count}</span><span class="set-switch${on ? ' on' : ''}"><i></i></span>`;
      html += `<div class="${cls}" data-i="${i}" style="top:${i * H - m.scroll}px">${inner}</div>`;
    }
    rows.innerHTML = html;
  }

  closeManageGroups() {
    const m = this.manage;
    if (!m || !m.open) return;
    m.open = false;
    document.getElementById('manage').classList.remove('open');
    this.nav.unregister('manage-list');
    this.nav.setScope('main');
    // The page is read again once, not switch by switch
    if (m.changes.size) {
      m.changes.forEach((hide, id) => { if (hide) this.hiddenGroupKeys.add(id); else this.hiddenGroupKeys.delete(id); });
      this.saveChannelState();
      this.activeCategoryIndex = Math.min(this.activeCategoryIndex, 1);
      this.refreshCatalogueView();
    }
    const target = m.returnFocus && this.nav.nodes.has(m.returnFocus) ? m.returnFocus : `cat-${this.activeCategoryIndex}`;
    this.nav.focus(target);
  }

  pickGroup(def) {
    if (def.fixed) return;
    this.movingGroup = this.movingGroup === def.key ? null : def.key;
    if (!this.movingGroup) this.saveChannelState();
    this.renderCategoryDrawer();
    this.syncEditMode();
    this.nav.focus(`cat-${this.activeCategoryIndex}`);
  }

  // Up and Down carry the picked-up group; the two fixed rows take no part
  moveGroup(delta) {
    const ids = this.groupDefs.filter((d) => !d.fixed).map((d) => d.key);
    const at = ids.indexOf(this.movingGroup);
    const to = at + delta;
    if (at < 0 || to < 0 || to >= ids.length) return;
    [ids[at], ids[to]] = [ids[to], ids[at]];
    const rest = this.groups.map((g) => g.id).filter((id) => !ids.includes(id));
    this.groupOrder = [...ids, ...rest];
    this.buildGroupDefs();
    this.activeCategoryIndex = this.groupDefs.findIndex((d) => d.key === this.movingGroup);
    this.renderCategoryDrawer();
    this.nav.focus(`cat-${this.activeCategoryIndex}`);
  }

  setupPreviewPlayer() {
    const starBtn = document.getElementById('btn-favorite-star');
    if (starBtn) {
      this.nav.register({
        id: 'btn-favorite-star',
        el: starBtn,
        scope: 'main',
        left: null,
        right: null,
        up: 'btn-filter',
        down: () => (this.currentDisplayList.length && !this.groupsOpen ? 'guide-list' : `cat-${this.activeCategoryIndex}`),
        onSelect: () => this.toggleFavorite(this.infoChannel)
      });
      starBtn.addEventListener('click', () => this.toggleFavorite(this.infoChannel));
    }

    // Start live playback in the preview monitor immediately
    this.tuneChannel(this.currentChannel, false);
  }

  tuneChannel(channel, record = true) {
    if (!channel) return;
    this.currentChannel = channel;
    if (record) storage.set(this.stateKey('last'), channel.id);
    this.updateChannelInfo(channel);
    this.markPlayingRow();

    if (this.setupView && this.setupView.isOpen) return; // the live preview stays off while setup is on screen
    console.log('[AvaPlay] Tuning channel:', channel.name);
    this.clearSubtitleText();
    this.setPlayerStatus('Opening stream…', false);
    player.play(channel.streamUrl, true);

    if (record) this.recordRecentChannel(channel);
    if (this.isFullscreen) this.updateFullscreenChannelInfo(channel);
    this.updatePreviewVideoPosition();
  }

  markPlayingRow() {
    this.renderRows();
  }

  setupPlayerEvents() {
    player.subscribe((event, data) => {
      if (event === 'buffering') this.setPlayerStatus(data ? 'Reconnecting…' : '', !data);
      else if (event === 'error') this.setPlayerStatus('Stream unavailable. Retrying…', false);
    });
    const vid = document.getElementById('avplay-html5-fallback');
    if (vid) vid.addEventListener('loadeddata', () => this.setPlayerStatus('', true));
  }

  setPlayerStatus(text, playing) {
    if (playing) this.applyTrackPreferences();
    const osd = document.getElementById('player-fullscreen-osd');
    const status = document.getElementById('fs-status');
    if (status) status.textContent = text;
    if (osd) osd.classList.toggle('playing', !!playing);
    if (playing && this.isFullscreen) this.revealFullscreenOsd();
  }

  loadRecentChannels() {
    const ids = storage.getRecentChannels();
    if (!Array.isArray(ids) || ids.length === 0) return;
    const byId = new Map(this.channels.map(c => [c.id, c]));
    this.recentChannels = ids.map(id => byId.get(id)).filter(Boolean);
  }

  recordRecentChannel(channel) {
    if (!channel || !channel.id) return;
    this.recentChannels = [channel, ...this.recentChannels.filter(c => c.id !== channel.id)].slice(0, 12);
    storage.saveRecentChannels(this.recentChannels.map(c => c.id));
    if (this.recentsOpen) this.renderRecents();
  }

  updatePreviewVideoPosition() {
    const vid = document.getElementById('avplay-html5-fallback');
    const previewBox = document.getElementById('preview-box');
    if (player.hasNativeAvplay) {
      if (this.isFullscreen) { player.setRect(0, 0, 1920, 1080); this.setVideoHole('full'); return; }
      if (this.currentView !== 'livetv' || !previewBox) { this.setVideoHole(null); return; }
      const r = previewBox.getBoundingClientRect();
      player.setRect(r.left, r.top, r.width, r.height);
      this.setVideoHole(r);
      return;
    }
    if (!vid || !previewBox) return;
    if (this.setupView && this.setupView.isOpen) { vid.style.visibility = 'hidden'; this.setVideoHole(null); return; }
    if (this.isFullscreen) { vid.style.visibility = 'visible'; this.setVideoHole('full'); return; }

    // The video element lives behind the page, so hide it outside Live TV
    vid.style.visibility = this.currentView === 'livetv' ? 'visible' : 'hidden';
    if (this.currentView !== 'livetv') this.setVideoHole(null);

    const rect = previewBox.getBoundingClientRect();
    vid.style.position = 'fixed';
    vid.style.top = `${rect.top}px`;
    vid.style.left = `${rect.left}px`;
    vid.style.width = `${rect.width}px`;
    vid.style.height = `${rect.height}px`;
    vid.style.borderRadius = '0px';
    vid.style.zIndex = '0';
    vid.style.objectFit = 'cover';
    vid.style.transform = 'none';
    if (this.currentView === 'livetv') this.setVideoHole(rect);
  }

  openFullscreenPlayer(channel) {
    if (!channel) return;
    this.isFullscreen = true;
    const appEl = document.getElementById('app');
    if (appEl) appEl.classList.add('fullscreen-player-mode');
    this.updatePreviewVideoPosition();

    if (this.currentChannel !== channel) this.tuneChannel(channel);
    this.updateFullscreenChannelInfo(channel);

    const vid = document.getElementById('avplay-html5-fallback');
    if (vid) {
      vid.style.visibility = 'visible';
      Object.assign(vid.style, this.fullVideoBox());
      vid.style.zIndex = '0';
    }
    this.applyScreenSize(this.screenSize);

    const fsClock = document.getElementById('fs-clock');
    if (fsClock) fsClock.textContent = this.formatClock(new Date());

    this.nav.setScope('fullscreen_player');

    // One focus target for the whole player. D-pad meaning depends on which overlay is open.
    this.nav.register({
      id: 'fs-surface',
      el: null,
      scope: 'fullscreen_player',
      left: () => {
        if (this.submenuOpen) this.closeSubmenu();
        else if (this.menuOpen) this.moveFullscreenMenu(-1);
        else if (this.historyOpen) this.closeHistory();
        else if (this.recentsOpen) this.moveRecents(-1);
        else if (this.browserOpen) this.browserLeft();
        else this.openChannelBrowser();
        return null;
      },
      right: () => {
        if (this.submenuOpen) this.applySubmenu();
        else if (this.menuOpen) this.moveFullscreenMenu(1);
        else if (this.historyOpen) { /* panel is at the right edge */ }
        else if (this.recentsOpen) this.moveRecents(1);
        else if (this.browserOpen) this.browserRight();
        else this.openRecents();
        return null;
      },
      up: () => {
        if (this.browserOpen) this.browserMove(-1);
        else if (this.submenuOpen) this.moveSubmenu(-1);
        else if (this.menuOpen) this.closeFullscreenMenu(true);
        else if (this.historyOpen) this.moveHistory(-1);
        else if (this.recentsOpen) this.closeRecents();
        else this.zapFullscreenChannel(1);
        return null;
      },
      down: () => {
        if (this.browserOpen) this.browserMove(1);
        else if (this.submenuOpen) this.moveSubmenu(1);
        else if (this.menuOpen) { /* bar is the bottom-most layer */ }
        else if (this.historyOpen) this.moveHistory(1);
        else if (this.recentsOpen) this.openFullscreenMenu();
        else this.zapFullscreenChannel(-1);
        return null;
      },
      onSelect: () => {
        if (this.browserOpen) this.browserSelect();
        else if (this.submenuOpen) this.applySubmenu();
        else if (this.menuOpen) this.activateFullscreenMenu();
        else if (this.historyOpen) this.selectHistoryChannel();
        else if (this.recentsOpen) this.activateStripItem();
        else this.openRecents();
      }
    });
    this.nav.focus('fs-surface');
    this.revealFullscreenOsd();
  }

  // --- Channel strip: TV guide, History, then the other channels in the list ---
  stripItems() {
    const list = this.currentDisplayList.length ? this.currentDisplayList : this.getVisibleChannels();
    const channels = list.filter(c => c !== this.currentChannel).slice(0, 40);
    return [{ type: 'guide' }, { type: 'history' }, ...channels.map(ch => ({ type: 'channel', ch }))];
  }

  openRecents() {
    this.closeHistory();
    this.recentsOpen = true;
    this.recentsIndex = 0;
    this.renderRecents();
    const el = document.getElementById('fs-recents');
    if (el) el.classList.add('active');
    const osd = document.getElementById('player-fullscreen-osd');
    if (osd) { osd.classList.add('active', 'with-strip'); }
    this.armRecentsHide();
  }

  closeRecents(restoreOsd = true) {
    if (!this.recentsOpen) return;
    this.recentsOpen = false;
    this.closeFullscreenMenu(false);
    if (this.recentsTimer) {
      clearTimeout(this.recentsTimer);
      this.recentsTimer = null;
    }
    const el = document.getElementById('fs-recents');
    if (el) el.classList.remove('active');
    const osd = document.getElementById('player-fullscreen-osd');
    if (osd) osd.classList.remove('with-strip');
    if (restoreOsd) this.revealFullscreenOsd();
  }

  armRecentsHide() {
    if (this.recentsTimer) clearTimeout(this.recentsTimer);
    this.recentsTimer = setTimeout(() => {
      if (!this.menuOpen && !this.historyOpen) this.closeRecents();
    }, 8000);
  }

  renderRecents() {
    const list = document.getElementById('fs-recents-list');
    if (!list) return;
    list.innerHTML = '';
    const I = {
      guide: '<svg viewBox="0 0 24 24"><path d="M3 5h4v4H3zm6 0h12v4H9zM3 10h4v4H3zm6 0h12v4H9zM3 15h4v4H3zm6 0h12v4H9z"/></svg>',
      history: '<svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>'
    };
    this.stripItems().forEach((item, i) => {
      const tile = document.createElement('div');
      tile.className = `fs-tile${item.type !== 'channel' ? ' action' : ''}${i === this.recentsIndex ? ' selected' : ''}`;
      if (item.type === 'channel') {
        tile.innerHTML = `<div class="fs-tile-art ${item.ch.logoClass || ''}"><span>${item.ch.logoText || 'TV'}</span></div><div class="fs-tile-label"></div>`;
        tile.querySelector('.fs-tile-label').textContent = this.chName(item.ch);
      } else {
        tile.innerHTML = `<div class="fs-tile-art">${I[item.type]}</div><div class="fs-tile-label">${item.type === 'guide' ? 'TV guide' : 'History'}</div>`;
      }
      tile.addEventListener('click', () => { this.recentsIndex = i; this.activateStripItem(); });
      list.appendChild(tile);
    });
    // Keep the selected tile in view
    const first = Math.max(0, this.recentsIndex - 5);
    list.style.transform = `translateX(${-first * 252}px)`;
  }

  moveRecents(delta) {
    if (!this.recentsOpen) return;
    const count = this.stripItems().length;
    this.recentsIndex = Math.max(0, Math.min(count - 1, this.recentsIndex + delta));
    this.renderRecents();
    this.armRecentsHide();
  }

  activateStripItem() {
    const item = this.stripItems()[this.recentsIndex];
    if (!item) return;
    if (item.type === 'guide') {
      this.closeFullscreenPlayer();
    } else if (item.type === 'history') {
      this.openHistory();
    } else {
      this.tuneChannel(item.ch);
      const listIndex = this.currentDisplayList.indexOf(item.ch);
      if (listIndex >= 0) this.activeChannelIndex = listIndex;
      this.closeRecents();
    }
  }

  // Back-compat for the recent-channel list that the old overlay exposed
  selectRecentChannel() { this.activateStripItem(); }

  // --- History side panel ---
  openHistory() {
    if (!this.recentChannels.length) {
      this.showToast('No history yet');
      return;
    }
    this.historyOpen = true;
    this.historyIndex = 0;
    this.renderHistory();
    const el = document.getElementById('fs-history');
    if (el) el.classList.add('active');
    if (this.recentsTimer) { clearTimeout(this.recentsTimer); this.recentsTimer = null; }
  }

  closeHistory() {
    if (!this.historyOpen) return;
    this.historyOpen = false;
    const el = document.getElementById('fs-history');
    if (el) el.classList.remove('active');
    if (this.recentsOpen) this.armRecentsHide();
  }

  renderHistory() {
    const list = document.getElementById('fs-history-list');
    if (!list) return;
    list.innerHTML = '';
    this.recentChannels.forEach((ch, i) => {
      const row = document.createElement('div');
      row.className = `fs-history-item${i === this.historyIndex ? ' selected' : ''}`;
      row.innerHTML = '<span></span>' + (ch === this.currentChannel ? '<span class="check">✓</span>' : '');
      row.querySelector('span').textContent = ch.name;
      row.addEventListener('click', () => { this.historyIndex = i; this.selectHistoryChannel(); });
      list.appendChild(row);
    });
    const sel = list.querySelector('.selected');
    if (sel) list.scrollTop = Math.max(0, sel.offsetTop - 5 * 84);
  }

  moveHistory(delta) {
    const n = this.recentChannels.length;
    if (!n) return;
    this.historyIndex = Math.max(0, Math.min(n - 1, this.historyIndex + delta));
    this.renderHistory();
  }

  selectHistoryChannel() {
    const ch = this.recentChannels[this.historyIndex];
    if (!ch) return;
    this.closeHistory();
    this.tuneChannel(ch);
    const listIndex = this.currentDisplayList.indexOf(ch);
    if (listIndex >= 0) this.activeChannelIndex = listIndex;
    this.closeRecents();
  }

  // --- Player options bar (Down from the channel strip), same items as the Android app ---
  fsMenuIcons() {
    return {
      search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
      list: '<svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>',
      star: '<svg viewBox="0 0 24 24"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
      video: '<svg viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>',
      audio: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
      captions: '<svg viewBox="0 0 24 24"><path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1z"/></svg>',
      aspect: '<svg viewBox="0 0 24 24"><path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16.01H3V4.99h18v14.02z"/></svg>',
      info: '<svg viewBox="0 0 24 24"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>'
    };
  }

  // Tracks come from the stream itself (the TV player, hls.js or the browser), named by language
  getAudioTracks() {
    this.audioTrackList = player.getTracks('AUDIO');
    return this.audioTrackList.length ? this.audioTrackList.map((t) => t.label) : ['Default'];
  }

  getSubtitleTracks() {
    this.textTrackList = player.getTracks('TEXT');
    return ['Off', ...this.textTrackList.map((t) => t.label)];
  }

  // The extra entry at the end of the Subtitles list
  static get ADD_SUBTITLE() { return 'Add subtitle file…'; }

  // A small box to paste the link of an .srt / .vtt file into; OK loads it, Back cancels
  promptSubtitleUrl() {
    let box = document.getElementById('sub-prompt');
    if (!box) {
      box = document.createElement('div');
      box.id = 'sub-prompt';
      box.className = 'sub-prompt';
      box.innerHTML = '<div class="sub-prompt-card"><h3>Add a subtitle file</h3><p>Paste the link to an .srt or .vtt file, then press OK.</p><input id="sub-prompt-input" autocomplete="off" spellcheck="false" placeholder="https://…/film.srt"><div id="sub-prompt-msg" class="sub-prompt-msg"></div></div>';
      document.getElementById('app').appendChild(box);
    }
    const input = box.querySelector('input');
    input.value = '';
    box.querySelector('#sub-prompt-msg').textContent = '';
    box.classList.add('open');
    this.subPromptOpen = true;
    this.subPromptReturn = { scope: this.nav.activeScope, focus: this.nav.currentFocusedId };
    this.nav.setScope('subprompt');
    this.nav.register({ id: 'sub-prompt', el: null, scope: 'subprompt', left: null, right: null, up: null, down: null, onSelect: () => this.submitSubtitleUrl() });
    this.nav.focus('sub-prompt');
    input.focus();
  }

  closeSubtitlePrompt() {
    if (!this.subPromptOpen) return;
    this.subPromptOpen = false;
    const box = document.getElementById('sub-prompt');
    if (box) { box.classList.remove('open'); box.querySelector('input').blur(); }
    this.nav.unregister('sub-prompt');
    const back = this.subPromptReturn || { scope: 'main' };
    this.nav.setScope(back.scope);
    if (back.focus && this.nav.nodes.has(back.focus)) this.nav.focus(back.focus);
  }

  async submitSubtitleUrl() {
    const box = document.getElementById('sub-prompt');
    const msg = box.querySelector('#sub-prompt-msg');
    const url = box.querySelector('input').value;
    msg.textContent = 'Loading…';
    try {
      const sub = await player.loadExternalSubtitle(url);
      this.closeSubtitlePrompt();
      this.subtitleTrack = sub.label;
      player.selectTrack('TEXT', sub.index);
      this.showToast(`Subtitles: ${sub.label}`);
      if (this.menuOpen) this.renderFullscreenMenu();
      if (this.moviesView && this.moviesView.vod.isOpen) this.moviesView.vod.renderTools();
    } catch (e) {
      msg.textContent = e.message || 'The subtitle file could not be loaded.';
    }
  }

  subtitleStyleOptions() {
    const s = settings.get();
    return [AvaPlayApp.ADD_SUBTITLE, `Size: ${(SUBTITLE_SIZES.find((x) => x[0] === s.subtitleSize) || SUBTITLE_SIZES[1])[1]}`, `Background: ${(SUBTITLE_BGS.find((x) => x[0] === s.subtitleBg) || SUBTITLE_BGS[0])[1]}`];
  }

  // The subtitle picker also carries the two style rows; this returns true when the choice was one of them
  cycleSubtitleStyle(choice) {
    const s = settings.get();
    const next = (list, current) => list[(list.findIndex((x) => x[0] === current) + 1) % list.length][0];
    if (choice.startsWith('Size:')) settings.update({ subtitleSize: next(SUBTITLE_SIZES, s.subtitleSize) });
    else if (choice.startsWith('Background:')) settings.update({ subtitleBg: next(SUBTITLE_BGS, s.subtitleBg) });
    else return false;
    return true;
  }

  // Once a stream plays, take the audio and subtitle language chosen in Settings > Playback when the stream has it
  applyTrackPreferences() {
    const s = settings.get();
    clearTimeout(this.trackTimer);
    this.trackTimer = setTimeout(() => {
      const audio = player.getTracks('AUDIO');
      const wantAudio = s.audioLanguage && audio.find((t) => t.lang === iso2(s.audioLanguage));
      if (wantAudio) { this.audioTrack = wantAudio.label; player.selectTrack('AUDIO', wantAudio.index); }
      const text = player.getTracks('TEXT');
      const wantText = s.subtitleLanguage && text.find((t) => t.lang === iso2(s.subtitleLanguage));
      if (wantText) { this.subtitleTrack = wantText.label; player.selectTrack('TEXT', wantText.index); }
      else if (!s.subtitleLanguage && text.length) { this.subtitleTrack = 'Off'; player.selectTrack('TEXT', -1); }
    }, 1200);
  }

  syncLabel() {
    const ms = this.soundDelay;
    return ms === 0 ? 'Sync off' : `Sound ${ms > 0 ? '+' : '−'}${Math.abs(ms)} ms`;
  }

  videoLabel() {
    const vid = document.getElementById('avplay-html5-fallback');
    if (this.videoResolution !== 'Auto') return this.videoResolution;
    return vid && vid.videoWidth ? `${vid.videoWidth} × ${vid.videoHeight}` : 'Quality';
  }

  getFullscreenMenu() {
    const ch = this.currentChannel;
    const I = this.fsMenuIcons();
    return [
      { id: 'search', label: 'Search', icon: I.search, type: 'action' },
      { id: 'channels', label: 'Channels list', icon: I.list, type: 'action' },
      { id: 'favorite', label: ch && ch.favorite ? 'Remove favourite' : 'Add favourite', icon: I.star, type: 'action' },
      { id: 'resolution', label: this.videoLabel(), icon: I.video, type: 'select', options: ['Auto', '1080p', '720p', '480p'] },
      { id: 'audio', label: this.audioTrack === 'Default' ? this.getAudioTracks()[0] : this.audioTrack, icon: I.audio, type: 'select', options: this.getAudioTracks() },
      { id: 'subtitles', label: this.subtitleTrack === 'Off' ? 'Subtitles off' : 'Subtitles on', icon: I.captions, type: 'select', options: [...this.getSubtitleTracks(), ...this.subtitleStyleOptions()] },
      { id: 'screensize', label: this.screenSize, icon: I.aspect, type: 'cycle', options: ['Normal', 'Full', 'Stretch', 'Zoom'] },
      { id: 'sounddelay', label: this.syncLabel(), icon: I.audio, type: 'cycle' },
      { id: 'info', label: 'Stream info', icon: I.info, type: 'action' }
    ];
  }

  openFullscreenMenu() {
    this.menuOpen = true;
    this.menuIndex = 0;
    this.submenuOpen = false;
    if (this.recentsTimer) {
      clearTimeout(this.recentsTimer);
      this.recentsTimer = null;
    }
    const recentsEl = document.getElementById('fs-recents');
    if (recentsEl) recentsEl.classList.remove('active');
    const osd = document.getElementById('player-fullscreen-osd');
    if (osd) osd.classList.add('menu-open');
    const menuEl = document.getElementById('fs-menu');
    if (menuEl) menuEl.classList.add('active');
    this.renderFullscreenMenu();
  }

  closeFullscreenMenu(restoreRecents = true) {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    this.submenuOpen = false;
    const menuEl = document.getElementById('fs-menu');
    if (menuEl) menuEl.classList.remove('active');
    const subEl = document.getElementById('fs-menu-sub');
    if (subEl) subEl.classList.remove('active');
    const osd = document.getElementById('player-fullscreen-osd');
    if (osd) osd.classList.remove('menu-open');
    if (restoreRecents && this.recentsOpen) {
      const recentsEl = document.getElementById('fs-recents');
      if (recentsEl) recentsEl.classList.add('active');
      this.armRecentsHide();
    } else if (!this.recentsOpen) {
      this.revealFullscreenOsd();
    }
  }

  renderFullscreenMenu() {
    const el = document.getElementById('fs-menu-list');
    if (!el) return;
    el.innerHTML = '';
    this.getFullscreenMenu().forEach((item, i) => {
      const cell = document.createElement('div');
      cell.className = `fs-menu-item${i === this.menuIndex ? ' selected' : ''}`;
      cell.innerHTML = `<div class="fs-menu-icon">${item.icon}</div><span class="fs-menu-label"></span>`;
      cell.querySelector('.fs-menu-label').textContent = item.label;
      cell.addEventListener('click', () => {
        this.menuIndex = i;
        this.renderFullscreenMenu();
        this.activateFullscreenMenu();
      });
      el.appendChild(cell);
    });
  }

  moveFullscreenMenu(delta) {
    const count = this.getFullscreenMenu().length;
    this.menuIndex = Math.max(0, Math.min(count - 1, this.menuIndex + delta));
    this.renderFullscreenMenu();
  }

  activateFullscreenMenu() {
    const item = this.getFullscreenMenu()[this.menuIndex];
    if (!item) return;
    if (item.id === 'search') {
      this.showToast('Search');
    } else if (item.id === 'channels') {
      this.closeFullscreenMenu(false);
      this.openChannelBrowser();
    } else if (item.id === 'favorite') {
      this.toggleFavorite(this.currentChannel);
      this.renderFullscreenMenu();
    } else if (item.id === 'screensize') {
      const i = item.options.indexOf(this.screenSize);
      this.screenSize = item.options[(i + 1) % item.options.length];
      this.applyScreenSize(this.screenSize);
      this.renderFullscreenMenu();
    } else if (item.id === 'sounddelay') {
      const next = SYNC_STEPS.find((v) => v > this.soundDelay);
      settings.update({ audioSync: next === undefined ? SYNC_STEPS[0] : next });
      this.renderFullscreenMenu();
    } else if (item.id === 'info') {
      this.openStreamInfo();
    } else if (item.type === 'select') {
      this.openSubmenu(item);
    }
  }

  openStreamInfo() {
    const ch = this.currentChannel;
    const vid = document.getElementById('avplay-html5-fallback');
    const rows = [
      ['Channel', `${ch.number}  ${ch.name}`],
      ['Group', ch.group || '-'],
      ['Video', vid && vid.videoWidth ? `${vid.videoWidth} × ${vid.videoHeight}` : 'Unknown'],
      ['Audio', this.audioTrack],
      ['Subtitles', this.subtitleTrack],
      ['Screen size', this.screenSize],
      ['Sound delay', this.syncLabel()],
      ['Player', window.webapis && window.webapis.avplay ? 'Samsung AVPlay' : 'HTML5 video']
    ];
    this.openDialog('Stream info', rows.map(([label, value]) => ({ label, value, action: () => {} })));
  }

  openSubmenu(item) {
    this.submenuOpen = true;
    const idx = item.options.indexOf(this.getMenuValueFor(item.id));
    this.submenuIndex = idx >= 0 ? idx : 0;
    this.renderSubmenu(item);
  }

  renderSubmenu(item) {
    const el = document.getElementById('fs-menu-sub');
    if (!el) return;
    const current = this.getMenuValueFor(item.id);
    el.innerHTML = '';
    item.options.forEach((opt, i) => {
      const row = document.createElement('div');
      row.className = `fs-sub-item${i === this.submenuIndex ? ' selected' : ''}${opt === current ? ' current' : ''}`;
      row.textContent = opt;
      row.addEventListener('click', () => {
        this.submenuIndex = i;
        this.applySubmenu();
      });
      el.appendChild(row);
    });
    el.classList.add('active');
    // Sit the list above the selected icon
    el.style.left = `${Math.max(20, Math.min(1920 - 380, 131 + this.menuIndex * 207.3 - 180))}px`;
  }

  moveSubmenu(delta) {
    const item = this.getFullscreenMenu()[this.menuIndex];
    if (!item || !item.options) return;
    this.submenuIndex = (this.submenuIndex + delta + item.options.length) % item.options.length;
    this.renderSubmenu(item);
  }

  closeSubmenu() {
    if (!this.submenuOpen) return;
    this.submenuOpen = false;
    const el = document.getElementById('fs-menu-sub');
    if (el) el.classList.remove('active');
  }

  getMenuValueFor(id) {
    if (id === 'resolution') return this.videoResolution;
    if (id === 'audio') return this.audioTrack;
    if (id === 'subtitles') return this.subtitleTrack;
    if (id === 'screensize') return this.screenSize;
    return null;
  }

  applySubmenu() {
    const item = this.getFullscreenMenu()[this.menuIndex];
    if (!item || !item.options) return;
    const chosen = item.options[this.submenuIndex];
    if (item.id === 'resolution') this.videoResolution = chosen;
    else if (item.id === 'audio') { this.audioTrack = chosen; this.applyAudioTrack(chosen); }
    else if (item.id === 'subtitles') {
      // Size and Background cycle in place and keep the list open
      if (chosen === AvaPlayApp.ADD_SUBTITLE) { this.closeSubmenu(); this.promptSubtitleUrl(); return; }
      if (this.cycleSubtitleStyle(chosen)) { this.renderSubmenu(this.getFullscreenMenu()[this.menuIndex]); return; }
      this.subtitleTrack = chosen; this.applySubtitleTrack(chosen);
    }
    this.closeSubmenu();
    this.renderFullscreenMenu();
    this.showToast(chosen);
  }

  applyAudioTrack(label) {
    const t = (this.audioTrackList || []).find((x) => x.label === label);
    if (t) player.selectTrack('AUDIO', t.index);
  }

  applySubtitleTrack(label) {
    if (label === 'Off') { player.selectTrack('TEXT', -1); return; }
    const t = (this.textTrackList || []).find((x) => x.label === label);
    if (t) player.selectTrack('TEXT', t.index);
  }

  applyScreenSize(mode) {
    if (player.hasNativeAvplay) { player.setPictureSize(mode); return; }
    const vid = document.getElementById('avplay-html5-fallback');
    if (!vid) return;
    const map = {
      Normal: { fit: 'contain', transform: 'none' },
      Full: { fit: 'cover', transform: 'none' },
      Stretch: { fit: 'fill', transform: 'none' },
      Zoom: { fit: 'cover', transform: 'scale(1.15)' }
    };
    const cfg = map[mode] || map.Normal;
    vid.style.objectFit = cfg.fit;
    vid.style.transform = cfg.transform;
  }

  showToast(message) {
    const el = document.getElementById('fs-toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('active');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('active'), 1800);
  }

  revealFullscreenOsd() {
    const fsOsd = document.getElementById('player-fullscreen-osd');
    if (!fsOsd) return;
    fsOsd.classList.add('active');
    if (this.fsOsdTimer) clearTimeout(this.fsOsdTimer);
    this.fsOsdTimer = setTimeout(() => {
      const busy = this.recentsOpen || this.menuOpen || this.historyOpen;
      // Keep the overlay up while the stream is still opening
      if (this.isFullscreen && !busy && fsOsd.classList.contains('playing')) fsOsd.classList.remove('active');
    }, 4000 * ({ SHORT: 0.6, LONG: 2 }[settings.get().overlayTime] || 1));
  }

  updateFullscreenChannelInfo(channel) {
    const title = document.getElementById('fs-channel-title');
    if (title) title.textContent = this.chName(channel);
    const num = document.getElementById('fs-num');
    if (num) num.textContent = `${channel.number}  ${this.chName(channel)}`;
    const group = document.getElementById('fs-group');
    if (group) group.textContent = channel.groupRaw || channel.group || '';
    const logo = document.getElementById('fs-logo');
    if (logo) {
      logo.innerHTML = '<span></span>';
      logo.querySelector('span').textContent = channel.logoText || 'TV';
      logo.className = `fs-logo ${channel.logoClass || ''}`;
    }
    const meta = document.querySelector('.fs-meta');
    if (meta) {
      meta.querySelectorAll('.fs-badge').forEach(el => el.remove());
      const q = (channel.name.match(/\b(4K|UHD|FHD|HD|SD)\b/i) || [])[1];
      if (q) {
        const badge = document.createElement('span');
        badge.className = 'fs-badge';
        badge.textContent = q.toUpperCase();
        meta.appendChild(badge);
      }
    }
    const prog = document.getElementById('fs-prog');
    const p = this.currentProgramme(channel);
    if (prog) prog.textContent = p ? p.title : 'No information';
    const bar = document.getElementById('fs-progress-bar');
    if (bar) {
      const pct = p ? Math.max(0, Math.min(100, ((Date.now() - p.start) / (p.end - p.start)) * 100)) : 0;
      bar.style.width = `${pct}%`;
    }
  }

  // Up = next channel (CH+), Down = previous channel, like a TV remote
  zapFullscreenChannel(delta) {
    const now = performance.now();
    if (now - this.lastZapTime < 250) return; // pace rapid D-pad repeats
    this.lastZapTime = now;

    const list = this.currentDisplayList.length ? this.currentDisplayList : this.getVisibleChannels();
    if (!list.length) return;

    let idx = list.indexOf(this.currentChannel);
    if (idx < 0) idx = this.activeChannelIndex || 0;
    idx = (idx + delta + list.length) % list.length;
    this.activeChannelIndex = idx;

    this.tuneChannel(list[idx]);
    this.revealFullscreenOsd();
  }

  closeFullscreenPlayer() {
    this.isFullscreen = false;
    this.closeHistory();
    this.closeRecents(false);
    const appEl = document.getElementById('app');
    const fsOsd = document.getElementById('player-fullscreen-osd');

    if (appEl) appEl.classList.remove('fullscreen-player-mode');
    if (fsOsd) fsOsd.classList.remove('active', 'with-strip');
    if (this.fsOsdTimer) {
      clearTimeout(this.fsOsdTimer);
      this.fsOsdTimer = null;
    }

    this.nav.unregister('fs-surface');
    this.nav.setScope('main');
    this.updatePreviewVideoPosition();

    // The list may now be a different group than the one that was playing
    const idx = this.currentDisplayList.indexOf(this.currentChannel);
    if (idx >= 0) this.activeChannelIndex = idx;
    if (this.currentDisplayList.length && idx >= 0) {
      this.setGroupsOpen(false);
      this.renderRows();
      this.nav.focus('guide-list');
    } else {
      this.nav.focus(`cat-${this.activeCategoryIndex}`);
    }
  }

  setupGlobalShortcuts() {
    this.nav.setCustomBackHandler(() => {
      if (this.setupView.isOpen) return this.setupView.handleBack();
      if (this.subPromptOpen) { this.closeSubtitlePrompt(); return true; }
      if (this.manage && this.manage.open) { this.closeManageGroups(); return true; }
      if (this.browserOpen) { this.handleBrowserBack(); return true; }
      if (this.dialogOpen) { this.closeDialog(); return true; }
      if (this.rowEdit !== 'NONE' || this.groupReorder) { this.exitEdit(); return true; }
      if (this.submenuOpen) { this.closeSubmenu(); return true; }
      if (this.menuOpen) { this.closeFullscreenMenu(true); return true; }
      if (this.historyOpen) { this.closeHistory(); return true; }
      if (this.recentsOpen) { this.closeRecents(); return true; }
      if (this.isFullscreen) { this.closeFullscreenPlayer(); return true; }
      if (this.currentView === 'settings' && this.settingsView.handleBack()) return true;
      if (this.isBrowse() && this.moviesView.handleBack()) return true;
      if (this.currentView !== 'livetv') { this.switchView('livetv'); return true; }
      if (!this.groupsOpen) {
        // Back from the channel list restores the group list
        this.setGroupsOpen(true);
        this.nav.focus(`cat-${this.activeCategoryIndex}`);
        return true;
      }
      return false; // Tizen exit protocol
    });

    window.addEventListener('resize', () => this.fitStage());
    this.fitStage();

    // Physical CH+ / CH- buttons zap channels while fullscreen
    this.nav.subscribe((type, data) => {
      if (type !== 'key' || !this.isFullscreen || !data) return;
      const code = data.keyCode;
      if (code === TVKeys.CH_UP) {
        if (data.event) data.event.preventDefault();
        this.zapFullscreenChannel(1);
      } else if (code === TVKeys.CH_DOWN) {
        if (data.event) data.event.preventDefault();
        this.zapFullscreenChannel(-1);
      }
    });
  }

  // ---- native video plane (Samsung AVPlay) ----
  // The TV draws video on a plane behind the page, so the page needs a hole where the picture shows.
  setVideoHole(rect) {
    const bg = document.getElementById('app-bg');
    if (!bg) return;
    bg.style.display = '';
    bg.style.clipPath = bg.style.webkitClipPath = '';
    if (rect === 'full') { bg.style.display = 'none'; return; }
    if (!rect) return;
    // The hole is cut in the page's own 1920 x 1080 pixels; a rectangle measured on the window is converted back to them
    // (on the TV the page is the window, so nothing changes)
    const page = document.getElementById('app').getBoundingClientRect();
    const k = page.width ? 1920 / page.width : 1;
    const x = Math.round((rect.left - page.left) * k), y = Math.round((rect.top - page.top) * k);
    const r = Math.round((rect.left + rect.width - page.left) * k), b = Math.round((rect.top + rect.height - page.top) * k);
    const path = `polygon(evenodd, 0 0, 1920px 0, 1920px 1080px, 0 1080px, 0 0, ${x}px ${y}px, ${x}px ${b}px, ${r}px ${b}px, ${r}px ${y}px, ${x}px ${y}px)`;
    bg.style.clipPath = bg.style.webkitClipPath = path;
  }

  // ---- Channel browser in the player (Left): this group's channels, and Left again for the other groups ----
  openChannelBrowser() {
    const cur = this.currentChannel;
    if (!cur) return;
    this.closeRecents(false);
    const inList = this.currentDisplayList.includes(cur);
    const key = inList ? this.activeGroupKey() : (this.groupDefs.some((d) => d.key === cur.groupId) ? cur.groupId : 'ALL');
    this.browser = { key, groupsShown: false, scroll: 0, gScroll: 0 };
    this.browser.list = this.getChannelsFor(key);
    this.browser.index = Math.max(0, this.browser.list.indexOf(cur));
    this.browserOpen = true;
    let el = document.getElementById('fs-browser');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fs-browser';
      el.className = 'fs-browser';
      document.getElementById('app').appendChild(el);
    }
    el.classList.add('open');
    this.hideFullscreenOsd();
    this.drawBrowser();
  }

  hideFullscreenOsd() {
    const osd = document.getElementById('player-fullscreen-osd');
    if (this.fsOsdTimer) clearTimeout(this.fsOsdTimer);
    if (osd) osd.classList.remove('active', 'with-strip');
  }

  closeChannelBrowser() {
    this.browserOpen = false;
    const el = document.getElementById('fs-browser');
    if (el) el.classList.remove('open');
  }

  handleBrowserBack() {
    if (this.browser && this.browser.groupsShown) { this.browser.groupsShown = false; this.drawBrowser(); return; }
    this.closeChannelBrowser();
  }

  browserLeft() {
    const b = this.browser;
    if (!b.groupsShown) {
      // The groups come in beside the channels; the one in use is highlighted
      b.groupsShown = true;
      b.gIndex = Math.max(0, this.groupDefs.findIndex((d) => d.key === b.key));
      this.drawBrowser();
    }
  }

  browserRight() {
    if (this.browser.groupsShown) { this.browser.groupsShown = false; this.drawBrowser(); }
  }

  // Up and Down carry on at the ends of the list
  browserMove(delta) {
    const b = this.browser;
    if (b.groupsShown) {
      const n = this.groupDefs.length;
      b.gIndex = (b.gIndex + delta + n) % n;
      // Moving through the groups changes the channels at once
      b.key = this.groupDefs[b.gIndex].key;
      b.list = this.getChannelsFor(b.key);
      const at = b.list.indexOf(this.currentChannel);
      b.index = Math.max(0, at);
      b.scroll = 0;
    } else {
      const n = b.list.length;
      if (!n) return;
      b.index = (b.index + delta + n) % n;
    }
    this.drawBrowser();
  }

  browserSelect() {
    const b = this.browser;
    if (b.groupsShown) { this.browserRight(); return; }
    const ch = b.list[b.index];
    if (!ch) return;
    // The list the player zaps through follows the group the channel was chosen from
    const gi = this.groupDefs.findIndex((d) => d.key === b.key);
    if (gi >= 0 && gi !== this.activeCategoryIndex) {
      this.activeCategoryIndex = gi;
      this.renderCategoryDrawer();
      this.renderCategoryChannels(b.key, false);
    }
    const at = this.currentDisplayList.indexOf(ch);
    if (at >= 0) this.activeChannelIndex = at;
    this.closeChannelBrowser();
    this.tuneChannel(ch);
    this.updateFullscreenChannelInfo(ch);
    this.revealFullscreenOsd();
  }

  drawBrowser() {
    const el = document.getElementById('fs-browser');
    const b = this.browser;
    if (!el || !b) return;
    const ROW = 104;
    const VIEW = 940;
    const groupsHtml = () => {
      const GROW = 92;
      let scroll = Math.max(0, b.gIndex * GROW - VIEW / 2);
      return `<div class="fsb-groups"><div class="fsb-head">GROUPS</div><div class="fsb-view">${this.groupDefs.map((d, i) => {
        const top = i * GROW - scroll;
        if (top < -GROW || top > VIEW + GROW) return '';
        return `<div class="fsb-grow${i === b.gIndex ? ' focused' : ''}${d.key === b.key ? ' current' : ''}" style="top:${top}px">${d.label.replace(/[&<>]/g, '')}</div>`;
      }).join('')}</div></div>`;
    };
    const def = this.groupDefs.find((d) => d.key === b.key);
    // The focused row stays in the middle of the list
    b.scroll = Math.max(0, b.index * ROW - (VIEW - ROW) / 2);
    const rows = b.list.map((ch, i) => {
      const top = i * ROW - b.scroll;
      if (top < -ROW || top > VIEW + ROW) return '';
      const playing = ch === this.currentChannel;
      const prog = this.currentProgramme(ch);
      return `<div class="fsb-row${i === b.index ? ' focused' : ''}${playing ? ' playing' : ''}" style="top:${top}px"><span class="fsb-logo">${ch.icon ? `<img src="${String(ch.icon).replace(/"/g, '')}" referrerpolicy="no-referrer" alt="" onerror="this.remove()">` : ''}<b>${ch.logoText || 'TV'}</b></span><span class="fsb-text"><span class="fsb-name">${i + 1}  ${this.chName(ch).replace(/[&<>]/g, '')}</span><span class="fsb-prog">${prog ? prog.title.replace(/[&<>]/g, '') : 'No information'}</span></span>${playing ? '<span class="fsb-play">▶</span>' : ''}</div>`;
    }).join('');
    el.innerHTML = `${b.groupsShown ? groupsHtml() : ''}<div class="fsb-channels"><div class="fsb-title">${def ? def.label.replace(/[&<>]/g, '') : 'Channels'}</div><div class="fsb-view">${rows || '<div class="fsb-empty">No channels in this group.</div>'}</div></div>`;
  }

  // ---- subtitles the player hands over as text ----
  setupSubtitleLayer() {
    const layer = document.createElement('div');
    layer.id = 'sub-layer';
    layer.className = 'sub-layer';
    layer.innerHTML = '<span></span>';
    document.getElementById('app').appendChild(layer);
    this.subLayer = layer;
    player.subscribe((event, data) => { if (event === 'subtitle') this.showSubtitleText(data); });
  }

  showSubtitleText({ text, duration }) {
    clearTimeout(this.subTimer);
    const clean = String(text || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
    this.subLayer.classList.toggle('on', !!clean);
    this.subLayer.querySelector('span').textContent = clean;
    if (clean) this.subTimer = setTimeout(() => this.showSubtitleText({ text: '' }), Math.max(1500, duration || 4000));
  }

  clearSubtitleText() { this.showSubtitleText({ text: '' }); }

  // ---- desktop browser: the 1920 x 1080 TV screen is scaled to fit the window, so video and overlays line up ----
  fitStage() {
    if (player.hasNativeAvplay) return;
    const app = document.getElementById('app');
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    const x = (window.innerWidth - 1920 * s) / 2;
    const y = (window.innerHeight - 1080 * s) / 2;
    document.documentElement.classList.add('browser');
    app.style.transformOrigin = '0 0';
    app.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    this.syncFullVideo();
  }

  /** The video element's box when it fills the whole TV screen (fullscreen, film player, hero preview) */
  fullVideoBox() {
    const r = document.getElementById('app').getBoundingClientRect();
    return { top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: '0px' };
  }

  syncFullVideo() {
    const vid = document.getElementById('avplay-html5-fallback');
    if (!vid || player.hasNativeAvplay) return;
    const full = this.isFullscreen || (this.moviesView && (this.moviesView.vod.isOpen || this.moviesView.el.cinema.classList.contains('playing')));
    if (full) Object.assign(vid.style, this.fullVideoBox());
    else this.updatePreviewVideoPosition();
  }

  isBrowse() { return this.currentView === 'movies' || this.currentView === 'series'; }

  // The film pages use the same player as the Live TV preview, so one gives way to the other
  suspendLivePreview() {
    player.stop();
    this.setVideoHole(null);
    this.clearSubtitleText();
    const vid = document.getElementById('avplay-html5-fallback');
    if (vid) vid.style.visibility = 'hidden';
  }

  resumeLivePreview() {
    if (this.currentChannel && this.currentView === 'livetv') this.tuneChannel(this.currentChannel, false);
  }

  switchView(viewName) {
    // Movies and TV Shows are one browse screen
    const kind = viewName === 'series' ? 'SHOW' : 'MOVIE';
    if (this.isBrowse() && (viewName === 'movies' || viewName === 'series')) {
      if (viewName === this.currentView) {
        this.moviesView.setHeaderShown(false);
        this.moviesView.focusGrid();
        return;
      }
      this.moviesView.close();
    }
    this.currentView = viewName;
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.header-tab').forEach(t => t.classList.toggle('active', t.dataset.view === viewName));

    const target = document.getElementById(`view-${viewName === 'series' ? 'movies' : viewName}`);
    if (target) target.classList.add('active');
    const gear = document.getElementById('btn-settings');
    if (gear) gear.classList.toggle('active', viewName === 'settings');
    this.updatePreviewVideoPosition();

    if (viewName === 'settings') this.settingsView.open();
    else this.settingsView.close();
    if (viewName === 'movies' || viewName === 'series') this.moviesView.open(kind);
    else if (this.moviesView.root.classList.contains('open')) { this.moviesView.close(); this.resumeLivePreview(); }

    if (viewName === 'livetv') {
      this.nav.focus(this.groupsOpen ? `cat-${this.activeCategoryIndex}` : 'guide-list');
    }
  }
}

// Bootstrap application on load
window.addEventListener('load', () => {
  window.app = new AvaPlayApp();
  // Virtual Samsung TV Remote (browser testing aid)
  window.remote = new VirtualRemote(window.app.nav, player);
});
