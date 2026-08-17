---
description: Main command for decision capture and review. Captures why architectural/technical decisions were made, or produces a briefing of existing decisions.
argument-hint: [review|log|area] [--since Nd] [--all]
allowed-tools: Read, Glob, Grep, Bash
---

# /decision

Main command for the **`decision`** skill.

- Run `/decision` or `/decision review` to catch up on decisions in this repository.
- Run `/decision log` to capture a decision from the current session context.
- Run `/decision <area>` (e.g., `/decision auth` or `/decision payments`) to view decisions scoped to a specific topic area.

## Usage

```
/decision                         # view condensed briefing for all areas
/decision payments                # view briefing for payments area
/decision review auth --since 30d # view auth decisions from last 30 days
/decision log                     # capture decisions from the current session
```

## What it does

Dispatches to the `decision` skill:
- For read requests (`review`, `<area>`, `--since`, `--all`): delegates to **`decision-briefing`**.
- For write/capture requests (`log`, `record`): delegates to **`decision-logger`**.

All arguments are forwarded to the `decision` skill.
