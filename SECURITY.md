# LDR Security Policy

> LDR is an open standard. Security vulnerabilities are not kept secret —
> they are shared with the community through a responsible process.
> Security researchers are among the most valued contributors to this project.

---

## Scope

This policy covers:

- The LDR technical standard (`STANDARD.md`)
- Reference reader implementations (`/src`)
- Registry infrastructure and API
- Logo verification algorithm
- Rule engine

This policy does **not** cover:

- Brands' own LDR integrations
- Third-party LDR implementations
- Brands' own server infrastructure

---

## Reporting a Vulnerability

### Where to report

**Email:** security@ldr-standard.org
**Encryption:** Our PGP key is at `/security/pgp-key.asc` in the repo

Do **not** open a public GitHub Issue — security vulnerabilities are not shared as public issues.

### How to report

```text
Subject: [LDR-SEC] Short description

Body:
- Type of vulnerability
- Affected component
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
```

### What happens next

```text
0–24 hours   → Acknowledgement
1–3 days     → Initial assessment and response
7 days       → Fix plan shared
30–90 days   → Fix + coordinated disclosure
```

We work with you throughout the process. We get your approval before publishing a fix.

---

## Security Model

### Core Principles

**1. LDR does not collect data**
The LDR standard does not define or encourage user data collection.
Contextual decisions (time, language, location type) are made on-device and never sent to a server.

**2. LDR does not handle money**
In payment scenarios, LDR is a router only.
Money always flows through bank or payment infrastructure.

**3. Registry is distributed**
No single server or company can control the registry.
Anyone can run a mirror. Anyone can verify a record.

**4. Every record is signed**
Verified logos are signed with RSA-2048.
Unsigned or unverifiable records show a warning to the user.

---

## Known Attack Vectors and Mitigations

### Logo Spoofing

**Attack:** Creating a logo similar to a real brand to deceive users.

**Mitigation:**

- Legal trademark registration document required on registration
- Visual similarity algorithm compares against existing logos (85% threshold)
- Unverified logos show a clear warning to the user
- User can always see "who does this logo belong to"

### Man-in-the-Middle Attack

**Attack:** Intercepting registry or brand API communication.

**Mitigation:**

- All communication requires TLS 1.3
- Registry responses are RSA-signed and can be verified independently of HTTPS
- Payment tokens expire in 30 seconds — intercepted tokens are worthless

### Registry Manipulation

**Attack:** Adding unauthorized records to the registry database.

**Mitigation:**

- Every record requires a cryptographic signature
- Signature verification happens client-side — no need to trust the registry
- Distributed mirror system — hacking a single registry does not take down the system

### Screenshot / Replay Attack

**Attack:** Taking a screenshot of a logo and using it elsewhere.

**Mitigation:**

- Single-use tokens (30 seconds) for payment scenarios
- Reader implementations must analyze live camera streams
- Static image detection is part of the reader standard

### GPS / Location Spoofing

**Attack:** Using a fake GPS to appear to be in a different location.

**Mitigation:**

- LDR only distinguishes `in_store` / `not_in_store`
- This decision uses WiFi network detection, not GPS
- The advantage gained from location spoofing is minimal
- Scenarios requiring precise location are handled by the brand's own app

### VPN / IP Spoofing

**Attack:** Using a VPN to appear to be in a different country.

**Mitigation:**

- IP-based decisions are not recommended in the LDR standard
- Language detection uses the phone's system language, not IP

---

## Severity Levels

Reported vulnerabilities are assessed at four levels:

| Level | Definition | Target Timeline |
|---|---|---|
| Critical | Threatens user money or data | 7 days |
| High | Fake logo can enter the system | 14 days |
| Medium | Registry manipulation risk | 30 days |
| Low | Minor bypasses, edge cases | 90 days |

---

## For Security Researchers

Contributors who report security issues to this project:

- Are added to `SECURITY_HALL_OF_FAME.md`
- Receive full credit during coordinated disclosure

Please avoid:

- Accessing real user data
- Causing service disruption
- Publicly disclosing a vulnerability before notifying us

---

## Version History

| Date | Version | Change |
|---|---|---|
| 2024 | v0.1 | Initial release |

---

*LDR — Logo Dynamic Redirect*
*Open Standard | MIT License | Community Governed*