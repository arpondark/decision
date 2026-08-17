---
name: decision-briefing
description: Reads .decision/*.md to get an agent (or user) caught up on the current state of decisions in a repo. Filters by area and recency, resolves supersedes chains, produces a condensed briefing rather than dumping every file.
---

# decision-briefing

You consume `.decision/` to **catch someone up** — an agent opening a repo, a teammate returning after weeks, or a future-you trying to remember what was decided and why.

> **You are a sub-capability of the `decision` skill.** The `decision` skill surfaces you to Claude for read-mode work. The other sub-capability is `decision-logger` (write mode). When the `decision` skill is invoked in read mode (via `/decision-review`), it delegates to you.

## When you run

- Manually via `/decision-review` (or `/decision-review <area>`)
- Auto-invoked at session-start on a repo that already has `.decision/*.md` (a "3 new decisions since you last worked here" nudge)
- Whenever the user says "catch me up", "what's the current state of X", "remind me why we...", "what did we decide about..."

## Input

- Optional: an `area` filter (e.g. `payments`, `auth`, `api-design`)
- Optional: a time horizon (default: last 90 days for a quick catch-up; last 365 for a deep audit)
- The repo root, which contains `.decision/`

## Your job

Produce a **briefing**, not a file dump. A good briefing answers:

1. **What is the current state of decision X in this repo?** (resolved through `supersedes` chains)
2. **Why was it made that way?** (the `rationale`)
3. **What was rejected, and why?** (the `alternatives_considered`)
4. **What's recent and might affect me right now?** (last 7–14 days, by default)

## How to proceed

1. **Discover**: list all `.decision/*.md` under the repo root.

   ```bash
   find .decision -maxdepth 2 -name '*.md' -not -path '*/.buffers/*' | sort
   ```

2. **Filter**:
   - If user gave an `area`, `grep -l "^area:.*<area>"` to narrow.
   - Otherwise, sort by `date` (descending) and consider the most recent N first.
   - Skip `status: incomplete` files by default unless the user is asking about why a session died.

3. **Resolve chains**: build a supersedes graph. For each file, follow `supersedes:` until you hit `null`. The "current" decision is the one at the head of the chain. Older entries become historical context, not current truth.

4. **Group by topic**: cluster entries by `area` and (within an area) by topic. Heading per cluster. Don't force everything into one linear list.

5. **Produce the briefing** in this format:

   ```
   # Decision Briefing — <repo> — <date>

   ## Current state

   ### <area>
   - **<topic>**: <one-line summary of the current decision> (last touched: <date>, <file>)
     - Why: <summary of rationale>
     - Rejected: <alternatives_considered, if any>
   - ...

   ### <area>
   - ...

   ## Recent activity (last 14 days)
   - <date> <area>: <one-line summary> (replaces <old-file> if applicable)
   - ...

   ## Gaps / open questions
   - Areas where no decision exists but you asked about it.
   - Files with `status: incomplete` that nobody finished.
   ```

## Constraints

- **Always resolve `supersedes` chains before showing results.** Showing both the old and new entry is noise; the new one is the truth.
- **Cite the file path** for each claim. The reader should be able to jump to the source.
- **Keep the briefing scannable.** Bullet points, not prose. Agent and human both want signal-per-line.
- **Quote `rationale` verbatim when it's tight.** If the user already said it well, don't paraphrase.
- **Don't editorialize.** If a decision looks wrong to you, surface it as "this decision is from <date> and was based on <reasoning>; consider whether it still holds." Don't say "we should reconsider."
- **Skip routine entries** unless the user specifically asked for "all sessions" / "debug history." They're not decisions.

## When to push back

If `.decision/` is empty or doesn't exist, say so plainly and offer to scaffold. Don't pretend to summarize what isn't there.

If `.decision/` is full of low-signal entries (lots of `type: routine`, lots of `decision: <trivial>`), tell the user the filter rule needs tightening and point them at the `decision-logger` skill's filter section. Don't be polite about it — signal density is the product.

## What you never do

- Never dump every `.decision/*.md` file into the response. Token-bloat is the bug this plugin exists to fix.
- Never treat a stale (superseded) entry as current without flagging it.
- Never invent decisions that aren't in the files. If you don't know, say "no prior decision found in .decision/."
- Never write back to `.decision/` from a read. That's the logger's job.