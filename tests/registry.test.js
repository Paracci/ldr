/**
 * LDR Registry API Integration Test
 * Tests the full stack: hasher → registry → resolve
 * Runs without a live HTTP server.
 */

'use strict';

const registry = require('../src/registry/registry');
const { computeHashes } = require('../src/core/hasher');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function expect(actual) {
  return {
    toBe: (e) => { if (actual !== e) throw new Error(`Expected ${JSON.stringify(e)}, got ${JSON.stringify(actual)}`); },
    toBeTruthy: () => { if (!actual) throw new Error(`Expected truthy, got ${actual}`); },
    toBeFalsy: () => { if (actual) throw new Error(`Expected falsy, got ${actual}`); },
    toBeGreaterThan: (n) => { if (actual <= n) throw new Error(`Expected ${actual} > ${n}`); },
    toHaveLength: (n) => { if (actual.length !== n) throw new Error(`Expected length ${n}, got ${actual.length}`); },
  };
}

function section(name) { console.log(`\n── ${name}`); }

// ─────────────────────────────────────────────────────────
// Setup — load seed data
// ─────────────────────────────────────────────────────────

registry._clear();

const seedPath = path.join(__dirname, '../src/registry/seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const importResult = registry.importRegistry(seed);

console.log(`\n[Setup] Seed: ${importResult.imported} imported, ${importResult.skipped} skipped`);
if (importResult.errors.length) {
  console.log(`[Setup] Warnings: ${importResult.errors.join(', ')}`);
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

section('Seed data');

test('at least one brand loaded from seed', () => {
  const all = registry.list();
  expect(all.length).toBeGreaterThan(0);
});

test('loaded brands have required fields', () => {
  const all = registry.list();
  for (const b of all) {
    if (!b.brand_id) throw new Error(`Missing brand_id in ${JSON.stringify(b)}`);
    if (!b.phash) throw new Error(`Missing phash in ${b.brand_id}`);
    if (!b.targets.web_url) throw new Error(`Missing web_url in ${b.brand_id}`);
  }
});

section('Lookup flow');

test('lookup walmart by exact seed hash', () => {
  const walmartSeed = seed.find(b => b.brand_id === 'walmart-global');
  const result = registry.lookup(walmartSeed.phash);
  expect(result.found).toBeTruthy();
  expect(result.entry.brand_id).toBe('walmart-global');
});

test('lookup mcdonalds by exact seed hash', () => {
  const mcSeed = seed.find(b => b.brand_id === 'mcdonalds-global');
  if (!mcSeed) return;
  const result = registry.lookup(mcSeed.phash);
  if (result.found) {
    expect(result.entry.brand_id).toBe('mcdonalds-global');
  }
});

test('lookup unknown hash returns not found', () => {
  const result = registry.lookup('0000000000000000');
  expect(result.found).toBeFalsy();
});

section('Resolve flow — Walmart');

test('resolve: in-store morning → morning deals', () => {
  const walmart = registry.get('walmart-global');
  if (!walmart) return;
  const r = registry.resolve(walmart, {
    hour: 9, language: 'en', location_type: 'in_store', app_installed: false
  });
  expect(r.rule_id).toBe('in-store-morning');
  expect(r.url).toBe('https://walmart.com/deals/morning');
});

test('resolve: in-store morning + app installed → app scheme', () => {
  const walmart = registry.get('walmart-global');
  if (!walmart) return;
  const r = registry.resolve(walmart, {
    hour: 9, language: 'en', location_type: 'in_store', app_installed: true
  });
  expect(r.via_app).toBeTruthy();
  expect(r.url).toBe('walmart://deals/morning');
});

test('resolve: in-store afternoon → current deals', () => {
  const walmart = registry.get('walmart-global');
  if (!walmart) return;
  const r = registry.resolve(walmart, {
    hour: 14, language: 'en', location_type: 'in_store', app_installed: false
  });
  expect(r.rule_id).toBe('in-store-afternoon');
});

test('resolve: in-store evening → evening deals', () => {
  const walmart = registry.get('walmart-global');
  if (!walmart) return;
  const r = registry.resolve(walmart, {
    hour: 20, language: 'en', location_type: 'in_store', app_installed: false
  });
  expect(r.rule_id).toBe('in-store-evening');
});

test('resolve: at home → delivery page', () => {
  const walmart = registry.get('walmart-global');
  if (!walmart) return;
  const r = registry.resolve(walmart, {
    hour: 14, language: 'en', location_type: 'not_in_store', app_installed: false
  });
  expect(r.rule_id).toBe('home-delivery');
  expect(r.url).toBe('https://walmart.com/delivery');
});

section("Resolve flow — McDonald's");

test('resolve: breakfast hour → breakfast menu', () => {
  const mc = registry.get('mcdonalds-global');
  if (!mc) return;
  const r = registry.resolve(mc, { hour: 8, language: 'en' });
  expect(r.rule_id).toBe('breakfast');
});

test('resolve: lunch hour → lunch menu', () => {
  const mc = registry.get('mcdonalds-global');
  if (!mc) return;
  const r = registry.resolve(mc, { hour: 12, language: 'en' });
  expect(r.rule_id).toBe('lunch');
});

test('resolve: language EN → English UI', () => {
  const mc = registry.get('mcdonalds-global');
  if (!mc) return;
  const r = registry.resolve(mc, { hour: 3, language: 'en' });
  expect(r.rule_id).toBe('english-ui');
  expect(r.url).toBe('https://mcdonalds.com/en');
});

test('resolve: late night → default', () => {
  const mc = registry.get('mcdonalds-global');
  if (!mc) return;
  const r = registry.resolve(mc, { hour: 3, language: 'de' });
  expect(r.rule_id).toBe(null);
  expect(r.url).toBe('https://mcdonalds.com');
});

section('Registration flow');

test('register new brand successfully', () => {
  const img = { pixels: new Uint8ClampedArray(64 * 64 * 4).fill(128), width: 64, height: 64 };
  const hashes = computeHashes(img.pixels, img.width, img.height);
  const result = registry.register({
    brand_id: 'test-brand-api',
    brand_name: 'Test Brand',
    phash: hashes.phash,
    ahash: hashes.ahash,
    dhash: hashes.dhash,
    targets: {
      web_url: 'https://test-brand.com',
    },
    rules: [],
  });
  expect(result.ok).toBeTruthy();
  expect(result.entry.verified).toBeFalsy();
});

test('newly registered brand appears in list', () => {
  const all = registry.list();
  const found = all.find(b => b.brand_id === 'test-brand-api');
  expect(!!found).toBeTruthy();
});

test('verify a brand', () => {
  const result = registry.update('test-brand-api', { verified: true });
  expect(result.ok).toBeTruthy();
  expect(result.entry.verified).toBeTruthy();
});

test('export produces valid JSON array', () => {
  const exported = registry.exportRegistry();
  expect(Array.isArray(exported)).toBeTruthy();
  expect(exported.length).toBeGreaterThan(0);
  const json = JSON.stringify(exported);
  const parsed = JSON.parse(json);
  expect(parsed.length).toBe(exported.length);
});

section('Stats');

test('stats are consistent with list', () => {
  const all = registry.list();
  const verified = registry.list({ verified_only: true });
  expect(all.length).toBeGreaterThan(0);
  expect(verified.length).toBeGreaterThan(0);
  if (verified.length > all.length) {
    throw new Error('verified count cannot exceed total');
  }
});

// ─────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(40));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else { console.log('\nAll tests passed ✓'); process.exit(0); }