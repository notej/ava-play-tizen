/**
 * Settings page, modelled on SettingsScreen.kt: a section menu on the left and, on the right,
 * groups of rows (toggle, pick-one, action, text field) for the selected section.
 * Only options that apply to the Tizen build's Live TV are included.
 */
import { settings, DEFAULTS, ColorPresets, SYNC_STEPS, SUBTITLE_SIZES, SUBTITLE_BGS } from '../data/AppSettings.js';
import { storage } from '../data/StorageManager.js';
import { checkAccount, parseXtreamLink, normalizeServer, loadLive, clearCache, explainConnectionError } from '../data/LiveSource.js';
import { ConnectionError } from '../data/XtreamClient.js';
import { isTizen } from '../core/net.js';
import { movieStore } from '../data/MovieStore.js';
import { clearMovieCache } from '../data/MovieSource.js';

const SECTIONS = [
  { key: 'ACCOUNT', title: 'Playlists', blurb: 'Your providers and logins' },
  { key: 'LIVE', title: 'Live TV', blurb: 'Stream format and start-up' },
  { key: 'GUIDE', title: 'TV guide', blurb: 'Programme listings and time' },
  { key: 'PLAYBACK', title: 'Playback', blurb: 'Picture, sound and buffering', gap: true },
  { key: 'CONTENT', title: 'Content', blurb: 'What shows up, and clean up' },
  { key: 'LOOK', title: 'Appearance', blurb: 'Menu, clock and numbers', gap: true },
  { key: 'SYSTEM', title: 'System & help', blurb: 'Network, storage, about' }
];

const REFRESH = [['OFF', 'Off'], ['START', 'On app start'], ['6H', 'Every 6 hours'], ['12H', 'Every 12 hours'], ['24H', 'Every 24 hours']];
const FORMATS = [['ts', 'MPEG-TS'], ['m3u8', 'HLS']];
const ASPECTS = [[0, 'Fit'], [1, 'Stretch'], [2, 'Zoom']];
const LANGUAGES = [['', 'Automatic'], ['en', 'English'], ['sq', 'Albanian'], ['de', 'German'], ['fr', 'French'], ['es', 'Spanish'], ['it', 'Italian'],
  ['pt', 'Portuguese'], ['tr', 'Turkish'], ['ru', 'Russian'], ['ar', 'Arabic'], ['nl', 'Dutch'], ['pl', 'Polish']];
const SKIP_INTRO = [['AUTO', 'Show a skip button'], ['OFF', 'Off']];
const PREVIEWS = [['SOUND', 'With sound'], ['SILENT', 'Silent'], ['OFF', 'Off']];
const OVERLAY = [['SHORT', 'Short'], ['NORMAL', 'Normal'], ['LONG', 'Long']];
const BUFFERS = [['SMALL', 'Small'], ['NORMAL', 'Normal'], ['LARGE', 'Large'], ['XLARGE', 'Very large']];

const syncLabel = (ms) => (ms === 0 ? 'Off' : ms > 0 ? `Sound ${ms >= 1000 ? '1 second' : `${ms} ms`} later` : `Sound ${-ms} ms earlier`);

function ago(time) {
  if (!time) return 'never';
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return `${Math.floor(minutes / 1440)} days ago`;
}

export class SettingsView {
  constructor(app) {
    this.app = app;
    this.nav = app.nav;
    this.root = document.getElementById('view-settings');
    this.sectionIndex = 0;
    this.page = 'main';
    this.rowIds = [];
    this.editing = null;
    this.note = '';
    this.account = null;
    this.busy = false;
    this.form = this.emptyForm();
    this.build();
  }

  emptyForm() {
    return { editingId: null, kind: 'XTREAM', name: 'My playlist', server: '', username: '', password: '', m3u: '', showPassword: false };
  }

  // ---------- frame ----------
  build() {
    this.root.innerHTML = `
      <div class="set-layout">
        <div class="set-title">Settings</div>
        <nav id="set-menu" class="set-menu"></nav>
        <div class="set-divider"></div>
        <div class="set-pane">
          <div id="set-crumb" class="set-crumb"></div>
          <h1 id="set-heading" class="set-heading"></h1>
          <p id="set-blurb" class="set-blurb"></p>
          <div id="set-note" class="set-note"></div>
          <div id="set-scroll" class="set-scroll"></div>
        </div>
      </div>`;
    this.menuEl = this.root.querySelector('#set-menu');
    this.scrollEl = this.root.querySelector('#set-scroll');
    this.buildMenu();
  }

