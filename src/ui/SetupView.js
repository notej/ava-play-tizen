/**
 * First-time setup, as in SetupFlow.kt: it stands alone over the whole app while there is no playlist (and until it is
 * finished): Connect, Download, then the choice of countries and groups for Live TV, Movies and TV Shows.
 * Left out on the TV, and why: the phone QR code (a web app on the TV cannot listen for a phone's connection)
 * and the sound step (no Tizen call applies a sound delay).
 */
import { storage } from '../data/StorageManager.js';
import { settings } from '../data/AppSettings.js';
import { movieStore } from '../data/MovieStore.js';
import { checkAccount, loadLive, parseXtreamLink, normalizeServer, explainConnectionError } from '../data/LiveSource.js';
import { ConnectionError } from '../data/XtreamClient.js';
import { countryOf, countryInfo, topicOf, TOPICS, withoutCountry } from '../data/Countries.js';
import { glyphHtml, flagHtml } from './Glyphs.js';

const STEPS = ['Connect', 'Download', 'Live TV', 'Movies', 'TV Shows'];
const TYPES = [
  { type: 'LIVE', label: 'Live TV', step: 2, unit: 'channels' },
  { type: 'MOVIE', label: 'Movies', step: 3, unit: 'films' },
  { type: 'SHOW', label: 'TV Shows', step: 4, unit: 'shows' }
];
const COLS_COUNTRY = 10;
const COLS_GROUP = 6;
const ROW_H1 = 112;       // a country tile row
const ROW_HEAD = 72;      // a country header in the group step
const ROW_H2 = 150;       // a group tile row
const VIEW_H = 340;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CHECK = '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';

export class SetupView {
  constructor(app) {
    this.app = app;
    this.nav = app.nav;
    this.isOpen = false;
    this.phase = 'connect';           // connect | download | choose | done
    this.form = { kind: 'XTREAM', server: '', user: '', pass: '', link: '' };
    this.error = '';
    this.busy = false;
    this.editing = null;
    this.counts = { LIVE: null, MOVIE: null, SHOW: null };
    this.working = null;
    this.notes = {};
    this.types = [];
    this.round = 0;
    this.step = 1;
    this.hidden = {};                 // type -> Set of hidden group keys, filled as each round is finished
    this.summary = '';
    this.ids = [];

    this.root = document.createElement('div');
    this.root.id = 'setup';
    this.root.className = 'setup';
    document.getElementById('app').appendChild(this.root);
  }

  /** Setup stands over the app while there is no playlist, and until an interrupted setup is finished */
  static needed() {
    return storage.getConnections().length === 0 || settings.get().setupPending;
  }

  open() {
    this.isOpen = true;
    this.root.classList.add('open');
    this.nav.setScope('setup');
    document.getElementById('app').classList.add('in-setup');
    this.app.suspendLivePreview();
    // An interrupted setup carries on where it stopped
    if (storage.getConnections().length > 0) this.runDownloads();
    else this.render();
  }

  close() {
    this.isOpen = false;
    this.unregister();
    this.root.classList.remove('open');
    document.getElementById('app').classList.remove('in-setup');
    this.nav.setScope('main');
  }

  unregister() { this.ids.forEach((id) => this.nav.unregister(id)); this.ids = []; }

  reg(node) { this.ids.push(node.id); this.nav.register({ scope: 'setup', ...node }); }

  // ================================================================ frame
  stepIndex() {
    if (this.phase === 'connect') return 0;
    if (this.phase === 'download') return 1;
    if (this.phase === 'choose') return TYPES.find((t) => t.type === this.types[this.round]).step;
    return STEPS.length;
  }

