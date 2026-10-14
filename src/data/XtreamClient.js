/**
 * Production Xtream Codes IPTV API Client for Samsung Tizen
 * Connects to provider player_api.php endpoints with timeout safety and JSON resilience.
 */

import { viaProxy } from '../core/net.js';

/** A connection failure with a kind, so the app can say what to try (see explainConnectionError) */
export class ConnectionError extends Error {
  constructor(kind, message, detail = '') {
    super(message);
    this.kind = kind;       // unreachable | timeout | blocked | notxtream | http | auth | inactive
    this.detail = detail;
  }
}

export class XtreamClient {
  constructor(connection) {
    this.connection = connection;
    this.server = (connection.server || '').trim().replace(/\/+$/, '');
    this.username = (connection.username || '').trim();
    this.password = connection.password || '';
  }

  buildUrl(action = '', params = {}) {
    const url = new URL(`${this.server}/player_api.php`);
    url.searchParams.set('username', this.username);
    url.searchParams.set('password', this.password);
    if (action) {
      url.searchParams.set('action', action);
    }
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    return url.toString();
  }

  async fetchJson(action = '', params = {}, timeoutMs = 15000) {
    const url = this.buildUrl(action, params);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(viaProxy(url), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 502 || response.status === 504) {
        // The dev proxy says why in its body (DNS failure, refused, timeout…)
        const why = (await response.text().catch(() => '')).replace(/^Proxy error:\s*/, '').slice(0, 80);
        throw new ConnectionError('unreachable', 'Could not reach the provider.', why);
      }
      if (response.status === 401 || response.status === 403 || response.status === 429) {
        throw new ConnectionError('blocked', 'The provider refused the connection.', `HTTP ${response.status}`);
      }
      if (response.status === 404 || response.status === 405) {
        throw new ConnectionError('notxtream', 'The server answered, but not like an IPTV service.', `HTTP ${response.status}`);
      }
      if (!response.ok) {
        throw new ConnectionError('http', `The provider reported a problem (HTTP ${response.status}).`, `HTTP ${response.status}`);
      }

      let data;
      try { data = await response.json(); } catch (e) {
        throw new ConnectionError('notxtream', 'The server answered, but not like an IPTV service.', 'not JSON');
      }
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw new ConnectionError('timeout', 'The provider did not answer in time.');
      // On the TV a blocked, unknown or refused address all arrive as one TypeError
      if (err instanceof TypeError) throw new ConnectionError('unreachable', 'Could not reach the provider.');
      throw err;
    }
  }

  // --- Authentication & User Info ---
  async authenticate() {
    const data = await this.fetchJson('', {}, 12000);
    const userInfo = data?.user_info;
    if (!userInfo) {
      throw new ConnectionError('notxtream', 'The server answered, but not like an IPTV service.', 'no user_info');
    }

    if (userInfo.auth !== 1 && userInfo.auth !== '1' && userInfo.auth !== true) {
      throw new ConnectionError('auth', 'The username or password was not accepted.');
    }

    return {
      status: userInfo.status || 'Active',
      maxConnections: userInfo.max_connections || '1',
      activeCons: userInfo.active_cons || '0',
      expDate: userInfo.exp_date ? parseInt(userInfo.exp_date, 10) : null,
      serverInfo: data?.server_info || {}
    };
  }

  // --- Live TV ---
  async getLiveCategories() {
    const categories = await this.fetchJson('get_live_categories');
    return Array.isArray(categories) ? categories.map(c => ({
      id: String(c.category_id),
      name: c.category_name || 'General',
      type: 'LIVE'
    })) : [];
  }

  async getLiveStreams(categoryId = null) {
    const params = categoryId ? { category_id: categoryId } : {};
    const streams = await this.fetchJson('get_live_streams', params, 30000);
    return Array.isArray(streams) ? streams.map(s => ({
      id: String(s.stream_id),
      name: s.name || 'Unnamed Channel',
      num: s.num || '',
      categoryId: String(s.category_id || ''),
      icon: s.stream_icon || '',
      epgId: s.epg_channel_id || '',
      type: 'LIVE',
      streamUrl: this.getLiveStreamUrl(s.stream_id)
    })) : [];
  }

  getLiveStreamUrl(streamId, format = 'm3u8') {
    return `${this.server}/live/${this.username}/${this.password}/${streamId}.${format}`;
  }

  // --- Movies (VOD) ---
  async getVodCategories() {
    const categories = await this.fetchJson('get_vod_categories');
    return Array.isArray(categories) ? categories.map(c => ({
      id: String(c.category_id),
      name: c.category_name || 'Movies',
      type: 'MOVIE'
    })) : [];
  }

  async getVodStreams(categoryId = null) {
    const params = categoryId ? { category_id: categoryId } : {};
    const streams = await this.fetchJson('get_vod_streams', params, 35000);
    return Array.isArray(streams) ? streams.map(v => ({
      id: String(v.stream_id),
      name: v.name || 'Unnamed Title',
      categoryId: String(v.category_id || ''),
      image: v.stream_icon || '',
      rating: v.rating || '',
      year: v.year || '',
      extension: v.container_extension || 'mp4',
      type: 'MOVIE',
      streamUrl: this.getVodStreamUrl(v.stream_id, v.container_extension)
    })) : [];
  }

  getVodStreamUrl(streamId, extension = 'mp4') {
    return `${this.server}/movie/${this.username}/${this.password}/${streamId}.${extension || 'mp4'}`;
  }

  async getVodInfo(vodId) {
    const data = await this.fetchJson('get_vod_info', { vod_id: vodId });
    const info = data?.info || {};
    const movieData = data?.movie_data || {};

    return {
      id: String(vodId),
      name: info.name || movieData.name || 'Movie Details',
      description: info.description || info.plot || '',
      duration: info.duration || info.duration_secs || '',
      rating: info.rating || '',
      year: info.releasedate || info.year || '',
      genre: info.genre || '',
      cast: info.cast || info.actors || '',
      director: info.director || '',
      backdrop: (info.backdrop_path && info.backdrop_path[0]) || movieData.backdrop_path || '',
      trailer: info.youtube_trailer || '',
      streamUrl: this.getVodStreamUrl(vodId, movieData.container_extension || 'mp4')
    };
  }

  // --- TV Shows (Series) ---
  async getSeriesCategories() {
    const categories = await this.fetchJson('get_series_categories');
    return Array.isArray(categories) ? categories.map(c => ({
      id: String(c.category_id),
      name: c.category_name || 'Series',
      type: 'SHOW'
    })) : [];
  }

  async getSeriesStreams(categoryId = null) {
    const params = categoryId ? { category_id: categoryId } : {};
    const list = await this.fetchJson('get_series', params, 35000);
    return Array.isArray(list) ? list.map(s => ({
      id: String(s.series_id),
      name: s.name || 'Unnamed Show',
      categoryId: String(s.category_id || ''),
      image: s.cover || '',
      rating: s.rating || '',
      year: s.releaseDate ? s.releaseDate.substring(0, 4) : '',
      plot: s.plot || '',
      genre: s.genre || '',
      type: 'SHOW'
    })) : [];
  }

  async getSeriesInfo(seriesId) {
    const data = await this.fetchJson('get_series_info', { series_id: seriesId });
    const info = data?.info || {};
    const rawEpisodes = data?.episodes || {};

    // Group episodes by season: { [seasonNum]: [episodes] }
    const seasons = {};
    for (const [seasonKey, epList] of Object.entries(rawEpisodes)) {
      if (Array.isArray(epList)) {
        seasons[seasonKey] = epList.map(ep => ({
          id: String(ep.id),
          title: ep.title || `Episode ${ep.episode_num}`,
          season: ep.season,
          episodeNum: ep.episode_num,
          duration: ep.info?.duration || '',
          plot: ep.info?.plot || '',
          image: ep.info?.movie_image || '',
          streamUrl: `${this.server}/series/${this.username}/${this.password}/${ep.id}.${ep.container_extension || 'mp4'}`
        }));
      }
    }

    return {
      id: String(seriesId),
      name: info.name || 'Series Details',
      description: info.plot || '',
      rating: info.rating || '',
      genre: info.genre || '',
      cast: info.cast || '',
      director: info.director || '',
      backdrop: (info.backdrop_path && info.backdrop_path[0]) || '',
      seasons
    };
  }

  // --- EPG ---
  async getShortEpg(streamId, limit = 4) {
    try {
      const data = await this.fetchJson('get_short_epg', { stream_id: streamId, limit });
      const listings = data?.epg_listings || [];
      return listings.map(l => ({
        id: l.id,
        title: l.title ? atobSafe(l.title) : 'Program',
        description: l.description ? atobSafe(l.description) : '',
        start: l.start,
        end: l.end,
        startTimestamp: l.start_timestamp,
        stopTimestamp: l.stop_timestamp
      }));
    } catch (e) {
      return [];
    }
  }
}

function atobSafe(str) {
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch (e) {
    return str;
  }
}
