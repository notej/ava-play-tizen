/**
 * A TV show's own page, in two steps like the Android app (SeriesScreen.kt): first the show (title, plot, Play / Resume,
 * My List, like, dislike) with an Episodes button under it; OK or Down on it opens the panel with the seasons and one
 * row of the open season's episodes, where resting on an episode shows its own title and plot.
 */
import { setMarquee } from './marquee.js';
import { movieStore } from '../data/MovieStore.js';
import { settings } from '../data/AppSettings.js';
import {
  displayTitle, qualityBadge, titleKindFor, runtime, episodeUrl, episodeTitle, numberedTitle, seasonLabel, episodeLength
} from '../data/MovieSource.js';

const CARD_PITCH = 376;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICONS = {
  restart: '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z"/></svg>',
  saveOutline: '<svg viewBox="0 0 24 24"><path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2zm0 15-5-2.18L7 18V5h10v13z"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M1 21h4V9H1v12zm22-11a2 2 0 0 0-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59A1.99 1.99 0 0 0 7 9v10a2 2 0 0 0 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2a2 2 0 0 0 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>'
};

export class SeriesPage {
  constructor(app, movies) {
    this.app = app;
    this.movies = movies;
    this.nav = app.nav;
    this.show = null;
    this.panel = null;          // null while the show is on view, 'episodes' once the Episodes button opened its panel
    this.season = 1;
    this.focusedEp = null;
    this.ids = [];
    this.epIds = [];
    this.isOpen = false;
    this.creditTimer = null;
  }

  ensureEl() {
    if (this.el) return;
    this.el = document.createElement('div');
    this.el.className = 'mv-details mv-series';
    this.movies.el.layout.appendChild(this.el);
  }

  // ============================================================ data
  info() { return this.movies.infos[this.show.key] || {}; }

  episodes() { return this.info().episodes || []; }

  bySeason() {
    const map = new Map();
    this.episodes().forEach((e) => { if (!map.has(e.season)) map.set(e.season, []); map.get(e.season).push(e); });
    return new Map([...map.entries()].sort((a, b) => (a[0] === 0 ? 1e9 : a[0]) - (b[0] === 0 ? 1e9 : b[0])));
  }

  watched(key) { return movieStore.isWatched(key); }

  /** The episode to resume: the most recently started unfinished one, else the first unwatched, else the first. */
  resume() {
    const eps = this.episodes();
    const started = eps.filter((e) => movieStore.isStarted(e.key)).sort((a, b) => (movieStore.getProgress(b.key).updated || 0) - (movieStore.getProgress(a.key).updated || 0));
    return started[0] || eps.find((e) => !this.watched(e.key)) || eps[0] || null;
  }

  // ============================================================ open / close
  open(show) {
    this.ensureEl();
    this.show = show;
    this.panel = null;
    this.focusedEp = null;
    this.isOpen = true;
    this.movies.mode = 'series';
    this.nav.setScope('mvseries');
    this.el.classList.add('open');
    const resume = this.resume();
    this.season = resume ? resume.season : 1;
    this.render();
    this.focusDefault();
    this.movies.loadInfo(show).then(() => { if (this.isOpen && this.show === show) { const r = this.resume(); if (!this.panel) this.season = r ? r.season : this.season; this.refresh(); } });
  }

  close(refocus) {
    if (!this.isOpen) return;
    this.isOpen = false;
    clearInterval(this.creditTimer);
    this.el.classList.remove('open');
    this.unregister();
    this.nav.setScope('main');
    this.movies.mode = 'grid';
    if (refocus) {
      const m = this.movies;
      m.list = m.computeList();
      m.focused = Math.min(m.focused, Math.max(0, m.list.length - 1));
      m.renderGrid(true);
      m.renderHead();
      m.renderEmpty();
      m.focusGrid();
    }
  }

  handleBack() {
    if (this.panel) {
      this.panel = null;
      this.focusedEp = null;
      this.render();
      this.nav.focus(this.nav.nodes.has('sr-b-0') ? 'sr-b-0' : 'sr-eps');
      return true;
    }
    this.close(true);
    return true;
  }

  unregister() {
    this.ids.concat(this.epIds).forEach((id) => this.nav.unregister(id));
    this.ids = [];
    this.epIds = [];
  }

