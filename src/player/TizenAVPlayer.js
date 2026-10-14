/**
 * Samsung Tizen Native AVPlay Hardware Player Wrapper
 * Integrates directly with webapis.avplay hardware decoding with HTML5 fallback for local dev.
 */

import { viaProxy } from '../core/net.js';

// ISO 639 language codes (2 and 3 letter) as names, and 3 letter to 2 letter
const LANG_NAMES = { en: 'English', sq: 'Albanian', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', pt: 'Portuguese', tr: 'Turkish', ru: 'Russian', ar: 'Arabic', nl: 'Dutch', pl: 'Polish', sr: 'Serbian', hr: 'Croatian', bs: 'Bosnian', mk: 'Macedonian', el: 'Greek', ro: 'Romanian', bg: 'Bulgarian', hu: 'Hungarian', sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish', cs: 'Czech', uk: 'Ukrainian', he: 'Hebrew', fa: 'Persian', hi: 'Hindi', ja: 'Japanese', ko: 'Korean', zh: 'Chinese' };
const ISO3 = { eng: 'en', sqi: 'sq', alb: 'sq', deu: 'de', ger: 'de', fra: 'fr', fre: 'fr', spa: 'es', ita: 'it', por: 'pt', tur: 'tr', rus: 'ru', ara: 'ar', nld: 'nl', dut: 'nl', pol: 'pl', srp: 'sr', hrv: 'hr', bos: 'bs', mkd: 'mk', mac: 'mk', ell: 'el', gre: 'el', ron: 'ro', rum: 'ro', bul: 'bg', hun: 'hu', swe: 'sv', dan: 'da', nor: 'no', fin: 'fi', ces: 'cs', cze: 'cs', ukr: 'uk', heb: 'he', fas: 'fa', per: 'fa', hin: 'hi', jpn: 'ja', kor: 'ko', zho: 'zh', chi: 'zh' };
export const iso2 = (code) => { const c = String(code || '').toLowerCase().slice(0, 3).replace(/[^a-z]/g, ''); return c.length === 2 ? c : (ISO3[c] || c.slice(0, 2)); };
export const languageName = (code) => LANG_NAMES[iso2(code)] || '';

// ---- subtitle files (.srt / .vtt) turned into cues ----
const stamp = (t) => {
  const m = String(t).trim().replace(',', '.').match(/^(?:(\d+):)?(\d+):(\d+)(?:\.(\d+))?$/);
  if (!m) return NaN;
  return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (m[4] ? +`0.${m[4]}` : 0);
};

export function parseSubtitles(text) {
  const cues = [];
  const blocks = text.replace(/^\uFEFF/, '').replace(/\r/g, '').split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n');
    const at = lines.findIndex((l) => l.includes('-->'));
    if (at < 0) continue;
    const [a, b] = lines[at].split('-->');
    const start = stamp(a);
    const end = stamp((b || '').trim().split(/\s+/)[0]);
    const body = lines.slice(at + 1).join('\n').replace(/<[^>]+>/g, '').replace(/\{\\[^}]*\}/g, '').trim();
    if (!Number.isNaN(start) && !Number.isNaN(end) && body) cues.push({ start, end, text: body });
  }
  return cues;
}

export const PlayerState = {
  IDLE: 'IDLE',
  READY: 'READY',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED'
};

export class TizenAVPlayer {
  constructor() {
    this.state = PlayerState.IDLE;
    this.hasNativeAvplay = typeof window !== 'undefined' && Boolean(window.webapis && window.webapis.avplay);
    this.avplay = this.hasNativeAvplay ? window.webapis.avplay : null;
    this.htmlVideo = null;
    this.listeners = new Set();
    this.currentUrl = null;
    this.duration = 0;
    this.currentTime = 0;
    this.isLive = false;
    this.userAgent = '';
    this.bufferSeconds = 2;
    this.hls = null;
    this.rect = { x: 0, y: 0, w: 1920, h: 1080 };   // where the native video plane is drawn, in 1920 x 1080 page pixels
    this.externalSubs = [];   // subtitle files added by the viewer for the current stream

    this.initFallbackIfNeeded();
    this.setupLifecycleHooks();
  }

