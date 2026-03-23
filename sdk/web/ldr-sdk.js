/**
 * LDR Web SDK v0.1.0
 *
 * Drop-in browser SDK for LDR logo scanning and routing.
 * Works in any modern browser — no dependencies, no build step.
 *
 * Usage:
 *   <script src="ldr-sdk.js"></script>
 *   <script>
 *     const ldr = new LDR({ registry: 'https://registry.ldr-standard.org' });
 *     ldr.start();
 *   </script>
 *
 * Or as ES module:
 *   import LDR from './ldr-sdk.js';
 */

'use strict';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const LDR_VERSION    = '0.1.0';
const SCAN_INTERVAL  = 500;     // ms between scans
const HASH_SIZE      = 8;
const DCT_SIZE       = 32;
const MATCH_THRESHOLD = 10;

// ─────────────────────────────────────────────────────────
// Perceptual hasher (browser version)
// Same algorithm as core/hasher.js — self-contained for the SDK
// ─────────────────────────────────────────────────────────

const Hasher = {
  toGrayscale(pixels) {
    const len  = pixels.length / 4;
    const gray = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      gray[i] =
        0.299 * pixels[i * 4] +
        0.587 * pixels[i * 4 + 1] +
        0.114 * pixels[i * 4 + 2];
    }
    return gray;
  },

  resize(src, srcW, srcH, dstW, dstH) {
    const dst    = new Float32Array(dstW * dstH);
    const xRatio = srcW / dstW;
    const yRatio = srcH / dstH;
    for (let y = 0; y < dstH; y++) {
      for (let x = 0; x < dstW; x++) {
        const sx   = x * xRatio;
        const sy   = y * yRatio;
        const x0   = Math.floor(sx);
        const y0   = Math.floor(sy);
        const x1   = Math.min(x0 + 1, srcW - 1);
        const y1   = Math.min(y0 + 1, srcH - 1);
        const xf   = sx - x0;
        const yf   = sy - y0;
        dst[y * dstW + x] =
          src[y0 * srcW + x0] * (1 - xf) * (1 - yf) +
          src[y0 * srcW + x1] * xf       * (1 - yf) +
          src[y1 * srcW + x0] * (1 - xf) * yf +
          src[y1 * srcW + x1] * xf       * yf;
      }
    }
    return dst;
  },

  dct2d(pixels, N) {
    const cos = new Float32Array(N * N);
    for (let k = 0; k < N; k++)
      for (let n = 0; n < N; n++)
        cos[k * N + n] = Math.cos((Math.PI / N) * (n + 0.5) * k);

    const out = new Float32Array(N * N);
    for (let ky = 0; ky < N; ky++) {
      for (let kx = 0; kx < N; kx++) {
        let sum = 0;
        for (let y = 0; y < N; y++)
          for (let x = 0; x < N; x++)
            sum += pixels[y * N + x] * cos[ky * N + y] * cos[kx * N + x];
        const sx = kx === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
        const sy = ky === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
        out[ky * N + kx] = sum * sx * sy;
      }
    }
    return out;
  },

  compute(pixels, width, height) {
    const gray     = this.toGrayscale(pixels);
    const small    = this.resize(gray, width, height, DCT_SIZE, DCT_SIZE);
    const dct      = this.dct2d(small, DCT_SIZE);
    const lowFreq  = new Float32Array(HASH_SIZE * HASH_SIZE);
    for (let y = 0; y < HASH_SIZE; y++)
      for (let x = 0; x < HASH_SIZE; x++)
        lowFreq[y * HASH_SIZE + x] = dct[y * DCT_SIZE + x];

    const sorted = Float32Array.from(lowFreq).sort();
    const median = (sorted[31] + sorted[32]) / 2;

    let hash = 0n;
    for (let i = 0; i < 64; i++)
      if (lowFreq[i] > median) hash |= (1n << BigInt(63 - i));

    return hash.toString(16).padStart(16, '0');
  },

  hamming(a, b) {
    let xor   = BigInt('0x' + a) ^ BigInt('0x' + b);
    let count = 0;
    while (xor > 0n) { count += Number(xor & 1n); xor >>= 1n; }
    return count;
  },
};

// ─────────────────────────────────────────────────────────
// Context collector
// ─────────────────────────────────────────────────────────

const Context = {
  collect() {
    return {
      hour:          new Date().getHours(),
      language:      (navigator.language || 'en').slice(0, 2).toLowerCase(),
      platform:      this._platform(),
      location_type: 'unknown', // set by brand's own logic
      app_installed: false,     // set by brand's own logic
    };
  },

  _platform() {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua))           return 'android';
    return 'web';
  },
};

// ─────────────────────────────────────────────────────────
// Local registry cache
// ─────────────────────────────────────────────────────────

const Cache = {
  _store: new Map(),
  _ttl:   5 * 60 * 1000, // 5 minutes

  set(key, value) {
    this._store.set(key, { value, ts: Date.now() });
  },

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this._ttl) { this._store.delete(key); return null; }
    return entry.value;
  },

  clear() { this._store.clear(); },
};