  buildMenu() {
    this.menuEl.innerHTML = '';
    SECTIONS.forEach((section, i) => {
      if (section.gap) {
        const rule = document.createElement('div');
        rule.className = 'set-menu-rule';
        this.menuEl.appendChild(rule);
      }
      const el = document.createElement('div');
      el.className = 'set-menu-item';
      el.id = `set-menu-el-${i}`;
      el.textContent = section.title;
      el.addEventListener('click', () => { this.nav.focus(`set-menu-${i}`); this.chooseSection(i, true); });
      this.menuEl.appendChild(el);

      this.nav.register({
        id: `set-menu-${i}`,
        el,
        scope: 'main',
        left: null,
        right: () => this.firstRowId(),
        up: () => (i === 0 ? 'btn-settings' : `set-menu-${i - 1}`),
        down: i < SECTIONS.length - 1 ? `set-menu-${i + 1}` : null,
        onSelect: () => this.chooseSection(i, true)
      });
    });
  }

  // ---------- open / close ----------
  open() {
    this.root.classList.add('open');
    this.page = 'main';
    this.renderSection();
    this.refreshAccount();
    this.nav.focus(`set-menu-${this.sectionIndex}`);
  }

  close() {
    this.stopEditing(false);
    this.root.classList.remove('open');
  }

  /** Jumps straight to a sub page of Content (used by "Hide groups…" in Live TV) */
  openPage(page) {
    this.sectionIndex = 4;
    this.page = page;
    this.renderSection();
    this.nav.focus(this.firstRowId() || `set-menu-${this.sectionIndex}`);
  }

  firstRowId() { return this.rowIds.length ? this.rowIds[0] : null; }

  chooseSection(index, enterRows) {
    this.sectionIndex = index;
    this.page = 'main';
    this.note = '';
    this.renderSection();
    if (index === 0) this.refreshAccount();
    if (enterRows && index !== 0 && this.firstRowId()) this.nav.focus(this.firstRowId());
    else if (enterRows && index === 0 && this.firstRowId()) this.nav.focus(this.firstRowId());
  }

  /** Returns true when Back was used up inside Settings. */
  handleBack() {
    if (this.editing) { this.stopEditing(true); return true; }
    if (this.page !== 'main') {
      this.page = 'main';
      this.renderSection();
      this.nav.focus(this.firstRowId() || `set-menu-${this.sectionIndex}`);
      return true;
    }
    const focus = this.nav.currentFocusedId || '';
    if (focus.startsWith('set-row-')) {
      this.nav.focus(`set-menu-${this.sectionIndex}`);
      return true;
    }
    return false;
  }

  setNote(text) {
    this.note = text;
    const el = document.getElementById('set-note');
    if (el) el.textContent = text;
  }

  // ---------- account info ----------
  async refreshAccount() {
    const conn = storage.getActiveConnection();
    this.account = null;
    if (!conn || conn.isM3u) return;
    try {
      this.account = await checkAccount(conn);
      if (this.root.classList.contains('open') && SECTIONS[this.sectionIndex].key === 'ACCOUNT' && this.page === 'main' && !this.editing) {
        const focus = this.nav.currentFocusedId;
        this.renderSection();
        if (focus && this.nav.nodes.has(focus)) this.nav.focus(focus);
      }
    } catch (e) { /* the status line simply stays out */ }
  }

  // ---------- rows ----------
  renderSection() {
    const section = SECTIONS[this.sectionIndex];
    this.menuEl.querySelectorAll('.set-menu-item').forEach((el, i) => el.classList.toggle('current', i === this.sectionIndex));
    const sub = this.page !== 'main';
    document.getElementById('set-crumb').textContent = sub ? 'Settings  ›  Content' : `Settings  ›  ${section.title}`;
    document.getElementById('set-heading').textContent = this.page === 'hidden' ? 'Hidden channel groups' : this.page === 'hiddenMovies' ? 'Hidden film groups' : this.page === 'hiddenShows' ? 'Hidden show groups' : this.page === 'hiddenTitles' ? 'Hidden films and shows' : section.title;
    document.getElementById('set-blurb').textContent = sub ? 'Choose what shows up. Anything you turn off is hidden everywhere.' : section.blurb;
    document.getElementById('set-note').textContent = this.note;

    this.rowIds.forEach((id) => this.nav.unregister(id));
    this.rowIds = [];
    this.scrollEl.innerHTML = '';
    this.scrollEl.scrollTop = 0;

    const items = this.page === 'hidden' ? this.hiddenGroupItems() : this.page === 'hiddenMovies' ? this.hiddenMovieGroupItems() : this.page === 'hiddenShows' ? this.hiddenShowGroupItems() : this.page === 'hiddenTitles' ? this.hiddenTitleItems() : this.itemsFor(section.key);
    items.forEach((item) => this.renderItem(item));
    this.wireRows();
  }

  rerender() {
    const focus = this.nav.currentFocusedId;
    const top = this.scrollEl.scrollTop;
    this.renderSection();
    this.scrollEl.scrollTop = top;
    if (focus && this.nav.nodes.has(focus)) this.nav.focus(focus);
  }

