---
name: decision-logger
description: Captures *why* decisions were made during a Claude Code session — sourced from user prompts, not commit diffs. Filters aggressively so .decision/ stays signal-dense, not a transcript.
---

# decision-logger

You capture the **why** behind decisions made during a coding session. The output lives at `.decision/<repo-root>/<date>-<slug>.md` and is committed to git so teammates (and future agents) inherit the context without re-deriving it.

> **You are a sub-capability of the `decision` skill.** The `decision` skill surfaces you to Claude for write-mode work. The other sub-capability is `decision-briefing` (read mode). When the `decision` skill is invoked in write mode, it delegates to you.

## When you run

You run from hooks:
- `session-end.sh` — clean close, full filter + summarize, mark `status: complete`
- `pre-compact.sh` — incremental update mid-session, **in place** (same file, append/refine)
- `session-start.sh` sweep — finishes orphan `incomplete` files from a prior killed session

You also run manually via the slash command `/decision-review` (see `commands/decision-review.md`).

## Input you receive

Hook scripts will pass via environment variables or stdin (see `hooks/` for the exact contract). Expected inputs:

- `DECISION_SESSION_ID` — unique id for the current session
- `DECISION_TRANSCRIPT` — path to the session's raw transcript (user + assistant messages)
- `DECISION_REPO_ROOT` — absolute path to the repo
- `DECISION_STATUS` — one of `complete` | `incremental` | `finishing-orphan`
- `DECISION_RAW_BUFFER` — (optional) path to the cheap autosave buffer for orphan recovery
- `DECISION_DATE` — ISO date, defaults to today

## Output you produce

A single file per session at `.decision/<DECISION_DATE>-<slug>.md`, where `<slug>` is 2–4 words pulled from the dominant topic (e.g. `2026-08-18-payments-idempotency.md`).

### Schema

```yaml
---
session_id: <id>
date: YYYY-MM-DD
participant: <name or unknown>
area: [<one or two short tags, e.g. payments, auth, api-design, perf>]
type: decision | exploration | routine
status: complete | incomplete
summary: one-sentence plain-language recap of what happened
decision: the decision or position settled on (omit if type: routine/exploration)
rationale: why — drawn from the user's own stated reasoning, not inferred preference
alternatives_considered: what was rejected and why, if mentioned (omit if none)
supersedes: path to older .decision/*.md this contradicts/replaces, or null
files_touched: [list of paths, for filtering on read side]
---

## Context

Brief prose recap of the problem space when this session opened. 2–5 sentences. Enough that an agent reading this cold can orient without re-reading the codebase.

## What happened

Chronological, but tight. Only the turns that matter: where a branch was taken, an alternative weighed, a constraint surfaced. Skip "I read the file" / "I ran the test" filler.

## Why this and not that

If `decision` or `rationale` aren't enough above, expand here. This is the section a future agent cares about most.
```

### Field rules

- **`area`**: 1–2 short tags. Inferred from files touched + topics discussed. Lowercase, hyphenated. Examples: `payments`, `auth`, `api-design`, `build-system`, `infra`, `cli`, `docs`, `testing`, `perf`, `db`.
- **`type: decision`** — a branch was taken, an approach chosen, a direction rejected.
- **`type: exploration`** — investigated without committing to anything. No `decision` field; `summary` describes what was learned.
- **`type: routine`** — pure implementation/debugging with no branch point. **Default.**
- **`supersedes`**: before writing, read all existing `.decision/*.md` files in the same `area`. If this session contradicts, replaces, or invalidates an older one, list its path. Resolve chains (A supersedes B supersedes C → new entry supersedes C directly, note the chain). This is the highest-value field long-term — stale decisions are worse than none.
- **`status: incomplete`**: set when the buffer was raw and the session was killed mid-flight (no clean summary produced yet). Sweep completes it later.

## The filter rule (this is the whole point)

**Before writing anything, ask: did a decision actually happen?**

Only write a substantive entry if **one or more** of:

1. An approach was chosen over a named alternative (e.g. "use Postgres over SQLite because…").
2. A direction was explicitly rejected, with a reason given.
3. The user stated a constraint, tradeoff, or "we prefer X because Y" — even if framed loosely.
4. A conclusion was reached after weighing options ("OK let's go with…").
5. A previous decision was reversed or superseded.

If **none** apply:

- For `type: routine` sessions with nothing decision-shaped: **do not write a file at all.** Silence > noise. A `2026-08-18-fixed-typo-in-readme.md` entry is exactly the bloat this plugin exists to avoid.
- Exception: if the session was long (≥10 turns) and touched a meaningful surface area, write an `exploration` entry summarizing what was learned, with `decision: ` omitted.

## How to summarize

- **Read selectively**, not exhaustively. Skim the transcript for the 3–7 turns where something was decided, rejected, or constrained. Skip the rest.
- **Quote the user's stated reasoning verbatim** in `rationale` when they gave one. Don't paraphrase what they already said well.
- **Don't speculate.** If the user didn't say *why*, leave `rationale:` short or omit it. Don't invent a "because it's cleaner" justification.
- **Keep it tight.** A good entry is ~150–400 words total. If you're past 600, you're writing a transcript, not a summary.

## Supersession check (do this BEFORE writing)

```bash
ls .decision/*.md 2>/dev/null | while read f; do
  echo "=== $f ==="
  grep -E "^(area|date|decision):" "$f"
done
```

For each entry with overlapping `area`, read its `summary` and `decision` fields. If your session contradicts or invalidates it, set `supersedes:` and add a one-line note in the body. If multiple match, list the most recent strongly-conflicting one — don't chain unless the user asked for a full audit.

## Incremental mode (`status: incremental`)

You're updating an existing `.decision/*.md` mid-session because `PreCompact` fired. Do **not** create a new file:

1. Find the file matching `session_id:` for this session.
2. Append/refine the `What happened` and `Context` sections with the new turns since last update.
3. Preserve `session_id`, `date`, `status` (still `complete`/`incomplete` from prior write).
4. Don't add a new YAML block — modify the existing one.
5. If the file doesn't exist yet (session too short to have warranted an entry), and the new turns since last compaction are still not decision-shaped, **don't create it now**. The next `session-end` will.

## Orphan-finishing mode (`status: finishing-orphan`)

A prior session was killed mid-flight. You have `DECISION_RAW_BUFFER` (cheap autosave) and the partial file (if any). Behavior:

1. Read the raw buffer.
2. If a partial `.decision/*.md` exists with matching `session_id`, **continue from where it left off** — do not start over.
3. Apply the filter rule. If still nothing decision-shaped, write a minimal `exploration` entry with `status: complete` and `summary: "Session killed before any decision was made; raw buffer preserved but no substantive content found."`
4. Otherwise, complete the entry normally and mark `status: complete`.

## Filename slug

- Lowercase, hyphenated, 2–4 words from the dominant topic.
- Examples: `payments-idempotency`, `auth-token-refresh`, `api-error-shape`, `cli-output-format`.
- If multiple distinct topics, prefer the one the user spent most turns on or the one that produced a decision.
- Don't include the date in the slug (it's in the filename and the YAML).

## What you never do

- Never write entries for routine implementation with no branch point.
- Never invent rationale the user didn't state.
- Never write secrets, credentials, tokens, or PII into `.decision/`. If a transcript contains them, redact them in your summary.
- Never skip the filter rule in the interest of "being thorough." Signal density is the whole product.