  render() {
    this.unregister();
    const at = this.stepIndex();
    const logo = document.querySelector('.header-logo svg');
    this.root.innerHTML = `
      <div class="su-logo">${logo ? logo.outerHTML : ''}</div>
      <div class="su-center">
        <div class="su-steps">${STEPS.map((n, i) => `<span class="su-step${i < at ? ' done' : ''}${i === at ? ' here' : ''}"><i></i>${n}</span>`).join('')}</div>
        <div class="su-card" id="su-card"></div>
      </div>`;
    const card = this.root.querySelector('#su-card');
    if (this.phase === 'connect') this.renderConnect(card);
    else if (this.phase === 'download') this.renderDownload(card);
    else if (this.phase === 'choose') this.renderChoose(card);
    else this.renderDone(card);
  }

  // ================================================================ 1. connect
  renderConnect(card) {
    const f = this.form;
    card.classList.remove('wide');
    card.innerHTML = `
      <h1>Connect your IPTV service</h1>
      <p class="su-sub">Use the details from your provider. AvaPlay needs an IPTV subscription to show anything.</p>
      <div class="su-tabs"><span class="su-tab${f.kind === 'XTREAM' ? ' on' : ''}" id="su-tab-x">Xtream login</span><span class="su-tab${f.kind === 'M3U' ? ' on' : ''}" id="su-tab-m">M3U link</span></div>
      <div class="su-fields" id="su-fields"></div>
      <div class="su-error" id="su-error">${this.errorHtml()}</div>
      <div class="su-actions"><span class="su-btn primary" id="su-connect">${this.busy ? 'Connecting…' : 'Connect'}</span></div>
      <p class="su-hint">Type with the TV's keyboard. You can also paste a <b>get.php</b> link into the server field.</p>`;
    const fields = f.kind === 'XTREAM'
      ? [['server', 'Server address (http://…)', false], ['user', 'Username', false], ['pass', 'Password', true]]
      : [['link', 'M3U link', false]];
    const box = card.querySelector('#su-fields');
    const fieldIds = [];
    fields.forEach(([key, label, secret]) => {
      const el = document.createElement('div');
      el.className = 'su-field';
      el.innerHTML = '<label></label><input autocomplete="off" spellcheck="false" readonly>';
      el.querySelector('label').textContent = label;
      const input = el.querySelector('input');
      input.type = secret ? 'password' : 'text';
      input.value = f[key];
      input.addEventListener('input', () => { f[key] = input.value; });
      box.appendChild(el);
      const id = `su-f-${key}`;
      fieldIds.push(id);
      const item = { el, input, key };
      el.addEventListener('click', () => { this.nav.focus(id); this.startEditing(item); });
      this.reg({ id, el, left: null, right: null,
        up: () => (fieldIds.indexOf(id) > 0 ? fieldIds[fieldIds.indexOf(id) - 1] : 'su-tab-x'),
        down: () => (fieldIds.indexOf(id) < fieldIds.length - 1 ? fieldIds[fieldIds.indexOf(id) + 1] : 'su-connect'),
        onSelect: () => this.startEditing(item) });
    });
    const tab = (id, kind, right, left) => this.reg({
      id, el: card.querySelector(`#${id}`), left, right, up: null, down: fieldIds[0],
      onSelect: () => { f.kind = kind; this.error = ''; this.render(); this.nav.focus(id); }
    });
    tab('su-tab-x', 'XTREAM', 'su-tab-m', null);
    tab('su-tab-m', 'M3U', null, 'su-tab-x');
    card.querySelector('#su-tab-x').addEventListener('click', () => { f.kind = 'XTREAM'; this.error = ''; this.render(); this.nav.focus('su-tab-x'); });
    card.querySelector('#su-tab-m').addEventListener('click', () => { f.kind = 'M3U'; this.error = ''; this.render(); this.nav.focus('su-tab-m'); });
    this.reg({ id: 'su-connect', el: card.querySelector('#su-connect'), left: null, right: null, up: fieldIds[fieldIds.length - 1], down: null, onSelect: () => this.connect() });
    card.querySelector('#su-connect').addEventListener('click', () => { this.nav.focus('su-connect'); this.connect(); });
    this.nav.focus(fieldIds[0] || 'su-connect');
  }

