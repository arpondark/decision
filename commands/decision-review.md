---
description: Read .decision/*.md and produce a condensed briefing on the current state of decisions in this repo. Dispatches via the `decision` skill to its `decision-briefing` sub-capability.
---

# /decision-review

Catch me up on the decisions in this repo. Optionally scoped to a specific area.

## Usage

```
/decision-review                  # all areas, last 90 days, current state
/decision-review payments         # just payments
/decision-review auth --since 30d # auth, last 30 days
/decision-review --all            # include historical (pre-superseded) entries
```

## What it does

The `decision` skill routes this command to its **`decision-briefing`** sub-capability. The sub-skill:

1. Discovers all `.decision/*.md` under the repo root.
2. Filters by `area` if you provided one.
3. Resolves `supersedes:` chains — only the current decision per topic is shown.
4. Groups by `area`, then by topic.
5. Surfaces recent activity (last 14 days) separately.
6. Cites file paths for every claim.

## Output

A scannable briefing — bullet points, not prose. Current state per area, recent activity, and any gaps where you asked but no decision exists.

## If `.decision/` is empty

The briefing will say so and offer to scaffold. It won't fabricate.

## Pass-through

All arguments are forwarded to the `decision-briefing` sub-skill. See `skills/decision-briefing/SKILL.md` for the full contract.
