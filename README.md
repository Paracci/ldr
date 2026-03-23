# LDR — Logo Dynamic Redirect

> An open standard for turning any brand visual into an intelligent, context-aware gateway. Like QR — but invisible, branded, and smart.

---

## What is LDR?

QR codes work like this:
```
URL → encoded into a visual pattern → camera reads it → user arrives at URL
```

LDR works like this:
```
Brand logo/visual → registered in LDR network → camera reads it →
user's context is evaluated → user arrives at the right destination
```

The same logo. Different people. Different moments. Different destinations.

---

## Why LDR?

| | QR Code | LDR |
|---|---|---|
| Requires special visual | ✅ Ugly square | ❌ Use your own logo |
| Static destination | ✅ Always same URL | ❌ Context-aware |
| Personalized routing | ❌ | ✅ |
| Brand owned | ❌ | ✅ |
| Works offline | ✅ | ✅ (partial) |
| Open standard | ✅ | ✅ |

---

## Quick Start

### Run the demo
Open `ldr-demo.html` in any modern browser. No build step, no server needed.

### Run the registry mock server
```bash
git clone https://github.com/paracci/ldr
cd ldr
node src/registry/server.js
# Server running at http://localhost:3000
```

### Run the tests
```bash
node tests/core.test.js       # 32 tests — perceptual hashing engine
node tests/registry.test.js   # 19 tests — registry + rule engine
node tests/sdk.test.js        # 17 tests — Node.js SDK
# or all at once:
npm test
```

### Integrate into your brand's app (Node.js)
```javascript
const { LDRClient } = require('./sdk/node/ldr-client');

const ldr = new LDRClient({
  registry: 'https://registry.ldr-standard.org',
  brand_id: 'your-brand-id',
  api_key:  'your-api-key',
});

// Build routing rules
const rules = ldr.rules()
  .when({ hour_range: [6, 12], location_type: 'in_store' })
    .id('morning-store')
    .go('yourapp://morning', 'https://yourbrand.com/morning')
  .when({ location_type: 'not_in_store' })
    .id('home')
    .go('yourapp://home', 'https://yourbrand.com/home')
  .build();

// Resolve a scan on your server
const result = await ldr.resolve(incomingPhash, {
  hour: 9, language: 'en', location_type: 'in_store', app_installed: true
});
console.log(result.resolution.url); // yourapp://morning
```

### Add scanning to your website
```html
<script src="sdk/web/ldr-sdk.js"></script>
<script>
  const scanner = new LDR({
    registry: 'https://registry.ldr-standard.org',
    onMatch: (result) => {
      console.log('Brand:', result.brand_name);
      console.log('Redirect to:', result.resolution.url);
    }
  });
  scanner.start(document.getElementById('scanner-container'));
</script>
```

---


## Core Principles

### 1. Zero Extra Hardware
Like QR — any camera, any device, no NFC, no Bluetooth, no special hardware. Paper + printer = ready.

### 2. Logo as the Code
The brand's existing visual IS the code. No ugly squares. A Walmart logo IS an LDR tag if Walmart registers it.

### 3. Context-Aware Routing
The same logo routes differently based on:
- Time of day
- Approximate location (city-level, not GPS tracking)
- Device language
- Previously visited pages (stored locally on device)

### 4. No Central Data Collection
User data never touches LDR servers. Routing logic lives either:
- **Inside the tag** (embedded decision tree, no server needed)
- **At the brand's own server** (brand gets only: "logo was scanned")

### 5. Open Standard
Like QR — free, open, forkable. No license fees. No lock-in.

---

## How It Works

### For Brands (Tag Creators)
```
1. Register your logo with LDR network (verification required)
2. Define routing rules:
   - Default URL
   - Context rules (time, language, etc.)
   - Optional: connect your own API for advanced routing
3. Generate your LDR tag (your logo + embedded metadata)
4. Print it anywhere. Put it anywhere.
```

### For Users (Tag Readers)
```
1. Open any LDR-compatible camera app
2. Point at a logo
3. App recognizes the logo → evaluates context → opens correct URL
No QR square. No confusion. Just point and go.
```

---

## Routing Modes

### Mode 1: Embedded (No Server)
All routing logic is baked into the tag itself.
```json
{
  "brand": "walmart",
  "default": "https://walmart.com",
  "rules": [
    { "if": "hour < 12", "then": "https://walmart.com/breakfast" },
    { "if": "lang == 'es'", "then": "https://walmart.com/es" }
  ]
}
```
This JSON is encoded into the visual tag. No server contact. Works offline.

### Mode 2: Connected (Brand API)
Tag sends a minimal signal to brand's own server.
```
LDR Reader → Brand API: { "tag_id": "walmart-main", "timestamp": "...", "city": "..." }
Brand API → LDR Reader: { "redirect": "https://walmart.com/sos-indirim" }
```
Brand controls everything. LDR never sees user data.

---

## Security & Verification

### Logo Verification
- Brands submit logo for verification (like SSL certificate)
- LDR network verifies legal ownership
- Verified logos get a cryptographic signature
- Any unverified logo shows a warning to the user

### Anti-Spoofing
- Perceptual hash comparison against verified logo database
- Visual similarity threshold — logos too similar to registered brands are rejected
- All verified tags are signed — signature is checked on every scan

### Anti-Manipulation
- Location spoofing: LDR uses city-level routing only, not GPS — spoofing city doesn't gain much
- Time spoofing: server timestamp used when connected, device time only for embedded mode
- Screenshot/replay attacks: liveness detection in camera stream analysis

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                    LDR CLIENT                        │
│  Camera Stream → Visual Recognition Engine           │
│               → Logo Fingerprint Match               │
│               → Context Evaluator                    │
│               → Redirect Handler                     │
└─────────────────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
    ┌─────────▼──────┐     ┌─────────▼──────┐
    │  EMBEDDED MODE  │     │ CONNECTED MODE  │
    │  (offline-first)│     │  (brand API)    │
    └────────────────┘     └────────────────┘
```

### Core Components

**Visual Recognition Engine**
- Perceptual hashing for logo fingerprinting
- Handles rotation, scale, lighting variation
- Built on open models (no proprietary dependencies)

**LDR Registry**
- Open database of verified logo fingerprints
- Cryptographic signatures for each entry
- Anyone can run a mirror

**Context Evaluator**
- Runs entirely on-device
- Evaluates time, language, local history
- No data leaves the device in embedded mode

**SDK**
- iOS / Android native
- Web (camera API)
- Any app can embed LDR reading capability

---

## Roadmap

### Phase 1 — Prove It
- [ ] Visual recognition prototype (single logo)
- [ ] Embedded routing mode
- [ ] Basic web demo

### Phase 2 — Secure It
- [ ] Logo verification pipeline
- [ ] Anti-spoofing layer
- [ ] Connected mode (brand API)

### Phase 3 — Scale It
- [ ] Open SDK (iOS, Android, Web)
- [ ] Public registry
- [ ] Developer documentation

### Phase 4 — Standardize It
- [ ] RFC-style open standard document
- [ ] Community governance
- [ ] Native OS integration proposals

---

## Contributing

LDR is open source and open standard. Fork it. Improve it. Build on it.

This project follows the spirit of QR code's creator Masahiro Hara — built for everyone, owned by no one.

```
git clone https://github.com/paracci/ldr
```

---

## License

MIT — do whatever you want. Just keep it open.

---

*LDR — because your logo should do more than look good.*
