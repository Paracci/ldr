# Changelog

All notable changes to the LDR standard and reference implementation
will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [0.1.0] — 2024 — Initial Draft

### Standard
- First draft of `STANDARD.md` (LDR v0.1 DRAFT)
- Two routing modes defined: embedded and connected
- Three-layer redirect target: `app_scheme` → `web_url` → `fallback_url`
- Context conditions: `hour_range`, `language`, `location_type`, `platform`, `app_installed`
- Registry schema defined (JSON format, open, mirrorable)
- Anti-spoofing model: perceptual hash + RSA-2048 signature
- Payment token specification: 30-second HMAC-signed single-use tokens

### Reference Implementation
- Perceptual hashing engine (`src/core/hasher.js`)
  - aHash, dHash, pHash algorithms
  - Hamming distance comparison
  - Spoofing detection via similarity threshold
- Registry with rule engine (`src/registry/registry.js`)
  - CRUD operations
  - Context-based rule evaluation
  - Import / export (JSON)
- HTTP mock server (`src/registry/server.js`)
  - 8 endpoints: health, brands, lookup, resolve, register, verify, stats
  - No external dependencies
- Seed data for 4 brands (`src/registry/seed.json`)

### SDKs
- Web SDK (`sdk/web/ldr-sdk.js`)
  - Browser camera scanning
  - Overlay UI
  - Context collection
  - Registry lookup with local cache
- Node.js SDK (`sdk/node/ldr-client.js`)
  - Registry client (read + write)
  - Fluent rule builder
  - Payment token generator and verifier
- Integration examples (`sdk/examples/integration-examples.js`)

### Tests
- 68 tests, 0 failures
- Core hasher: 32 tests
- Registry integration: 19 tests
- SDK: 17 tests

### Documentation
- `README.md` — Project overview and standard comparison
- `STANDARD.md` — Full technical specification
- `USE_CASES.md` — 10 sectors, 40+ scenarios
- `CONTRIBUTING.md` — Community contribution guide
- `SECURITY.md` — Security policy and responsible disclosure
- `LAUNCH.md` — Community announcement templates

### Infrastructure
- GitHub issue templates (bug, feature, RFC, use case, brand registration)
- PR template
- CI workflow (docs validation, tests, security audit)
- Stale issue management
- MIT license

---

## Roadmap

### [0.2.0] — Planned
- Payment token standard finalized
- Offline-first embedded mode specification
- iOS Swift SDK reference implementation
- Android Kotlin SDK reference implementation

### [0.3.0] — Planned
- Distributed registry protocol
- Mirror synchronization specification
- Visual similarity benchmark suite
- Performance benchmarks for mobile devices

### [1.0.0] — Target
- Community ratification of standard
- RFC submission to standards body
- Native OS integration proposals (iOS / Android camera APIs)
- Production-grade registry infrastructure

---

*Unreleased changes are tracked in open issues and PRs.*
