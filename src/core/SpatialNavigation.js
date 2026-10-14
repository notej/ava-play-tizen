/**
 * High-Performance Deterministic Spatial Navigation Engine for Samsung Tizen TV
 * Sub-50ms response, decoupled from component re-renders, with key throttling and focus history.
 */

export const TVKeys = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
  BACK: 10009,          // Samsung Tizen Hardware Return / Back
  BACK_BROWSER: 27,     // Fallback for PC development (Escape)
  PLAY: 415,
  PAUSE: 19,
  PLAY_PAUSE: 10252,
  STOP: 413,
  FAST_FWD: 417,
  REWIND: 412,
  CH_UP: 427,
  CH_DOWN: 428,
  INFO: 457,
  NUM_0: 48,
  NUM_1: 49,
  NUM_2: 50,
  NUM_3: 51,
  NUM_4: 52,
  NUM_5: 53,
  NUM_6: 54,
  NUM_7: 55,
  NUM_8: 56,
  NUM_9: 57
};

export class SpatialNavigationEngine {
  constructor() {
    this.nodes = new Map();
    this.currentFocusedId = null;
    this.lastKeyPressTime = 0;
    this.repeatThrottleMs = 38; // 38ms throttle (~26 keystrokes/sec max) prevents CPU stall
    this.historyStack = [];
    this.activeScope = 'main'; // Scopes allow trapping focus in modals or player overlay
    this.listeners = new Set();
    this.customBackHandler = null;

    this.enterHoldTimer = null;
    this.isEnterHolding = false;
    this.enterDownId = null;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    window.addEventListener('keyup', this.onKeyUp, { capture: true });
  }

  setCustomBackHandler(fn) {
    this.customBackHandler = fn;
  }

  setScope(scope) {
    this.activeScope = scope;
  }

  register(node) {
    // node: { id, scope = 'main', el, up, down, left, right, onFocus, onBlur, onSelect, autoFocus }
    const registeredNode = {
      scope: 'main',
      ...node
    };
    this.nodes.set(node.id, registeredNode);

    if (!this.currentFocusedId && node.autoFocus) {
      this.focus(node.id);
    }
  }

  unregister(nodeId) {
    const node = this.nodes.get(nodeId);
    if (node && node.el) {
      node.el.classList.remove('focused');
    }
    this.nodes.delete(nodeId);
    if (this.currentFocusedId === nodeId) {
      this.currentFocusedId = null;
    }
  }

  unregisterScope(scope) {
    for (const [id, node] of this.nodes.entries()) {
      if (node.scope === scope) {
        this.unregister(id);
      }
    }
  }

  getCurrentNode() {
    return this.nodes.get(this.currentFocusedId);
  }

  focus(nodeId, pushHistory = false) {
    if (!this.nodes.has(nodeId)) return;
    const nextNode = this.nodes.get(nodeId);

    // If node is outside current active scope and not global, do not switch
    if (this.activeScope && nextNode.scope && nextNode.scope !== this.activeScope && nextNode.scope !== 'global') {
      return;
    }

    const prevNode = this.nodes.get(this.currentFocusedId);
    if (prevNode && prevNode.id !== nodeId) {
      if (pushHistory) {
        this.historyStack.push(prevNode.id);
      }
      if (prevNode.el) prevNode.el.classList.remove('focused');
      if (prevNode.onBlur) prevNode.onBlur(prevNode);
    }

    this.currentFocusedId = nodeId;

    if (nextNode.el) {
      nextNode.el.classList.add('focused');
      // Scroll into view safely using hardware translate if needed
      this.ensureVisible(nextNode.el);
    }
    if (nextNode.onFocus) {
      nextNode.onFocus(nextNode);
    }

    this.emit('focusChange', { current: nextNode, previous: prevNode });
  }

  ensureVisible(el) {
    // Check if element has a scrollable or virtual container
    const container = el.closest('[data-scroll-container]');
    if (!container) return;

    const orientation = container.dataset.scrollOrientation || 'horizontal';
    if (orientation === 'horizontal') {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const padding = 120; // safe area margin

      if (elRect.left < containerRect.left + padding) {
        const offset = (containerRect.left + padding) - elRect.left;
        container.scrollLeft -= offset;
      } else if (elRect.right > containerRect.right - padding) {
        const offset = elRect.right - (containerRect.right - padding);
        container.scrollLeft += offset;
      }
    } else {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const padding = 80;

      if (elRect.top < containerRect.top + padding) {
        const offset = (containerRect.top + padding) - elRect.top;
        container.scrollTop -= offset;
      } else if (elRect.bottom > containerRect.bottom - padding) {
        const offset = elRect.bottom - (containerRect.bottom - padding);
        container.scrollTop += offset;
      }
    }
  }

