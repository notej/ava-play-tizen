/**
 * The film player: the seek bar with ± 10 s steps, pause, resume where the viewer stopped, progress saving,
 * and the options bar (start over, quality, audio, subtitles, picture size, sound sync, stream info).
 * Modelled on the VOD side of PlayerOverlay.kt.
 */
import { player } from '../player/TizenAVPlayer.js';
import { movieStore } from '../data/MovieStore.js';
import { settings, SYNC_STEPS } from '../data/AppSettings.js';
import { displayTitle, episodeTitle, episodeUrl } from '../data/MovieSource.js';
import { isTizen } from '../core/net.js';

const SEEK_STEP = 10000;
const SAVE_EVERY = 5000;
const NEXT_COUNTDOWN = 10;

const ICON = {
  pause: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z"/></svg>',
  fwd: '<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>',
  restart: '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',
  video: '<svg viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>',
  audio: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
  captions: '<svg viewBox="0 0 24 24"><path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1z"/></svg>',
  aspect: '<svg viewBox="0 0 24 24"><path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16.01H3V4.99h18v14.02z"/></svg>',
  info: '<svg viewBox="0 0 24 24"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>'
};

const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

export class VodPlayer {
  constructor(app, movies) {
    this.app = app;
    this.movies = movies;
    this.nav = app.nav;
    this.isOpen = false;
    this.film = null;
    this.position = 0;
    this.duration = 0;
    this.paused = false;
    this.overlay = false;
    this.toolsOpen = false;
    this.toolIndex = 0;
    this.subOpen = false;
    this.subIndex = 0;
    this.pendingSeek = null;
    this.lastSeekKey = 0;
    this.seekStreak = 0;
    this.lastSave = 0;
    this.resumeAt = 0;
    this.resumed = false;
    this.hideTimer = null;
    this.seekTimer = null;
    this.status = '';
    this.build();
  }

  build() {
    const el = document.createElement('div');
    el.id = 'vod';
    el.className = 'vod';
    el.innerHTML = `
      <div class="vod-top"><span id="vod-title" class="vod-title"></span><span id="vod-clock" class="vod-clock"></span></div>
      <div id="vod-status" class="vod-status"></div>
      <div id="vod-spinner" class="fs-spinner vod-spinner"></div>
      <div id="vod-flash" class="vod-flash"></div>
      <div class="vod-bottom" id="vod-bottom">
        <div class="vod-seek">
          <span id="vod-pos" class="vod-time">0:00</span>
          <div class="vod-track" id="vod-track"><i id="vod-played"></i><b id="vod-knob"></b></div>
          <span id="vod-dur" class="vod-time">--:--</span>
        </div>
        <div class="vod-tools" id="vod-tools"></div>
      </div>
      <div class="vod-sub" id="vod-sub"></div>
      <div class="vod-prompt" id="vod-prompt"><div class="vod-prompt-btn"></div><div class="vod-prompt-detail"></div></div>
      <div class="vod-next" id="vod-next"></div>`;
    document.getElementById('app').appendChild(el);
    this.el = {
      root: el,
      title: el.querySelector('#vod-title'),
      clock: el.querySelector('#vod-clock'),
      status: el.querySelector('#vod-status'),
      spinner: el.querySelector('#vod-spinner'),
      flash: el.querySelector('#vod-flash'),
      pos: el.querySelector('#vod-pos'),
      dur: el.querySelector('#vod-dur'),
      played: el.querySelector('#vod-played'),
      knob: el.querySelector('#vod-knob'),
      tools: el.querySelector('#vod-tools'),
      sub: el.querySelector('#vod-sub'),
      prompt: el.querySelector('#vod-prompt'),
      next: el.querySelector('#vod-next')
    };
  }

