/**
 * LDR SDK Tests
 */

'use strict';

const { LDRClient, RuleBuilder, PaymentToken } = require('../sdk/node/ldr-client');

let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}: ${e.message}`); failed++; }
}

function expect(actual) {
  return {
    toBe:        (e) => { if (actual !== e)    throw new Error(`Expected ${JSON.stringify(e)}, got ${JSON.stringify(actual)}`); },
    toBeTruthy:  ()  => { if (!actual)         throw new Error(`Expected truthy`); },
    toBeFalsy:   ()  => { if (actual)          throw new Error(`Expected falsy`); },
    toHaveLength:(n) => { if (actual.length !== n) throw new Error(`Expected length ${n}, got ${actual.length}`); },
    toContain:   (s) => { if (!actual.includes(s)) throw new Error(`Expected to contain ${s}`); },
  };
}

function section(name) { console.log(`\n── ${name}`); }

const ldr = new LDRClient({ registry: 'http://localhost:3000', brand_id: 'test', api_key: 'test' });
const SECRET = 'test-secret-key-12345';

section('RuleBuilder');

test('builds empty rule set', () => {
  const rules = ldr.rules().build();
  expect(rules).toHaveLength(0);
});

test('builds single rule', () => {
  const rules = ldr.rules()
    .when({ hour_range: [6, 12] })
    .go('app://morning', 'https://example.com/morning')
    .build();
  expect(rules).toHaveLength(1);
  expect(rules[0].conditions.hour_range[0]).toBe(6);
  expect(rules[0].targets.web_url).toBe('https://example.com/morning');
});

test('builds multiple rules', () => {
  const rules = ldr.rules()
    .when({ hour_range: [6, 12] }).go(null, 'https://example.com/morning')
    .when({ hour_range: [12, 20] }).go(null, 'https://example.com/afternoon')
    .when({ language: 'en' }).go(null, 'https://example.com/en')
    .build();
  expect(rules).toHaveLength(3);
});

test('custom ID is applied', () => {
  const rules = ldr.rules()
    .when({ language: 'tr' }).id('turkish-rule').go(null, 'https://example.com/tr')
    .build();
  expect(rules[0].id).toBe('turkish-rule');
});

test('auto-generates IDs when not set', () => {
  const rules = ldr.rules()
    .when({ language: 'tr' }).go(null, 'https://a.com')
    .when({ language: 'en' }).go(null, 'https://b.com')
    .build();
  expect(rules[0].id).toBe('rule-1');
  expect(rules[1].id).toBe('rule-2');
});

test('app_scheme is optional', () => {
  const rules = ldr.rules()
    .when({ language: 'tr' }).go(null, 'https://example.com')
    .build();
  expect(!!rules[0].targets.app_scheme).toBeFalsy();
  expect(rules[0].targets.web_url).toBe('https://example.com');
});

test('fallback defaults to web_url', () => {
  const rules = ldr.rules()
    .when({ language: 'tr' }).go(null, 'https://example.com')
    .build();
  expect(rules[0].targets.fallback_url).toBe('https://example.com');
});

section('PaymentToken — generate');

test('generates token with all required fields', () => {
  const token = PaymentToken.generate({ amount: 1000, currency: 'TRY', merchant: 'kasa-1', secret: SECRET });
  expect(typeof token.id).toBe('string');
  expect(token.amount).toBe(1000);
  expect(token.currency).toBe('TRY');
  expect(token.merchant).toBe('kasa-1');
  expect(typeof token.expires).toBe('number');
  expect(typeof token.sig).toBe('string');
});

test('token expires in ~30s by default', () => {
  const before = Math.floor(Date.now() / 1000);
  const token  = PaymentToken.generate({ amount: 100, currency: 'TRY', merchant: 'x', secret: SECRET });
  const after  = Math.floor(Date.now() / 1000);
  if (token.expires < before + 28 || token.expires > after + 32) {
    throw new Error(`Expected expires ~30s from now, got ${token.expires - before}s`);
  }
});

test('custom TTL is respected', () => {
  const before = Math.floor(Date.now() / 1000);
  const token  = PaymentToken.generate({ amount: 100, currency: 'TRY', merchant: 'x', secret: SECRET, ttl: 120 });
  const after  = Math.floor(Date.now() / 1000);
  if (token.expires < before + 118 || token.expires > after + 122) {
    throw new Error(`Expected TTL ~120s`);
  }
});

test('two tokens have different IDs', () => {
  const a = PaymentToken.generate({ amount: 100, currency: 'TRY', merchant: 'x', secret: SECRET });
  const b = PaymentToken.generate({ amount: 100, currency: 'TRY', merchant: 'x', secret: SECRET });
  if (a.id === b.id) throw new Error('Token IDs should be unique');
});

section('PaymentToken — verify');

test('valid token passes verification', () => {
  const token  = PaymentToken.generate({ amount: 500, currency: 'TRY', merchant: 'kasa-2', secret: SECRET });
  const result = PaymentToken.verify(token, SECRET);
  expect(result.valid).toBeTruthy();
});

test('wrong secret fails verification', () => {
  const token  = PaymentToken.generate({ amount: 500, currency: 'TRY', merchant: 'kasa-2', secret: SECRET });
  const result = PaymentToken.verify(token, 'wrong-secret');
  expect(result.valid).toBeFalsy();
  expect(result.reason).toBe('Invalid signature');
});

test('expired token fails verification', () => {
  const token  = PaymentToken.generate({ amount: 100, currency: 'TRY', merchant: 'x', secret: SECRET, ttl: -10 });
  const result = PaymentToken.verify(token, SECRET);
  expect(result.valid).toBeFalsy();
  expect(result.reason).toBe('Token expired');
});

test('tampered amount fails verification', () => {
  const token   = PaymentToken.generate({ amount: 100, currency: 'TRY', merchant: 'x', secret: SECRET });
  const tampered = { ...token, amount: 1 };
  const result  = PaymentToken.verify(tampered, SECRET);
  expect(result.valid).toBeFalsy();
});

test('tampered merchant fails verification', () => {
  const token   = PaymentToken.generate({ amount: 100, currency: 'TRY', merchant: 'kasa-1', secret: SECRET });
  const tampered = { ...token, merchant: 'kasa-99' };
  const result  = PaymentToken.verify(tampered, SECRET);
  expect(result.valid).toBeFalsy();
});

section('LDRClient — auth guard');

test('register() throws without brand_id', () => {
  const noAuth = new LDRClient({ registry: 'http://localhost:3000' });
  try {
    noAuth._requireAuth();
    throw new Error('Should have thrown');
  } catch (e) {
    expect(e.message).toContain('brand_id');
  }
});

console.log('\n' + '─'.repeat(40));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else { console.log('\nAll tests passed ✓'); process.exit(0); }
