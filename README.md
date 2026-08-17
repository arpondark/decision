# decision

A Claude Code & AI Agent **skill named `decision`** that automatically captures **why** decisions were made during sessions — sourced from user prompts, not commit diffs — so any agent (yours or a teammate's) can get caught up without re-reading history or re-deriving context that already exists.

Run `/decision` or `/decision-review` to read. Hooks to write. Filter is strict: only decision-shaped sessions leave a trace.

The public skill name is **`decision`**. Inside it, the skill dispatches to two named sub-capabilities:

- **`decision-logger`** — write mode (capture).
- **`decision-briefing`** — read mode (briefing).

Available slash commands:
- `/decision` — main command (read briefing or log decision)
- `/decision-review` — read decision briefing
- `/decision-logger` — force capture session decisions
- `/decision-briefing` — read decision briefing

Works with **Claude Code** (full hook support), **skills.sh** (`npx skills add arpondark/decision`), **Cursor** (real hooks), and degrades gracefully to other AI IDEs via rules + slash commands.

---

## Table of contents

- [Install via skills.sh](#install-via-skillssh-recommended) — works with Claude Code, Cursor, Antigravity, & all skills.sh agents
- [Install in Claude Code](#install-in-claude-code) — npm registry & standalone options
- [Install in Cursor](#install-in-cursor) — real hooks on sessionStart / preCompact / etc.
- [Install in other AI IDEs](#install-in-other-ai-ides) — Windsurf, Continue, Cline, Aider, Antigravity
- [Verify it worked](#verify-it-worked)
- [After install: use it](#after-install-use-it)
- [How it works](#how-it-works)
- [The filter rule](#the-filter-rule)
- [The schema](#the-schema)
- [Layout](#layout)
- [License](#license)

---

## Install via skills.sh (Recommended)

You can install this skill directly using the `skills.sh` CLI into any supported AI agent:

```bash
npx skills add arpondark/decision
```

Or for Claude Code specifically:

```bash
npx skills add arpondark/decision -a claude-code -g
```

---

## Install in Claude Code

Pick **one** of the install methods below. They all set up the plugin, skills, and slash commands in `~/.claude/` so Claude Code picks them up automatically.

### Method 1 — npm registry

One command. The package's `postinstall` script registers the plugin, skills, and slash commands (`/decision`, `/decision-review`, etc.) for you.

```bash
npm install -g @arpon007/decision
```

That's it. Restart Claude Code and run `/decision`.

> **Note:** the npm package name is `@arpon007/decision` (scoped, because plain `decision` is taken on npm). The skill itself is still called **`decision`** — the scope is just npm's namespace. If you fork and re-publish under your own scope, replace `@arpon007` with yours.

The install also exposes a `decision` CLI for later:

```bash
decision          # re-run install (alias for `decision install`)
decision status   # show install path and confirm it's wired up
decision update   # re-copy files from the latest package into ~/.claude/plugins/decision/
decision uninstall
```

#### As a project-scoped dep instead

If you'd rather not install globally (e.g. for a CI runner or to pin a version per repo):

```bash
# In your repo root
npm install @arpon007/decision
node node_modules/@arpon007/decision/bin/install.js
```

The same script copies files into `~/.claude/plugins/decision/`.

### Method 2 — directly from GitHub (no npm publish required)

```bash
# Pin to a tag (best — reproducible)
npm install -g "github:arpondark/decision#v0.1.0"

# Or, if you don't have npm package metadata and just want the files:
mkdir -p ~/.claude/plugins/decision
git clone --depth 1 --branch v0.1.0 https://github.com/arpondark/decision.git /tmp/decision
cp -r /tmp/decision/.claude-plugin ~/.claude/plugins/decision/
cp -r /tmp/decision/{hooks,skills,commands} ~/.claude/plugins/decision/
rm -rf /tmp/decision
```

Tip: replace `v0.1.0` with `main` if you want the bleeding edge.

### Method 3 — git clone and symlink (live updates)

If you'll be iterating on the plugin locally and want `git pull` to update your install:

```bash
git clone https://github.com/arpondark/decision.git ~/decision
mkdir -p ~/.claude/plugins/decision
ln -s ~/decision/.claude-plugin ~/.claude/plugins/decision/.claude-plugin
ln -s ~/decision/hooks ~/.claude/plugins/decision/hooks
ln -s ~/decision/skills ~/.claude/plugins/decision/skills
ln -s ~/decision/commands ~/.claude/plugins/decision/commands
```

Now `cd ~/decision && git pull` updates your Claude install.

---

## Install in Cursor

Cursor has first-class hooks (via `~/.cursor/hooks.json`) that run on the same lifecycle events Claude Code uses (`sessionStart`, `beforeSubmitPrompt`, `stop`, etc.). This is the closest non-Claude Code experience to the full plugin.

### One-shot install

```bash
# macOS / Linux
git clone https://github.com/arpondark/decision.git ~/.cursor/decision
mkdir -p ~/.cursor/rules ~/.cursor/hooks
cp -r ~/.cursor/decision/skills/decision ~/.cursor/rules/decision
cp -r ~/.cursor/decision/skills/decision-logger ~/.cursor/rules/decision-logger
cp -r ~/.cursor/decision/skills/decision-briefing ~/.cursor/rules/decision-briefing
```

Then create `~/.cursor/hooks.json` (or merge into your existing one):

```json
{
  "hooks": {
    "sessionStart": [
      {
        "command": "bash $HOME/.cursor/decision/hooks/session-start.sh",
        "async": false
      }
    ],
    "beforeSubmitPrompt": [
      {
        "command": "bash $HOME/.cursor/decision/hooks/autosave.sh",
        "async": true
      }
    ],
    "stop": [
      {
        "command": "bash $HOME/.cursor/decision/hooks/session-end.sh",
        "async": false
      }
    ]
  }
}
```

Restart Cursor. The `decision` skill is auto-loadable as an agent.

### Windows caveat

Cursor's default shell on Windows is PowerShell, not bash. You have two options:

1. **Recommended:** install [Git for Windows](https://git-scm.com/download/win) so `bash.exe` is on `PATH`, then set Cursor's shell to Git Bash (Settings → Shell → Bash Path).
2. **Or:** ship a `.cmd` shim next to each `.sh` and call the shim from `hooks.json`. Create `~/.cursor/decision/hooks/session-start.cmd` containing:

   ```cmd
   @echo off
   bash "%~dp0session-start.sh" %*
   ```

   …and reference `session-start.cmd` instead of `.sh` in `hooks.json`.

### Bridging the slash command

Cursor doesn't load Claude-Code-style command files from `commands/`, but rules can supply the same prompt. Drop this into `~/.cursor/rules/decision-review.mdc`:

```markdown
---
description: Read the captured decision log for the current repo and surface anything decision-shaped.
globs:
alwaysApply: false
---

# decision-review

When the user types `/decision-review` (or asks you to "review decisions", "catch me up on decisions", "what did we decide about X"), run the briefing from the `decision` skill files in `~/.cursor/rules/decision/`.
```

---

## Install in other AI IDEs

The plugin's heartbeat is bash hooks fired on session lifecycle events. Not every IDE exposes that. The level of fidelity you get depends on the IDE:

| IDE | Hooks? | What you get | Install path |
|---|---|---|---|
| **Claude Code** | ✅ Full | Hooks + slash command + skills | `~/.claude/plugins/decision/` |
| **Cursor** | ✅ Full | Hooks + rules + slash-equivalent | `~/.cursor/hooks.json` + `~/.cursor/rules/` |
| **Windsurf** | ⚠️ Workflows only | Manual / auto-triggered workflow + global rules | `~/.codeium/windsurf/memories/` + `.windsurf/workflows/` |
| **Continue** | ❌ Rules only | Rule + slash command | `~/.continue/rules/` |
| **Cline** | ❌ Rules only | Per-project `.clinerules` | `<repo>/.clinerules` |
| **Aider** | ❌ Rules only | Per-project `CONVENTIONS.md` | `<repo>/CONVENTIONS.md` |
| **Antigravity** | ❓ Unverified | If present, follows Codeium pattern | `~/.codeium/` (see below) |

### Windsurf

Windsurf has user-global rules and per-project workflows. There are no lifecycle hooks, but a workflow with `auto_execution_mode: 3` runs the recording on Cascade turns.

1. Install the global rule:

   ```bash
   mkdir -p ~/.codeium/windsurf/memories
   git clone --depth 1 https://github.com/arpondark/decision.git /tmp/decision
   cp /tmp/decision/skills/decision/SKILL.md ~/.codeium/windsurf/memories/decision.md
   cp /tmp/decision/skills/decision-logger/SKILL.md ~/.codeium/windsurf/memories/decision-logger.md
   cp /tmp/decision/skills/decision-briefing/SKILL.md ~/.codeium/windsurf/memories/decision-briefing.md
   rm -rf /tmp/decision
   ```

2. Inside any repo where you want the plugin active, create `.windsurf/workflows/decision-review.md`:

   ```markdown
   ---
   description: Review the captured decisions for this repo.
   auto_execution_mode: 0
   ---

   Read `.decision/` at the repo root and produce a briefing of the most recent decision-shaped entries. Quote the user rationale verbatim when present.
   ```

   For automatic capture, set `auto_execution_mode: 3` (full auto) and prefix the body with: *"At the end of every turn, run `bash <plugin>/hooks/autosave.sh` against the current session buffer."*

### Continue

Continue loads user-global rules from `~/.continue/rules/` and slash commands from `config.yaml`.

```bash
mkdir -p ~/.continue/rules
git clone --depth 1 https://github.com/arpondark/decision.git /tmp/decision
cp -r /tmp/decision/skills/decision ~/.continue/rules/decision
cp -r /tmp/decision/skills/decision-logger ~/.continue/rules/decision-logger
cp -r /tmp/decision/skills/decision-briefing ~/.continue/rules/decision-briefing
rm -rf /tmp/decision
```

Then add a slash command to `~/.continue/config.yaml`:

```yaml
commands:
  - name: decision-review
    description: Surface the captured decision log for the current repo
    prompt: |
      Open .decision/ at the repo root and produce a briefing of every
      decision-shaped entry. Quote the user rationale verbatim when present.
```

There are no lifecycle hooks in Continue, so capture is **manual** — invoke `/decision-review` after a session to have the agent write its own entry.

### Cline

Cline reads `.clinerules` from the workspace root. Copy the skill into each repo you want it active in:

```bash
# In the repo where you want decisions captured
git clone --depth 1 https://github.com/arpondark/decision.git /tmp/decision
mkdir -p .clinerules
cp /tmp/decision/skills/decision/SKILL.md .clinerules/decision.md
cp /tmp/decision/skills/decision-logger/SKILL.md .clinerules/decision-logger.md
cp /tmp/decision/skills/decision-briefing/SKILL.md .clinerules/decision-briefing.md
rm -rf /tmp/decision
```

Cline has no hook system, so capture is **manual**: ask Cline to *"log this decision"* and it will write `.decision/<date>-<slug>.md` per the skill body.

### Aider

Aider reads `CONVENTIONS.md` (for git repos) or `AIDER.md` (no git) from the repo root. Drop a pointer in:

```bash
# In your repo
cat >> CONVENTIONS.md <<'EOF'

# Decision capture

When the user asks to "log this decision", "why did we decide X", or "review decisions",
consult the skill bodies at:
- https://github.com/arpondark/decision/tree/main/skills/decision           (entry point)
- https://github.com/arpondark/decision/tree/main/skills/decision-logger  (write mode)
- https://github.com/arpondark/decision/tree/main/skills/decision-briefing (read mode)

Write entries to `.decision/<date>-<slug>.md` and run `/decision-review` to surface the log.
EOF
```

Aider has no hook system and no global rules path. Capture is **manual** and **per-repo**.

### Antigravity

Antigravity is Codeium's agentic IDE. If you have it installed, the most likely install paths follow the same pattern as Windsurf:

```bash
# Try this and adjust if Antigravity uses a different directory
mkdir -p ~/.codeium/antigravity/memories ~/.codeium/antigravity/workflows ~/.codeium/antigravity/skills ~/.codeium/antigravity/hooks
git clone --depth 1 https://github.com/arpondark/decision.git /tmp/decision
cp /tmp/decision/skills/decision/SKILL.md ~/.codeium/antigravity/memories/decision.md
cp /tmp/decision/skills/decision-logger/SKILL.md ~/.codeium/antigravity/memories/decision-logger.md
cp /tmp/decision/skills/decision-briefing/SKILL.md ~/.codeium/antigravity/memories/decision-briefing.md
cp -r /tmp/decision/skills/* ~/.codeium/antigravity/skills/
cp -r /tmp/decision/hooks/* ~/.codeium/antigravity/hooks/
rm -rf /tmp/decision
```

> **Note:** Antigravity is a recent product and its exact skill/rules directory layout could not be verified at the time of writing. If the paths above don't match your install, check Antigravity's docs for where it looks for user-level skills/rules, then copy the same files there. PRs to update this section are welcome.

---

## Verify it worked

After installing in Claude Code, restart and run:

```
/decision-review
```

You should see a (possibly empty) briefing. If you see "decision: 0 decisions recorded" it's working — no decisions have been captured yet, just the framework is in place.

For Claude Code, you can also confirm the install by checking that all five hook files exist and that the three skills are present:

```bash
ls ~/.claude/plugins/decision/hooks/*.sh
# should print autosave.sh, pre-compact.sh, session-end.sh, session-start.sh, supersedes-check.sh
ls ~/.claude/plugins/decision/skills/
# should print: decision/  decision-logger/  decision-briefing/
```

For Cursor:

```bash
ls ~/.cursor/decision/hooks/*.sh
cat ~/.cursor/hooks.json
ls ~/.cursor/rules/decision/SKILL.md
```

For other IDEs, just confirm the rule/skill files are in the directory shown in the table above.

---

## After install: use it

For Claude Code, the hooks fire automatically:

- **Each turn:** raw buffer autosave (~free).
- **Before any `/compact`:** incremental summarize.
- **End of session:** full filter + final entry.
- **Start of next session:** sweep any unfinished entries, surface a brief nudge if there are new decisions.

For other IDEs, see the IDE-specific section — most require manual invocation.

### Read side (Claude Code)

```
/decision-review                          # all areas, current state
/decision-review payments                 # just payments
/decision-review auth --since 30d         # auth, last 30 days
/decision-review --all                    # include pre-superseded entries
```

For other IDEs, the equivalent command is whatever the IDE calls the rule/skill (see the install instructions above).

### Per-repo setup (one-time, in the repo where decisions will be written)

The skill writes entries to `.decision/<date>-<slug>.md` at the **repo root**. Add the buffer directory to `.gitignore` so scratch files don't leak:

```bash
echo ".decision/.buffers/" >> .gitignore
```

The `.decision/*.md` files themselves **should** be committed — that's how teammates (and their agents) inherit the context.

---

## Prerequisites

- **`bash`** — all hook scripts are bash; works on Linux, macOS, and Windows (Git Bash / WSL).
- **Node 18+** — only for the npm install methods (Claude Code's npm path) and to run Cursor's hooks.json config generator.
- **Claude Code** CLI on PATH — only if you want the full hook-driven experience. All other IDEs work without it.

---

## How it works

| Layer | Trigger | Cost | Does what |
|---|---|---|---|
| Raw buffer autosave | every turn | ~free, no LLM | Appends prompt to scratch file |
| Incremental summarize | `PreCompact` | 1 cheap LLM | Updates `.decision/*.md` in place |
| Finalize | `SessionEnd` (clean) | 1 LLM | Full filter + summarize, marks complete |
| Sweep | `SessionStart` (next) | conditional | Finishes any orphan `incomplete` files |

Killed mid-flight? The buffer survives. Next session sweeps it up.

---

## The filter rule (the whole point)

Only writes a substantive entry if something decision-shaped actually happened:

- An approach was chosen over a named alternative.
- A direction was explicitly rejected, with a reason given.
- The user stated a constraint, tradeoff, or "we prefer X because Y."
- A conclusion was reached after weighing options.
- A previous decision was reversed or superseded.

Routine debugging, typo fixes, pure implementation with no branch point → **no file**. Signal density over completeness.

---

## The schema

```yaml
session_id: <id>
date: YYYY-MM-DD
area: [payments, auth]
type: decision | exploration | routine
status: complete | incomplete
summary: "..."
decision: "..."
rationale: "..."     # quoted from user when possible
alternatives_considered: "..."
supersedes: <path to older .decision/*.md, or null>
```

Files live in `.decision/` at the repo root, committed to git. Buffers live in `.decision/.buffers/` (gitignored) — only the cleaned-up entries are shared.

---

## Layout

```
decision/
├── .claude-plugin/plugin.json
├── hooks/
│   ├── hooks.json
│   ├── autosave.sh
│   ├── pre-compact.sh
│   ├── session-end.sh
│   ├── session-start.sh
│   └── supersedes-check.sh
├── skills/
│   ├── decision/SKILL.md            # public entry-point skill (name: decision)
│   ├── decision-logger/SKILL.md     # write-mode sub-capability
│   └── decision-briefing/SKILL.md   # read-mode sub-capability
└── commands/decision-review.md
```

---

## License

MIT