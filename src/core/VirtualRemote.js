/* Virtual Samsung Smart TV Remote & Fullscreen Controller */

import { TVKeys } from './SpatialNavigation.js';

export class VirtualRemote {
  constructor(navEngine, playerInstance) {
    this.nav = navEngine;
    this.player = playerInstance;
    this.visible = true; // press R to hide
    this.createRemoteUI();
    this.attachKeyboardShortcuts();
  }

  createRemoteUI() {
    // 1. Floating Toggle Button (Top-Right of screen)
    const toggleBar = document.createElement('div');
    toggleBar.id = 'virtual-remote-togglebar';
    toggleBar.innerHTML = `
      <button id="btn-toggle-fullscreen" class="remote-toggle-btn" title="Toggle Fullscreen TV (F11)">
        ⛶ Fullscreen TV
      </button>
      <button id="btn-toggle-remote" class="remote-toggle-btn active" title="Toggle Virtual Remote (R)">
        📱 Samsung Remote
      </button>
    `;
    document.body.appendChild(toggleBar);

    // 2. Realistic Samsung OneRemote Container
    const remoteEl = document.createElement('div');
    remoteEl.id = 'virtual-samsung-remote';
    remoteEl.className = 'samsung-remote';
    remoteEl.innerHTML = `
      <div class="remote-top">
        <div class="remote-brand">SAMSUNG</div>
        <div id="remote-led" class="remote-led"></div>
        <button class="remote-btn btn-power" data-action="power" title="Power / Exit">⏻</button>
      </div>

      <!-- Directional D-Pad Wheel -->
      <div class="dpad-wheel">
        <button class="remote-btn dpad-btn dpad-up" data-key="${TVKeys.UP}" title="Up Arrow">▲</button>
        <button class="remote-btn dpad-btn dpad-left" data-key="${TVKeys.LEFT}" title="Left Arrow">◀</button>
        <button class="remote-btn dpad-btn dpad-ok" data-key="${TVKeys.ENTER}" title="OK / Select">OK</button>
        <button class="remote-btn dpad-btn dpad-right" data-key="${TVKeys.RIGHT}" title="Right Arrow">▶</button>
        <button class="remote-btn dpad-btn dpad-down" data-key="${TVKeys.DOWN}" title="Down Arrow">▼</button>
      </div>

      <!-- Essential Navigation Row -->
      <div class="remote-nav-row">
        <button class="remote-btn nav-btn" data-key="${TVKeys.BACK}" title="Return / Back (Esc)">
          <span>⤺</span>
          <label>BACK</label>
        </button>
        <button class="remote-btn nav-btn" data-action="home" title="Home">
          <span>🏠</span>
          <label>HOME</label>
        </button>
        <button class="remote-btn nav-btn" data-key="${TVKeys.PLAY_PAUSE}" title="Play / Pause (Space)">
          <span>⏯</span>
          <label>PLAY</label>
        </button>
      </div>

      <!-- Channel & Volume Rockers -->
      <div class="remote-rocker-row">
        <div class="rocker-group">
          <button class="remote-btn rocker-btn" data-action="vol-up">VOL +</button>
          <button class="remote-btn rocker-btn" data-action="vol-down">VOL -</button>
        </div>
        <div class="rocker-group">
          <button class="remote-btn rocker-btn" data-key="${TVKeys.CH_UP}">CH ∧</button>
          <button class="remote-btn rocker-btn" data-key="${TVKeys.CH_DOWN}">CH ∨</button>
        </div>
      </div>

      <!-- Playback Transport Row -->
      <div class="remote-transport-row">
        <button class="remote-btn transport-btn" data-key="${TVKeys.REWIND}" title="Rewind 15s">⏪</button>
        <button class="remote-btn transport-btn" data-key="${TVKeys.STOP}" title="Stop Stream">⏹</button>
        <button class="remote-btn transport-btn" data-key="${TVKeys.FAST_FWD}" title="Fast Forward 15s">⏩</button>
      </div>

      <!-- Quick Action Buttons -->
      <div class="remote-quick-actions">
        <button class="remote-btn pill-btn" data-action="guide">GUIDE</button>
        <button class="remote-btn pill-btn" data-action="livetv">LIVE</button>
        <button class="remote-btn pill-btn" data-action="search">SEARCH</button>
      </div>

      <div class="remote-footer">AVA PLAY • TIZEN TV</div>
    `;
    document.body.appendChild(remoteEl);

    this.remoteEl = remoteEl;
    this.ledEl = document.getElementById('remote-led');

    // Attach Event Handlers
    this.attachButtonEvents();
  }

