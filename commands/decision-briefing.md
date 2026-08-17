---
description: Read .decision/*.md and produce a condensed briefing on the current state of decisions in this repo.
argument-hint: [area] [--since Nd] [--all]
allowed-tools: Read, Glob, Grep, Bash
---

# /decision-briefing

Read `.decision/*.md` and produce a condensed briefing on the decisions recorded in this repo.

Invokes the **`decision-briefing`** sub-capability of the `decision` skill to:
1. Discover all `.decision/*.md` files under the repository root.
2. Filter by area if provided.
3. Resolve `supersedes:` chains so only active decisions are shown as current truth.
4. Output a clean, scannable briefing.

## Usage

```
/decision-briefing
/decision-briefing payments
/decision-briefing auth --since 30d
```
