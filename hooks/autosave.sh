#!/usr/bin/env bash
# autosave.sh — cheap raw-buffer append, every turn
#
# Fired on UserPromptSubmit. No LLM call. Just appends the user's prompt
# to a per-session raw buffer so we never lose context even if the session
# is killed mid-flight (usage limit, crash, etc.).
#
# Cost: ~free. Single file append, no parsing.
#
# The buffer lives at .decision/.buffers/<session-id>.raw and is *not*
# committed to git — it's scratch. The next session-start sweep will
# either finalize it into a real .decision/*.md, or clean it up.

set -euo pipefail

HOOK_INPUT="$(cat)"

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

# Extract session id — same shapes as session-end.sh
SESSION_ID=$(printf '%s' "$HOOK_INPUT" \
  | grep -oE '"session[_-]?id"[[:space:]]*:[[:space:]]*"[^"]+"' \
  | head -1 \
  | sed -E 's/.*"([^"]+)"$/\1/' \
  || true)

if [ -z "${SESSION_ID:-}" ]; then
  SESSION_ID="unknown-$(date +%s)"
fi

# Extract the user prompt text. Shape varies — try a few common patterns.
# The hook payload typically includes the prompt as a string field.
PROMPT_TEXT=$(printf '%s' "$HOOK_INPUT" \
  | grep -oE '"prompt"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -1 \
  | sed -E 's/^"prompt"[[:space:]]*:[[:space:]]*"//' \
  | sed -E 's/"$//' \
  || true)

# Fallback: try "user_prompt" or "message"
if [ -z "$PROMPT_TEXT" ]; then
  PROMPT_TEXT=$(printf '%s' "$HOOK_INPUT" \
    | grep -oE '"user_prompt"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | head -1 \
    | sed -E 's/^"user_prompt"[[:space:]]*:[[:space:]]*"//' \
    | sed -E 's/"$//' \
    || true)
fi

# Nothing to append — exit clean
if [ -z "$PROMPT_TEXT" ]; then
  exit 0
fi

BUFFER_DIR="$REPO_ROOT/.decision/.buffers"
BUFFER_FILE="$BUFFER_DIR/${SESSION_ID}.raw"

mkdir -p "$BUFFER_DIR"

# Append with a separator. The "---\n" delimiter keeps prompt boundaries
# recoverable when the buffer is replayed by session-start sweep.
{
  printf -- '--- %s ---\n' "$(date -Iseconds 2>/dev/null || date)"
  printf '%s\n\n' "$PROMPT_TEXT"
} >> "$BUFFER_FILE"

# Best-effort: keep the buffer under ~1MB to avoid runaway disk use.
# If it grows past that, rotate (keep last 50%).
MAX_BYTES=1048576
if [ -f "$BUFFER_FILE" ]; then
  SIZE=$(wc -c < "$BUFFER_FILE" | tr -d ' ')
  if [ "$SIZE" -gt "$MAX_BYTES" ]; then
    TMP=$(mktemp)
    tail -c $((MAX_BYTES / 2)) "$BUFFER_FILE" > "$TMP"
    mv "$TMP" "$BUFFER_FILE"
  fi
fi

exit 0
