/**
 * LDR Registry
 *
 * Manages the database of verified brand logos.
 * In production this would be a distributed, mirrored database.
 * This reference implementation uses an in-memory store with
 * JSON import/export for persistence.
 *
 * Every entry is:
 *   - Cryptographically signed (RSA-2048 in production)
 *   - Identified by perceptual hash (pHash)
 *   - Versioned and timestamped
 */

'use strict';

const { compareHashes, checkSpoofing, MATCH_THRESHOLD } = require('../core/hasher');

// ─────────────────────────────────────────────────────────
// In-memory store
// ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} RegistryEntry
 * @property {string}   brand_id     - Unique brand identifier
 * @property {string}   brand_name   - Display name
 * @property {string}   phash        - Perceptual hash (16-char hex)
 * @property {string}   ahash        - Average hash
 * @property {string}   dhash        - Difference hash
 * @property {boolean}  verified     - Has legal verification passed?
 * @property {string}   signature    - RSA signature (placeholder in dev)
 * @property {Object}   targets      - Routing targets
 * @property {Array}    rules        - Context-based routing rules
 * @property {string}   registered_at
 * @property {string}   updated_at
 */

/** @type {Map<string, RegistryEntry>} */
const store = new Map();

// ─────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────

/**
 * Register a new brand logo.
 * Checks for spoofing conflicts before adding.
 *
 * @param {Object} entry
 * @returns {{ ok: boolean, entry?: RegistryEntry, error?: string, conflicts?: Array }}
 */
function register(entry) {
  const { brand_id, brand_name, phash, ahash, dhash, targets } = entry;

  // Validate required fields
  if (!brand_id || !brand_name || !phash || !targets?.web_url) {
    return { ok: false, error: 'Missing required fields: brand_id, brand_name, phash, targets.web_url' };
  }

  // Check for duplicate brand_id
  if (store.has(brand_id)) {
    return { ok: false, error: `Brand ID already registered: ${brand_id}` };
  }

  // Spoofing check — compare against all existing entries
  const existing = Array.from(store.values()).map(e => ({
    brand_id: e.brand_id,
    phash:    e.phash,
  }));

  const spoofCheck = checkSpoofing(phash, existing);
  if (!spoofCheck.safe) {
    return {
      ok:        false,
      error:     'Logo too similar to existing registered brand(s)',
      conflicts: spoofCheck.conflicts,
    };
  }

  const now = new Date().toISOString();
  const record = {
    brand_id,
    brand_name,
    phash,
    ahash:  ahash  || null,
    dhash:  dhash  || null,
    verified:      entry.verified      || false,
    signature:     entry.signature     || 'UNSIGNED_DEV',
    targets: {
      app_scheme:   targets.app_scheme   || null,
      web_url:      targets.web_url,
      fallback_url: targets.fallback_url || targets.web_url,
    },
    rules:         entry.rules         || [],
    registered_at: now,
    updated_at:    now,
  };

  store.set(brand_id, record);
  return { ok: true, entry: record };
}

/**
 * Look up a brand by its pHash.
 * This is the hot path — called on every logo scan.
 *
 * @param {string} phash - 16-char hex pHash from camera
 * @returns {{ found: boolean, entry?: RegistryEntry, distance?: number } }
 */
function lookup(phash) {
  let bestMatch  = null;
  let bestDist   = Infinity;

  for (const entry of store.values()) {
    const { distance, verdict } = compareHashes(phash, entry.phash);

    if (verdict === 'different') continue;

    if (distance < bestDist) {
      bestDist  = distance;
      bestMatch = entry;
    }
  }

  if (!bestMatch) return { found: false };

  return {
    found:    true,
    entry:    bestMatch,
    distance: bestDist,
  };
}

/**
 * Get a brand by its brand_id.
 *
 * @param {string} brand_id
 * @returns {RegistryEntry|null}
 */
function get(brand_id) {
  return store.get(brand_id) || null;
}

/**
 * Update routing rules for an existing brand.
 *
 * @param {string} brand_id
 * @param {Object} updates - Fields to update (targets, rules)
 * @returns {{ ok: boolean, entry?: RegistryEntry, error?: string }}
 */
function update(brand_id, updates) {
  const entry = store.get(brand_id);
  if (!entry) return { ok: false, error: `Brand not found: ${brand_id}` };

  const allowed = ['targets', 'rules', 'verified', 'signature'];
  for (const key of Object.keys(updates)) {
    if (allowed.includes(key)) {
      entry[key] = updates[key];
    }
  }
  entry.updated_at = new Date().toISOString();
  store.set(brand_id, entry);
  return { ok: true, entry };
}