// ─────────────────────────────────────────────────────────
// Main LDR class
// ─────────────────────────────────────────────────────────

class LDR {
  /**
   * @param {Object} options
   * @param {string}   options.registry      - Registry URL
   * @param {Function} options.onMatch       - Called when a logo is recognized
   * @param {Function} options.onUnknown     - Called when logo is not in registry
   * @param {Function} options.onError       - Called on errors
   * @param {boolean}  options.autoRedirect  - Auto-redirect on match (default: true)
   * @param {boolean}  options.showOverlay   - Show scan overlay UI (default: true)
   * @param {Object}   options.context       - Override context values
   */
  constructor(options = {}) {
    this.registryUrl   = options.registry     || 'http://localhost:3000';
    this.onMatch       = options.onMatch      || null;
    this.onUnknown     = options.onUnknown    || null;
    this.onError       = options.onError      || null;
    this.autoRedirect  = options.autoRedirect !== false;
    this.showOverlay   = options.showOverlay  !== false;
    this.contextOverride = options.context    || {};

    this._video      = null;
    this._canvas     = null;
    this._ctx        = null;
    this._overlay    = null;
    this._scanning   = false;
    this._timer      = null;
    this._lastHash   = null;
    this._cooldown   = false;
  }

  // ─────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────

  /**
   * Start the camera and begin scanning.
   * @param {HTMLElement} container - Where to mount the scanner UI
   * @returns {Promise<void>}
   */
  async start(container = document.body) {
    try {
      await this._setupCamera(container);
      if (this.showOverlay) this._buildOverlay(container);
      this._scanning = true;
      this._scan();
      this._emit('start');
    } catch (e) {
      this._handleError('Camera access denied or unavailable', e);
    }
  }

  /**
   * Stop scanning and release the camera.
   */
  stop() {
    this._scanning = false;
    clearTimeout(this._timer);
    if (this._video?.srcObject) {
      this._video.srcObject.getTracks().forEach(t => t.stop());
    }
    this._overlay?.remove();
    this._emit('stop');
  }

  /**
   * Manually compute hash from an image element or canvas.
   * Useful when you already have an image and don't need the camera.
   *
   * @param {HTMLImageElement|HTMLCanvasElement} source
   * @returns {string} pHash hex string
   */
  hashFromImage(source) {
    const canvas = document.createElement('canvas');
    canvas.width  = source.naturalWidth  || source.width;
    canvas.height = source.naturalHeight || source.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return Hasher.compute(data, canvas.width, canvas.height);
  }

  /**
   * Resolve a logo directly by pHash — without camera.
   * Useful for testing or server-side-like flows.
   *
   * @param {string}  phash
   * @param {Object}  contextOverrides
   * @returns {Promise<Object>}
   */
  async resolve(phash, contextOverrides = {}) {
    const context = { ...Context.collect(), ...this.contextOverride, ...contextOverrides };
    return this._callResolve(phash, context);
  }

  // ─────────────────────────────────────────────────────
  // Camera setup
  // ─────────────────────────────────────────────────────

