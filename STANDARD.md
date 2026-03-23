# LDR Technical Standard — v0.1 DRAFT

> **LDR is not an application. It is a standard.**
> Just as QR code is not an application.
> What made QR powerful was Samsung, Apple, and Google adding it to their camera apps.
> LDR's goal is the same: if brands adopt this standard, phone manufacturers and operating systems
> will support it natively. When that day comes, LDR will be ready in every camera, just like QR.
> Users will not be asked to install anything.

---

## Philosophy

```text
QR's power:    Any paper + any printer + any camera = works
LDR's goal:    Any logo  + any printer + any camera = works
```

The only way to reach this goal is to be an **open standard**.
A closed system, a proprietary format, or infrastructure controlled by a single company
can never achieve this goal.

**A call to brands:**

> "Register your logo and add three lines of integration.
> The community, developers, and eventually operating systems will handle the rest.
> If you put your hand to the wheel, we will bring this technology to every camera, just like QR."

---

## LDR Record — Basic Structure

The minimum information required for a brand to register with the LDR system:

```json
{
  "brand_id": "walmart-us",
  "brand_name": "Walmart",
  "logo_hash": "perceptual_hash_here",
  "signature": "RSA2048_signature_here",
  "verified": true,
  "targets": {
    "app_scheme": "walmart://",
    "web_url": "https://walmart.com",
    "fallback_url": "https://walmart.com/app-install"
  },
  "rules": []
}
```

### Target Definitions

Every LDR record can define a **three-layer target**:

| Field | Required | Description |
|---|---|---|
| `app_scheme` | Optional | Opens if the user has the app installed |
| `web_url` | Required | Opens if no app or not defined |
| `fallback_url` | Optional | Opens if both of the above fail |

**Decision flow:**

```text
Logo recognized
    ↓
Is app_scheme defined?
    ├── Yes → Is this app installed on the user's device?
    │           ├── Yes → Open the app, go to correct page
    │           └── No  → Go to web_url
    └── No  → Go to web_url
                    ↓
              Is web_url reachable?
                    ├── Yes → Open
                    └── No  → Go to fallback_url
```

---

## Rule Engine

Brands can optionally define context-based routing rules.
Rules are added to the `rules` array. Each rule is evaluated in order — the first match is applied.

### Rule Structure

```json
{
  "rules": [
    {
      "id": "morning-campaign",
      "conditions": {
        "hour_range": [6, 12],
        "location_type": "in_store"
      },
      "targets": {
        "app_scheme": "walmart://deals/morning",
        "web_url": "https://walmart.com/deals/morning"
      }
    },
    {
      "id": "home-delivery",
      "conditions": {
        "location_type": "not_in_store"
      },
      "targets": {
        "app_scheme": "walmart://delivery",
        "web_url": "https://walmart.com/delivery"
      }
    }
  ]
}
```

### Supported Conditions

| Condition | Values | Description |
|---|---|---|
| `hour_range` | `[0, 23]` | Hour range (device time) |
| `language` | `["tr", "en", ...]` | Device language |
| `location_type` | `in_store`, `not_in_store` | Inside or outside store |
| `platform` | `ios`, `android`, `web` | User platform |
| `app_installed` | `true`, `false` | Is brand app installed? |

> **Important note on location:**
> LDR only distinguishes `in_store` / `not_in_store`.
> Precise location data such as GPS coordinates, street, or neighborhood is outside the scope of the LDR standard.
> If precise location is needed, the brand handles it through their own app — LDR does not interfere.

---

## App Integration

Brands only need to do the following to add LDR support to their apps:

### Android

```xml
<!-- AndroidManifest.xml -->
<intent-filter>
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <data android:scheme="walmart"/>
</intent-filter>
```

### iOS

```xml
<!-- Info.plist -->
<key>CFBundleURLSchemes</key>
<array>
    <string>walmart</string>
</array>
```

### Web (Progressive Web App)

```json
{
  "start_url": "/",
  "protocol_handlers": [
    {
      "protocol": "web+ldr",
      "url": "/ldr-handler?url=%s"
    }
  ]
}
```

