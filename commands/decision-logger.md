---
description: Capture *why* decisions were made during this session into .decision/<date>-<slug>.md.
argument-hint: [topic] [--status complete|incremental]
allowed-tools: Read, Glob, Grep, Bash
---

# /decision-logger

Capture the rationale behind decisions made during this coding session.

Invokes the **`decision-logger`** sub-capability of the `decision` skill to:
1. Read session context and user prompts.
2. Apply the strict decision filter (only decision-shaped sessions leave a trace).
3. Check for superseded prior decisions in `.decision/`.
4. Write or update `.decision/<date>-<slug>.md`.

## Usage

```
/decision-logger
/decision-logger payments-idempotency
```