  initFallbackIfNeeded() {
    if (!this.hasNativeAvplay && typeof document !== 'undefined') {
      console.log('[TizenAVPlayer] webapis.avplay not detected; using HTML5 video fallback.');
      let vid = document.getElementById('avplay-html5-fallback');
      if (!vid) {
        vid = document.createElement('video');
        vid.id = 'avplay-html5-fallback';
        vid.style.position = 'fixed';
        vid.style.top = '0';
        vid.style.left = '0';
        vid.style.width = '100vw';
        vid.style.height = '100vh';
        vid.style.objectFit = 'contain';
        vid.style.zIndex = '0';
        vid.style.backgroundColor = '#000';
        document.body.prepend(vid);
      }
      this.htmlVideo = vid;

      this.htmlVideo.addEventListener('timeupdate', () => {
        this.currentTime = Math.round(this.htmlVideo.currentTime * 1000);
        this.emit('timeUpdate', this.currentTime);
      });

      this.htmlVideo.addEventListener('durationchange', () => {
        this.duration = Math.round(this.htmlVideo.duration * 1000);
        this.emit('durationChange', this.duration);
      });

      this.htmlVideo.addEventListener('waiting', () => this.emit('buffering', true));
      this.htmlVideo.addEventListener('playing', () => this.emit('buffering', false));

      this.htmlVideo.addEventListener('ended', () => {
        this.state = PlayerState.STOPPED;
        this.emit('ended');
        this.emit('stateChange', this.state);
      });

      this.htmlVideo.addEventListener('error', (e) => {
        this.emit('error', { stage: 'html5_error', error: e });
      });
    }
  }

