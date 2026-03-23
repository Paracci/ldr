# LDR Launch Documents

Ready-to-use announcement texts for community platforms.
Each platform has its own format — tone, length, and expectations differ.

---

## 1. Hacker News — "Show HN"

**Title:**

```text
Show HN: LDR – An open standard to make any brand logo work like a smart QR code
```

**Post text:**

```text
QR codes are powerful because of their universality — any paper, any printer,
any camera, no infrastructure needed. But QR codes have a ceiling: they're
static, ugly, and route everyone to the same URL regardless of context.

LDR (Logo Dynamic Redirect) is an attempt to build the next layer on top of
that idea.

The core premise: instead of encoding a URL into an ugly square, you register
your existing brand logo as an LDR tag. When someone scans it, the system
evaluates context — time of day, device language, whether the brand's app is
installed, rough location — and routes them to the right destination. Same
logo, different people, different outcomes.

A few design decisions I'd love feedback on:

1. No central data collection. Context decisions happen on-device.
   The registry only confirms "this logo belongs to this brand."
   We never see who scanned what.

2. Two routing modes: embedded (all rules baked into the tag, works offline,
   like QR) and connected (brand's own API decides, more dynamic).

3. Three-layer redirect target: app_scheme → web_url → fallback_url.
   If the brand's app is installed, open it directly. Otherwise fall back
   gracefully to web.

4. Payment tokens for POS: 30-second single-use HMAC-signed tokens.
   LDR never touches money — it just routes to the right payment page.

5. Anti-spoofing via perceptual hashing + cryptographic signatures.
   New logo registrations are checked against all existing verified logos
   using Hamming distance on pHash fingerprints.

The hard problem, which I'm fully aware of: QR succeeded because it required
zero infrastructure. LDR's smarter routing requires brands to opt in.
The chicken-and-egg problem is real.

My theory: start with small businesses (a restaurant, a freelancer, a small
shop) where the value is immediate and doesn't require corporate buy-in.
If the standard gets traction, bigger brands follow — the same way WordPress
started with blogs and ended up powering enterprise sites.

What's in the repo:
- Full technical standard (STANDARD.md)
- Perceptual hashing engine (no dependencies, vanilla JS/Node)
- Registry with rule engine + HTTP mock server
- Web SDK (browser camera scanning)
- Node.js SDK with fluent rule builder + payment token API
- 68 tests, 0 failures
- Interactive demo (load your own logo, see the hash computed live)

Everything is MIT licensed. The goal is for this to become a community-owned
open standard, not a product.

GitHub: https://github.com/paracci/ldr
Demo: [link]

Curious whether anyone sees fundamental flaws in the approach, and whether
the chicken-and-egg problem is solvable without a massive first mover.
```

---

## 2. Product Hunt

**Tagline:**

```text
Turn any brand logo into a smart, context-aware QR code alternative
```

**Description:**

```text
QR codes route everyone to the same URL. LDR routes people to the
right place — based on time, language, location, and whether they
have the brand's app installed.

Same logo. Different person. Different destination.

HOW IT WORKS
A brand registers their logo with the LDR network (like getting an
SSL certificate). When someone scans it with an LDR-compatible camera,
the system evaluates context on-device and opens the right destination —
the brand's app if installed, the web otherwise.

WHAT MAKES IT DIFFERENT FROM QR
→ Uses the brand's existing logo — no ugly squares
→ Context-aware: morning vs evening, in-store vs at home, EN vs other languages
→ App-aware: opens the native app if installed, falls back to web
→ Updatable: change the destination without reprinting anything
→ Open standard: MIT licensed, community owned, no vendor lock-in

PAYMENT SUPPORT
For POS scenarios, LDR generates 30-second single-use payment tokens.
The money always flows through the bank — LDR just routes to the
right checkout page.

FULLY OPEN SOURCE
68 tests. Perceptual hashing engine. Registry mock server.
Browser SDK + Node.js SDK. Interactive demo where you can upload
your own logo and see the hash computed in real time.

Built for developers and brands who want QR-level simplicity with
21st century intelligence.
```