/**
 * Remove a brand from the registry.
 * In production this would require multi-party authorization.
 *
 * @param {string} brand_id
 * @returns {boolean}
 */
function remove(brand_id) {
  return store.delete(brand_id);
}

/**
 * List all registered brands.
 *
 * @param {{ verified_only?: boolean }} options
 * @returns {RegistryEntry[]}
 */
function list({ verified_only = false } = {}) {
  const entries = Array.from(store.values());
  return verified_only ? entries.filter(e => e.verified) : entries;
}

// ─────────────────────────────────────────────────────────
// Routing resolver
// ─────────────────────────────────────────────────────────

/**
 * Resolve the final redirect target for a scanned logo.
 * Evaluates context-based rules in order.
 * Falls back to default targets if no rule matches.
 *
 * @param {RegistryEntry} entry   - Registry entry for the scanned logo
 * @param {Object}        context - User's current context
 * @param {number}        context.hour          - 0–23
 * @param {string}        context.language      - e.g. 'tr', 'en'
 * @param {string}        context.location_type - 'in_store' | 'not_in_store'
 * @param {string}        context.platform      - 'ios' | 'android' | 'web'
 * @param {boolean}       context.app_installed - Is brand app installed?
 * @returns {{
 *   url:         string,
 *   rule_id:     string|null,
 *   reason:      string,
 *   via_app:     boolean,
 * }}
 */
function resolve(entry, context = {}) {
  const {
    hour          = new Date().getHours(),
    language      = 'en',
    location_type = 'not_in_store',
    platform      = 'web',
    app_installed = false,
  } = context;

  // Evaluate rules in order
  for (const rule of (entry.rules || [])) {
    if (matchesConditions(rule.conditions, { hour, language, location_type, platform, app_installed })) {
      const target = pickTarget(rule.targets, app_installed);
      return {
        url:     target.url,
        rule_id: rule.id,
        reason:  `Rule matched: ${rule.id}`,
        via_app: target.via_app,
      };
    }
  }

  // No rule matched — use default targets
  const target = pickTarget(entry.targets, app_installed);
  return {
    url:     target.url,
    rule_id: null,
    reason:  'Default target',
    via_app: target.via_app,
  };
}

/**
 * Pick the best URL from a targets object based on app availability.
 * @private
 */
function pickTarget(targets, app_installed) {
  if (app_installed && targets.app_scheme) {
    return { url: targets.app_scheme, via_app: true };
  }
  if (targets.web_url) {
    return { url: targets.web_url, via_app: false };
  }
  return { url: targets.fallback_url, via_app: false };
}

/**
 * Check if a rule's conditions match the current context.
 * @private
 */
function matchesConditions(conditions = {}, context) {
  if (conditions.hour_range) {
    const [from, to] = conditions.hour_range;
    if (context.hour < from || context.hour >= to) return false;
  }

  if (conditions.language) {
    const langs = Array.isArray(conditions.language)
      ? conditions.language
      : [conditions.language];
    if (!langs.includes(context.language)) return false;
  }

  if (conditions.location_type) {
    if (conditions.location_type !== context.location_type) return false;
  }

  if (conditions.platform) {
    const platforms = Array.isArray(conditions.platform)
      ? conditions.platform
      : [conditions.platform];
    if (!platforms.includes(context.platform)) return false;
  }

  if (conditions.app_installed !== undefined) {
    if (conditions.app_installed !== context.app_installed) return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────
// Import / Export (JSON)
// ─────────────────────────────────────────────────────────

/**
 * Export the entire registry as a JSON-serializable array.
 * Use this to persist, mirror, or inspect the registry.
 *
 * @returns {RegistryEntry[]}
 */
function exportRegistry() {
  return Array.from(store.values());
}

/**
 * Import entries from a JSON array (e.g. from a mirror).
 * Skips entries that fail spoofing checks.
 *
 * @param {RegistryEntry[]} entries
 * @returns {{ imported: number, skipped: number, errors: string[] }}
 */
function importRegistry(entries) {
  let imported = 0;
  let skipped  = 0;
  const errors = [];

  for (const entry of entries) {
    // If already exists, skip
    if (store.has(entry.brand_id)) {
      skipped++;
      continue;
    }
    const result = register(entry);
    if (result.ok) {
      imported++;
    } else {
      skipped++;
      errors.push(`${entry.brand_id}: ${result.error}`);
    }
  }

  return { imported, skipped, errors };
}

/**
 * Clear all entries. Use only in tests.
 */
function _clear() {
  store.clear();
}

// ─────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────

module.exports = {
  register,
  lookup,
  get,
  update,
  remove,
  list,
  resolve,
  exportRegistry,
  importRegistry,
  _clear,
};
