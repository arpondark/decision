#!/usr/bin/env bash
# pre-compact.sh — incremental real summarization when context is about to compact
#
# Fired on PreCompact. Runs ONE cheap LLM call to update the .decision/*.md
# entry for this session in place with what we know so far. This is the
# "if the session dies mid-flight, we still have a real summary" insurance.
#
# Stays incremental: appends/refines the existing file rather than rewriting
# from scratch. If the session is short and nothing decision-shaped has
# happened yet, we don't create a file — the next session-end has more context.

set -euo pipefail

HOOK_INPUT="$(cat)"

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

SESSION_ID=$(printf '%s' "$HOOK_INPUT" \
  | grep -oE '"session[_-]?id"[[:space:]]*:[[:space:]]*"[^"]+"' \
  | head -1 \
  | sed -E 's/.*"([^"]+)"$/\1/' \
  || true)

if [ -z "${SESSION_ID:-}" ]; then
  SESSION_ID="unknown-$(date +%s)"
fi

TRANSCRIPT=""
CANDIDATE_DIR="${HOME}/.claude/projects"
if [ -d "$CANDIDATE_DIR" ]; then
  TRANSCRIPT=$(find "$CANDIDATE_DIR" -name "${SESSION_ID}.jsonl" 2>/dev/null | head -1 || true)
fi

DECISION_DIR="$REPO_ROOT/.decision"
BUFFER_FILE="$DECISION_DIR/.buffers/${SESSION_ID}.raw"
SESSION_PARTIAL="$DECISION_DIR/.buffers/${SESSION_ID}.md"

# Skip if claude isn't available — we don't want a broken hook to block compaction.
if ! command -v claude >/dev/null 2>&1; then
  echo "decision-log: claude CLI not found; skipping pre-compact incremental save" >&2
  exit 0
fi

PROMPT="Run the decision-logger skill in incremental mode for this session.

Session id: $SESSION_ID
Repo root: $REPO_ROOT
Decision dir: $DECISION_DIR
Transcript: $TRANSCRIPT
Raw autosave buffer: $BUFFER_FILE
Prior partial file: $SESSION_PARTIAL (may not exist yet)
Status: incremental (PreCompact fired)

Behavior:
- If a partial file exists (matching session_id), update it in place — append/refine the 'What happened' and 'Context' sections, do NOT start over.
- If no partial file exists and the session is short (<5 turns or no decision-shaped content), do NOT create a file. Output 'decision-logger: skip' and exit.
- If no partial file exists but turns since session start ARE decision-shaped, create a new file with status: incomplete (the session-end will mark it complete).
- Otherwise output 'decision-logger: wrote <path>' or 'decision-logger: updated <path>'."

# Soft timeout; hard cap is in hooks.json.
timeout 80 claude -p "$PROMPT" || {
  echo "decision-log: pre-compact incremental save failed or timed out; buffer preserved at $BUFFER_FILE" >&2
  exit 0
}

exit 0