  setupLifecycleHooks() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.suspend();
      } else {
        this.resume();
      }
    });

    window.addEventListener('beforeunload', () => {
      this.stop();
    });
  }

  open(streamUrl, isLiveStream = false) {
    if (!streamUrl) return;
    this.externalSubs = [];
    this.currentUrl = streamUrl;
    this.isLive = isLiveStream;

    if (this.state !== PlayerState.IDLE && this.state !== PlayerState.STOPPED) {
      this.stop();
    }

    if (this.hasNativeAvplay) {
      try {
        this.avplay.open(streamUrl);
        this.state = PlayerState.READY;

        // Hardware hole-punch rect (1920x1080 canvas coordinates)
        this.applyRect();

        // Hardware features
        try {
          this.avplay.setStreamingProperty('SET_MODE_4K', 'TRUE');
          this.avplay.setStreamingProperty('ADAPTIVE_INFO', 'FIXED_MAX_RESOLUTION=3840x2160');
          this.avplay.setBufferingParam('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', this.bufferSeconds);
          this.avplay.setBufferingParam('PLAYER_BUFFER_FOR_RESUME', 'PLAYER_BUFFER_SIZE_IN_SECOND', this.bufferSeconds * 3);
          if (this.userAgent) this.avplay.setStreamingProperty('USER_AGENT', this.userAgent);
        } catch (e) {
          console.warn('[TizenAVPlayer] setStreamingProperty warning:', e);
        }

        this.attachNativeEvents();
        this.emit('stateChange', this.state);
      } catch (err) {
        console.error('[TizenAVPlayer] open failed:', err);
        this.emit('error', { stage: 'open', error: err });
      }
    } else if (this.htmlVideo) {
      this.openInBrowser(streamUrl);
      this.state = PlayerState.READY;
      this.emit('stateChange', this.state);
    }
  }

  // Desktop browser path: HLS through hls.js (Chrome cannot play it natively), anything else directly.
  openInBrowser(streamUrl) {
    const video = this.htmlVideo;
    this.deferPlay = false;
    if (this.hls) { this.hls.destroy(); this.hls = null; }
    const proxied = viaProxy(streamUrl, this.userAgent);
    const isHls = /\.m3u8(\?|$)/i.test(streamUrl);
    const isTs = /\.ts(\?|$)/i.test(streamUrl);

    if (isTs) {
      // MPEG-TS has no browser decoder; the Tizen TV plays it natively.
      video.removeAttribute('src');
      this.deferPlay = true;
      this.emit('error', { stage: 'unsupported', error: new Error('MPEG-TS plays on the TV only. Choose HLS under Settings > Live TV to test in a browser.') });
      return;
    }
    if (isHls) {
      this.deferPlay = true; // hls.js starts playback once the manifest is parsed
      import('hls.js').then(({ default: Hls }) => {
        if (this.currentUrl !== streamUrl) return; // channel changed while loading
        if (!Hls.isSupported()) {
          // No Media Source support (e.g. Safari on iOS): let the element try its own HLS
          video.src = proxied;
          video.play().catch(() => {});
          return;
        }
        const hls = new Hls({ lowLatencyMode: false, maxBufferLength: this.bufferSeconds * 5 });
        this.hls = hls;
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) this.emit('error', { stage: 'hls', error: new Error(data.details || 'HLS error') });
        });
        hls.loadSource(proxied);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      });
      return;
    }
    video.src = proxied;
  }

  prepare() {
    return new Promise((resolve, reject) => {
      if (this.hasNativeAvplay) {
        try {
          this.avplay.prepareAsync(() => {
            this.state = PlayerState.READY;
            this.applyRect();
            if (this.pictureMode) this.setPictureSize(this.pictureMode);
            try {
              this.duration = this.avplay.getDuration();
              this.emit('durationChange', this.duration);
            } catch (e) {}
            resolve();
          }, (err) => {
            this.emit('error', { stage: 'prepare', error: err });
            reject(err);
          });
        } catch (err) {
          reject(err);
        }
      } else {
        resolve();
      }
    });
  }

  async play(streamUrl = null, isLive = false) {
    if (streamUrl) {
      this.open(streamUrl, isLive);
      try {
        await this.prepare();
      } catch (e) {
        console.error('[TizenAVPlayer] Prepare error:', e);
      }
    }

    if (this.hasNativeAvplay) {
      try {
        this.avplay.play();
        this.state = PlayerState.PLAYING;
        this.emit('buffering', false);
        this.emit('stateChange', this.state);
      } catch (err) {
        this.emit('error', { stage: 'play', error: err });
      }
    } else if (this.htmlVideo && !this.deferPlay) {
      this.htmlVideo.play().then(() => {
        this.state = PlayerState.PLAYING;
        this.emit('stateChange', this.state);
      }).catch((e) => {
        this.emit('error', { stage: 'play', error: e });
      });
    }
  }

  pause() {
    if (this.state !== PlayerState.PLAYING) return;

    if (this.hasNativeAvplay) {
      try {
        this.avplay.pause();
        this.state = PlayerState.PAUSED;
        this.emit('stateChange', this.state);
      } catch (err) {
        this.emit('error', { stage: 'pause', error: err });
      }
    } else if (this.htmlVideo) {
      this.htmlVideo.pause();
      this.state = PlayerState.PAUSED;
      this.emit('stateChange', this.state);
    }
  }

  togglePlayPause() {
    if (this.state === PlayerState.PLAYING) {
      this.pause();
    } else if (this.state === PlayerState.PAUSED || this.state === PlayerState.READY) {
      this.play();
    }
  }

  seekTo(milliseconds) {
    if (this.isLive) return;

    if (this.hasNativeAvplay) {
      try {
        this.avplay.seekTo(milliseconds, () => {
          this.currentTime = milliseconds;
          this.emit('seekSuccess', milliseconds);
        }, (err) => {
          this.emit('error', { stage: 'seek', error: err });
        });
      } catch (e) {
        console.error('[TizenAVPlayer] seek error:', e);
      }
    } else if (this.htmlVideo) {
      this.htmlVideo.currentTime = milliseconds / 1000;
      this.currentTime = milliseconds;
      this.emit('seekSuccess', milliseconds);
    }
  }

  /** Moves and sizes the native video plane (the Live TV preview box, the hero, or the whole screen). */
  setRect(x, y, w, h) {
    this.rect = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
    this.applyRect();
  }

  applyRect() {
    if (!this.hasNativeAvplay) return;
    try { this.avplay.setDisplayRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h); } catch (e) { /* not open yet */ }
  }

  /** Picture size on the native plane: 'Normal' keeps the shape, 'Stretch' fills the rect, 'Zoom' crops to fill. */
  setPictureSize(mode) {
    if (!this.hasNativeAvplay) return;
    this.pictureMode = mode;
    const method = { Normal: 'PLAYER_DISPLAY_MODE_LETTER_BOX', Full: 'PLAYER_DISPLAY_MODE_FULL_SCREEN', Stretch: 'PLAYER_DISPLAY_MODE_FULL_SCREEN', Zoom: 'PLAYER_DISPLAY_MODE_CROPPED_FULL' }[mode] || 'PLAYER_DISPLAY_MODE_LETTER_BOX';
    try { this.avplay.setDisplayMethod(method); } catch (e) { /* not open yet */ }
  }

  // ---- audio and subtitle tracks (type: 'AUDIO' | 'TEXT') ----
  getTracks(type) {
    const out = [];
    const add = (index, lang, name) => out.push({ index, lang: iso2(lang), label: languageName(lang) || name || `Track ${out.length + 1}` });
    try {
      if (this.hasNativeAvplay) {
        (this.avplay.getTotalTrackInfo() || []).filter((t) => t.type === type).forEach((t) => {
          let info = {};
          try { info = JSON.parse(t.extra_info); } catch (e) { /* plain text */ }
          add(t.index, info.language || info.track_lang || '', '');
        });
      } else if (this.hls) {
        ((type === 'AUDIO' ? this.hls.audioTracks : this.hls.subtitleTracks) || []).forEach((t, i) => add(i, t.lang || '', t.name));
      } else if (this.htmlVideo) {
        const list = type === 'AUDIO' ? this.htmlVideo.audioTracks : this.htmlVideo.textTracks;
        Array.from(list || []).forEach((t, i) => add(i, t.language || '', t.label));
      }
    } catch (e) { console.warn('[TizenAVPlayer] track list failed:', e); }
    if (type === 'TEXT') this.externalSubs.forEach((e, i) => out.push({ index: `ext:${i}`, lang: '', label: e.label }));
    // Two tracks of one language ("English", "English") are told apart by a number
    const seen = {};
    out.forEach((t) => { seen[t.label] = (seen[t.label] || 0) + 1; });
    const count = {};
    out.forEach((t) => { if (seen[t.label] > 1) { count[t.label] = (count[t.label] || 0) + 1; t.label = `${t.label} ${count[t.label]}`; } });
    return out;
  }

  selectTrack(type, index) {
    if (type === 'TEXT') {
      // A subtitle file added by the viewer is shown; any other choice (or Off) hides the files
      const ext = typeof index === 'string' && index.startsWith('ext:') ? Number(index.slice(4)) : -1;
      this.externalSubs.forEach((e, i) => { if (e.track) e.track.mode = i === ext ? 'showing' : 'disabled'; });
      if (ext >= 0) {
        if (this.hasNativeAvplay) { try { this.avplay.setSilentSubtitle(false); this.avplay.setExternalSubtitlePath(this.externalSubs[ext].url); } catch (e) { console.warn(e); } }
        else if (this.hls) { try { this.hls.subtitleTrack = -1; } catch (e) { /* none */ } }
        return;
      }
    }
    try {
      if (this.hasNativeAvplay) {
        if (type === 'TEXT') {
          if (index < 0) { this.avplay.setSilentSubtitle(true); return; }
          this.avplay.setSilentSubtitle(false);
        }
        this.avplay.setSelectTrack(type, index);
      } else if (this.hls) {
        if (type === 'AUDIO') this.hls.audioTrack = index;
        else { this.hls.subtitleDisplay = index >= 0; this.hls.subtitleTrack = index; }
      } else if (this.htmlVideo) {
        const list = Array.from(type === 'AUDIO' ? this.htmlVideo.audioTracks || [] : this.htmlVideo.textTracks || []);
        list.forEach((t, i) => { if (type === 'AUDIO') t.enabled = i === index; else t.mode = i === index ? 'showing' : 'disabled'; });
      }
    } catch (e) { console.warn('[TizenAVPlayer] track select failed:', e); }
  }

  /** Adds a subtitle file (.srt / .vtt link) to the stream that is playing; resolves to its name. */
  async loadExternalSubtitle(url) {
    const clean = String(url || '').trim();
    if (!/^https?:\/\//i.test(clean)) throw new Error('Enter the full http(s) link of the subtitle file.');
    const name = decodeURIComponent((clean.split('?')[0].split('/').pop() || 'Subtitles').replace(/\.[A-Za-z0-9]{2,4}$/, '')).slice(0, 30) || 'Subtitles';
    const entry = { label: name, url: clean, track: null };
    if (!this.hasNativeAvplay) {
      const response = await fetch(viaProxy(clean, this.userAgent));
      if (!response.ok) throw new Error(`The subtitle file could not be loaded (HTTP ${response.status}).`);
      const cues = parseSubtitles(await response.text());
      if (!cues.length) throw new Error('No subtitles found in that file. Use an .srt or .vtt file.');
      const track = this.htmlVideo.addTextTrack('subtitles', name, 'und');
      cues.forEach((c) => track.addCue(new VTTCue(c.start, c.end, c.text)));
      entry.track = track;
    }
    this.externalSubs.push(entry);
    return { label: name, index: `ext:${this.externalSubs.length - 1}` };
  }

  stop() {
    if (this.hls) { try { this.hls.destroy(); } catch (e) { /* already gone */ } this.hls = null; }
    if (this.state === PlayerState.IDLE || this.state === PlayerState.STOPPED) return;

    if (this.hasNativeAvplay) {
      try {
        this.avplay.stop();
        this.avplay.close();
      } catch (err) {
        console.warn('[TizenAVPlayer] stop/close error:', err);
      }
    } else if (this.htmlVideo) {
      this.htmlVideo.pause();
      this.htmlVideo.removeAttribute('src');
      this.htmlVideo.load();
    }

    this.state = PlayerState.STOPPED;
    this.emit('stateChange', this.state);
  }

  suspend() {
    if (this.state === PlayerState.PLAYING) {
      this.stop(); // Strictly release hardware decoders on backgrounding
    }
  }

  resume() {}

  attachNativeEvents() {
    const listener = {
      oncurrentplaytime: (time) => {
        this.currentTime = time;
        this.emit('timeUpdate', time);
      },
      onresolutionchanged: (width, height) => {
        this.emit('resolutionChange', { width, height });
      },
      onbufferingstart: () => {
        this.emit('buffering', true);
      },
      onbufferingcomplete: () => {
        this.emit('buffering', false);
      },
      onstreamcompleted: () => {
        this.state = PlayerState.STOPPED;
        this.emit('ended');
        this.emit('stateChange', this.state);
      },
      onerror: (errType) => {
        this.emit('error', { type: errType });
      },
      // Embedded and external subtitles arrive as text; the app draws them
      onsubtitlechange: (duration, text) => {
        this.emit('subtitle', { text: String(text == null ? '' : text), duration: Number(duration) || 0 });
      }
    };

    try {
      this.avplay.setListener(listener);
    } catch (e) {
      console.warn('[TizenAVPlayer] setListener error:', e);
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event, data) {
    for (const fn of this.listeners) {
      try {
        fn(event, data);
      } catch (e) {
        console.error('[TizenAVPlayer] listener callback error:', e);
      }
    }
  }
}

export const player = new TizenAVPlayer();
