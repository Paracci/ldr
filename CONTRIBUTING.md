# Contributing to LDR

> LDR is not a company project. It grows with the community, improves with the community.
> This document is written to make contribution possible at every level —
> you can contribute even without writing code.

---

## Types of Contribution

### Non-code contributions

- Add a new sector scenario → `USE_CASES.md`
- Report a bug or missing piece → GitHub Issue
- Translate documentation to another language → `docs/` folder
- Test the standard and provide feedback

### Technical contributions

- Develop the visual recognition engine
- Write a reader for a new platform (iOS, Android, Web)
- Improve the registry infrastructure
- Contribute to the security layer
- Write integration examples

### Standard contributions

- Propose rule engine extensions
- Propose new condition types
- Improve the security model
- Submit a change proposal in RFC format

---

## Before You Start

### 1. Understand the repo

Read these files first:

```text
README.md      → What the project is
STANDARD.md    → Technical standard
USE_CASES.md   → Sector scenarios
SECURITY.md    → Security policy
```

### 2. Check existing issues

Someone may have already proposed the same thing.
The `good first issue` label is ideal for newcomers.

### 3. Big change?

Open an Issue and discuss first. Large PRs won't be merged without prior discussion.

---

## Development Environment

```bash
git clone https://github.com/paracci/ldr
cd ldr
```

The repo currently contains:

```text
/src       → Source code
/sdk       → Web and Node.js SDKs
/tests     → Test suite
```

---

## Pull Request Process

```text
1. Fork the repo
2. Create a feature branch
   git checkout -b feature/short-description
3. Make your change
4. Write tests (if applicable)
5. Open a PR — fill in the template
6. Wait for review
```

### PR Title Format

```text
[DOCS] USE_CASES.md — healthcare sector added
[FEAT] Registry API — bulk lookup endpoint
[FIX]  Logo hash — angle tolerance fixed
[SEC]  Token validation — edge case fixed
```

### PR Description Template

```markdown
## What changed?
...

## Why?
...

## Was it tested?
...

## Related issue?
Closes #...
```

---

## Proposing a Standard Change

Modifying `STANDARD.md` is a more sensitive process.

### Small change (wording, clarification, improvement)

→ Open a PR directly

### Medium change (new condition type, new field)

→ Open an Issue first → discuss → PR

### Large change (architecture, security model, breaking change)

→ Write in RFC format → community vote → core team approval → PR

### RFC Format

```markdown
# RFC-XXX: [Title]

## Summary
What are you proposing in one paragraph.

## Motivation
Why is it needed?

## Technical Detail
How does it work?

## Backward Compatibility
Does it affect existing systems?

## Alternatives
What else was considered?

## Open Questions
Things not yet decided.
```

---

## Code Standards

### General

- Comments in English
- Commit messages in English
- Documentation accepted in both English and other languages

### Security

- Use battle-tested libraries for cryptography — don't roll your own
- Every piece of code handling user data gets a special review
- Every payment-related PR must be approved by two people

### Testing

- Visual recognition changes → benchmark test required
- Registry changes → integration test required
- Security changes → security test required

---

## Code of Conduct

This project is for everyone.

- Be respectful
- Give constructive feedback
- Value contributions at every level
- Don't put commercial interests ahead of the community

Unacceptable behavior:

- Personal attacks
- Harassment
- Attempting to steer the standard toward a single company's interests
- Disclosing security vulnerabilities publicly instead of through responsible disclosure

---

## Frequently Asked Questions

**"I'm not a big brand. Does my contribution matter?"**
The most important contributions come from small businesses and individual developers.
Your use case brings the standard into the real world.

**"I don't know how to code. Can I still contribute?"**
Yes. Writing documentation, translating, adding scenarios, testing — all of these are contributions.

**"Can I use LDR in my own project?"**
MIT license. Use it however you want, even in closed-source projects.

**"I represent a company and we want to integrate."**
Check the `sdk/examples/` folder. Open an Issue for questions.
If you contribute to the integration documentation, the community will appreciate it.

---

*LDR — Logo Dynamic Redirect*
*Open Standard | MIT License | Community Governed*