  focusDefault() {
    this.nav.focus(this.nav.nodes.has('sr-b-0') ? 'sr-b-0' : 'sr-eps');
  }

  /** Redraws the page after the data or the viewer's marks changed, keeping the remote where it was */
  refresh(keepFocus = true) {
    if (!this.isOpen) return;
    const at = keepFocus ? this.nav.currentFocusedId : null;
    this.render();
    if (at && this.nav.nodes.has(at)) this.nav.focus(at);
    else this.focusDefault();
  }

  // ============================================================ drawing
  render() {
    const show = this.show;
    const info = this.info();
    const merged = {
      ...show,
      description: info.description || show.plot || '',
      backdrop: info.backdrop || show.backdrop,
      image: info.image || show.image,
      year: info.year || show.year,
      genre: info.genre || show.genre,
      rating: info.rating || show.rating,
      cast: info.cast || show.cast || '',
      director: info.director || show.director || ''
    };
    const seasons = this.bySeason();
    const resume = this.resume();
    const eps = this.episodes();
    const started = resume ? movieStore.isStarted(resume.key) : false;
    const progress = resume ? movieStore.getProgress(resume.key) : null;
    const saved = movieStore.inLibrary(show.key);
    const rating = movieStore.rating(show.key);
    const kind = titleKindFor(merged.genre);
    const title = displayTitle(show.name);
    const shownTitle = kind === 'playful' ? title : title.toUpperCase();
    const base = title.length <= 12 ? 128 : title.length <= 26 ? 96 : 76;
    const size = Math.round(base * ({ action: 1.1, scifi: 0.85, playful: 1.15, factual: 0.9, dread: 0.9 }[kind] || 1));
    const seasonCount = [...seasons.keys()].filter((n) => n !== 0).length;
    const ep = this.focusedEp;
    const loading = !info.loaded;

    this.unregister();
    const buttons = [];
    if (!this.panel) {
      if (resume) {
        const left = started && progress && progress.duration > 0 ? ` • ${Math.max(1, Math.round((progress.duration - progress.position) / 60000))}m left` : '';
        buttons.push({ id: 'play', band: true, label: `${started ? 'Resume' : 'Play'} S${resume.season} E${resume.episode}${left}`, hint: '', run: () => this.play(resume, false) });
        if (started) buttons.push({ id: 'restart', icon: ICONS.restart, hint: 'Start from the beginning', run: () => this.play(resume, true) });
      }
      buttons.push({ id: 'save', icon: saved ? ICONS.save : ICONS.saveOutline, on: saved, accent: true, hint: saved ? 'Remove from My List' : 'Watch later', run: () => movieStore.toggleLibrary(show.key) });
      buttons.push({ id: 'like', icon: ICONS.up, on: rating > 0, hint: rating > 0 ? 'Liked' : 'Like', run: () => movieStore.rate(show.key, 1) });
      buttons.push({ id: 'dislike', icon: ICONS.down, on: rating < 0, hint: rating < 0 ? 'Disliked' : 'Dislike', run: () => movieStore.rate(show.key, -1) });
    }

    // What the left side says: the show, or the episode the remote rests on
    let textHtml;
    if (ep) {
      const pr = movieStore.getProgress(ep.key);
      const meta = [episodeLength(ep.duration), pr && pr.watched ? 'Watched' : pr && pr.position > 0 ? 'Resume' : ''].filter(Boolean).join(' • ');
      textHtml = `
        <div class="sr-ep-label">${esc(`${title} • S${ep.season} E${ep.episode}`.toUpperCase())}</div>
        <div class="sr-ep-title">${esc(episodeTitle(ep, show))}</div>
        <div class="mv-d-meta"><span>${esc(meta)}</span></div>
        <div class="mv-d-plot">${esc(ep.description || merged.description)}</div>`;
    } else {
      const q = qualityBadge(show.name);
      const rate = parseFloat(merged.rating);
      const meta = [merged.year, merged.genre, seasonCount ? `${seasonCount} season${seasonCount === 1 ? '' : 's'}` : '', rate > 0 ? `★ ${rate.toFixed(1)}` : ''].filter(Boolean).join(' • ');
      const plot = merged.description || (loading ? 'Loading details…' : '');
      textHtml = `
        <div class="mv-d-meta">${q ? `<b class="mv-badge">${q}</b>` : ''}<span>${esc(meta)}</span></div>
        <div class="mv-d-plot">${esc(plot)}</div>`;
    }

    const el = this.el;
    el.innerHTML = `
      <div class="mv-d-art"><div class="mv-d-img"></div><i class="mv-d-shade-l"></i><i class="mv-d-shade-b"></i><i class="sr-dim${this.panel ? ' on' : ''}"></i></div>
      <div class="mv-d-title kind-${kind}" style="font-size:${size}px">${esc(shownTitle)}</div>
      <div class="sr-stack">
        <div class="sr-text">${textHtml}</div>
        ${buttons.length ? `<div class="mv-d-buttons">${buttons.map((b) => (b.band
          ? `<span class="mv-d-play" data-b="${b.id}">${esc(b.label)}</span>`
          : `<span class="mv-d-round${b.on ? ' on' : ''}${b.accent && b.on ? ' accent' : ''}" data-b="${b.id}">${b.icon}</span>`)).join('')}</div><div class="mv-d-hint" id="sr-hint"></div>` : ''}
        <div class="sr-chip-row"><span class="sr-chip${this.panel ? ' on' : ''}" id="sr-eps-el">Episodes</span></div>
        ${this.panel && seasons.size > 1 ? `<div class="sr-seasons" id="sr-seasons"></div>` : ''}
        ${this.panel ? '<div class="sr-eps"><div class="sr-eps-track" id="sr-eps-track"></div></div>' : ''}
        ${!loading && !eps.length ? '<div class="sr-none">No episodes available from this provider.</div>' : ''}
      </div>
      <div class="mv-d-credits sr-credits" id="sr-credits"></div>`;
    el.querySelector('.mv-d-img').style.backgroundImage = `url("${merged.backdrop || (ep && ep.image) || merged.image}")`;

    // ---- buttons
    const els = el.querySelectorAll('[data-b]');
    buttons.forEach((b, i) => {
      const id = `sr-b-${i}`;
      this.ids.push(id);
      const act = () => { b.run(); if (this.isOpen && this.movies.mode === 'series') this.refresh(true); };
      this.nav.register({
        id, el: els[i], scope: 'mvseries',
        left: i > 0 ? `sr-b-${i - 1}` : null,
        right: i < buttons.length - 1 ? `sr-b-${i + 1}` : null,
        up: null, down: 'sr-eps',
        onFocus: () => { const h = document.getElementById('sr-hint'); if (h) h.textContent = b.hint; },
        onSelect: act
      });
      els[i].addEventListener('click', () => { this.nav.focus(id); act(); });
    });

    // ---- Episodes button
    this.ids.push('sr-eps');
    this.nav.register({
      id: 'sr-eps', el: el.querySelector('#sr-eps-el'), scope: 'mvseries',
      left: null, right: null,
      up: () => (this.panel ? null : (buttons.length ? 'sr-b-0' : null)),
      down: () => { if (!this.panel) { this.openPanel(); return null; } return this.firstPanelId(); },
      onSelect: () => (this.panel ? this.nav.focus(this.firstPanelId()) : this.openPanel())
    });
    el.querySelector('#sr-eps-el').addEventListener('click', () => { this.nav.focus('sr-eps'); if (!this.panel) this.openPanel(); });

    if (this.panel) { this.renderSeasons(seasons); this.renderEpisodes(seasons); }
    this.renderCredits(merged, seasonCount, eps.length);
  }