  renderItem(item) {
    const el = document.createElement('div');
    if (item.type === 'group') {
      el.className = 'set-group-label';
      el.textContent = item.title;
      this.scrollEl.appendChild(el);
      return;
    }
    if (item.type === 'footer') {
      el.className = 'set-footer';
      el.textContent = item.text;
      this.scrollEl.appendChild(el);
      return;
    }
    el.className = `set-row set-${item.type}`;
    if (item.type === 'info') {
      el.innerHTML = '<div class="set-row-main"><div class="set-row-title"></div><div class="set-row-detail"></div></div>';
      el.querySelector('.set-row-title').textContent = item.label;
      el.querySelector('.set-row-detail').textContent = item.detail || '';
      this.scrollEl.appendChild(el);
      return;
    }

    item.el = el;
    if (item.type === 'toggle') {
      el.innerHTML = `<div class="set-row-main"><div class="set-row-title"></div><div class="set-row-detail"></div></div><div class="set-switch${item.value ? ' on' : ''}"><i></i></div>`;
    } else if (item.type === 'choice' || item.type === 'link') {
      el.innerHTML = `<div class="set-row-main"><div class="set-row-title"></div><div class="set-row-detail"></div></div><div class="set-row-value">${item.swatch ? '<b class="set-swatch"></b>' : ''}<span></span><em>›</em></div>`;
      el.querySelector('.set-row-value span').textContent = item.valueLabel;
      if (item.swatch) el.querySelector('.set-swatch').style.background = item.swatch;
    } else if (item.type === 'action') {
      el.innerHTML = '<div class="set-row-main"><div class="set-row-title"></div><div class="set-row-detail"></div></div>';
    } else if (item.type === 'input') {
      el.innerHTML = `<div class="set-row-main"><div class="set-field-label"></div><input class="set-text" autocomplete="off" spellcheck="false"></div>${item.trailing ? '<div class="set-trailing"></div>' : ''}`;
      el.querySelector('.set-field-label').textContent = item.label;
      const input = el.querySelector('input');
      input.type = item.password && !item.revealed ? 'password' : 'text';
      input.placeholder = item.placeholder || '';
      input.value = item.value || '';
      input.readOnly = true; // typing starts when OK is pressed
      input.addEventListener('input', () => item.onInput(input.value));
      if (item.trailing) el.querySelector('.set-trailing').textContent = item.trailing;
      item.input = input;
    } else if (item.type === 'tabs') {
      el.innerHTML = '<div class="set-tabs"></div>';
      const tabs = el.querySelector('.set-tabs');
      item.options.forEach(([key, label]) => {
        const tab = document.createElement('span');
        tab.className = `set-tab${key === item.value ? ' current' : ''}`;
        tab.textContent = label;
        tabs.appendChild(tab);
      });
    } else if (item.type === 'buttons' || item.type === 'saved') {
      el.innerHTML = '<div class="set-row-main"><div class="set-row-title"></div></div><div class="set-btnbar"></div>';
      el.querySelector('.set-row-title').textContent = item.label || '';
      if (!item.label) el.querySelector('.set-row-main').style.display = 'none';
      const wrap = el.querySelector('.set-btnbar');
      item.buttonIndex = 0;
      item.buttons.forEach((b) => {
        const btn = document.createElement('span');
        btn.className = `set-button${b.disabled ? ' disabled' : ''}`;
        btn.textContent = b.label;
        wrap.appendChild(btn);
      });
    }
    if (item.label && el.querySelector('.set-row-title')) el.querySelector('.set-row-title').textContent = item.label;
    if (el.querySelector('.set-row-detail')) el.querySelector('.set-row-detail').textContent = item.detail || '';
    this.scrollEl.appendChild(el);
    this.pending = this.pending || [];
    this.pending.push(item);
  }

  wireRows() {
    const items = this.pending || [];
    this.pending = [];
    const ids = items.map((_, i) => `set-row-${i}`);
    this.rowIds = ids;

    items.forEach((item, i) => {
      const id = ids[i];
      const el = item.el;
      const focusRow = () => this.nav.focus(id);
      el.addEventListener('click', (e) => {
        focusRow();
        if (item.buttons) {
          // Mouse / touch: run the button that was clicked, not the one the remote last rested on
          const bars = [...el.querySelectorAll('.set-button')];
          const hit = bars.findIndex((b) => b === e.target || b.contains(e.target));
          if (hit < 0) return;
          item.buttonIndex = hit;
          this.paintButtons(item);
        }
        this.activate(item);
      });

      this.nav.register({
        id,
        el,
        scope: 'main',
        left: () => {
          if (item.type === 'tabs') { this.stepTabs(item, -1); return null; }
          if (item.buttons && item.buttonIndex > 0) { this.moveButton(item, -1); return null; }
          return `set-menu-${this.sectionIndex}`;
        },
        right: () => {
          if (item.type === 'tabs') { this.stepTabs(item, 1); return null; }
          if (item.buttons && item.buttonIndex < item.buttons.length - 1) { this.moveButton(item, 1); return null; }
          return null;
        },
        up: i === 0 ? 'btn-settings' : ids[i - 1],
        down: i < ids.length - 1 ? ids[i + 1] : null,
        onFocus: () => {
          this.keepVisible(el);
          if (item.buttons) this.paintButtons(item);
        },
        onSelect: () => this.activate(item)
      });
    });
  }

