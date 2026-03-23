/**
 * LDR Node.js SDK v0.1.0
 *
 * Server-side SDK for brands integrating LDR into their own systems.
 * Use this to:
 *   - Register your logo with the LDR registry
 *   - Validate incoming LDR scan signals on your server
 *   - Define and update routing rules
 *   - Generate payment tokens for POS scenarios
 *
 * Usage:
 *   const { LDRClient } = require('ldr-sdk');
 *   const ldr = new LDRClient({ registry: 'https://registry.ldr-standard.org' });
 */

'use strict';

const https = require('https');
const http = require('http');
const crypto = require('crypto');

const LDR_VERSION = '0.1.0';

// ─────────────────────────────────────────────────────────
// HTTP client helper
// ─────────────────────────────────────────────────────────

function request(url, method, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const bodyStr = body ? JSON.stringify(body) : null;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-LDR-SDK': `node/${LDR_VERSION}`,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = lib.request(options, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────
// Payment token generator
// ─────────────────────────────────────────────────────────

const PaymentToken = {
  /**
   * Generate a single-use payment token for POS scenarios.
   * This token is signed by the brand's secret key.
   * LDR never sees the secret key — only the public token.
   *
   * @param {Object} options
   * @param {number}  options.amount    - Amount in minor currency units (e.g. cents)
   * @param {string}  options.currency  - ISO 4217 (e.g. 'USD', 'EUR')
   * @param {string}  options.merchant  - Branch/terminal identifier
   * @param {string}  options.secret    - Brand's signing secret (stays on brand server)
   * @param {number}  options.ttl       - Seconds until expiry (default: 30)
   * @returns {Object} token object to embed in LDR tag
   */
  generate({ amount, currency, merchant, secret, ttl = 30 }) {
    const id = crypto.randomBytes(16).toString('hex');
    const expires = Math.floor(Date.now() / 1000) + ttl;

    const payload = JSON.stringify({ id, amount, currency, merchant, expires });
    const sig = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return { id, amount, currency, merchant, expires, sig };
  },

  /**
   * Verify a payment token received from a scanner.
   *
   * @param {Object} token   - Token to verify
   * @param {string} secret  - Same secret used during generation
   * @returns {{ valid: boolean, reason?: string }}
   */
  verify(token, secret) {
    const { sig, ...rest } = token;
    const payload = JSON.stringify(rest);
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (sig !== expected) return { valid: false, reason: 'Invalid signature' };
    if (Math.floor(Date.now() / 1000) > token.expires) {
      return { valid: false, reason: 'Token expired' };
    }
    return { valid: true };
  },
};

// ─────────────────────────────────────────────────────────
// LDR Client
// ─────────────────────────────────────────────────────────

class LDRClient {
  /**
   * @param {Object} options
   * @param {string} options.registry  - Registry base URL
   * @param {string} options.brand_id  - Your brand ID (required for write ops)
   * @param {string} options.api_key   - Your API key (required for write ops)
   */
  constructor(options = {}) {
    this.registryUrl = (options.registry || 'http://localhost:3000').replace(/\/$/, '');
    this.brand_id = options.brand_id || null;
    this.api_key = options.api_key || null;
  }

  // ─────────────────────────────────────────────────────
  // Registry — read
  // ─────────────────────────────────────────────────────

  /**
   * Check registry health.
   * @returns {Promise<Object>}
   */
  async health() {
    const res = await request(`${this.registryUrl}/health`, 'GET');
    return res.body;
  }

  /**
   * Look up a brand by pHash.
   * @param {string} phash
   * @returns {Promise<Object>}
   */
  async lookup(phash) {
    const res = await request(`${this.registryUrl}/v1/lookup`, 'POST', { phash });
    return res.body;
  }

  /**
   * Resolve a redirect for a pHash + context.
   * @param {string} phash
   * @param {Object} context
   * @returns {Promise<Object>}
   */
  async resolve(phash, context = {}) {
    const res = await request(
      `${this.registryUrl}/v1/resolve`,
      'POST',
      { phash, context }
    );
    return res.body;
  }

  /**
   * Get a brand by ID.
   * @param {string} brand_id
   * @returns {Promise<Object>}
   */
  async getBrand(brand_id) {
    const res = await request(`${this.registryUrl}/v1/brands/${brand_id}`, 'GET');
    return res.body;
  }

  /**
   * List all verified brands.
   * @returns {Promise<Object>}
   */
  async listBrands() {
    const res = await request(`${this.registryUrl}/v1/brands?verified=true`, 'GET');
    return res.body;
  }

  /**
   * Get registry stats.
   * @returns {Promise<Object>}
   */
  async stats() {
    const res = await request(`${this.registryUrl}/v1/stats`, 'GET');
    return res.body;
  }

  // ─────────────────────────────────────────────────────
  // Registry — write (requires brand_id + api_key)
  // ─────────────────────────────────────────────────────

  /**
   * Register your brand logo.
   *
   * @param {Object} data
   * @param {string} data.brand_name
   * @param {string} data.phash         - From hasher.computeHashes()
   * @param {string} data.ahash
   * @param {string} data.dhash
   * @param {Object} data.targets       - { app_scheme, web_url, fallback_url }
   * @param {Array}  data.rules         - Context-based routing rules
   * @returns {Promise<Object>}
   */
  async register(data) {
    this._requireAuth();
    const res = await request(
      `${this.registryUrl}/v1/register`,
      'POST',
      { brand_id: this.brand_id, ...data }
    );
    return res.body;
  }

  // ─────────────────────────────────────────────────────
  // Payment tokens
  // ─────────────────────────────────────────────────────

  /**
   * Generate a payment token for a POS transaction.
   * Keep your secret on your server — never send it to LDR.
   *
   * @param {Object} options - { amount, currency, merchant, secret, ttl }
   * @returns {Object} token
   */
  generatePaymentToken(options) {
    return PaymentToken.generate(options);
  }

  /**
   * Verify a payment token received from a scanner.
   * @param {Object} token
   * @param {string} secret
   * @returns {{ valid: boolean, reason?: string }}
   */
  verifyPaymentToken(token, secret) {
    return PaymentToken.verify(token, secret);
  }

  // ─────────────────────────────────────────────────────
  // Rule builder — fluent API
  // ─────────────────────────────────────────────────────

  /**
   * Build routing rules with a fluent API.
   *
   * Example:
   *   const rules = ldr.rules()
   *     .when({ hour_range: [6, 12], location_type: 'in_store' })
   *       .go('myapp://morning', 'https://example.com/morning')
   *     .when({ language: 'en' })
   *       .go(null, 'https://example.com/en')
   *     .build();
   */
  rules() {
    return new RuleBuilder();
  }

  // ─────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────

  _requireAuth() {
    if (!this.brand_id) throw new Error('brand_id is required for write operations');
    if (!this.api_key) throw new Error('api_key is required for write operations');
  }
}

// ─────────────────────────────────────────────────────────
// Rule builder
// ─────────────────────────────────────────────────────────

class RuleBuilder {
  constructor() {
    this._rules = [];
    this._current = null;
    this._counter = 0;
  }

  /**
   * Start a new rule with conditions.
   * @param {Object} conditions
   */
  when(conditions) {
    if (this._current) this._rules.push(this._current);
    this._current = {
      id: `rule-${++this._counter}`,
      conditions,
      targets: {},
    };
    return this;
  }

  /**
   * Set the redirect target for the current rule.
   * @param {string|null} appScheme
   * @param {string}      webUrl
   * @param {string}      [fallbackUrl]
   */
  go(appScheme, webUrl, fallbackUrl) {
    if (!this._current) throw new Error('Call .when() before .go()');
    this._current.targets = {
      app_scheme: appScheme || undefined,
      web_url: webUrl,
      fallback_url: fallbackUrl || webUrl,
    };
    return this;
  }

  /**
   * Set a custom ID for the current rule.
   * @param {string} id
   */
  id(id) {
    if (this._current) this._current.id = id;
    return this;
  }

  /**
   * Finalize and return the rules array.
   * @returns {Array}
   */
  build() {
    if (this._current) this._rules.push(this._current);
    this._current = null;
    return this._rules;
  }
}

// ─────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────

module.exports = { LDRClient, RuleBuilder, PaymentToken, LDR_VERSION };