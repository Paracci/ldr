/**
 * LDR Registry Mock Server
 *
 * A lightweight HTTP API that simulates the LDR registry in production.
 * No external dependencies — built on Node.js built-in `http` module.
 *
 * Endpoints:
 *   GET  /health                      → Server status
 *   GET  /v1/brands                   → List all verified brands
 *   GET  /v1/brands/:brand_id         → Get brand by ID
 *   POST /v1/lookup                   → Look up brand by pHash
 *   POST /v1/resolve                  → Resolve redirect for a logo + context
 *   POST /v1/register                 → Register a new brand
 *   POST /v1/verify/:brand_id         → Mark brand as verified
 *   GET  /v1/stats                    → Registry statistics
 *
 * Run: node src/registry/server.js
 * Default port: 3000
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const registry = require('./registry');

const PORT      = process.env.PORT || 3000;
const SEED_FILE = path.join(__dirname, 'seed.json');

// ─────────────────────────────────────────────────────────
// Boot: load seed data
// ─────────────────────────────────────────────────────────

function loadSeed() {
  try {
    const raw     = fs.readFileSync(SEED_FILE, 'utf8');
    const entries = JSON.parse(raw);
    const result  = registry.importRegistry(entries);
    console.log(`[LDR] Seed loaded: ${result.imported} brands imported, ${result.skipped} skipped`);
    if (result.errors.length > 0) {
      console.warn('[LDR] Seed warnings:', result.errors);
    }
  } catch (e) {
    console.warn('[LDR] No seed file found or seed failed:', e.message);
  }
}

// ─────────────────────────────────────────────────────────
// Request parsing helpers
// ─────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end',  ()    => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type':  'application/json',
    'X-LDR-Version': '0.1.0',
  });
  res.end(body);
}

function ok(res, data)      { send(res, 200, { ok: true,  ...data }); }
function created(res, data) { send(res, 201, { ok: true,  ...data }); }
function badRequest(res, msg)  { send(res, 400, { ok: false, error: msg }); }
function notFound(res, msg)    { send(res, 404, { ok: false, error: msg }); }
function conflict(res, data)   { send(res, 409, { ok: false, ...data }); }
function serverError(res, msg) { send(res, 500, { ok: false, error: msg }); }

// ─────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────

const routes = [];

function route(method, pattern, handler) {
  routes.push({ method, pattern, handler });
}

function matchRoute(method, url) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const keys   = [];
    const regStr = r.pattern.replace(/:([^/]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; });
    const regex  = new RegExp(`^${regStr}$`);
    const match  = url.match(regex);
    if (match) {
      const params = {};
      keys.forEach((k, i) => { params[k] = decodeURIComponent(match[i + 1]); });
      return { handler: r.handler, params };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────
// Route definitions
// ─────────────────────────────────────────────────────────

// GET /health
route('GET', '/health', (req, res) => {
  ok(res, {
    status:   'ok',
    version:  '0.1.0',
    standard: 'LDR v0.1 DRAFT',
    brands:   registry.list().length,
    verified: registry.list({ verified_only: true }).length,
    uptime:   Math.round(process.uptime()),
  });
});

// GET /v1/brands
route('GET', '/v1/brands', (req, res) => {
  const url    = new URL(`http://localhost${req.url}`);
  const verified = url.searchParams.get('verified') === 'true';
  const brands   = registry.list({ verified_only: verified });

  ok(res, {
    count:  brands.length,
    brands: brands.map(b => ({
      brand_id:      b.brand_id,
      brand_name:    b.brand_name,
      verified:      b.verified,
      rules_count:   b.rules.length,
      registered_at: b.registered_at,
    })),
  });
});

// GET /v1/brands/:brand_id
route('GET', '/v1/brands/:brand_id', (req, res, params) => {
  const entry = registry.get(params.brand_id);
  if (!entry) return notFound(res, `Brand not found: ${params.brand_id}`);
  ok(res, { brand: entry });
});

// POST /v1/lookup  { phash: "..." }
route('POST', '/v1/lookup', async (req, res) => {
  let body;
  try { body = await readBody(req); }
  catch (e) { return badRequest(res, e.message); }

  if (!body.phash) return badRequest(res, 'Missing required field: phash');

  const result = registry.lookup(body.phash);

  if (!result.found) {
    return ok(res, {
      found:   false,
      message: 'No matching brand found in registry',
    });
  }

  ok(res, {
    found:     true,
    distance:  result.distance,
    brand_id:  result.entry.brand_id,
    brand_name: result.entry.brand_name,
    verified:  result.entry.verified,
  });
});

// POST /v1/resolve  { phash: "...", context: { hour, language, location_type, platform, app_installed } }
route('POST', '/v1/resolve', async (req, res) => {
  let body;
  try { body = await readBody(req); }
  catch (e) { return badRequest(res, e.message); }

  if (!body.phash) return badRequest(res, 'Missing required field: phash');

  const lookup = registry.lookup(body.phash);

  if (!lookup.found) {
    return ok(res, {
      found:    false,
      verified: false,
      message:  'Logo not found in registry — may be spoofed or unregistered',
    });
  }

  if (!lookup.entry.verified) {
    return ok(res, {
      found:    true,
      verified: false,
      warning:  'Brand is not verified — proceed with caution',
      brand_id: lookup.entry.brand_id,
    });
  }

  const resolution = registry.resolve(lookup.entry, body.context || {});

  ok(res, {
    found:      true,
    verified:   true,
    brand_id:   lookup.entry.brand_id,
    brand_name: lookup.entry.brand_name,
    distance:   lookup.distance,
    resolution,
  });
});

// POST /v1/register
route('POST', '/v1/register', async (req, res) => {
  let body;
  try { body = await readBody(req); }
  catch (e) { return badRequest(res, e.message); }

  const result = registry.register(body);

  if (!result.ok) {
    if (result.conflicts) {
      return conflict(res, {
        error:     result.error,
        conflicts: result.conflicts,
      });
    }
    return badRequest(res, result.error);
  }

  created(res, {
    message: 'Brand registered successfully. Pending verification.',
    entry:   result.entry,
  });
});

// POST /v1/verify/:brand_id  (dev only — in production requires multi-party auth)
route('POST', '/v1/verify/:brand_id', (req, res, params) => {
  const result = registry.update(params.brand_id, {
    verified:  true,
    signature: `VERIFIED_${Date.now()}`,
  });

  if (!result.ok) return notFound(res, result.error);
  ok(res, { message: 'Brand verified successfully', entry: result.entry });
});

// GET /v1/stats
route('GET', '/v1/stats', (req, res) => {
  const all      = registry.list();
  const verified = all.filter(b => b.verified);
  const withApp  = all.filter(b => b.targets.app_scheme);
  const withRules = all.filter(b => b.rules.length > 0);
  const totalRules = all.reduce((sum, b) => sum + b.rules.length, 0);

  ok(res, {
    total_brands:    all.length,
    verified_brands: verified.length,
    with_app_scheme: withApp.length,
    with_rules:      withRules.length,
    total_rules:     totalRules,
    avg_rules_per_brand: all.length
      ? (totalRules / all.length).toFixed(1)
      : 0,
  });
});

// ─────────────────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS — allow anyone to query the registry (it's open)
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Strip query string for routing
  const url = req.url.split('?')[0];

  const match = matchRoute(req.method, url);

  if (!match) {
    return notFound(res, `No route: ${req.method} ${url}`);
  }

  const start = Date.now();

  try {
    await match.handler(req, res, match.params);
  } catch (e) {
    console.error('[LDR] Handler error:', e);
    serverError(res, 'Internal server error');
  }

  const duration = Date.now() - start;
  console.log(`[LDR] ${req.method} ${url} → ${res.statusCode} (${duration}ms)`);
});

// ─────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────

loadSeed();

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   LDR Registry Mock Server v0.1.0   ║
╚══════════════════════════════════════╝

  Listening on: http://localhost:${PORT}
  Standard:     LDR v0.1 DRAFT

  Endpoints:
    GET  /health
    GET  /v1/brands
    GET  /v1/brands/:brand_id
    POST /v1/lookup    { phash }
    POST /v1/resolve   { phash, context }
    POST /v1/register  { brand_id, brand_name, phash, targets }
    POST /v1/verify/:brand_id
    GET  /v1/stats

  Press Ctrl+C to stop.
`);
});

module.exports = server;