  attachButtonEvents() {
    // 1. Toggle Fullscreen
    const btnFullscreen = document.getElementById('btn-toggle-fullscreen');
    btnFullscreen.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    // 2. Toggle Remote Visibility
    const btnToggleRemote = document.getElementById('btn-toggle-remote');
    btnToggleRemote.addEventListener('click', () => {
      this.visible = !this.visible;
      this.remoteEl.classList.toggle('hidden', !this.visible);
      btnToggleRemote.classList.toggle('active', this.visible);
    });

    // 3. Remote Buttons
    this.remoteEl.querySelectorAll('.remote-btn').forEach((btn) => {
      const keyCode = btn.dataset.key ? parseInt(btn.dataset.key, 10) : null;

      if (keyCode) {
        // Key buttons are press-and-hold capable: keydown fires on press and keyup
        // on release, so long-press gestures (e.g. hold OK = fullscreen) work here.
        // Directional / channel keys auto-repeat while held, like a real remote.
        const repeatable = keyCode !== TVKeys.ENTER && [
          TVKeys.LEFT, TVKeys.RIGHT, TVKeys.UP, TVKeys.DOWN, TVKeys.CH_UP, TVKeys.CH_DOWN
        ].includes(keyCode);

        const press = (e) => {
          e.preventDefault();
          if (btn.dataset.pressed === '1') return;
          btn.dataset.pressed = '1';
          this.flashLed();
          window.dispatchEvent(this.makeKeyEvent('keydown', keyCode, false));
          if (repeatable) {
            btn._repeatTimer = setInterval(() => {
              window.dispatchEvent(this.makeKeyEvent('keydown', keyCode, true));
            }, 160);
          }
        };
        const release = () => {
          if (btn.dataset.pressed !== '1') return;
          btn.dataset.pressed = '0';
          if (btn._repeatTimer) {
            clearInterval(btn._repeatTimer);
            btn._repeatTimer = null;
          }
          window.dispatchEvent(this.makeKeyEvent('keyup', keyCode, false));
        };
        btn.addEventListener('pointerdown', press);
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointerleave', release);
        btn.addEventListener('pointercancel', release);
        return;
      }

      // Custom action buttons
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.flashLed();

        const action = btn.dataset.action;
        if (action === 'power') {
          if (confirm('Exit TV Application?')) {
            window.close();
          }
        } else if (action === 'home') {
          if (window.app) window.app.switchView('home');
        } else if (action === 'guide') {
          if (window.app) window.app.switchView('guide');
        } else if (action === 'livetv') {
          if (window.app) window.app.switchView('livetv');
        } else if (action === 'search') {
          if (window.app) window.app.switchView('search');
        }
      });
    });
  }

  flashLed() {
    if (!this.ledEl) return;
    this.ledEl.classList.add('flash');
    setTimeout(() => {
      this.ledEl.classList.remove('flash');
    }, 120);
  }

  makeKeyEvent(type, keyCode, repeat = false) {
    return new KeyboardEvent(type, {
      keyCode,
      which: keyCode,
      repeat,
      bubbles: true,
      cancelable: true
    });
  }

  dispatchKey(keyCode) {
    window.dispatchEvent(this.makeKeyEvent('keydown', keyCode));
    // Emit the matching keyup so a remote tap registers as a click, not a hold.
    window.setTimeout(() => window.dispatchEvent(this.makeKeyEvent('keyup', keyCode)), 80);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request error:', err);
      });
      document.getElementById('btn-toggle-fullscreen').textContent = '⛶ Exit Fullscreen';
    } else {
      document.exitFullscreen().catch(() => {});
      document.getElementById('btn-toggle-fullscreen').textContent = '⛶ Fullscreen TV';
    }
  }

  attachKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Toggle Remote shortcut: press 'R' key
      if (e.key === 'r' || e.key === 'R') {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          const btn = document.getElementById('btn-toggle-remote');
          if (btn) btn.click();
        }
      }
    });
  }
}