  onKeyDown(e) {
    const code = e.keyCode;
    const now = performance.now();

    // Key repeat throttling for high-frequency D-pad holding
    if (code >= TVKeys.LEFT && code <= TVKeys.DOWN) {
      if (now - this.lastKeyPressTime < this.repeatThrottleMs) {
        e.preventDefault();
        return;
      }
      this.lastKeyPressTime = now;
    }

    // Handle Return / Back key
    if (code === TVKeys.BACK || code === TVKeys.BACK_BROWSER) {
      e.preventDefault();
      this.handleBack();
      return;
    }

    const current = this.nodes.get(this.currentFocusedId);
    if (!current) {
      // If nothing is focused, attempt to focus first available node in scope
      this.focusFirstInScope();
      return;
    }

    // Enter / OK key (Click vs Long-press)
    if (code === TVKeys.ENTER) {
      e.preventDefault();
      if (e.repeat) {
        if (current.onHoldSelect && !this.isEnterHolding) {
          this.isEnterHolding = true;
          if (this.enterHoldTimer) clearTimeout(this.enterHoldTimer);
          current.onHoldSelect(current);
        }
        return;
      }

      this.enterDownId = current.id;

      if (current.onHoldSelect) {
        this.isEnterHolding = false;
        if (this.enterHoldTimer) clearTimeout(this.enterHoldTimer);
        this.enterHoldTimer = setTimeout(() => {
          this.isEnterHolding = true;
          current.onHoldSelect(current);
        }, 400);
      } else if (current.onSelect) {
        current.onSelect(current);
      }
      return;
    }

    // Directional Navigation
    let targetId = null;

    if (code === TVKeys.LEFT) {
      targetId = typeof current.left === 'function' ? current.left(current) : current.left;
    } else if (code === TVKeys.RIGHT) {
      targetId = typeof current.right === 'function' ? current.right(current) : current.right;
    } else if (code === TVKeys.UP) {
      targetId = typeof current.up === 'function' ? current.up(current) : current.up;
    } else if (code === TVKeys.DOWN) {
      targetId = typeof current.down === 'function' ? current.down(current) : current.down;
    }

    if (targetId && this.nodes.has(targetId)) {
      e.preventDefault();
      this.focus(targetId);
      return;
    }

    // Pass media keys or number keys to global listeners
    this.emit('key', { keyCode: code, event: e });
  }

  focusFirstInScope() {
    for (const [id, node] of this.nodes.entries()) {
      if (!this.activeScope || node.scope === this.activeScope) {
        this.focus(id);
        break;
      }
    }
  }

  handleBack() {
    if (this.customBackHandler) {
      const handled = this.customBackHandler();
      if (handled) return;
    }

    if (this.historyStack.length > 0) {
      const prevId = this.historyStack.pop();
      if (this.nodes.has(prevId)) {
        this.focus(prevId);
        return;
      }
    }

    // Default Tizen app exit procedure
    try {
      if (window.tizen && window.tizen.application) {
        window.tizen.application.getCurrentApplication().exit();
      }
    } catch (err) {
      console.log('App exit invoked:', err);
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type, data) {
    for (const fn of this.listeners) {
      fn(type, data);
    }
  }

  onKeyUp(e) {
    if (e.keyCode === TVKeys.ENTER) {
      if (this.enterHoldTimer) {
        clearTimeout(this.enterHoldTimer);
        this.enterHoldTimer = null;
      }
      const enterDownId = this.enterDownId;
      this.enterDownId = null;
      if (!this.isEnterHolding) {
        const current = this.nodes.get(this.currentFocusedId);
        // Only register a tap-select if focus stayed on the same node during the press,
        // so selecting a group does not also tune the channel it just focused.
        if (current && current.id === enterDownId && current.onSelect && current.onHoldSelect) {
          current.onSelect(current);
        }
      }
      this.isEnterHolding = false;
    }
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown, { capture: true });
    window.removeEventListener('keyup', this.onKeyUp, { capture: true });
    if (this.enterHoldTimer) clearTimeout(this.enterHoldTimer);
    this.nodes.clear();
    this.listeners.clear();
  }
}