  startEditing(item) {
    this.editing = item;
    item.input.readOnly = false;
    item.el.classList.add('editing');
    item.input.focus();
    const end = item.input.value.length;
    try { item.input.setSelectionRange(end, end); } catch (e) { /* field type without selection */ }
    this.nav.setScope('editing');
    this.nav.register({ id: 'su-editing', el: null, scope: 'editing', left: null, right: null, up: null, down: null, onSelect: () => this.stopEditing() });
    this.nav.focus('su-editing');
  }

  stopEditing() {
    const item = this.editing;
    if (!item) return;
    this.editing = null;
    item.input.blur();
    item.input.readOnly = true;
    item.el.classList.remove('editing');
    this.form[item.key] = item.input.value;
    this.nav.unregister('su-editing');
    this.nav.setScope('setup');
    this.nav.focus(`su-f-${item.key}`);
  }

  // An error is a text, or { message, tips, detail }: what failed, and what to try
  errorHtml() {
    const e = this.error;
    if (!e) return '';
    if (typeof e === 'string') return esc(e);
    return `<b>${esc(e.message)}${e.detail ? ` <small>(${esc(e.detail)})</small>` : ''}</b>${e.tips && e.tips.length ? `<ul>${e.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}`;
  }

  setError(error) {
    this.error = error;
    const el = document.getElementById('su-error');
    if (el) el.innerHTML = this.errorHtml();
  }

  async connect() {
    if (this.busy) return;
    const f = this.form;
    let conn;
    try {
      if (f.kind === 'M3U') {
        const link = f.link.trim();
        if (!/^https?:\/\//i.test(link)) throw new Error('Enter the complete http:// or https:// link of the M3U playlist.');
        conn = { id: `c${Date.now().toString(36)}`, name: 'My IPTV', server: link, username: '', password: '', isM3u: true };
      } else {
        let { server, user, pass } = f;
        const parsed = parseXtreamLink(server);
        if (parsed) ({ server, username: user, password: pass } = { server: parsed.server, username: parsed.username, password: parsed.password });
        server = normalizeServer(server);
        if (!server) throw new Error('Enter the server address.');
        if (!user.trim() || !pass) throw new Error('Username and password are required.');
        conn = { id: `c${Date.now().toString(36)}`, name: 'My IPTV', server, username: user.trim(), password: pass, isM3u: false };
      }
    } catch (e) { this.setError(e.message); return; }

    this.busy = true;
    this.setError('');
    document.getElementById('su-connect').textContent = 'Connecting…';
    try {
      if (conn.isM3u) await loadLive(conn, 'm3u8');
      else {
        const info = await checkAccount(conn);
        if (String(info.status).toLowerCase() !== 'active') throw new ConnectionError('inactive', `This account is ${String(info.status).toLowerCase()}.`);
      }
    } catch (e) {
      this.busy = false;
      this.setError(explainConnectionError(e));
      const b = document.getElementById('su-connect');
      if (b) b.textContent = 'Connect';
      return;
    }
    this.busy = false;
    this.createdId = conn.id;
    settings.update({ setupPending: true, hideAdult: true });
    storage.saveConnection(conn);
    storage.setActiveConnectionId(conn.id);
    this.runDownloads();
  }

  // ================================================================ 2. download
  async runDownloads() {
    this.phase = 'download';
    this.counts = { LIVE: null, MOVIE: null, SHOW: null };
    this.notes = {};
    this.render();
    const app = this.app;
    const movies = app.moviesView;
    // Live channels come first, through the app's own loader
    this.working = 'LIVE';
    this.updateDownload();
    await app.loadCatalogue(true);
    if (app.loadError) {
      // Nothing to choose from: go back to the login with the reason
      this.phase = 'connect';
      this.error = app.loadErrorInfo || app.loadError;
      this.counts = { LIVE: null, MOVIE: null, SHOW: null };
      this.dropCreated();
      this.render();
      return;
    }
    this.counts.LIVE = app.channels.length;
    for (const type of ['MOVIE', 'SHOW']) {
      this.working = type;
      this.updateDownload();
      const result = await movies.preload(type);
      this.counts[type] = result.items.length;
      if (result.error) this.notes[type] = result.error;
    }
    this.working = null;
    this.updateDownload();
    await new Promise((r) => setTimeout(r, 400));
    this.startChoosing();
  }

  /** A failed setup removes only the playlist it saved itself, never one that was there before */
  dropCreated() {
    if (this.createdId) storage.deleteConnection(this.createdId);
    this.createdId = null;
    if (!storage.getConnections().length) storage.setActiveConnectionId(null);
    settings.update({ setupPending: false });
  }

  renderDownload(card) {
    card.classList.remove('wide');
    card.innerHTML = `
      <h1 id="su-dl-title">Downloading your list</h1>
      <p class="su-sub">Large lists hold hundreds of thousands of titles and can take a few minutes. You only do this once.</p>
      <div class="su-loads" id="su-loads"></div>
      <p class="su-note" id="su-dl-note"></p>`;
    this.updateDownload();
  }

  updateDownload() {
    const box = document.getElementById('su-loads');
    if (!box) return;
    const nf = new Intl.NumberFormat();
    box.innerHTML = TYPES.map(({ type, label }) => {
      const done = this.counts[type] !== null;
      const working = this.working === type;
      return `<div class="su-load${done ? ' done' : ''}${working ? ' working' : ''}"><span class="su-load-mark">${done ? CHECK : working ? '<i class="su-spin"></i>' : '<i class="su-dot"></i>'}</span><span class="su-load-name">${label}</span><span class="su-load-count">${done ? nf.format(this.counts[type]) : working ? 'Downloading…' : 'Waiting'}</span></div>`;
    }).join('');
    const note = document.getElementById('su-dl-note');
    if (note) note.textContent = Object.values(this.notes)[0] || '';
    const title = document.getElementById('su-dl-title');
    if (title) title.textContent = this.working === null && this.counts.LIVE !== null ? 'Preparing your catalogue…' : 'Downloading your list';
  }

  // ================================================================ 3-5. choose countries and groups
  groupsOf(type) {
    const app = this.app;
    if (type === 'LIVE') {
      const counts = new Map();
      app.channels.forEach((c) => counts.set(c.groupId, (counts.get(c.groupId) || 0) + 1));
      return app.groups.filter((g) => counts.get(g.id)).map((g) => ({ key: g.id, name: g.name }));
    }
    const bag = app.moviesView.bagOf(type);
    const prefix = type === 'SHOW' ? 'SHOW:' : '';
    return bag && bag.loaded ? bag.groups.map((g) => ({ key: `${prefix}${g.id}`, name: g.name })) : [];
  }

  startChoosing() {
    this.types = TYPES.filter((t) => this.groupsOf(t.type).length > 0).map((t) => t.type);
    if (!this.types.length) {
      this.phase = 'connect';
      this.error = 'Nothing came down. Check with your provider that the subscription is active.';
      this.dropCreated();
      this.render();
      return;
    }
    this.phase = 'choose';
    this.round = 0;
    this.hidden = {};
    this.beginRound();
  }

  /** What setup hides to begin with, so the picker opens with something added */
  startHidden(type, groups) {
    const region = ((navigator.language || 'en-US').split('-')[1] || '').toUpperCase();
    const tile = (g) => countryOf(g.name) || topicOf(g.name).key;
    let keep = type === 'LIVE' ? new Set([region]) : new Set(['T:ENGLISH', 'T:MULTI']);
    if (!groups.some((g) => keep.has(tile(g)))) keep = new Set([region]);
    return new Set(groups.filter((g) => !keep.has(tile(g))).map((g) => g.key));
  }

  beginRound() {
    const type = this.types[this.round];
    this.groups = this.groupsOf(type);
    this.draft = this.startHidden(type, this.groups);
    this.step = 1;
    this.buildTiles(type);
    this.picked = this.tiles.filter((t) => t.groups.some((g) => !this.draft.has(g.key)));
    this.cur = { r: 0, c: 0 };
    this.scroll = 0;
    this.render();
  }

  buildTiles(type) {
    const byTile = new Map();
    this.groups.forEach((g) => {
      const k = countryOf(g.name) || topicOf(g.name).key;
      if (!byTile.has(k)) byTile.set(k, []);
      byTile.get(k).push(g);
    });
    const languages = type !== 'LIVE';
    const countries = [...byTile.keys()].filter((k) => countryInfo(k)).map((k) => {
      const c = countryInfo(k);
      return { key: k, name: c.name.replace('North ', 'N. ').replace('Bosnia', 'Bosnia & H.'), mono: k, flag: k, glyph: '', groups: byTile.get(k) };
    }).sort((a, b) => a.name.localeCompare(b.name));
    const topics = TOPICS.filter((t) => byTile.has(t.key)).map((t) => ({ key: t.key, name: t.name, mono: t.mono, glyph: t.mono ? '' : t.glyph, groups: byTile.get(t.key) }));
    this.tiles = languages ? [...topics, ...countries] : [...countries, ...topics];
  }

  addedTiles() { return this.tiles.filter((t) => t.groups.some((g) => !this.draft.has(g.key))); }

  mark(t) {
    const shown = t.groups.filter((g) => !this.draft.has(g.key)).length;
    return shown === 0 ? 0 : shown === t.groups.length ? 2 : 1;
  }

  typeInfo() { return TYPES.find((t) => t.type === this.types[this.round]); }

  renderChoose(card) {
    card.classList.add('wide');
    const info = this.typeInfo();
    const total = this.types.length * 2;
    const added = this.addedTiles();
    const list = this.step === 1 ? this.groups : this.picked.flatMap((t) => t.groups);
    const addedGroups = list.filter((g) => !this.draft.has(g.key)).length;
    const lang = info.type !== 'LIVE';
    const last = this.round >= this.types.length - 1;
    card.innerHTML = `
      <div class="su-pk-head"><span class="su-pk-type">${info.label}</span><span class="su-pk-what">·  ${this.step === 1 ? (lang ? 'Choose languages' : 'Choose countries') : 'Choose their groups'}</span><span class="su-pk-step">STEP ${this.step + this.round * 2} OF ${total}</span></div>
      ${this.step === 1 ? `<div class="su-added" id="su-added"></div>` : ''}
      <div class="su-viewport" id="su-view"><div class="su-rows" id="su-rows"></div></div>
      <div class="su-foot">
        <span class="su-count">${this.step === 1 ? `${added.length} of ${this.tiles.length} added  ·  ${addedGroups} groups` : `${addedGroups} of ${list.length} groups added`}</span>
        <span class="su-btn" id="su-adult">Hide adult: ${settings.get().hideAdult ? 'On' : 'Off'}</span>
        ${this.step === 1 && this.round === 0 ? '' : '<span class="su-btn" id="su-back">‹  Back</span>'}
        <span class="su-btn primary${added.length ? '' : ' disabled'}" id="su-next">${this.step === 1 ? 'Next  ›' : (last ? 'Finish' : `Next: ${TYPES.find((t) => t.type === this.types[this.round + 1]).label}  ›`)}</span>
      </div>`;
    if (this.step === 1) this.drawAdded();
    this.buildRows();
    this.drawRows();
    const hasBack = !!card.querySelector('#su-back');

    this.reg({ id: 'su-grid', el: card.querySelector('#su-view'),
      left: () => { this.moveCol(-1); return null; },
      right: () => { if (!this.moveCol(1)) return 'su-next'; return null; },
      up: () => { this.moveRow(-1); return null; },
      down: () => { if (!this.moveRow(1)) return 'su-next'; return null; },
      onFocus: () => this.drawRows(), onBlur: () => this.drawRows(),
      onSelect: () => this.toggleCurrent() });
    card.querySelector('#su-view').addEventListener('click', (e) => {
      const el = e.target.closest('[data-r]');
      if (el) { this.cur = { r: +el.dataset.r, c: +el.dataset.c }; this.nav.focus('su-grid'); this.toggleCurrent(); }
    });
    const footer = ['su-adult', ...(hasBack ? ['su-back'] : []), 'su-next'];
    footer.forEach((id, i) => {
      this.reg({ id, el: card.querySelector(`#${id}`), left: i > 0 ? footer[i - 1] : null, right: i < footer.length - 1 ? footer[i + 1] : null, up: 'su-grid', down: null,
        onSelect: () => this.footerAction(id) });
      card.querySelector(`#${id}`).addEventListener('click', () => { this.nav.focus(id); this.footerAction(id); });
    });
    this.nav.focus('su-grid');
  }

  footerAction(id) {
    if (id === 'su-adult') { settings.update({ hideAdult: !settings.get().hideAdult }); this.render(); this.nav.focus('su-adult'); return; }
    if (id === 'su-back') { this.back(); return; }
    if (id === 'su-next') this.next();
  }

  next() {
    const added = this.addedTiles();
    if (!added.length) return;
    if (this.step === 1) {
      this.picked = added;
      this.step = 2;
      this.cur = { r: 0, c: 0 };
      this.scroll = 0;
      this.render();
      return;
    }
    this.hidden[this.types[this.round]] = new Set(this.draft);
    if (this.round < this.types.length - 1) { this.round++; this.beginRound(); return; }
    this.finish();
  }

  back() {
    if (this.step === 2) { this.step = 1; this.cur = { r: 0, c: 0 }; this.scroll = 0; this.render(); return; }
    if (this.round > 0) {
      // The previous kind opens on its second step with what was chosen there
      this.round--;
      const type = this.types[this.round];
      this.groups = this.groupsOf(type);
      this.draft = new Set(this.hidden[type] || []);
      this.buildTiles(type);
      this.picked = this.addedTiles();
      this.step = 2;
      this.cur = { r: 0, c: 0 };
      this.scroll = 0;
      this.render();
    }
  }

  // ---- the rows of the grid: a window of them is drawn around the remote
  buildRows() {
    const rows = [];
    if (this.step === 1) {
      for (let i = 0; i < this.tiles.length; i += COLS_COUNTRY) rows.push({ h: ROW_H1, items: this.tiles.slice(i, i + COLS_COUNTRY).map((t) => ({ kind: 'country', t })) });
    } else {
      this.picked.forEach((t) => {
        rows.push({ h: ROW_HEAD, items: [{ kind: 'head', t }] });
        const ordered = [...t.groups].sort((a, b) => a.name.localeCompare(b.name));
        for (let i = 0; i < ordered.length; i += COLS_GROUP) rows.push({ h: ROW_H2, items: ordered.slice(i, i + COLS_GROUP).map((g) => ({ kind: 'group', t, g })) });
      });
    }
    let y = 0;
    rows.forEach((r) => { r.top = y; y += r.h; });
    this.rows = rows;
    this.total = y;
  }

  clampCur() {
    this.cur.r = Math.max(0, Math.min(this.rows.length - 1, this.cur.r));
    this.cur.c = Math.max(0, Math.min(this.rows[this.cur.r].items.length - 1, this.cur.c));
  }

  moveCol(d) {
    const row = this.rows[this.cur.r];
    if (row.items[0].kind === 'head') return d < 0 ? true : false;
    const c = this.cur.c + d;
    if (c < 0 || c >= row.items.length) return d < 0; // left at the edge stays; right at the edge goes to the buttons
    this.cur.c = c;
    this.drawRows();
    return true;
  }

  moveRow(d) {
    const r = this.cur.r + d;
    if (r < 0) return true;
    if (r >= this.rows.length) return false;
    this.cur.r = r;
    this.clampCur();
    this.drawRows();
    return true;
  }

  currentItem() { return this.rows[this.cur.r] && this.rows[this.cur.r].items[this.cur.c]; }

  toggleCurrent() {
    const item = this.currentItem();
    if (!item) return;
    if (item.kind === 'group') {
      if (this.draft.has(item.g.key)) this.draft.delete(item.g.key); else this.draft.add(item.g.key);
    } else {
      const keys = item.t.groups.map((g) => g.key);
      const shown = item.t.groups.filter((g) => !this.draft.has(g.key)).length;
      // A country or a header switches all its groups off when all show, otherwise all on
      if (shown === item.t.groups.length) keys.forEach((k) => this.draft.add(k)); else keys.forEach((k) => this.draft.delete(k));
    }
    this.drawRows();
    this.updateFooter();
    if (this.step === 1) this.drawAdded();
  }

  updateFooter() {
    const added = this.addedTiles();
    const list = this.step === 1 ? this.groups : this.picked.flatMap((t) => t.groups);
    const addedGroups = list.filter((g) => !this.draft.has(g.key)).length;
    const count = this.root.querySelector('.su-count');
    if (count) count.textContent = this.step === 1 ? `${added.length} of ${this.tiles.length} added  ·  ${addedGroups} groups` : `${addedGroups} of ${list.length} groups added`;
    const next = document.getElementById('su-next');
    if (next) next.classList.toggle('disabled', !added.length);
  }

  drawAdded() {
    const box = document.getElementById('su-added');
    if (!box) return;
    const added = this.addedTiles();
    const room = 14;
    const shown = added.length > room ? added.slice(0, room - 1) : added;
    box.innerHTML = `<span class="su-added-label">ADDED  ·  ${added.length}</span>` + shown.map((t) => {
      const on = t.groups.filter((g) => !this.draft.has(g.key)).length;
      return `<span class="su-chip">${this.badge(t)}<b>${esc(t.name)}</b><em>${on === t.groups.length ? t.groups.length : `${on}/${t.groups.length}`}</em></span>`;
    }).join('') + (added.length > room ? `<span class="su-chip more">+${added.length - shown.length} more</span>` : '');
  }

  badge(t, cls = '') {
    if (t.flag) return flagHtml(t.flag, cls);
    if (t.mono) return `<i class="su-mono ${cls}">${esc(t.mono)}</i>`;
    return `<i class="su-glyph ${cls}">${glyphHtml(t.glyph || 'grid')}</i>`;
  }

  drawRows() {
    const view = document.getElementById('su-view');
    const rowsEl = document.getElementById('su-rows');
    if (!view || !rowsEl) return;
    const vh = view.clientHeight || VIEW_H;
    const row = this.rows[this.cur.r];
    if (row) {
      if (row.top < this.scroll) this.scroll = row.top;
      else if (row.top + row.h > this.scroll + vh) this.scroll = row.top + row.h - vh;
    }
    const focused = this.nav.currentFocusedId === 'su-grid';
    const from = this.scroll - 120;
    const to = this.scroll + vh + 120;
    let html = '';
    this.rows.forEach((r, ri) => {
      if (r.top + r.h < from || r.top > to) return;
      html += `<div class="su-row" style="top:${r.top - this.scroll}px;height:${r.h}px">${r.items.map((it, ci) => this.tileHtml(it, ri, ci, focused && ri === this.cur.r && ci === this.cur.c)).join('')}</div>`;
    });
    rowsEl.innerHTML = html;
  }

  tileHtml(it, r, c, focused) {
    const f = focused ? ' focused' : '';
    const data = `data-r="${r}" data-c="${c}"`;
    if (it.kind === 'country') {
      const m = this.mark(it.t);
      return `<div class="su-tile country m${m}${f}" ${data} style="grid-column:${c + 1}">${this.badge(it.t, m ? '' : 'grey')}<span class="su-tile-name">${esc(it.t.name)}</span>${focused ? `<span class="su-cnt">${it.t.groups.length}</span><span class="su-add m${m}">${m === 2 ? CHECK : m === 1 ? '–' : '+'}</span>` : ''}</div>`;
    }
    if (it.kind === 'head') {
      const shown = it.t.groups.filter((g) => !this.draft.has(g.key)).length;
      return `<div class="su-head${f}" ${data}>${this.badge(it.t)}<b>${esc(it.t.name)}</b><span>${shown} of ${it.t.groups.length}</span><em>${shown === it.t.groups.length ? 'None' : 'All'}</em></div>`;
    }
    const on = !this.draft.has(it.g.key);
    const name = withoutCountry(it.g.name, it.g.name.replace(/\[[^\]]*]/g, '').replace(/^\s*[A-Za-z]{2,3}\s*\|\s*/, '').trim()) || it.g.name;
    return `<div class="su-tile group${on ? ' on' : ''}${f}" ${data}><div class="su-gtop">${this.badge(it.t, on ? '' : 'grey')}<span class="su-add m${on ? 2 : 0}">${on ? CHECK : (focused ? '+' : '')}</span></div><span class="su-tile-name">${esc(this.app.displayName(name))}</span></div>`;
  }

  // ================================================================ finish
  finish() {
    const app = this.app;
    const kept = new Set();
    let groupsKept = 0;
    for (const type of this.types) {
      const hidden = this.hidden[type] || new Set();
      this.groupsOf(type).forEach((g) => { if (!hidden.has(g.key)) { groupsKept++; kept.add(countryOf(g.name) || topicOf(g.name).key); } });
    }
    // Apply what was chosen
    const live = this.hidden.LIVE;
    if (live) { live.forEach((k) => app.hiddenGroupKeys.add(k)); app.saveChannelState(); }
    [['MOVIE'], ['SHOW']].forEach(([type]) => { (this.hidden[type] || []).forEach((k) => movieStore.hiddenGroups.add(k)); });
    movieStore.save();
    movieStore.emit();
    this.summary = `${kept.size} ${kept.size === 1 ? 'country or topic' : 'countries and topics'}  ·  ${groupsKept} groups kept`;
    this.phase = 'done';
    this.render();
  }

  renderDone(card) {
    card.classList.remove('wide');
    card.innerHTML = `
      <div class="su-tick">${CHECK}</div>
      <h1 class="center">You're all set</h1>
      <p class="su-sub center">${esc(this.summary)}</p>
      <div class="su-actions center"><span class="su-btn primary" id="su-start">Start watching</span></div>
      <p class="su-hint center">Settings has everything to change this later: playlists, hidden groups and more.</p>`;
    this.reg({ id: 'su-start', el: card.querySelector('#su-start'), left: null, right: null, up: null, down: null, onSelect: () => this.start() });
    card.querySelector('#su-start').addEventListener('click', () => this.start());
    this.nav.focus('su-start');
  }

  start() {
    settings.update({ setupPending: false });
    this.close();
    const app = this.app;
    app.refreshCatalogueView();
    app.moviesView.picksCache = null;
    app.switchView('livetv');
    const first = app.getVisibleChannels()[0];
    if (first) { app.currentChannel = null; app.tuneChannel(first, false); }
  }

  // ================================================================ keys the app routes here
  handleBack() {
    if (this.editing) { this.stopEditing(); return true; }
    if (this.phase === 'choose') {
      if (this.step === 2 || this.round > 0) { this.back(); return true; }
      return true; // nothing before the first picker but the download, which cannot be redone from here
    }
    if (this.phase === 'download' || this.phase === 'done') return true;
    return false; // on the login, Back leaves the app
  }
}