  async _setupCamera(container) {
    this._video = document.createElement('video');
    this._video.setAttribute('playsinline', '');
    this._video.setAttribute('autoplay', '');
    this._video.setAttribute('muted', '');
    this._video.style.cssText = 'width:100%;height:100%;object-fit:cover;';

    this._canvas = document.createElement('canvas');
    this._canvas.style.display = 'none';
    this._ctx    = this._canvas.getContext('2d', { willReadFrequently: true });

    container.appendChild(this._video);
    container.appendChild(this._canvas);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });

    this._video.srcObject = stream;
    await new Promise(r => { this._video.onloadedmetadata = r; });
    this._canvas.width  = this._video.videoWidth;
    this._canvas.height = this._video.videoHeight;
  }

  // ─────────────────────────────────────────────────────
  // Scan loop
  // ─────────────────────────────────────────────────────

  _scan() {
    if (!this._scanning) return;

    this._timer = setTimeout(async () => {
      if (!this._cooldown) {
        await this._processFrame();
      }
      this._scan();
    }, SCAN_INTERVAL);
  }

  async _processFrame() {
    if (!this._video || this._video.readyState < 2) return;

    try {
      this._ctx.drawImage(this._video, 0, 0, this._canvas.width, this._canvas.height);
      const frame  = this._ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);
      const phash  = Hasher.compute(frame.data, frame.width, frame.height);

      // Skip if same hash as last scan (nothing changed)
      if (phash === this._lastHash) return;
      this._lastHash = phash;

      const context  = { ...Context.collect(), ...this.contextOverride };
      const result   = await this._callResolve(phash, context);

      if (result.found && result.verified) {
        this._onLogoMatch(result);
      } else if (result.found && !result.verified) {
        this._onUnverifiedLogo(result);
      }
      // Not found = no logo in frame, just keep scanning silently
    } catch (e) {
      // Silently swallow frame processing errors (camera hiccups etc.)
      if (this.onError) this.onError({ type: 'frame_error', error: e });
    }
  }

  // ─────────────────────────────────────────────────────
  // Registry calls
  // ─────────────────────────────────────────────────────

  async _callResolve(phash, context) {
    const cacheKey = `${phash}:${context.hour}:${context.language}:${context.location_type}`;
    const cached   = Cache.get(cacheKey);
    if (cached) return cached;

    const res = await fetch(`${this.registryUrl}/v1/resolve`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phash, context }),
    });

    const data = await res.json();
    Cache.set(cacheKey, data);
    return data;
  }

  // ─────────────────────────────────────────────────────
  // Match handlers
  // ─────────────────────────────────────────────────────

  _onLogoMatch(result) {
    this._cooldown = true;
    setTimeout(() => { this._cooldown = false; }, 3000);

    if (this._overlay) this._overlayMatch(result);

    if (this.onMatch) {
      this.onMatch(result);
    } else if (this.autoRedirect) {
      this._redirect(result.resolution.url, result.resolution.via_app);
    }
  }

  _onUnverifiedLogo(result) {
    if (this._overlay) this._overlayWarning(result);
    if (this.onUnknown) this.onUnknown(result);
  }

  _redirect(url, viaApp) {
    if (viaApp && this._canOpenApp(url)) {
      window.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  }

  _canOpenApp(scheme) {
    return scheme && (scheme.startsWith('http') === false);
  }

  // ─────────────────────────────────────────────────────
  // Overlay UI
  // ─────────────────────────────────────────────────────

  _buildOverlay(container) {
    this._overlay = document.createElement('div');
    this._overlay.id = 'ldr-overlay';
    this._overlay.innerHTML = `
      <style>
        #ldr-overlay {
          position: absolute; inset: 0;
          pointer-events: none;
          font-family: system-ui, sans-serif;
        }
        #ldr-frame {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -60%);
          width: 200px; height: 200px;
          border: 2px solid rgba(255,255,255,0.5);
          border-radius: 16px;
          box-shadow: 0 0 0 9999px rgba(0,0,0,0.45);
        }
        #ldr-frame::before, #ldr-frame::after {
          content: '';
          position: absolute;
          width: 24px; height: 24px;
          border-color: #7c6ff7;
          border-style: solid;
        }
        #ldr-frame::before { top: -2px; left: -2px; border-width: 3px 0 0 3px; border-radius: 12px 0 0 0; }
        #ldr-frame::after  { bottom: -2px; right: -2px; border-width: 0 3px 3px 0; border-radius: 0 0 12px 0; }
        #ldr-status {
          position: absolute;
          bottom: 24%; left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.7);
          color: #fff;
          padding: 8px 20px;
          border-radius: 20px;
          font-size: 13px;
          white-space: nowrap;
          transition: all 0.3s;
        }
        #ldr-status.match   { background: rgba(74,222,128,0.85); color: #000; }
        #ldr-status.warning { background: rgba(251,191,36,0.85);  color: #000; }
        #ldr-badge {
          position: absolute;
          top: 16px; right: 16px;
          background: rgba(0,0,0,0.5);
          color: rgba(255,255,255,0.6);
          font-size: 10px;
          padding: 4px 8px;
          border-radius: 4px;
          letter-spacing: 1px;
        }
      </style>
      <div id="ldr-frame"></div>
      <div id="ldr-status">Hold camera up to a logo</div>
      <div id="ldr-badge">LDR v${LDR_VERSION}</div>
    `;
    container.style.position = 'relative';
    container.appendChild(this._overlay);
  }

  _overlayMatch(result) {
    const status = this._overlay?.querySelector('#ldr-status');
    if (!status) return;
    status.textContent = `✓ ${result.brand_name} — opening…`;
    status.className   = 'match';
    setTimeout(() => {
      status.textContent = 'Hold camera up to a logo';
      status.className   = '';
    }, 2500);
  }

  _overlayWarning(result) {
    const status = this._overlay?.querySelector('#ldr-status');
    if (!status) return;
    status.textContent = `⚠ Unverified brand`;
    status.className   = 'warning';
    setTimeout(() => {
      status.textContent = 'Hold camera up to a logo';
      status.className   = '';
    }, 3000);
  }

  // ─────────────────────────────────────────────────────
  // Event emitter (simple)
  // ─────────────────────────────────────────────────────

  _emit(event, data) {
    const el = document.createElement('div');
    el.dispatchEvent(new CustomEvent(`ldr:${event}`, { detail: data, bubbles: true }));
  }

  _handleError(msg, err) {
    console.error('[LDR SDK]', msg, err);
    if (this.onError) this.onError({ type: 'error', message: msg, error: err });
  }
}

// ─────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LDR, Hasher, Context, Cache };
} else {
  window.LDR = LDR;
}
