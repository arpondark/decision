#!/usr/bin/env bash
# session-end.sh — clean-close path
#
# Fired on SessionEnd. Invokes the decision-logger skill to do a full
# filter+summarize pass on the session transcript, writes the .decision/*.md
# entry, and marks status: complete.
#
# This is the "happy path" — relies on the session having a clean transcript
# available. The autosave+PreCompact+sweep layers (session-start.sh, pre-compact.sh,
# autosave.sh) cover the killed-mid-flight case.

set -euo pipefail

# Read the hook input from stdin (Claude Code passes JSON describing the event)
HOOK_INPUT="$(cat)"

# Resolve repo root. Prefer the env var Claude Code sets; fall back to git.
REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

# Extract session id from the hook input. Accept several common JSON shapes.
SESSION_ID=$(printf '%s' "$HOOK_INPUT" \
  | grep -oE '"session[_-]?id"[[:space:]]*:[[:space:]]*"[^"]+"' \
  | head -1 \
  | sed -E 's/.*"([^"]+)"$/\1/' \
  || true)

if [ -z "${SESSION_ID:-}" ]; then
  SESSION_ID="unknown-$(date +%s)"
fi

# Find the transcript path. Claude Code typically stores it at:
#   ~/.claude/projects/<encoded-cwd>/<session-id>.jsonl
TRANSCRIPT=""
CANDIDATE_DIR="${HOME}/.claude/projects"
if [ -d "$CANDIDATE_DIR" ]; then
  TRANSCRIPT=$(find "$CANDIDATE_DIR" -name "${SESSION_ID}.jsonl" 2>/dev/null | head -1 || true)
fi

# Locate the raw autosave buffer (if autosave.sh has been running this session)
DECISION_DIR="$REPO_ROOT/.decision"
BUFFER_FILE="$DECISION_DIR/.buffers/${SESSION_ID}.raw"
SESSION_PARTIAL="$DECISION_DIR/.buffers/${SESSION_ID}.md"

# Build the prompt for the decision-logger skill
PROMPT="Run the decision-logger skill in finalize mode for this session.

Session id: $SESSION_ID
Repo root: $REPO_ROOT
Decision dir: $DECISION_DIR
Transcript: $TRANSCRIPT
Raw autosave buffer: $BUFFER_FILE
Prior partial file: $SESSION_PARTIAL
Status: complete (clean session-end)

If the transcript file does not exist, fall back to reading the raw buffer at \$BUFFER_FILE. If neither exists, write a minimal entry with summary: 'Session ended before any content was captured.' and exit.

Apply the filter rule strictly. If nothing decision-shaped happened, do NOT write a file. Output a single line: 'decision-logger: skip' and exit.

Otherwise write the file and output: 'decision-logger: wrote <path-to-file>'."

# Invoke Claude headless to run the skill. -p / --print is non-interactive.
# If `claude` is not on PATH, skip silently — we don't want a broken hook to break sessions.
if ! command -v claude >/dev/null 2>&1; then
  echo "decision-log: claude CLI not found on PATH; skipping session-end summary" >&2
  exit 0
fi

# Soft timeout; the hard cap is set in hooks.json.
timeout 100 claude -p "$PROMPT" || {
  echo "decision-log: claude -p failed or timed out; raw buffer preserved at $BUFFER_FILE for next sweep" >&2
  exit 0
}

exit 0
