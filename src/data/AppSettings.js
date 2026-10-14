/**
 * App-wide settings, ported from the Android app's AppSettings.kt (the options that apply to Live TV).
 * Stored locally; every change is broadcast so the UI can react at once.
 */
import { storage } from './StorageManager.js';

const KEY = 'avaplay_settings_v2';

export const ColorPresets = [
  { key: 'TEAL', label: 'Teal', accent: '#2be0c8', band: '#0f8f80' },
  { key: 'RED', label: 'Red', accent: '#f0343c', band: '#b20710' },
  { key: 'BLUE', label: 'Blue', accent: '#4c9aff', band: '#1f5fbf' },
  { key: 'PURPLE', label: 'Purple', accent: '#b388ff', band: '#6a3aa2' },
  { key: 'ORANGE', label: 'Orange', accent: '#ff9f43', band: '#c8570f' },
  { key: 'GREEN', label: 'Green', accent: '#5be584', band: '#1e8a3c' },
  { key: 'PINK', label: 'Pink', accent: '#ff6fa8', band: '#b0245f' }
];

export const DEFAULTS = {
  playlistRefresh: '24H',   // OFF, START, 6H, 12H, 24H
  liveFormat: 'm3u8',       // ts or m3u8
  resumeSession: true,
  aspect: 0,                // 0 fit, 1 stretch, 2 zoom
  audioLanguage: '',
  subtitleSize: 'NORMAL',   // SMALL, NORMAL, LARGE, XLARGE
  subtitleBg: 'OFF',        // OFF, SEMI, SOLID
  subtitleLanguage: '',
  audioSync: 0,             // ms, one of SYNC_STEPS
  skipIntro: 'AUTO',        // AUTO shows a skip button over a series' opening, OFF hides it
  nextButton: true,
  autoPlayNext: true,
  overlayTime: 'NORMAL',    // SHORT, NORMAL, LONG
  buffer: 'NORMAL',         // SMALL, NORMAL, LARGE, XLARGE
  hideAdult: false,
  setupPending: false,      // first-time setup was started and not finished
  accentColor: 'TEAL',
  labelColor: 'RED',        // colour of the band across a poster
  moviePreview: 'SOUND',    // SOUND, SILENT, OFF
  onlyMultiSub: false,
  hideDuplicates: false,
  clock24: true,
  hideCountryNames: false,
  showNumbers: true,
  playerClock: true,
  hiddenSections: [],       // LIVE, MOVIE, SHOW
  userAgent: '',
  guideUrl: '',
  guideTimezone: ''
};

export const SUBTITLE_SIZES = [['SMALL', 'Small', '75%'], ['NORMAL', 'Normal', '100%'], ['LARGE', 'Large', '130%'], ['XLARGE', 'X-Large', '160%']];
export const SUBTITLE_BGS = [['OFF', 'Off', 'transparent'], ['SEMI', 'Semi', 'rgba(0,0,0,0.6)'], ['SOLID', 'Solid', '#000']];

export const SYNC_STEPS = [-300, -200, -100, -50, 0, 50, 100, 150, 200, 250, 300, 400, 500, 750, 1000];

class SettingsStore {
  constructor() {
    this.listeners = new Set();
    this.values = { ...DEFAULTS, ...(storage.get(KEY, {}) || {}) };
  }

  get() { return this.values; }

  update(patch) {
    this.values = { ...this.values, ...patch };
    storage.set(KEY, this.values);
    this.listeners.forEach((fn) => fn(this.values, Object.keys(patch)));
  }

  reset() {
    this.values = { ...DEFAULTS };
    storage.set(KEY, this.values);
    this.listeners.forEach((fn) => fn(this.values, Object.keys(DEFAULTS)));
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  band() {
    return (ColorPresets.find((c) => c.key === this.values.labelColor) || ColorPresets[1]).band;
  }

  accent() {
    return (ColorPresets.find((c) => c.key === this.values.accentColor) || ColorPresets[0]).accent;
  }
}

export const settings = new SettingsStore();