  firstPanelId() {
    return this.nav.nodes.has(`sr-s-${this.season}`) ? `sr-s-${this.season}` : this.epIds[0] || 'sr-eps';
  }

  openPanel() {
    this.panel = 'episodes';
    this.render();
    this.nav.focus(this.firstPanelId());
  }

  // ---- seasons: resting on one opens it, so the row below always matches the highlighted season
  renderSeasons(seasons) {
    const box = document.getElementById('sr-seasons');
    if (!box) return;
    const keys = [...seasons.keys()];
    keys.forEach((n, i) => {
      const list = seasons.get(n);
      const done = list.filter((e) => this.watched(e.key)).length;
      const whole = list.length > 0 && done === list.length;
      const wrap = document.createElement('div');
      wrap.className = 'sr-season';
      wrap.innerHTML = `<span class="sr-chip${n === this.season ? ' on' : ''}">${whole ? '✓  ' : ''}${esc(seasonLabel(n))}</span><i class="sr-bar"><b style="width:${list.length ? (done / list.length) * 100 : 0}%"></b></i>`;
      box.appendChild(wrap);
      const id = `sr-s-${n}`;
      this.ids.push(id);
      this.nav.register({
        id, el: wrap.querySelector('.sr-chip'), scope: 'mvseries',
        left: i > 0 ? `sr-s-${keys[i - 1]}` : null,
        right: i < keys.length - 1 ? `sr-s-${keys[i + 1]}` : null,
        up: 'sr-eps',
        down: () => this.epIds[this.startIndex(list)] || null,
        onFocus: () => { if (this.season !== n) { this.season = n; this.focusedEp = null; this.renderSeasonChips(); this.renderEpisodes(seasons); } },
        onSelect: () => this.nav.focus(this.epIds[this.startIndex(list)] || id),
        onHoldSelect: () => this.openSeasonMenu(n, list, whole)
      });
      wrap.addEventListener('click', () => { this.nav.focus(id); });
    });
  }