  keepVisible(el) {
    const box = this.scrollEl;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < box.scrollTop + 20) box.scrollTop = Math.max(0, top - 60);
    else if (bottom > box.scrollTop + box.clientHeight - 20) box.scrollTop = bottom - box.clientHeight + 60;
  }

  stepTabs(item, delta) {
    const keys = item.options.map((o) => o[0]);
    const next = keys[Math.max(0, Math.min(keys.length - 1, keys.indexOf(item.value) + delta))];
    if (next !== item.value) item.onPick(next);
  }

  moveButton(item, delta) {
    item.buttonIndex += delta;
    this.paintButtons(item);
  }

  paintButtons(item) {
    item.el.querySelectorAll('.set-button').forEach((b, i) => b.classList.toggle('on', i === item.buttonIndex));
  }

  activate(item) {
    switch (item.type) {
      case 'toggle': item.onToggle(); break;
      case 'choice': this.openChoice(item); break;
      case 'link':
      case 'action': item.onSelect(); break;
      case 'input': this.startEditing(item); break;
      case 'buttons':
      case 'saved': {
        const b = item.buttons[item.buttonIndex];
        if (b && !b.disabled) b.onSelect();
        break;
      }
      default: break;
    }
  }

  openChoice(item) {
    this.app.openDialog(item.label, item.options.map(([key, label]) => ({
      label,
      current: String(key) === String(item.value),
      value: String(key) === String(item.value) ? 'In use' : '',
      action: () => item.onPick(key)
    })));
  }

  // ---------- text fields ----------
  startEditing(item) {
    this.editing = item;
    item.input.readOnly = false;
    item.input.focus();
    const end = item.input.value.length;
    try {
      // A pre-filled default name is replaced by typing; anything else continues at the end
      if (item.selectOnEdit) item.input.select(); else item.input.setSelectionRange(end, end);
    } catch (e) { /* field type without selection */ }
    item.el.classList.add('editing');
    this.nav.setScope('editing');
    this.nav.register({ id: 'set-editing', el: null, scope: 'editing', left: null, right: null, up: null, down: null, onSelect: () => this.stopEditing(true) });
    this.nav.focus('set-editing');
  }

  stopEditing(refocus) {
    const item = this.editing;
    if (!item) return;
    this.editing = null;
    item.input.blur();
    item.input.readOnly = true;
    item.el.classList.remove('editing');
    item.onInput(item.input.value);
    this.nav.unregister('set-editing');
    this.nav.setScope('main');
    if (refocus) {
      const idx = this.rowIds.findIndex((id) => this.nav.nodes.get(id) && this.nav.nodes.get(id).el === item.el);
      if (idx >= 0) this.nav.focus(this.rowIds[idx]);
    }
  }

  // ---------- section contents ----------
  itemsFor(key) {
    const s = settings.get();
    const set = (patch) => settings.update(patch);
    const toggle = (label, field, detail) => ({ type: 'toggle', label, detail, value: !!s[field], onToggle: () => { set({ [field]: !s[field] }); this.rerender(); } });
    const choice = (label, field, options, detail, extra = {}) => {
      const current = options.find(([k]) => String(k) === String(s[field])) || options[0];
      return { type: 'choice', label, detail, options, value: current[0], valueLabel: current[1], onPick: (k) => { set({ [field]: typeof options[0][0] === 'number' ? Number(k) : k }); this.rerender(); }, ...extra };
    };
    const out = [];

    if (key === 'ACCOUNT') return this.accountItems(choice);

    if (key === 'LIVE') {
      out.push({ type: 'group', title: 'LIVE TV' });
      out.push(choice('Stream format', 'liveFormat', FORMATS, 'MPEG-TS is the usual choice. HLS can be steadier on weak connections.'));
      out.push(toggle('Reopen what was playing', 'resumeSession', 'When the app opens, carry on with the channel that was on last.'));
      out.push({ type: 'footer', text: 'Try HLS if MPEG-TS channels stutter or fail to start. This applies to Xtream playlists; an M3U playlist plays each channel\'s own link. In a desktop browser only HLS can play.' });
    } else if (key === 'GUIDE') {
      out.push({ type: 'group', title: 'UPDATES' });
      out.push({ type: 'info', label: 'Status', detail: 'The programme guide is not available in the Tizen build yet. Channels show "No programme guide".' });
      out.push({ type: 'group', title: 'SOURCE AND TIME' });
      out.push({ type: 'input', label: 'Custom XMLTV URL (optional)', value: s.guideUrl, placeholder: 'https://…/guide.xml', onInput: (v) => set({ guideUrl: v.trim() }) });
      out.push({ type: 'input', label: 'Timezone (optional), e.g. Europe/Warsaw', value: s.guideTimezone, placeholder: 'Europe/Tirane', onInput: (v) => set({ guideTimezone: v.trim() }) });
      out.push({ type: 'footer', text: 'These are saved for when the guide is added. Times follow this TV\'s timezone unless you set one.' });
    } else if (key === 'PLAYBACK') {
      out.push({ type: 'group', title: 'PICTURE AND SOUND' });
      out.push(choice('Picture size', 'aspect', ASPECTS, 'Fit keeps the whole picture. Zoom fills the screen and crops the edges.'));
      out.push(choice('Preferred audio language', 'audioLanguage', LANGUAGES, 'Picked automatically when the stream has several.'));
      out.push(choice('Preferred subtitle language', 'subtitleLanguage', LANGUAGES, 'Automatic shows subtitles only when the stream marks them as default or forced.'));
      out.push(choice('Subtitle size', 'subtitleSize', SUBTITLE_SIZES.map(([k, l]) => [k, l]), 'How large the subtitles are drawn.'));
      out.push(choice('Subtitle background', 'subtitleBg', SUBTITLE_BGS.map(([k, l]) => [k, l]), 'A dark patch behind the subtitle text.'));
      out.push(choice('Audio sync', 'audioSync', SYNC_STEPS.map((ms) => [ms, syncLabel(ms)]), 'If the sound is heard after the picture it belongs to, pick how late it is. Stored now; the Tizen player applies it where the TV allows.'));
      out.push({ type: 'footer', text: 'Used whenever a stream opens. You can still change them from the player menu.' });
      out.push({ type: 'group', title: 'BEHAVIOUR' });
      out.push(choice('Skip intro button', 'skipIntro', SKIP_INTRO, 'For series. A button over the opening of an episode jumps forward 90 seconds.'));
      out.push(toggle('Next episode button', 'nextButton', 'Shown over the last minute and a half of an episode.'));
      out.push(toggle('Play next episode automatically', 'autoPlayNext', 'A countdown starts when an episode ends.'));
      out.push(choice('Player menu stays on screen', 'overlayTime', OVERLAY, 'How long the banner and menus stay up before they hide.'));
      out.push({ type: 'group', title: 'PERFORMANCE' });
      out.push(choice('Buffer size', 'buffer', BUFFERS, 'A small buffer starts and changes channel faster. A larger one rides out a weak connection but waits longer before the picture starts.'));
      out.push({ type: 'footer', text: 'Applies the next time the player starts.' });
    } else if (key === 'CONTENT') {
      out.push({ type: 'group', title: 'WHAT SHOWS UP' });
      out.push(toggle('Hide adult categories', 'hideAdult', 'Hides categories with names such as Adult, XXX or 18+.'));
      out.push(toggle('Multi-sub films only', 'onlyMultiSub', 'Movies lists only the films your provider tags as multi-sub (the CC mark).'));
      out.push(toggle('Hide duplicates', 'hideDuplicates', 'A film listed more than once is shown once: its multi-sub copy, else its sharpest.'));
      const open = (page) => () => { this.page = page; this.renderSection(); this.nav.focus(this.firstRowId() || `set-menu-${this.sectionIndex}`); };
      out.push({ type: 'link', label: 'Hidden channel groups', detail: 'Choose exactly which Live TV groups to hide.', valueLabel: `${this.app.hiddenGroupKeys.size} hidden`, onSelect: open('hidden') });
      out.push({ type: 'link', label: 'Hidden film groups', detail: 'Choose exactly which Movies groups to hide.', valueLabel: `${movieStore.hiddenGroups.size} hidden`, onSelect: open('hiddenMovies') });
      out.push({ type: 'link', label: 'Hidden show groups', detail: 'Choose exactly which TV Shows groups to hide.', valueLabel: `${[...movieStore.hiddenGroups].filter((k) => k.startsWith('SHOW:')).length} hidden`, onSelect: open('hiddenShows') });
      out.push({ type: 'link', label: 'Hidden films and shows', detail: 'Titles you hid one by one. Turn one on to bring it back.', valueLabel: `${movieStore.hidden.size} hidden`, onSelect: open('hiddenTitles') });
      out.push({ type: 'group', title: 'MOVIES' });
      out.push(choice('Movie previews', 'moviePreview', PREVIEWS, 'When the remote rests on a film, a short stretch from the middle of it plays behind the title, at half the TV volume.'));
      out.push({ type: 'group', title: 'CLEAN UP' });
      out.push({ type: 'action', label: 'Clear recent channels', onSelect: () => this.confirm('Clear recently watched channels?', 'The channel history is emptied.', 'Clear', () => { this.app.clearRecents(); this.setNote('Recent channels cleared.'); }) });
      out.push({ type: 'action', label: 'Clear Continue watching', onSelect: () => this.confirm('Clear Continue watching?', 'Playback positions of films and episodes are forgotten.', 'Clear', () => { movieStore.clearAllProgress(); this.setNote('Continue watching cleared.'); }) });
      out.push({ type: 'action', label: 'Clear My List', onSelect: () => this.confirm('Clear My List?', 'Films saved with Watch later are removed from the list.', 'Clear', () => { movieStore.clearLibrary(); this.setNote('My List cleared.'); }) });
      out.push({ type: 'action', label: 'Clear favourites', onSelect: () => this.confirm('Clear favourites?', 'Favourite channels of this playlist are removed.', 'Clear', () => { this.app.clearFavorites(); this.setNote('Favourites cleared.'); }) });
      out.push({ type: 'footer', text: 'These only affect the open playlist.' });
    } else if (key === 'LOOK') {
      out.push({ type: 'group', title: 'TOP MENU' });
      [['LIVE', 'Live TV'], ['MOVIE', 'Movies'], ['SHOW', 'TV Shows']].forEach(([k, label]) => {
        const hidden = s.hiddenSections.includes(k);
        out.push({ type: 'toggle', label: `Show ${label}`, value: !hidden, onToggle: () => { set({ hiddenSections: hidden ? s.hiddenSections.filter((x) => x !== k) : [...s.hiddenSections, k] }); this.rerender(); } });
      });
      out.push({ type: 'footer', text: 'Turning a section off only removes it from the top menu.' });
      out.push({ type: 'group', title: 'COLOURS' });
      const accent = ColorPresets.find((c) => c.key === s.accentColor) || ColorPresets[0];
      out.push(choice('Accent colour', 'accentColor', ColorPresets.map((c) => [c.key, c.label]), 'Changes at once.', { swatch: accent.accent }));
      const band = ColorPresets.find((c) => c.key === s.labelColor) || ColorPresets[1];
      out.push(choice('Poster label colour', 'labelColor', ColorPresets.map((c) => [c.key, c.label]), 'The band across a poster.', { swatch: band.band }));
      out.push({ type: 'footer', text: 'The accent is used for switches, buttons and highlights. The label colour is used for the bands on posters.' });
      out.push({ type: 'group', title: 'DISPLAY' });
      out.push(toggle('24-hour clock', 'clock24', s.clock24 ? 'Shown as 13:30' : 'Shown as 1:30 PM'));
      out.push(toggle('Hide country names', 'hideCountryNames', 'A group shows without its country: "AL | General" as "General".'));
      out.push(toggle('Channel numbers', 'showNumbers', 'In the Live TV list.'));
      out.push(toggle('Clock in the player', 'playerClock', 'Date and time at the top of the player.'));
    } else {
      out.push({ type: 'group', title: 'NETWORK' });
      out.push({ type: 'input', label: 'User-Agent', value: s.userAgent, placeholder: 'Default', onInput: (v) => set({ userAgent: v.trim() }) });
      out.push({ type: 'footer', text: isTizen()
        ? 'Some providers only answer known players. Leave this empty to use the default. Sent with the stream requests.'
        : 'Some providers only answer known players. Leave this empty to use the default. In a desktop browser it is sent through the dev proxy.' });
      out.push({ type: 'group', title: 'STORAGE' });
      out.push({ type: 'action', label: 'Clear film and show cache', onSelect: () => { const c = storage.getActiveConnection(); clearMovieCache(c ? c.id : 'demo'); this.setNote('Cache cleared. Films and shows download again the next time they open.'); } });
      out.push({ type: 'action', label: 'Clear channel cache', onSelect: () => { const c = storage.getActiveConnection(); if (c) clearCache(c.id); this.setNote('Channel cache cleared. Channels download again on the next refresh.'); } });
      out.push({ type: 'group', title: 'MAINTENANCE' });
      out.push({ type: 'action', label: 'Reset all settings', onSelect: () => this.confirm('Reset all settings?', 'Every option on these pages goes back to its default. Playlists and favourites are kept.', 'Reset', () => { settings.reset(); this.setNote('Settings reset.'); this.rerender(); }) });
      out.push({ type: 'group', title: 'ABOUT AND HELP' });
      out.push({ type: 'info', label: 'AvaPlay', detail: 'Version 1.0.0 (Tizen)' });
      out.push({ type: 'info', label: 'Remote control', detail: 'OK plays a channel or opens it fullscreen. Back goes up one level. In the player, Up and Down change channel and Right opens the channel strip.' });
      out.push({ type: 'info', label: 'Your login', detail: 'Logins are stored on this device and only sent to your provider. HTTP-only providers send them without encryption.' });
    }
    return out;
  }

  hiddenGroupItems() {
    const app = this.app;
    return app.groups.map((g) => ({
      type: 'toggle',
      label: app.displayName(g.name),
      detail: `${app.channels.filter((c) => c.groupId === g.id).length} channels`,
      value: !app.hiddenGroupKeys.has(g.id),
      onToggle: () => { app.toggleGroupHidden(g.id); this.rerender(); }
    }));
  }

  /** The groups and titles of one kind, from whichever screen holds them; null until that kind was opened once */
  hiddenGroupItemsFor(kind) {
    const app = this.app;
    const bag = app.moviesView.bagOf(kind);
    const label = kind === 'SHOW' ? 'TV Shows' : 'Movies';
    if (!bag || !bag.loaded) return [{ type: 'info', label: `Open ${label} once`, detail: `Its groups are listed here after ${label} has loaded.` }];
    const key = (id) => (kind === 'SHOW' ? `SHOW:${id}` : id);
    return bag.groups.map((g) => ({
      type: 'toggle',
      label: app.displayName(g.name),
      detail: `${bag.items.filter((i) => i.groups.includes(g.id)).length} ${kind === 'SHOW' ? 'shows' : 'films'}`,
      value: !movieStore.hiddenGroups.has(key(g.id)),
      onToggle: () => { movieStore.toggleGroupHidden(key(g.id)); this.rerender(); }
    }));
  }

  hiddenMovieGroupItems() { return this.hiddenGroupItemsFor('MOVIE'); }
  hiddenShowGroupItems() { return this.hiddenGroupItemsFor('SHOW'); }

  hiddenTitleItems() {
    const movies = this.app.moviesView;
    const rows = [...movieStore.hidden].map((key) => movies.findItem(key)).filter(Boolean).map((film) => ({
      type: 'toggle',
      label: film.name,
      detail: 'Hidden. Turn on to show it again.',
      value: false,
      onToggle: () => { movieStore.unhide(film.key); this.rerender(); }
    }));
    return rows.length ? rows : [{ type: 'info', label: 'No hidden titles', detail: 'Use Hold OK on a film or show, then Hide this title.' }];
  }

  // ---------- playlists ----------
  accountItems(choice) {
    const app = this.app;
    const s = settings.get();
    const f = this.form;
    const active = storage.getActiveConnection();
    const out = [];

    if (active) {
      const status = [];
      status.push(`Last refreshed ${ago(app.refreshedAt)}`);
      if (app.channels.length) status.push(`${app.channels.length} channels`);
      out.push({ type: 'group', title: 'CURRENT PLAYLIST' });
      out.push({ type: 'info', label: active.name, detail: status.join(' • ') });
      if (this.account) {
        const exp = this.account.expDate ? new Date(this.account.expDate * 1000).toISOString().slice(0, 10) : 'not supplied';
        out.push({ type: 'info', label: 'Account', detail: `${this.account.status} • Connection limit ${this.account.maxConnections} • Expires ${exp}` });
      }
      out.push(choice('Automatic refresh', 'playlistRefresh', REFRESH, 'The channels update quietly when they are over 3 hours old.'));
      out.push({ type: 'action', label: this.busy ? 'Refreshing…' : 'Refresh now', onSelect: () => this.refreshNow() });
    }

    out.push({ type: 'group', title: f.editingId ? 'EDIT PLAYLIST' : 'ADD A PLAYLIST' });
    out.push({ type: 'tabs', options: [['XTREAM', 'Xtream login'], ['M3U', 'M3U link']], value: f.kind, onPick: (k) => { f.kind = k; this.rerender(); } });
    out.push({ type: 'input', label: 'Playlist name', value: f.name, selectOnEdit: !f.editingId, onInput: (v) => { f.name = v; } });
    if (f.kind === 'M3U') {
      out.push({ type: 'input', label: 'M3U playlist link', value: f.m3u, placeholder: 'http://example.com/list.m3u', onInput: (v) => { f.m3u = v; } });
      out.push({ type: 'buttons', buttons: [
        { label: f.editingId ? 'Update playlist' : 'Save playlist', disabled: this.busy, onSelect: () => this.savePlaylist() },
        { label: 'Test link', disabled: this.busy, onSelect: () => this.testPlaylist() }
      ] });
    } else {
      out.push({ type: 'input', label: 'Server URL or Xtream link', value: f.server, placeholder: 'http://server.example:8080', onInput: (v) => { f.server = v; } });
      out.push({ type: 'input', label: 'Username', value: f.username, onInput: (v) => { f.username = v; } });
      out.push({ type: 'input', label: 'Password', value: f.password, password: true, revealed: f.showPassword, trailing: f.showPassword ? 'Hide' : 'Show', onInput: (v) => { f.password = v; } });
      out.push({ type: 'action', label: f.showPassword ? 'Hide password' : 'Show password', onSelect: () => { f.showPassword = !f.showPassword; this.rerender(); } });
      out.push({ type: 'buttons', buttons: [
        { label: f.editingId ? 'Update playlist' : 'Save playlist', disabled: this.busy, onSelect: () => this.savePlaylist() },
        { label: 'Test connection', disabled: this.busy, onSelect: () => this.testPlaylist() }
      ] });
    }
    out.push({ type: 'footer', text: f.kind === 'M3U'
      ? 'Paste the link to an .m3u or .m3u8 playlist. A get.php link that contains your login is added as an Xtream playlist.'
      : 'Enter your server URL, username and password, or paste a get.php link. HTTPS protects your login; providers on plain HTTP send it unencrypted.' });

    const saved = storage.getConnections();
    out.push({ type: 'group', title: 'SAVED PLAYLISTS' });
    saved.forEach((c) => {
      const isActive = active && c.id === active.id;
      out.push({ type: 'saved', label: `${c.name}${c.isM3u ? '  •  M3U' : ''}${isActive ? '  •  in use' : ''}`, buttons: [
        { label: isActive ? 'In use' : 'Use', disabled: isActive || this.busy, onSelect: () => this.usePlaylist(c) },
        { label: 'Edit', onSelect: () => this.editPlaylist(c) },
        { label: 'Remove', onSelect: () => this.removePlaylist(c) }
      ] });
    });
    out.push({ type: 'action', label: '+ New playlist', onSelect: () => { this.form = this.emptyForm(); this.setNote(''); this.rerender(); } });
    if (!saved.length) out.push({ type: 'footer', text: 'Connect a provider above to save your first playlist. Until then the app shows demo channels.' });
    return out;
  }

  collectConnection() {
    const f = this.form;
    if (f.kind === 'M3U') {
      const link = f.m3u.trim();
      if (!/^https?:\/\//i.test(link)) throw new Error('Enter the full http(s) link of the playlist.');
      return { id: f.editingId || `c${Date.now().toString(36)}`, name: f.name.trim() || 'My playlist', server: link, username: '', password: '', isM3u: true };
    }
    let { server, username, password } = f;
    const parsed = parseXtreamLink(server);
    if (parsed) ({ server, username, password } = parsed);
    server = normalizeServer(server);
    if (!server) throw new Error('Enter the server URL.');
    if (!username.trim() || !password) throw new Error('Enter the username and password.');
    return { id: f.editingId || `c${Date.now().toString(36)}`, name: f.name.trim() || 'My playlist', server, username: username.trim(), password, isM3u: false };
  }

  async verify(conn) {
    if (conn.isM3u) {
      const data = await loadLive(conn, 'm3u8');
      return `Playlist reachable • ${data.channels.length} channels`;
    }
    const info = await checkAccount(conn);
    if (String(info.status).toLowerCase() !== 'active') throw new ConnectionError('inactive', `This account is ${String(info.status).toLowerCase()}.`);
    return `Connected • ${info.status} • connection limit ${info.maxConnections}`;
  }

  async guard(fn) {
    if (this.busy) return;
    this.busy = true;
    try { await fn(); } catch (e) { const x = explainConnectionError(e); this.setNote([x.message + (x.detail ? ` (${x.detail})` : ''), x.tips[0]].filter(Boolean).join(' ')); }
    this.busy = false;
    if (this.root.classList.contains('open')) this.rerender();
  }

  testPlaylist() {
    return this.guard(async () => {
      const conn = this.collectConnection();
      this.setNote('Testing…');
      this.setNote(await this.verify(conn));
    });
  }

  savePlaylist() {
    return this.guard(async () => {
      const conn = this.collectConnection();
      this.setNote('Checking the login…');
      await this.verify(conn);
      const wasActive = storage.getActiveConnectionId() === conn.id;
      storage.saveConnection(conn);
      storage.setActiveConnectionId(conn.id);
      this.form = this.emptyForm();
      this.setNote('Playlist saved. Loading channels…');
      await this.app.loadCatalogue(true, wasActive);
      this.setNote(this.app.loadError || `Playlist saved • ${this.app.channels.length} channels`);
      this.refreshAccount();
    });
  }

  refreshNow() {
    return this.guard(async () => {
      this.setNote('Refreshing…');
      await this.app.loadCatalogue(true, true);
      this.setNote(this.app.loadError || `Refreshed • ${this.app.channels.length} channels`);
    });
  }

  usePlaylist(conn) {
    return this.guard(async () => {
      storage.setActiveConnectionId(conn.id);
      this.setNote(`Loading ${conn.name}…`);
      await this.app.loadCatalogue(true);
      this.account = null;
      this.setNote(this.app.loadError || `${conn.name} • ${this.app.channels.length} channels`);
      this.refreshAccount();
    });
  }

  editPlaylist(conn) {
    this.form = {
      editingId: conn.id, kind: conn.isM3u ? 'M3U' : 'XTREAM', name: conn.name,
      server: conn.isM3u ? '' : conn.server, username: conn.username, password: conn.password, m3u: conn.isM3u ? conn.server : '', showPassword: false
    };
    this.rerender();
  }

  removePlaylist(conn) {
    this.confirm(`Remove ${conn.name}?`, 'This removes its saved login and cached channels from this TV.', 'Remove playlist', async () => {
      const wasActive = storage.getActiveConnectionId() === conn.id;
      storage.deleteConnection(conn.id);
      clearCache(conn.id);
      if (wasActive) await this.app.loadCatalogue(true);
      this.setNote(`${conn.name} removed.`);
      this.rerender();
    });
  }

  confirm(title, body, label, run) {
    this.app.openDialog(title, [{ label, action: run }, { label: 'Cancel', action: () => {} }], body);
  }
}
