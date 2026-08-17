#!/usr/bin/env bash
# supersedes-check.sh — list existing .decision/*.md entries by area
#
# Used by the decision-logger skill before writing a new entry, to check
# whether the current session supersedes, contradicts, or replaces an
# older decision in the same area.
#
# Usage:
#   ./supersedes-check.sh                  # list all entries, summary view
#   ./supersedes-check.sh <area>           # filter by area (e.g. "payments")
#   ./supersedes-check.sh <area> <date>    # only entries older than <date>
#
# Output: one line per file:
#   <date> | <area> | <slug> | <one-line summary> | <path> | <supersedes>

set -euo pipefail

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
DECISION_DIR="$REPO_ROOT/.decision"

if [ ! -d "$DECISION_DIR" ]; then
  exit 0
fi

AREA_FILTER="${1:-}"
DATE_FILTER="${2:-}"

# Find files, skip buffers, parse frontmatter, emit a one-line summary.
find "$DECISION_DIR" -maxdepth 1 -name '*.md' 2>/dev/null \
  | sort \
  | while read -r f; do
      # Extract frontmatter fields. Use awk for portability.
      DATE=$(awk '/^date:/{print $2; exit}' "$f")
      AREA=$(awk '/^area:/{print $2; exit}' "$f" | tr -d '[]')
      SLUG=$(basename "$f" .md)
      SUMMARY=$(awk '/^summary:/{sub(/^summary: */,""); print; exit}' "$f")
      SUPERSEDES=$(awk '/^supersedes:/{print $2; exit}' "$f")

      # Filter by area if requested (loose match)
      if [ -n "$AREA_FILTER" ]; then
        case "$AREA" in
          *"$AREA_FILTER"*) ;;
          *) continue ;;
        esac
      fi

      # Filter by date if requested (only entries older than)
      if [ -n "$DATE_FILTER" ] && [ -n "$DATE" ]; then
        if [ "$DATE" \> "$DATE_FILTER" ] 2>/dev/null; then
          continue
        fi
      fi

      printf '%s | %s | %s | %s | %s | %s\n' \
        "${DATE:-unknown}" "${AREA:-unknown}" "${SLUG:-unknown}" \
        "${SUMMARY:-}" "$f" "${SUPERSEDES:-null}"
  done

exit 0