  renderSeasonChips() {
    this.el.querySelectorAll('.sr-season .sr-chip').forEach((c) => c.classList.remove('on'));
    const chip = this.nav.nodes.get(`sr-s-${this.season}`);
    if (chip && chip.el) chip.el.classList.add('on');
  }

  // A season opens on the episode to continue, when it is in that season
  startIndex(list) {
    const r = this.resume();
    const at = r ? list.findIndex((e) => e.key === r.key) : -1;
    return Math.max(0, at);
  }

  // ---- episodes
  renderEpisodes(seasons) {
    const track = document.getElementById('sr-eps-track');
    if (!track) return;
    this.epIds.forEach((id) => this.nav.unregister(id));
    this.epIds = [];
    track.innerHTML = '';
    const list = seasons.get(this.season) || [];
    const show = this.show;
    list.forEach((ep, i) => {
      const pr = movieStore.getProgress(ep.key);
      const done = pr && pr.watched;
      const pct = pr && pr.duration > 0 && !done ? Math.min(100, (pr.position / pr.duration) * 100) : 0;
      const art = ep.image || show.backdrop || '';
      const card = document.createElement('div');
      card.className = 'sr-card';
      card.innerHTML = `
        <div class="sr-card-art">${art ? '' : `<span class="sr-card-e">E${ep.episode}</span>`}</div>
        ${done ? '<span class="mv-watched">✓</span>' : ''}
        ${pr && pr.position > 0 && !done ? `<span class="sr-left">${Math.max(1, Math.round((pr.duration - pr.position) / 60000))} min left</span>` : ''}
        <div class="mv-card-band"><span><em></em></span></div>
        ${pct ? `<i class="mv-card-progress" style="width:${pct}%"></i>` : ''}`;
      card.querySelector('.mv-card-band em').textContent = numberedTitle(ep, show);
      if (art) {
        const img = document.createElement('img');
        img.referrerPolicy = 'no-referrer';
        img.alt = '';
        img.style.opacity = done ? '0.5' : '1';
        img.onerror = () => img.remove();
        img.src = art;
        card.querySelector('.sr-card-art').appendChild(img);
      }
      track.appendChild(card);
      const id = `sr-e-${i}`;
      this.epIds.push(id);
      this.nav.register({
        id, el: card, scope: 'mvseries',
        left: i > 0 ? `sr-e-${i - 1}` : null,
        right: i < list.length - 1 ? `sr-e-${i + 1}` : null,
        up: () => (seasons.size > 1 ? `sr-s-${this.season}` : 'sr-eps'),
        down: null,
        onFocus: () => { this.focusEpisode(ep, i); },
        onSelect: () => this.play(ep, false),
        onHoldSelect: () => this.openEpisodeMenu(ep, list)
      });
      card.addEventListener('click', () => { this.nav.focus(id); this.play(ep, false); });
    });
    // The row opens on the episode to continue
    track.style.transform = `translateX(${-Math.max(0, this.startIndex(list) - 1) * CARD_PITCH}px)`;
  }