**That's it.** Once a brand completes these three steps, the LDR system automatically recognizes
and routes to their app.

---

## Security Standard

### Logo Verification

```text
1. Brand submits logo file to LDR registry
2. Registry computes perceptual hash → fingerprint created
3. Legal verification: trademark registration document required
4. On approval: signed with RSA-2048
5. Signed record added to open registry
6. Anyone can verify this record (with public key)
```

### Fake Logo Detection

```text
New registration received
    ↓
Visual similarity check against all existing verified logos
    ↓
Similarity > 85% → Auto-reject + flag for human review
Similarity 60–85% → Flag for human review
Similarity < 60%  → Auto-pass (legal verification continues)
```

### Additional Security for Payment Scenarios

```json
{
  "payment_token": {
    "value": "single_use_token",
    "expires_in_seconds": 30,
    "signed_by": "pos_system_RSA_signature",
    "amount": 47.50,
    "currency": "USD",
    "merchant": "walmart-manhattan-pos-3"
  }
}
```

- Token expires after 30 seconds
- LDR server never sees token content — only routes it
- Money transfer goes entirely through bank / payment infrastructure
- LDR is never a payment intermediary

---

## Registry

### Open and Distributed

The LDR registry is not centralized. Anyone can run a mirror.

```text
Main registry:  registry.ldr-standard.org (community governed)
Mirror example: registry.example.com/ldr
Local mirror:   Companies can run mirrors on their own networks
```

### Registry API

```text
GET  /v1/lookup/{logo_hash}     → Get logo record
GET  /v1/verify/{brand_id}      → Brand verification status
POST /v1/register               → New logo registration request
GET  /v1/list                   → All verified brands
```

### Data Structure (Open Format)

```json
{
  "version": "1.0",
  "brand_id": "walmart-us",
  "brand_name": "Walmart",
  "logo_hash": "a3f9c2b1d8e4...",
  "logo_hash_algorithm": "perceptual_hash_v1",
  "public_key": "RSA2048_public_key",
  "signature": "signature",
  "registered_at": "2024-01-01T00:00:00Z",
  "verified": true,
  "targets": {},
  "rules": []
}
```

---

## Reader Standard

An LDR reader can be implemented by any app or operating system.

### Minimum Requirements

An LDR reader must be able to:

1. **Analyze camera stream** — continuous visual scanning
2. **Compute perceptual hash** — extract fingerprint from live frame
3. **Query registry** — look up hash in registry
4. **Verify signature** — check the signature of the found record
5. **Evaluate rules** — compute contextual conditions on-device
6. **Redirect** — open `app_scheme` or `web_url`

### User Experience Requirements

- Haptic feedback on recognition
- Clear warning for unverified logos
- User must be able to see "why was I redirected here"
- User must be able to decline the redirect

---

## Versioning

This document is at the `v0.1 DRAFT` stage.

| Version | Status | Content |
|---|---|---|
| v0.1 | Draft | Core structure, rule engine, security |
| v0.2 | Planned | Payment token standard details |
| v0.3 | Planned | Offline mode standard |
| v1.0 | Target | Community ratification, RFC submission |

---

## Standardization Roadmap

```text
Today      → Open source repo, community contribution
            → First prototypes, first integrations

Near-term  → Independent foundation or community governance established
            → No single company can control the standard

Mid-term   → Sufficient brand and developer adoption
            → Submission to W3C or equivalent standards body

Long-term  → Operating systems add native support
            → Ready in every camera, just like QR
            → Users are not asked to install anything
```

---

## Contribute

This standard is developed by the community.

- Technical proposal: open a GitHub Issue
- Standard change: open a PR in RFC format
- New sector scenario: add to `USE_CASES.md`
- Bug report: follow the Security Policy

---

*LDR — Logo Dynamic Redirect*
*Open Standard | MIT License | Community Governed*

*"What made QR powerful was not the technology — it was the universality. LDR follows the same path."*