**First comment (founder's note):**

```text
Hey PH 👋

Built this because I kept asking: why does QR still route everyone
to the same static URL in 2024? The technology to do better exists.
What's missing is a standard.

The honest challenge: this needs brands to integrate before users
see value, and users before brands see value. Classic chicken-and-egg.

My bet is that the entry point is small businesses — a café, a
freelancer, a local shop — where one person makes the integration
decision and the payoff is immediate. Large brands follow when
the ecosystem is there.

Everything is MIT. If you want to fork it, build on it, or help
define the standard — the repo is open and CONTRIBUTING.md is
detailed. Would genuinely love co-contributors on this.

Happy to answer any questions here.
```

---

## 3. Reddit — r/programming

**Title:**

```text
LDR: Open standard for logo-based dynamic routing (QR alternative, MIT, no deps)
```

**Post:**

```text
I built a thing and I'm genuinely unsure if it's a good idea.

TL;DR: QR codes route everyone to the same URL. What if your brand's
logo could route different people to different places based on context,
without a central server tracking anything?

**The idea**

QR's power: any paper + any printer + any camera = works.
LDR's goal: any logo + any printer + any camera = works.

A brand registers their logo. When scanned, the system evaluates
context on-device (time, language, whether the app is installed)
and routes to the right destination.

Same logo. Walmart in-store at 9am → morning deals.
Same logo. Walmart from home at 8pm → delivery page.
Same logo. English device → English UI.

No tracking. Context decisions are local. The registry only answers
"does this logo belong to a verified brand."

**What's actually built**

Not just a spec doc. Working code:

- Perceptual hashing engine (pHash + aHash + dHash, vanilla JS/Node,
  no dependencies)
- Registry with rule engine + HTTP API mock server
- Browser SDK with camera scanning
- Node.js SDK with fluent rule builder + payment tokens
- 68 tests passing
- Interactive demo where you upload your own logo and watch the hash
  computed live in the browser

**The honest problem**

Classic two-sided marketplace problem. Brands need to integrate before
users benefit. Users need to exist before brands care.

My theory: start with small businesses where one person makes the
call and the payoff is immediate. QR took 15 years to go mainstream.
I'm not in a hurry.

**The ask**

Looking for:
1. Security holes in the anti-spoofing model (perceptual hash + RSA sig)
2. Fundamental protocol flaws I haven't thought of
3. Anyone who wants to co-own the standard

GitHub: https://github.com/paracci/ldr (MIT)

Not a product launch. Not a startup pitch. Just an open standard
looking for a community.
```

---

## 4. Dev.to / Hashnode — Technical Blog Post

**Title:**

```text
I built an open standard to replace QR codes with brand logos
(and here's why the hard part isn't technical)
```

**Post:**

```text
QR codes are a solved problem. Any camera reads them, any printer
produces them, they work offline, and they've been open for 30 years.

But they have a ceiling. Every QR routes everyone to the same URL.
The same static destination regardless of who you are, what time
it is, what language your phone speaks, or whether you have the
brand's app installed.

We can do better. And the technical part is straightforward.
The hard part is something else entirely.

## The idea: Logo Dynamic Redirect (LDR)

Instead of encoding a URL into a pattern, you register your brand's
existing logo as an LDR tag. When scanned:

1. Perceptual hash computed from camera frame
2. Hash looked up in open registry
3. Cryptographic signature verified
4. Context evaluated on-device (time, language, app installed, location type)
5. Best destination chosen — brand app if available, web otherwise

Same logo. Different context. Different destination.

## What makes it technically interesting

**Perceptual hashing for logo matching**

Unlike QR's exact binary match, LDR uses pHash (Discrete Cosine Transform
on a 32x32 resize). Two photos of the same logo — different lighting,
slight angle, minor damage — should hash to within Hamming distance 10.

The core: DCT-based perceptual hash
function pHash(gray, w, h) {
  const small = resize(gray, w, h, 32, 32);
  const dct   = dct2d(small, 32);
  // Extract top-left 8x8 (low frequency components)
  // Each bit = DCT coefficient above median
  // Result: 64-bit hash, robust to minor visual changes
}

**Three-layer routing**

Every LDR tag can define three targets:
- app_scheme: opens brand app if installed
- web_url: fallback to web
- fallback_url: last resort

The SDK checks app availability and routes accordingly. Graceful
degradation is a first-class citizen.

**Anti-spoofing**

New logo registrations go through:
1. Legal verification (trademark certificate)
2. Perceptual similarity check against all existing logos
   (>85% similarity = rejected or flagged for human review)
3. RSA-2048 signature on approval

Every scan verifies the signature. Unverified logos get a clear
warning in the reader UI.

## The hard part

The technical architecture is fine. The hard part is:

QR succeeded because it needed zero ecosystem.

Any URL, printed on anything, readable by any camera. No registration.
No verification. No integration. Just a URL in a pattern.

LDR's smarter routing requires brands to register and integrate.
Classic two-sided marketplace problem. Brands won't integrate without
users. Users won't adopt without brand support.

My theory on solving it: don't start with enterprise.

Start with a café owner who wants their logo to show the breakfast
menu before noon and the evening special after 6pm. One person.
One afternoon of integration work. Immediate payoff.

If enough small businesses adopt it, the standard proves itself.
When a standard proves itself, enterprise follows.

It took QR codes 15 years to become ubiquitous after Masahiro Hara
invented them at Toyota. He deliberately didn't patent them.
I'm taking the same approach.

## What's in the repo

Not just a spec. Working code:

- src/core/hasher.js — pHash engine, no dependencies
- src/registry/ — rule engine + HTTP mock server
- sdk/web/ldr-sdk.js — browser camera SDK
- sdk/node/ldr-client.js — Node.js integration SDK
- tests/ — 68 tests, 0 failures
- Interactive demo — upload your own logo, see hash computed live

GitHub: https://github.com/paracci/ldr (MIT)

If you see security holes in the anti-spoofing model, protocol
flaws I haven't thought of, or want to help define the standard —
the repo is open and CONTRIBUTING.md is waiting.
```

---

## 5. Twitter / X — Thread

```text
🧵 I built an open standard to make brand logos work like smart QR codes.

Here's what QR gets right, what it gets wrong, and why the hardest
problem isn't technical. (1/8)

─

QR's superpower: zero infrastructure.
Any URL → any printer → any paper → any camera → works.

That's why it took 30 years to go mainstream and will probably
last another 30. (2/8)

─

QR's ceiling: everyone gets the same URL.

Same Walmart logo.
8am in-store shopper → should see morning deals.
8pm at-home browser → should see delivery options.
English phone → should get English UI.
App installed → should open the app directly.

QR can't do any of this. (3/8)

─

LDR (Logo Dynamic Redirect) is my attempt at the next layer.

Register your existing logo.
Define routing rules.
Same logo, different people, different destinations.
Context evaluated on-device. No central tracking. (4/8)

─

The technical part is solved:
→ pHash fingerprinting (robust to lighting, angles, minor damage)
→ Cryptographic signature verification
→ Three-layer routing: app → web → fallback
→ 30-second payment tokens for POS
→ Offline-capable embedded mode

68 tests passing. Full SDK. Interactive demo. (5/8)

─

The hard part: QR needed zero ecosystem.
LDR needs brands to integrate before users benefit.
Classic chicken-and-egg.

My theory: start with small businesses.
A café. A freelancer. A local shop.
One person, one afternoon, immediate payoff.

Enterprise follows proven standards. (6/8)

─

Masahiro Hara invented QR for Toyota in 1994.
Deliberately didn't patent it.
It took 15 years to go mainstream.

Taking the same approach.
MIT license. Community owned. No vendor lock-in. (7/8)

─

Repo: https://github.com/paracci/ldr

Looking for:
→ Security review of the anti-spoofing model
→ Protocol flaws I haven't seen
→ Co-contributors who want to help define the standard

Not a startup. Not a product. Just an open standard. (8/8)
```

---

*All texts are editable. Before adding platform links,
make sure the GitHub repo is live and the demo URL is working.*