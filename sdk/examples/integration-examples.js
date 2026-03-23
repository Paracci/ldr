/**
 * LDR SDK — Integration Examples
 *
 * Real-world examples for common brand scenarios.
 * Each example is self-contained and runnable.
 */

'use strict';

const { LDRClient, PaymentToken } = require('../node/ldr-client');

const ldr = new LDRClient({
  registry: 'http://localhost:3000',
  brand_id: 'walmart-global',
  api_key: 'your-api-key-here',
});

// ─────────────────────────────────────────────────────────
// Example 1: Basic brand registration
// ─────────────────────────────────────────────────────────

async function example1_register() {
  console.log('\n── Example 1: Brand Registration\n');

  // Build routing rules with the fluent API
  const rules = ldr.rules()
    .when({ location_type: 'in_store', hour_range: [6, 12] })
    .id('morning-store')
    .go('walmart://deals/morning', 'https://walmart.com/deals/morning')
    .when({ location_type: 'in_store', hour_range: [12, 20] })
    .id('afternoon-store')
    .go('walmart://deals/current', 'https://walmart.com/deals/current')
    .when({ location_type: 'not_in_store' })
    .id('home-delivery')
    .go('walmart://delivery', 'https://walmart.com/delivery')
    .when({ language: 'en' })
    .id('english')
    .go('walmart://en', 'https://walmart.com/en')
    .build();

  console.log('Rules built:');
  rules.forEach(r => console.log(`  ${r.id}: ${JSON.stringify(r.conditions)}`));

  // In production: send to registry
  // const result = await ldr.register({
  //   brand_name: 'Walmart',
  //   phash: 'your-computed-phash',
  //   ahash: 'your-computed-ahash',
  //   dhash: 'your-computed-dhash',
  //   targets: {
  //     app_scheme:   'walmart://',
  //     web_url:      'https://walmart.com',
  //     fallback_url: 'https://walmart.com/app',
  //   },
  //   rules,
  // });
  // console.log('Registration result:', result);
}

// ─────────────────────────────────────────────────────────
// Example 2: Resolve on your own server
// ─────────────────────────────────────────────────────────

async function example2_serverResolve() {
  console.log('\n── Example 2: Server-side resolve\n');

  // Your server receives a scan signal from the LDR reader
  // (the reader sends you the pHash + context)
  const incomingPhash = 'e3c3c3e3e3c3c3e3';
  const context = {
    hour: 9,
    language: 'en',
    location_type: 'in_store',
    app_installed: true,
  };

  try {
    const result = await ldr.resolve(incomingPhash, context);
    console.log('Resolve result:', JSON.stringify(result, null, 2));

    if (result.found && result.verified) {
      console.log(`\nRedirect to: ${result.resolution.url}`);
      console.log(`Via app:     ${result.resolution.via_app}`);
      console.log(`Rule:        ${result.resolution.rule_id || 'default'}`);
    }
  } catch (e) {
    console.log('Registry not running — skipping live test');
  }
}

// ─────────────────────────────────────────────────────────
// Example 3: Payment token (POS scenario)
// ─────────────────────────────────────────────────────────

async function example3_paymentToken() {
  console.log('\n── Example 3: POS Payment Token\n');

  const BRAND_SECRET = 'super-secret-key-never-leave-server';

  // Cashier system generates a token when customer approaches
  const token = PaymentToken.generate({
    amount: 2499,       // $24.99 in cents
    currency: 'USD',
    merchant: 'walmart-manhattan-pos-3',
    secret: BRAND_SECRET,
    ttl: 30,         // 30 seconds
  });

  console.log('Generated token:', JSON.stringify(token, null, 2));

  // Token is embedded in the LDR tag displayed at the checkout
  // Customer scans → LDR reader shows payment page with this token

  // On your server: verify the token when payment is initiated
  const verification = PaymentToken.verify(token, BRAND_SECRET);
  console.log('\nVerification:', verification);

  // Test with wrong secret
  const badVerification = PaymentToken.verify(token, 'wrong-secret');
  console.log('Wrong secret:', badVerification);

  // Test expired token
  const expiredSigned = PaymentToken.generate({
    amount: 100, currency: 'USD', merchant: 'test',
    secret: BRAND_SECRET, ttl: -100
  });
  const expiredVerification = PaymentToken.verify(expiredSigned, BRAND_SECRET);
  console.log('Expired token:', expiredVerification);
}

