#!/usr/bin/env bash
# session-start.sh — sweep for orphaned/incomplete sessions from last run
#
# Fired on SessionStart (startup AND resume). Before the new session begins,
# scan .decision/.buffers/ for any leftover raw buffers or partial files
# from a prior session that was killed mid-flight. Run the decision-logger
# sub-skill of the decision skill in finishing-orphan mode to complete them.
#
# Also: if .decision/*.md exists and there's recent activity, surface a
# short "N decisions since you last worked here" nudge to the new session
# (the briefing-side logic, lightweight version).

set -euo pipefail

HOOK_INPUT="$(cat)"

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

DECISION_DIR="$REPO_ROOT/.decision"
BUFFER_DIR="$DECISION_DIR/.buffers"

# If .decision/ doesn't exist, nothing to sweep or nudge.
if [ ! -d "$DECISION_DIR" ]; then
  exit 0
fi

# --- Phase 1: sweep orphan buffers ---
if [ -d "$BUFFER_DIR" ]; then
  # Find any raw buffer files that have content
  ORPHANS=$(find "$BUFFER_DIR" -name '*.raw' -size +0c 2>/dev/null || true)

  if [ -n "$ORPHANS" ] && command -v claude >/dev/null 2>&1; then
    for BUFFER in $ORPHANS; do
      SESSION_ID=$(basename "$BUFFER" .raw)
      PARTIAL="$BUFFER_DIR/${SESSION_ID}.md"

      PROMPT="Run the decision-logger sub-skill of the decision skill in finishing-orphan mode.

Session id: $SESSION_ID
Repo root: $REPO_ROOT
Decision dir: $DECISION_DIR
Raw autosave buffer: $BUFFER
Prior partial file: $PARTIAL (may not exist)
Status: finishing-orphan

If the buffer is empty or contains no decision-shaped content, write a minimal entry with summary: 'Session killed before any content was captured.' and status: complete, then exit.
Otherwise apply the filter rule and complete the entry normally."

      timeout 80 claude -p "$PROMPT" || {
        echo "decision: orphan sweep failed for $SESSION_ID; leaving buffer for next sweep" >&2
        continue
      }

      # On success, remove the raw buffer (keep the partial .md; on next pass
      # the orphan should be gone).
      rm -f "$BUFFER"
    done
  fi
fi

# --- Phase 2: lightweight briefing nudge ---
# Only if there's at least one .decision/*.md and recent activity.
RECENT_COUNT=$(find "$DECISION_DIR" -maxdepth 1 -name '*.md' -mtime -14 2>/dev/null | wc -l | tr -d ' ')
TOTAL_COUNT=$(find "$DECISION_DIR" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')

if [ "$TOTAL_COUNT" -gt 0 ] && [ "$RECENT_COUNT" -gt 0 ]; then
  # Output a single line for the new session to see. Goes to stdout so the
  # hook contract picks it up; the agent will surface it as context.
  echo "decision: $RECENT_COUNT new decisions in the last 14 days. Run /decision-review to catch up."
elif [ "$TOTAL_COUNT" -gt 0 ]; then
  echo "decision: $TOTAL_COUNT decisions recorded. Run /decision-review when you want context."
fi

exit 0
