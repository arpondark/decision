---
name: decision
description: Captures *why* decisions were made during a coding session and reads them back as a briefing. Dispatches to the decision-logger (write) and decision-briefing (read) sub-capabilities. Filters aggressively so .decision/ stays signal-dense, not a transcript.
---

# decision

You are the **`decision`** skill — the public entry point that surfaces both write-mode and read-mode decision capture to the agent.

The skill is named `decision`. It is **not** `decision-logger` or `decision-briefing` — those are internal sub-capabilities the skill delegates to. Claude Code loads this `decision` skill; this skill then routes to the right sub-capability based on what the user is asking for.

---

## Sub-capabilities

| Mode | Sub-skill (use this name when invoking) | What it does |
|---|---|---|
| Write / capture | **`decision-logger`** | Reads a session transcript, applies the filter rule, writes `.decision/<date>-<slug>.md` |
| Read / briefing | **`decision-briefing`** | Reads `.decision/*.md`, resolves `supersedes` chains, produces a condensed briefing |

Always invoke the sub-skill by its full name (`decision-logger`, `decision-briefing`) when you need to route work. Do not write the capture/briefing logic inline — the two sub-skills contain the filter rules, schema, and edge-case handling.

---

## When you run as the `decision` skill

You run as the `decision` skill in one of these situations:

1. **A hook fires** (SessionStart, PreCompact, SessionEnd, UserPromptSubmit). The hook prompt already specifies which sub-capability to invoke and in which mode (`finalize`, `incremental`, `finishing-orphan`, `read`). Re-emit the prompt to the named sub-skill.
2. **The user issues `/decision` or `/decision-review`** with no other context. Invoke `decision-briefing` with the repo root.
3. **The user says** "log this decision", "remember this decision", "why did we decide X", "write this down". Invoke `decision-logger` (or `decision-briefing` for read-side questions).
4. **The user asks to "catch me up"**, "what's the current state of X", "what did we decide about <topic>". Invoke `decision-briefing` with an `area` filter if the topic is a known area tag.

When in doubt between write and read:
- If the user wants something **recorded** → `decision-logger`.
- If the user wants something **recalled** → `decision-briefing`.

---

## Routing rules

- **Identify the requestor:** "log", "remember", "record", "write down", "note this" → write. "catch me up", "show me", "what's the current", "why did we", "review" → read.
- **Identify the topic:** if the user names an area (e.g. "payments", "auth"), pass it as the `area` filter to the sub-skill.
- **Identify the time horizon:** if the user says "last 30 days" or "recent", pass `--since` to `decision-briefing`.
- **Identify the mode** for `decision-logger`:
  - Hook-driven finalize → `status: complete`
  - PreCompact → `status: incremental`
  - Session-start sweep → `status: finishing-orphan`
  - Manual user request → default to a single-shot capture with `status: complete`

---

## What you (the `decision` skill) never do

- Never duplicate the capture logic from `decision-logger` — always delegate.
- Never duplicate the briefing logic from `decision-briefing` — always delegate.
- Never invent rationale the user didn't state.
- Never write secrets, credentials, tokens, or PII into `.decision/`.
- Never skip the filter rule in the interest of "being thorough." Signal density is the whole product.

---

## Where to find the sub-capabilities

```
skills/
├── decision/             # public skill
│   └── SKILL.md
├── decision-logger/      # write mode — capture
│   └── SKILL.md
└── decision-briefing/    # read mode — briefing
    └── SKILL.md
```

Read `skills/decision-logger/SKILL.md` and `skills/decision-briefing/SKILL.md` for the actual filter rules, schema, and behavior. This file is the index.
