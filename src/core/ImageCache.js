/**
 * LRU GPU Texture Memory Manager for Tizen TV (Strict 40MB limit)
 * Prevents WebKit/Chromium layer memory exhaustion and OOM crashes.
 */

export class ImageCache {
  constructor(maxMemoryBytes = 40 * 1024 * 1024) {
    this.maxMemoryBytes = maxMemoryBytes;
    this.currentMemoryBytes = 0;
    this.cache = new Map(); // key -> { img, sizeBytes, lastUsed }
    this.placeholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect fill="%23181c21" width="300" height="450"/><path d="M110 180 L190 225 L110 270 Z" fill="%23262a30"/></svg>';
  }

  calculateBytes(width, height) {
    // 4 bytes per pixel for uncompressed RGBA_8888 bitmap in memory
    return Math.round(width * height * 4);
  }

  load(url, targetWidth = 300, targetHeight = 450) {
    if (!url) return Promise.resolve(this.placeholder);

    const key = `${url}?w=${targetWidth}&h=${targetHeight}`;
    const now = performance.now();

    if (this.cache.has(key)) {
      const entry = this.cache.get(key);
      entry.lastUsed = now;
      return Promise.resolve(entry.img.src);
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async'; // Decode off the main thread

      img.onload = () => {
        const sizeBytes = this.calculateBytes(targetWidth, targetHeight);
        this.ensureCapacity(sizeBytes);

        this.cache.set(key, {
          img,
          sizeBytes,
          lastUsed: now
        });
        this.currentMemoryBytes += sizeBytes;
        resolve(url);
      };

      img.onerror = () => {
        resolve(this.placeholder);
      };

      img.src = url;
    });
  }

  ensureCapacity(incomingBytes) {
    while (this.currentMemoryBytes + incomingBytes > this.maxMemoryBytes && this.cache.size > 0) {
      let oldestKey = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.cache.entries()) {
        if (entry.lastUsed < oldestTime) {
          oldestTime = entry.lastUsed;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.evict(oldestKey);
      }
    }
  }

  evict(key) {
    const entry = this.cache.get(key);
    if (!entry) return;

    // Direct browser cleanup of decoded bitmap
    entry.img.src = '';
    entry.img.onload = null;
    entry.img.onerror = null;

    this.currentMemoryBytes -= entry.sizeBytes;
    this.cache.delete(key);
  }

  clear() {
    for (const key of Array.from(this.cache.keys())) {
      this.evict(key);
    }
  }
}

export const imageCache = new ImageCache();