// ─────────────────────────────────────────────────────────
// Example 4: Registry health check + stats
// ─────────────────────────────────────────────────────────

async function example4_health() {
  console.log('\n── Example 4: Registry health + stats\n');

  try {
    const health = await ldr.health();
    console.log('Health:', JSON.stringify(health, null, 2));

    const stats = await ldr.stats();
    console.log('\nStats:', JSON.stringify(stats, null, 2));
  } catch (e) {
    console.log('Registry not running — skipping live test');
    console.log('Start registry with: npm run server');
  }
}

// ─────────────────────────────────────────────────────────
// Example 5: Rule builder patterns
// ─────────────────────────────────────────────────────────

function example5_rulePatternsShowcase() {
  console.log('\n── Example 5: Rule builder patterns\n');

  // Restaurant: time-based menus
  const restaurantRules = ldr.rules()
    .when({ hour_range: [7, 11] }).id('breakfast')
    .go('myrestaurant://breakfast', 'https://myrestaurant.com/breakfast')
    .when({ hour_range: [11, 15] }).id('lunch')
    .go('myrestaurant://lunch', 'https://myrestaurant.com/lunch')
    .when({ hour_range: [15, 18] }).id('afternoon')
    .go('myrestaurant://snacks', 'https://myrestaurant.com/snacks')
    .when({ hour_range: [18, 23] }).id('dinner')
    .go('myrestaurant://dinner', 'https://myrestaurant.com/dinner')
    .build();

  console.log('Restaurant rules:');
  restaurantRules.forEach(r =>
    console.log(`  ${r.id}: hours ${r.conditions.hour_range} → ${r.targets.web_url}`)
  );

  // Hospital: context-aware routing
  const hospitalRules = ldr.rules()
    .when({ hour_range: [0, 8] }).id('emergency-hours')
    .go('hospital://emergency', 'https://hospital.com/emergency')
    .when({ location_type: 'in_store', app_installed: true }).id('in-hospital-app')
    .go('hospital://appointment', 'https://hospital.com/appointment')
    .when({ location_type: 'not_in_store' }).id('remote-booking')
    .go('hospital://online-booking', 'https://hospital.com/online-booking')
    .build();

  console.log('\nHospital rules:');
  hospitalRules.forEach(r =>
    console.log(`  ${r.id}: ${JSON.stringify(r.conditions)} → ${r.targets.web_url}`)
  );

  // Multi-language brand
  const multiLangRules = ldr.rules()
    .when({ language: 'en' }).id('english')
    .go('brand://en', 'https://brand.com/en')
    .when({ language: 'de' }).id('german')
    .go('brand://de', 'https://brand.com/de')
    .when({ language: 'fr' }).id('french')
    .go('brand://fr', 'https://brand.com/fr')
    .build();

  console.log('\nMulti-language rules:');
  multiLangRules.forEach(r =>
    console.log(`  ${r.id}: lang=${r.conditions.language} → ${r.targets.web_url}`)
  );
}

// ─────────────────────────────────────────────────────────
// Run all examples
// ─────────────────────────────────────────────────────────

(async () => {
  console.log('LDR SDK Integration Examples\n' + '='.repeat(40));
  await example1_register();
  await example2_serverResolve();
  await example3_paymentToken();
  await example4_health();
  example5_rulePatternsShowcase();
  console.log('\n' + '='.repeat(40));
  console.log('Done.');
})();