  // ============================================================ opening and closing
  open(film, url, resumeAt, ctx = null) {
    this.stopNextCard();
    this.hidePrompt();
    if (this.unsub) { this.unsub(); this.unsub = null; }
    this.film = film;
    this.ctx = ctx;                 // { show, episodes } when an episode of a show plays
    this.nextEp = ctx ? this.episodeAfter(film) : null;
    this.isOpen = true;
    this.position = resumeAt || 0;
    this.resumeAt = resumeAt || 0;
    this.resumed = false;
    this.tracksSet = false;
    this.duration = 0;
    this.paused = false;
    this.toolsOpen = false;
    this.subOpen = false;
    this.pendingSeek = null;
    this.lastSave = 0;
    this.status = 'Opening stream…';

    const app = this.app;
    document.getElementById('app').classList.add('fullscreen-player-mode');
    this.el.root.classList.add('open');
    this.el.title.textContent = ctx ? `${displayTitle(ctx.show.name)} • S${film.season} E${film.episode}` : displayTitle(film.name);
    this.el.clock.textContent = app.formatClock(new Date());
    this.el.clock.style.display = settings.get().playerClock ? '' : 'none';
    this.setStatus('Opening stream…', true);

    const video = document.getElementById('avplay-html5-fallback');
    if (video) {
      Object.assign(video.style, { position: 'fixed', ...app.fullVideoBox(), zIndex: '0', visibility: 'visible', transform: 'none' });
      video.muted = false;
      video.volume = 1;
    }
    if (player.hasNativeAvplay) player.setRect(0, 0, 1920, 1080);
    app.clearSubtitleText();
    app.applyScreenSize(app.screenSize);

    this.unsub = player.subscribe((event, data) => this.onPlayer(event, data));
    this.nav.setScope('vod');
    this.nav.register({
      id: 'vod-surface', el: null, scope: 'vod',
      left: () => { this.onLeft(); return null; },
      right: () => { this.onRight(); return null; },
      up: () => { this.onUp(); return null; },
      down: () => { this.onDown(); return null; },
      onSelect: () => this.onOk()
    });
    this.nav.focus('vod-surface');
    this.renderTools();
    this.renderSeek();
    this.reveal();
    player.play(url, false);
    clearInterval(this.clockTimer);
    this.clockTimer = setInterval(() => { this.el.clock.textContent = app.formatClock(new Date()); }, 15000);
  }

  parentKey() { return this.ctx ? this.ctx.show.key : ''; }

  /** The episode that follows, in watching order; the specials do not lead into the next season */
  episodeAfter(ep) {
    const list = this.ctx.episodes;
    const at = list.findIndex((e) => e.key === ep.key);
    const next = at >= 0 ? list[at + 1] : null;
    return next && (next.season !== 0 || ep.season === 0) ? next : null;
  }