  // Resting on an episode: its title and plot replace the show's, and the row keeps it in view
  focusEpisode(ep, index) {
    this.focusedEp = ep;
    this.el.querySelectorAll('.sr-card').forEach((c, i) => setMarquee(c, i === index));
    const track = document.getElementById('sr-eps-track');
    if (track) track.style.transform = `translateX(${-Math.max(0, index - 1) * CARD_PITCH}px)`;
    const show = this.show;
    const pr = movieStore.getProgress(ep.key);
    const meta = [episodeLength(ep.duration), pr && pr.watched ? 'Watched' : pr && pr.position > 0 ? 'Resume' : ''].filter(Boolean).join(' • ');
    const text = this.el.querySelector('.sr-text');
    text.innerHTML = `
      <div class="sr-ep-label">${esc(`${displayTitle(show.name)} • S${ep.season} E${ep.episode}`.toUpperCase())}</div>
      <div class="sr-ep-title">${esc(episodeTitle(ep, show))}</div>
      <div class="mv-d-meta"><span>${esc(meta)}</span></div>
      <div class="mv-d-plot">${esc(ep.description || this.info().description || show.plot || '')}</div>`;
  }

  // ---- hold OK on a season or an episode
  openSeasonMenu(n, list, whole) {
    this.app.openDialog(seasonLabel(n), [
      { label: whole ? 'Mark season as unwatched' : 'Mark season as watched', action: () => { movieStore.markMany(list.map((e) => e.key), !whole, this.show.key); this.refresh(true); } }
    ]);
  }

  openEpisodeMenu(ep, list) {
    const ordered = [...this.bySeason().values()].flat();
    const before = ordered.slice(0, ordered.findIndex((e) => e.key === ep.key)).filter((e) => !this.watched(e.key));
    const isWatched = this.watched(ep.key);
    const items = [{ label: isWatched ? 'Mark as unwatched' : 'Mark as watched', action: () => { movieStore.markMany([ep.key], !isWatched, this.show.key); this.refresh(true); } }];
    if (before.length) items.push({ label: `Mark ${before.length} previous as watched`, action: () => { movieStore.markMany(before.map((e) => e.key), true, this.show.key); this.refresh(true); } });
    items.push({ label: 'Start over', action: () => this.play(ep, true) });
    this.app.openDialog(`S${ep.season} E${ep.episode}`, items);
    void list;
  }

  // ---- what the provider says about the show, one section at a time
  renderCredits(show, seasonCount, episodeCount) {
    clearInterval(this.creditTimer);
    const box = document.getElementById('sr-credits');
    if (!box || this.panel) return;
    const length = [seasonCount ? `${seasonCount} season${seasonCount === 1 ? '' : 's'}` : '', episodeCount ? `${episodeCount} episode${episodeCount === 1 ? '' : 's'}` : ''].filter(Boolean).join(' • ');
    const sections = [['STARRING', show.cast], ['DIRECTOR', show.director], ['GENRE', show.genre], ['RELEASED', show.year], ['LENGTH', length]].filter(([, v]) => v);
    if (!sections.length) return;
    let i = 0;
    const show1 = () => {
      const [k, v] = sections[i % sections.length];
      box.classList.remove('in');
      setTimeout(() => { box.innerHTML = `<div class="mv-d-credit"><em>${k}</em><span>${esc(v)}</span></div>`; box.classList.add('in'); }, 250);
      i++;
    };
    show1();
    if (sections.length > 1) this.creditTimer = setInterval(show1, 4800);
  }

  // ============================================================ playing
  play(ep, fromStart) {
    const m = this.movies;
    const url = ep.url || episodeUrl(m.connection, ep);
    const pr = movieStore.getProgress(ep.key);
    const resume = !fromStart && movieStore.isStarted(ep.key) && pr ? pr.position : 0;
    const ordered = [...this.bySeason().values()].flat();
    m.stopPreview();
    m.vod.open(ep, url, resume, { show: this.show, episodes: ordered });
  }
}
