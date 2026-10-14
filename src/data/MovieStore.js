/**
 * What the viewer has done with films, per playlist: watch progress ("Continue watching"), My List, likes and
 * dislikes, and hidden titles. Mirrors Preferences in the Android app.
 */
import { storage } from './StorageManager.js';

const WATCHED_AT = 0.95; // a film counts as watched once this much of it has played

class MovieStore {
  constructor() {
    this.playlistId = 'demo';
    this.listeners = new Set();
    this.load();
  }

  key(name) { return `avaplay_movies_${name}_${this.playlistId}`; }

  load() {
    this.progress = storage.get(this.key('progress'), {});   // film key -> {position, duration, watched, updated}
    this.library = storage.get(this.key('library'), []);     // film keys, newest first
    this.ratings = storage.get(this.key('ratings'), {});     // film key -> 1 / -1
    this.hidden = new Set(storage.get(this.key('hidden'), []));
    this.hiddenGroups = new Set(storage.get(this.key('hiddenGroups'), []));
  }

  setPlaylist(id) {
    this.playlistId = id || 'demo';
    this.load();
    this.emit();
  }

  save() {
    storage.set(this.key('progress'), this.progress);
    storage.set(this.key('library'), this.library);
    storage.set(this.key('ratings'), this.ratings);
    storage.set(this.key('hidden'), Array.from(this.hidden));
    storage.set(this.key('hiddenGroups'), Array.from(this.hiddenGroups));
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach((fn) => fn()); }
  commit() { this.save(); this.emit(); }

  // ---- progress ----
  getProgress(key) { return this.progress[key] || null; }
  isStarted(key) { const p = this.progress[key]; return !!p && p.position > 0 && !p.watched; }
  isWatched(key) { return !!(this.progress[key] && this.progress[key].watched); }

  /** Called while a film plays; cheap, and only written to storage every few calls. */
  record(key, position, duration, parentKey = '') {
    if (!(duration > 0) || position < 0) return;
    const watched = position / duration >= WATCHED_AT;
    this.progress[key] = { position: watched ? 0 : position, duration, watched, updated: Date.now(), parent: parentKey || (this.progress[key] && this.progress[key].parent) || '' };
    this.dirty = (this.dirty || 0) + 1;
    if (this.dirty >= 5) { this.dirty = 0; this.save(); }
  }

  flush() { this.dirty = 0; this.commit(); }

  markWatched(key, watched, parentKey = '') {
    const old = this.progress[key] || { position: 0, duration: 0 };
    this.progress[key] = { ...old, watched, position: watched ? 0 : old.position, updated: Date.now(), parent: parentKey || old.parent || '' };
    this.commit();
  }

  /** Marks several episodes at once (one write) */
  markMany(keys, watched, parentKey) {
    keys.forEach((key) => {
      const old = this.progress[key] || { position: 0, duration: 0 };
      this.progress[key] = { ...old, watched, position: watched ? old.position : 0, updated: Date.now(), parent: parentKey };
    });
    this.commit();
  }

  clearProgress(key) { delete this.progress[key]; this.commit(); }
  clearAllProgress() { this.progress = {}; this.commit(); }

  /** Films with something left to watch, most recent first */
  continueKeys() {
    return Object.entries(this.progress)
      .filter(([k, p]) => k.startsWith('MOVIE:') && p.position > 0 && !p.watched)
      .sort((a, b) => b[1].updated - a[1].updated)
      .map(([k]) => k);
  }

  // ---- shows: progress is kept per episode, with the show it belongs to ----
  /** One entry per show, most recent first: an unfinished episode, or the last one watched within a month */
  continueShowKeys() {
    const latest = new Map();
    for (const [k, p] of Object.entries(this.progress)) {
      if (!k.startsWith('EPISODE:') || !p.parent) continue;
      const cur = latest.get(p.parent) || { updated: 0, unfinished: false };
      latest.set(p.parent, { updated: Math.max(cur.updated, p.updated || 0), unfinished: cur.unfinished || (p.position > 0 && !p.watched) });
    }
    const month = 30 * 24 * 3600 * 1000;
    return [...latest.entries()].filter(([, v]) => v.unfinished || Date.now() - v.updated < month).sort((a, b) => b[1].updated - a[1].updated).map(([k]) => k);
  }

  /** Progress of the shows as the "Picked for you" rows read it: one entry per show */
  showProgress() {
    const out = {};
    for (const [k, p] of Object.entries(this.progress)) {
      if (!k.startsWith('EPISODE:') || !p.parent) continue;
      const cur = out[p.parent];
      if (!cur || (p.updated || 0) > cur.updated) out[p.parent] = { position: 1, duration: 1, watched: false, updated: p.updated || 0 };
    }
    return out;
  }

  // ---- My List ----
  inLibrary(key) { return this.library.includes(key); }
  toggleLibrary(key) {
    this.library = this.inLibrary(key) ? this.library.filter((k) => k !== key) : [key, ...this.library];
    this.commit();
  }
  clearLibrary() { this.library = []; this.commit(); }

  // ---- likes ----
  rating(key) { return this.ratings[key] || 0; }
  rate(key, value) {
    if (this.rating(key) === value) delete this.ratings[key]; else this.ratings[key] = value;
    this.commit();
  }

  // ---- hidden ----
  hide(key) { this.hidden.add(key); this.commit(); }
  unhide(key) { this.hidden.delete(key); this.commit(); }
  toggleGroupHidden(id) {
    if (this.hiddenGroups.has(id)) this.hiddenGroups.delete(id); else this.hiddenGroups.add(id);
    this.commit();
  }
}

export const movieStore = new MovieStore();
