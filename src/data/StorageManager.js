/**
 * Local Storage Persistence Manager for AvaPlay Tizen
 * Manages playlists, credentials, favorites, visibility, and resume progress.
 */

const STORAGE_KEYS = {
  CONNECTIONS: 'avaplay_connections',
  ACTIVE_CONNECTION_ID: 'avaplay_active_conn_id',
  FAVORITES: 'avaplay_favorites',
  HIDDEN_ITEMS: 'avaplay_hidden_items',
  LIBRARY: 'avaplay_my_library',
  PROGRESS: 'avaplay_playback_progress',
  SETTINGS: 'avaplay_app_settings',
  RECENT_CHANNELS: 'avaplay_recent_channels'
};

export class StorageManager {
  constructor() {
    this.memoryCache = new Map();
  }

  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch (e) {
      console.warn('Storage read failed:', key, e);
      return defaultValue;
    }
  }

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage write failed:', key, e);
    }
  }

  // --- Connections / Playlists ---
  getConnections() {
    return this.get(STORAGE_KEYS.CONNECTIONS, []);
  }

  saveConnection(connection) {
    const list = this.getConnections();
    const index = list.findIndex(c => c.id === connection.id);
    if (index >= 0) {
      list[index] = connection;
    } else {
      list.push(connection);
    }
    this.set(STORAGE_KEYS.CONNECTIONS, list);
    if (!this.getActiveConnectionId()) {
      this.setActiveConnectionId(connection.id);
    }
  }

  deleteConnection(id) {
    const list = this.getConnections().filter(c => c.id !== id);
    this.set(STORAGE_KEYS.CONNECTIONS, list);
    if (this.getActiveConnectionId() === id) {
      this.setActiveConnectionId(list[0]?.id || null);
    }
  }

  getActiveConnectionId() {
    return this.get(STORAGE_KEYS.ACTIVE_CONNECTION_ID, null);
  }

  setActiveConnectionId(id) {
    this.set(STORAGE_KEYS.ACTIVE_CONNECTION_ID, id);
  }

  getActiveConnection() {
    const id = this.getActiveConnectionId();
    if (!id) return null;
    return this.getConnections().find(c => c.id === id) || null;
  }

  // --- Favorites ---
  getFavorites() {
    return new Set(this.get(STORAGE_KEYS.FAVORITES, []));
  }

  toggleFavorite(mediaKey) {
    const favs = this.getFavorites();
    if (favs.has(mediaKey)) {
      favs.delete(mediaKey);
    } else {
      favs.add(mediaKey);
    }
    this.set(STORAGE_KEYS.FAVORITES, Array.from(favs));
    return favs.has(mediaKey);
  }

  isFavorite(mediaKey) {
    return this.getFavorites().has(mediaKey);
  }

  // --- Visibility (Hidden categories / channels) ---
  getHiddenItems() {
    return new Set(this.get(STORAGE_KEYS.HIDDEN_ITEMS, []));
  }

  toggleHidden(key) {
    const hidden = this.getHiddenItems();
    if (hidden.has(key)) {
      hidden.delete(key);
    } else {
      hidden.add(key);
    }
    this.set(STORAGE_KEYS.HIDDEN_ITEMS, Array.from(hidden));
    return hidden.has(key);
  }

  isHidden(key) {
    return this.getHiddenItems().has(key);
  }

  // --- My Library / Watchlist ---
  getLibrary() {
    return this.get(STORAGE_KEYS.LIBRARY, []);
  }

  addToLibrary(media) {
    const lib = this.getLibrary();
    if (!lib.some(m => m.id === media.id && m.type === media.type)) {
      lib.unshift({ ...media, savedAt: Date.now() });
      this.set(STORAGE_KEYS.LIBRARY, lib);
    }
  }

  removeFromLibrary(mediaId, mediaType) {
    const lib = this.getLibrary().filter(m => !(m.id === mediaId && m.type === mediaType));
    this.set(STORAGE_KEYS.LIBRARY, lib);
  }

  isInLibrary(mediaId, mediaType) {
    return this.getLibrary().some(m => m.id === mediaId && m.type === mediaType);
  }

  // --- Continue Watching / Playback Progress ---
  getProgress(streamId) {
    const map = this.get(STORAGE_KEYS.PROGRESS, {});
    return map[streamId] || null;
  }

  getAllProgress() {
    return this.get(STORAGE_KEYS.PROGRESS, {});
  }

  saveProgress(streamId, positionMs, durationMs, mediaMeta = {}) {
    const map = this.get(STORAGE_KEYS.PROGRESS, {});
    map[streamId] = {
      streamId,
      positionMs,
      durationMs,
      updatedAt: Date.now(),
      percent: durationMs > 0 ? Math.round((positionMs / durationMs) * 100) : 0,
      ...mediaMeta
    };
    this.set(STORAGE_KEYS.PROGRESS, map);
  }

  // --- Settings ---
  getSettings() {
    return this.get(STORAGE_KEYS.SETTINGS, {
      streamFormat: 'm3u8', // 'm3u8' (HLS) or 'ts' (MPEG-TS)
      autoPlayLastChannel: false,
      epgHoursOffset: 0
    });
  }

  saveSettings(patch) {
    const current = this.getSettings();
    this.set(STORAGE_KEYS.SETTINGS, { ...current, ...patch });
  }

  // --- Recently watched channels ---
  getRecentChannels() {
    return this.get(STORAGE_KEYS.RECENT_CHANNELS, []);
  }

  saveRecentChannels(ids) {
    this.set(STORAGE_KEYS.RECENT_CHANNELS, Array.isArray(ids) ? ids : []);
  }
}

export const storage = new StorageManager();