  close(returnToPage = true) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.stopNextCard();
    this.hidePrompt();
    clearTimeout(this.hideTimer);
    clearTimeout(this.seekTimer);
    clearInterval(this.clockTimer);
    if (this.unsub) { this.unsub(); this.unsub = null; }
    if (this.duration > 0) movieStore.record(this.film.key, this.position, this.duration, this.parentKey());
    movieStore.flush();
    player.stop();
    this.app.clearSubtitleText();
    this.el.root.classList.remove('open', 'show');
    document.getElementById('app').classList.remove('fullscreen-player-mode');
    this.nav.unregister('vod-surface');
    this.nav.setScope('main');
    const video = document.getElementById('avplay-html5-fallback');
    if (video) video.style.visibility = 'hidden';
    if (returnToPage) this.movies.afterPlayer(this.film);
  }

  handleBack() {
    if (this.nextCard) { this.stopNextCard(); this.close(true); return true; }
    if (this.subOpen) { this.closeSub(); return true; }
    if (this.toolsOpen) { this.closeTools(); return true; }
    if (this.overlay) { this.hide(); this.overlay = false; return true; }
    this.close(true);
    return true;
  }

  // ============================================================ player events
  onPlayer(event, data) {
    if (!this.isOpen) return;
    if (event === 'timeUpdate') {
      if (this.pendingSeek === null) this.position = data;
      if (!this.resumed && this.duration > 0) this.applyResume();
      if (this.status) this.setStatus('', false);
      this.tickPrompts();
      if (!this.tracksSet) { this.tracksSet = true; this.app.applyTrackPreferences(); }
      this.renderSeek();
      if (this.duration > 0 && Date.now() - this.lastSave > SAVE_EVERY) {
        this.lastSave = Date.now();
        movieStore.record(this.film.key, this.position, this.duration, this.parentKey());
      }
    } else if (event === 'durationChange') {
      this.duration = data;
      if (!this.resumed) this.applyResume();
      this.renderSeek();
    } else if (event === 'buffering') {
      this.setStatus(data ? 'Buffering…' : '', !!data);
    } else if (event === 'ended') {
      movieStore.markWatched(this.film.key, true, this.parentKey());
      if (this.ctx && this.nextEp && settings.get().autoPlayNext) this.offerNext(this.nextEp);
      else this.close(true);
    } else if (event === 'error') {
      const e = data && data.error;
      const ext = (this.film.ext || '').toLowerCase();
      const hint = !isTizen() && ext && ext !== 'mp4' ? ` ${ext.toUpperCase()} files play on the TV only.` : '';
      this.setStatus(`${(e && e.message) || 'This film could not be played.'}${hint}`, false);
      this.reveal(true);
    }
  }

  // ============================================================ episodes: skip intro, next episode, countdown
  showPrompt(title, detail, run) {
    const same = this.prompt && this.prompt.title === title && this.prompt.detail === detail;
    this.prompt = { title, detail, run };
    if (same) return;
    this.el.prompt.querySelector('.vod-prompt-btn').textContent = title;
    this.el.prompt.querySelector('.vod-prompt-detail').textContent = detail;
    this.el.prompt.classList.add('on');
  }

  hidePrompt() {
    this.prompt = null;
    if (this.el) this.el.prompt.classList.remove('on');
  }

  tickPrompts() {
    if (!this.ctx || this.nextCard) { if (!this.ctx) this.hidePrompt(); return; }
    const s = settings.get();
    const pos = this.position;
    const dur = this.duration;
    if (s.nextButton && this.nextEp && dur > 0 && dur - pos > 0 && dur - pos <= 90000) {
      const next = this.nextEp;
      this.showPrompt('Next episode  ▶', `S${next.season} E${next.episode}  ·  OK`, () => this.playNext(next));
    } else if (s.skipIntro === 'AUTO' && pos >= 5000 && pos <= 180000 && dur > 0) {
      // Nothing is learned from the sound here: a plain jump forward of 90 seconds
      const target = Math.min(pos + 90000, dur - 5000);
      this.showPrompt('Skip intro  ▶', '+90 s  ·  OK', () => { this.seekTo(target); });
    } else {
      this.hidePrompt();
    }
  }

  // An episode has ended and another follows: offer it with a countdown. OK plays it now; Back cancels and leaves.
  offerNext(next) {
    this.hidePrompt();
    this.hide();
    let left = NEXT_COUNTDOWN;
    const draw = () => {
      this.el.next.innerHTML = `
        <div class="vod-next-label">UP NEXT  ·  S${next.season} E${next.episode}</div>
        <div class="vod-next-title"></div>
        <div class="vod-next-sec">Starting in ${left}s</div>
        <div class="vod-next-bar"><i style="width:${(left / NEXT_COUNTDOWN) * 100}%"></i></div>
        <div class="vod-next-keys">OK  Play now        Back  Cancel</div>`;
      this.el.next.querySelector('.vod-next-title').textContent = episodeTitle(next, this.ctx.show);
    };
    this.nextCard = { ep: next };
    draw();
    this.el.next.classList.add('on');
    this.nextTimer = setInterval(() => {
      left--;
      if (left <= 0) this.playNext(next); else draw();
    }, 1000);
  }

  stopNextCard() {
    clearInterval(this.nextTimer);
    this.nextTimer = null;
    this.nextCard = null;
    if (this.el) this.el.next.classList.remove('on');
  }

  playNext(next) {
    const ctx = this.ctx;
    this.stopNextCard();
    this.hidePrompt();
    if (this.duration > 0 && this.position > 0) movieStore.record(this.film.key, this.position, this.duration, this.parentKey());
    movieStore.flush();
    player.stop();
    const url = next.url || episodeUrl(this.movies.connection, next);
    this.open(next, url, 0, ctx);
  }

  applyResume() {
    this.resumed = true;
    if (this.resumeAt > 0 && this.duration > this.resumeAt) {
      player.seekTo(this.resumeAt);
      this.position = this.resumeAt;
    }
  }

  setStatus(text, spinning) {
    this.status = text;
    this.el.status.textContent = text;
    this.el.spinner.style.display = spinning ? '' : 'none';
  }

  // ============================================================ overlay
  reveal(sticky = false) {
    this.overlay = true;
    this.el.root.classList.add('show');
    clearTimeout(this.hideTimer);
    if (sticky) return;
    const factor = { SHORT: 0.6, LONG: 2 }[settings.get().overlayTime] || 1;
    this.hideTimer = setTimeout(() => {
      if (this.toolsOpen || this.subOpen || this.paused) return;
      this.hide();
    }, 4500 * factor);
  }

  hide() {
    this.overlay = false;
    this.el.root.classList.remove('show');
  }

  flash(text) {
    const el = this.el.flash;
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => el.classList.remove('on'), 900);
  }

  renderSeek() {
    const total = this.duration || 0;
    const at = this.pendingSeek !== null ? this.pendingSeek : this.position;
    const pct = total > 0 ? Math.max(0, Math.min(100, (at / total) * 100)) : 0;
    this.el.pos.textContent = clock(at);
    this.el.dur.textContent = total > 0 ? clock(total) : '--:--';
    this.el.played.style.width = `${pct}%`;
    this.el.knob.style.left = `${pct}%`;
  }

  // ============================================================ keys
  onLeft() { if (this.nextCard) return; if (this.subOpen) this.closeSub(); else if (this.toolsOpen) this.moveTool(-1); else this.seekBy(-1); }
  onRight() { if (this.nextCard) return; if (this.subOpen) this.applySub(); else if (this.toolsOpen) this.moveTool(1); else this.seekBy(1); }
  onUp() {
    if (this.nextCard) return;
    if (this.subOpen) this.moveSub(-1);
    else if (this.toolsOpen) this.closeTools();
    else this.reveal();
  }
  onDown() {
    if (this.nextCard) return;
    if (this.subOpen) this.moveSub(1);
    else if (!this.toolsOpen) { this.openTools(); }
  }
  onOk() {
    if (this.nextCard) { this.playNext(this.nextCard.ep); return; }
    if (this.prompt && this.prompt.run) { const run = this.prompt.run; this.hidePrompt(); run(); return; }
    if (this.subOpen) this.applySub();
    else if (this.toolsOpen) this.activateTool();
    else this.togglePause();
  }

  // Holding the key seeks in growing steps, up to a minute at a time
  seekBy(direction) {
    const now = performance.now();
    this.seekStreak = now - this.lastSeekKey < 500 ? this.seekStreak + 1 : 0;
    this.lastSeekKey = now;
    const step = SEEK_STEP * Math.min(6, 1 + Math.floor(this.seekStreak / 5));
    this.seekTo((this.pendingSeek !== null ? this.pendingSeek : this.position) + direction * step);
    this.flash(`${direction > 0 ? '+' : '−'}${Math.round(step / 1000)} s`);
  }

  seekTo(ms) {
    if (!(this.duration > 0)) return;
    this.pendingSeek = Math.max(0, Math.min(this.duration - 1000, ms));
    this.reveal();
    this.renderSeek();
    clearTimeout(this.seekTimer);
    this.seekTimer = setTimeout(() => {
      const target = this.pendingSeek;
      this.pendingSeek = null;
      this.position = target;
      player.seekTo(target);
      this.renderSeek();
    }, 250);
  }

  togglePause() {
    this.paused = !this.paused;
    const video = document.getElementById('avplay-html5-fallback');
    if (player.hasNativeAvplay) player.togglePlayPause();
    else if (video) { if (this.paused) video.pause(); else video.play().catch(() => {}); }
    this.flash(this.paused ? 'Paused' : 'Playing');
    this.renderTools();
    this.reveal(this.paused);
  }

  // ============================================================ tools bar
  tools() {
    const app = this.app;
    const video = document.getElementById('avplay-html5-fallback');
    const size = video && video.videoWidth ? `${video.videoWidth} × ${video.videoHeight}` : 'Quality';
    const sync = app.soundDelay === 0 ? 'Sync off' : `Sound ${app.soundDelay > 0 ? '+' : '−'}${Math.abs(app.soundDelay)} ms`;
    return [
      { id: 'pause', icon: this.paused ? ICON.play : ICON.pause, label: this.paused ? 'Play' : 'Pause' },
      { id: 'back', icon: ICON.back, label: '− 10 s' },
      { id: 'fwd', icon: ICON.fwd, label: '+ 10 s' },
      { id: 'restart', icon: ICON.restart, label: 'Start over' },
      { id: 'quality', icon: ICON.video, label: app.videoResolution === 'Auto' ? size : app.videoResolution },
      { id: 'audio', icon: ICON.audio, label: app.audioTrack === 'Default' ? app.getAudioTracks()[0] : app.audioTrack },
      { id: 'subs', icon: ICON.captions, label: app.subtitleTrack === 'Off' ? 'Subtitles off' : 'Subtitles on' },
      { id: 'aspect', icon: ICON.aspect, label: app.screenSize },
      { id: 'sync', icon: ICON.audio, label: sync },
      { id: 'info', icon: ICON.info, label: 'Stream info' }
    ];
  }

  renderTools() {
    const items = this.tools();
    this.el.tools.innerHTML = '';
    items.forEach((t, i) => {
      const cell = document.createElement('div');
      cell.className = `fs-menu-item${this.toolsOpen && i === this.toolIndex ? ' selected' : ''}`;
      cell.innerHTML = `<div class="fs-menu-icon">${t.icon}</div><span class="fs-menu-label"></span>`;
      cell.querySelector('.fs-menu-label').textContent = t.label;
      cell.addEventListener('click', () => { this.toolIndex = i; this.toolsOpen = true; this.activateTool(); });
      this.el.tools.appendChild(cell);
    });
  }

  openTools() {
    this.toolsOpen = true;
    this.toolIndex = 0;
    this.reveal(true);
    this.el.root.classList.add('tools');
    this.renderTools();
  }

  closeTools() {
    this.toolsOpen = false;
    this.el.root.classList.remove('tools');
    this.renderTools();
    this.reveal();
  }

  moveTool(delta) {
    this.toolIndex = Math.max(0, Math.min(this.tools().length - 1, this.toolIndex + delta));
    this.renderTools();
  }

  activateTool() {
    const app = this.app;
    const tool = this.tools()[this.toolIndex];
    if (!tool) return;
    switch (tool.id) {
      case 'pause': this.togglePause(); break;
      case 'back': this.seekBy(-1); break;
      case 'fwd': this.seekBy(1); break;
      case 'restart': this.pendingSeek = null; player.seekTo(0); this.position = 0; this.renderSeek(); this.flash('From the start'); break;
      case 'quality': this.openSub('Quality', ['Auto', '1080p', '720p', '480p'], app.videoResolution, (v) => { app.videoResolution = v; }); break;
      case 'audio': this.openSub('Audio', app.getAudioTracks(), app.audioTrack, (v) => { app.audioTrack = v; app.applyAudioTrack(v); }); break;
      case 'subs': this.openSub('Subtitles', [...app.getSubtitleTracks(), ...app.subtitleStyleOptions()], app.subtitleTrack, (v) => { app.subtitleTrack = v; app.applySubtitleTrack(v); }, true); break;
      case 'aspect': {
        const order = ['Normal', 'Stretch', 'Zoom'];
        app.screenSize = order[(order.indexOf(app.screenSize) + 1) % order.length];
        app.applyScreenSize(app.screenSize);
        break;
      }
      case 'sync': {
        const next = SYNC_STEPS.find((v) => v > app.soundDelay);
        settings.update({ audioSync: next === undefined ? SYNC_STEPS[0] : next });
        break;
      }
      case 'info': this.showInfo(); break;
      default: break;
    }
    this.renderTools();
  }

  showInfo() {
    const app = this.app;
    const video = document.getElementById('avplay-html5-fallback');
    const rows = [
      ['Title', displayTitle(this.film.name)],
      ['Length', this.duration > 0 ? clock(this.duration) : 'Unknown'],
      ['Video', video && video.videoWidth ? `${video.videoWidth} × ${video.videoHeight}` : 'Unknown'],
      ['File type', (this.film.ext || 'mp4').toUpperCase()],
      ['Audio', app.audioTrack],
      ['Subtitles', app.subtitleTrack],
      ['Picture size', app.screenSize],
      ['Player', player.hasNativeAvplay ? 'Samsung AVPlay' : 'HTML5 video']
    ];
    app.openDialog('Stream info', rows.map(([label, value]) => ({ label, value, action: () => {} })));
  }

  // ---- pickers
  openSub(title, options, current, apply, styled = false) {
    this.sub = { options, apply, title, styled };
    this.subOpen = true;
    this.subIndex = Math.max(0, options.indexOf(current));
    this.renderSub();
  }

  renderSub() {
    const el = this.el.sub;
    const { options, title } = this.sub;
    el.innerHTML = `<div class="vod-sub-title">${title}</div>`;
    options.forEach((opt, i) => {
      const row = document.createElement('div');
      row.className = `fs-sub-item${i === this.subIndex ? ' selected' : ''}`;
      row.textContent = opt;
      row.addEventListener('click', () => { this.subIndex = i; this.applySub(); });
      el.appendChild(row);
    });
    el.style.left = `${Math.max(20, Math.min(1920 - 400, 100 + this.toolIndex * 188 - 160))}px`;
    el.classList.add('open');
  }

  moveSub(delta) {
    this.subIndex = (this.subIndex + delta + this.sub.options.length) % this.sub.options.length;
    this.renderSub();
  }

  applySub() {
    const chosen = this.sub.options[this.subIndex];
    // Size and Background cycle in place and keep the list open
    if (chosen === 'Add subtitle file…') { this.closeSub(); this.app.promptSubtitleUrl(); return; }
    if (this.sub.styled && this.app.cycleSubtitleStyle(chosen)) {
      const app = this.app;
      this.sub.options = [...app.getSubtitleTracks(), ...app.subtitleStyleOptions()];
      this.renderSub();
      return;
    }
    this.sub.apply(chosen);
    this.closeSub();
    this.renderTools();
    this.flash(chosen);
  }

  closeSub() {
    this.subOpen = false;
    this.el.sub.classList.remove('open');
  }
}
