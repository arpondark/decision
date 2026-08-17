#!/usr/bin/env node
/**
 * install.js — runs automatically after `npm install -g @arpon007/decision`.
 *
 * Copies the plugin's .claude-plugin/, hooks/, skills/, and commands/ dirs into
 * ~/.claude/plugins/decision/ so Claude Code picks them up.
 *
 * Cross-platform: works on Windows, macOS, Linux, WSL, Git Bash.
 *
 * Modes:
 *   node bin/install.js          # copy files (default; npm postinstall calls this)
 *   node bin/install.js update   # same as copy (for `decision update`)
 *   node bin/install.js uninstall # remove the install
 *   node bin/install.js status   # print install state, exit 0 if present
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const PKG_ROOT = path.resolve(__dirname, '..');
const MODE = (process.argv[2] || 'install').toLowerCase();

// Resolve ~/.claude/plugins/decision regardless of platform.
function homeDir() {
  // Respect USERPROFILE on Windows; fall back to HOME (Git Bash, Linux, macOS).
  return process.env.USERPROFILE || process.env.HOME || os.homedir();
}

const TARGET = path.join(homeDir(), '.claude', 'plugins', 'decision');

const SUBDIRS = ['.claude-plugin', 'hooks', 'skills', 'commands'];

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(s, d);
    } else if (entry.isFile()) {
      // Preserve executable bit on .sh files when possible.
      const data = fs.readFileSync(s);
      fs.writeFileSync(d, data);
      try {
        if (entry.name.endsWith('.sh')) {
          fs.chmodSync(d, 0o755);
        }
      } catch (_) {
        // chmod can fail on Windows; ignore.
      }
    }
  }
}

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function status() {
  const exists = fs.existsSync(TARGET);
  const pluginJson = path.join(TARGET, '.claude-plugin', 'plugin.json');
  const hasPlugin = fs.existsSync(pluginJson);
  if (!exists) {
    console.log(`decision: not installed (${TARGET} does not exist)`);
    return 1;
  }
  if (!hasPlugin) {
    console.log(`decision: ${TARGET} exists but is missing .claude-plugin/plugin.json — re-run install`);
    return 1;
  }
  console.log(`decision: installed at ${TARGET}`);
  return 0;
}

function install() {
  console.log(`decision: installing to ${TARGET}`);
  fs.mkdirSync(TARGET, { recursive: true });
  for (const sub of SUBDIRS) {
    const src = path.join(PKG_ROOT, sub);
    if (!fs.existsSync(src)) {
      console.warn(`decision: skipping ${sub} (not found in package)`);
      continue;
    }
    const dest = path.join(TARGET, sub);
    rmrf(dest); // overwrite cleanly
    copyDirSync(src, dest);
    console.log(`  - ${sub}/`);
  }
  console.log(`\ndecision: done. Restart Claude Code and run /decision-review to verify.\n` +
             `         To uninstall: npm uninstall -g @arpon007/decision`);
}

function uninstall() {
  if (!fs.existsSync(TARGET)) {
    console.log(`decision: not installed (nothing to remove)`);
    return 0;
  }
  console.log(`decision: removing ${TARGET}`);
  rmrf(TARGET);
  console.log(`decision: done`);
  return 0;
}

try {
  let code = 0;
  switch (MODE) {
    case 'install':
    case 'update':
      install();
      break;
    case 'uninstall':
    case 'remove':
      code = uninstall();
      break;
    case 'status':
      code = status();
      break;
    case 'help':
    case '--help':
    case '-h':
      console.log('Usage: decision [install|update|uninstall|status]');
      code = 0;
      break;
    default:
      console.error(`decision: unknown mode "${MODE}". Try install | update | uninstall | status`);
      code = 2;
  }
  process.exit(code);
} catch (err) {
  console.error(`decision: install failed: ${err.message}`);
  // Don't fail npm install on a copy error — the user can re-run manually.
  // Exit 0 so `npm install -g` doesn't bail.
  process.exit(0);
}