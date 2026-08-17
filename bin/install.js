#!/usr/bin/env node
/**
 * install.js — runs automatically after `npm install -g @arpon007/decision`.
 *
 * Sets up the plugin so /decision, /decision-review, /decision-logger, /decision-briefing show up
 * as slash commands and skills in Claude Code and agent environments (skills.sh compatible):
 *
 *   1. Copies plugin files into ~/.claude/plugins/marketplaces/arpon007/plugins/decision/
 *   2. Copies skills into ~/.claude/skills/ and ~/.agents/skills/ for direct skill discovery.
 *   3. Copies commands into ~/.claude/commands/ for direct slash command availability.
 *   4. Registers marketplace & updates known_marketplaces.json and installed_plugins.json.
 *
 * Cross-platform: works on Windows, macOS, Linux, WSL, Git Bash.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const PKG_ROOT = path.resolve(__dirname, '..');
const MODE = (process.argv[2] || 'install').toLowerCase();

function homeDir() {
  return process.env.USERPROFILE || process.env.HOME || os.homedir();
}

const CLAUDE_ROOT = path.join(homeDir(), '.claude');
const PLUGINS_ROOT = path.join(CLAUDE_ROOT, 'plugins');
const CLAUDE_SKILLS_ROOT = path.join(CLAUDE_ROOT, 'skills');
const CLAUDE_COMMANDS_ROOT = path.join(CLAUDE_ROOT, 'commands');
const AGENTS_SKILLS_ROOT = path.join(homeDir(), '.agents', 'skills');

const MARKETPLACE_NAME = 'arpon007';
const MARKETPLACE_DIR = path.join(PLUGINS_ROOT, 'marketplaces', MARKETPLACE_NAME);
const MARKETPLACE_MANIFEST = path.join(MARKETPLACE_DIR, '.claude-plugin', 'marketplace.json');
const PLUGIN_DIR = path.join(MARKETPLACE_DIR, 'plugins', 'decision');
const KNOWN_MARKETPLACES = path.join(PLUGINS_ROOT, 'known_marketplaces.json');
const INSTALLED_PLUGINS = path.join(PLUGINS_ROOT, 'installed_plugins.json');

const PLUGIN_NAME = 'decision';
const PLUGIN_DESCRIPTION =
  'Captures *why* decisions were made during a session so any agent can get caught up without re-reading history. Run /decision to read or log.';
const PLUGIN_HOMEPAGE = 'https://github.com/arpondark/decision';
const PLUGIN_REPO = 'arpondark/decision';

const PLUGIN_SUBDIRS = ['.claude-plugin', 'hooks', 'skills', 'commands'];

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(s, d);
    } else if (entry.isFile()) {
      const data = fs.readFileSync(s);
      fs.writeFileSync(d, data);
      try {
        if (entry.name.endsWith('.sh')) {
          fs.chmodSync(d, 0o755);
        }
      } catch (_) {
        // ignore chmod errors on Windows
      }
    }
  }
}

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function windowsPath(p) {
  return p.split(path.sep).join('\\');
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeMarketplaceManifest() {
  const manifest = {
    $schema: 'https://anthropic.com/claude-code/marketplace.schema.json',
    name: MARKETPLACE_NAME,
    description: "Personal marketplace for arpondark's Claude Code plugins.",
    owner: { name: 'arpondark' },
    plugins: [
      {
        name: PLUGIN_NAME,
        description: PLUGIN_DESCRIPTION,
        author: { name: 'arpondark' },
        category: 'productivity',
        source: './plugins/' + PLUGIN_NAME,
        homepage: PLUGIN_HOMEPAGE,
      },
    ],
  };
  writeJson(MARKETPLACE_MANIFEST, manifest);
}

function registerMarketplace() {
  const known = readJson(KNOWN_MARKETPLACES, {});
  known[MARKETPLACE_NAME] = {
    source: {
      source: 'github',
      repo: PLUGIN_REPO,
    },
    installLocation: windowsPath(MARKETPLACE_DIR),
    lastUpdated: new Date().toISOString(),
  };
  writeJson(KNOWN_MARKETPLACES, known);
}

function registerInstalledPlugin() {
  const installed = readJson(INSTALLED_PLUGINS, { version: 2, plugins: {} });
  if (!installed.plugins) installed.plugins = {};
  
  const pluginKey = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;
  const pkgVersion = readJson(path.join(PKG_ROOT, 'package.json'), {}).version || '0.1.2';
  installed.plugins[pluginKey] = [
    {
      scope: 'user',
      installPath: windowsPath(PLUGIN_DIR),
      version: pkgVersion,
      installedAt: new Date().toISOString()
    }
  ];
  writeJson(INSTALLED_PLUGINS, installed);
}

function unregisterMarketplace() {
  const known = readJson(KNOWN_MARKETPLACES, {});
  if (known[MARKETPLACE_NAME]) {
    delete known[MARKETPLACE_NAME];
    writeJson(KNOWN_MARKETPLACES, known);
  }

  const installed = readJson(INSTALLED_PLUGINS, { version: 2, plugins: {} });
  const pluginKey = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;
  if (installed.plugins && installed.plugins[pluginKey]) {
    delete installed.plugins[pluginKey];
    writeJson(INSTALLED_PLUGINS, installed);
  }
}

function copyPluginFiles() {
  fs.mkdirSync(PLUGIN_DIR, { recursive: true });
  for (const sub of PLUGIN_SUBDIRS) {
    const src = path.join(PKG_ROOT, sub);
    if (!fs.existsSync(src)) {
      console.warn(`decision: skipping ${sub} (not found in package)`);
      continue;
    }
    const dest = path.join(PLUGIN_DIR, sub);
    rmrf(dest);
    copyDirSync(src, dest);
    console.log(`  - ${sub}/`);
  }
}

function configureCursorHooks() {
  const cursorDir = path.join(homeDir(), '.cursor');
  const cursorDecisionDir = path.join(cursorDir, 'decision');
  const cursorHooksFile = path.join(cursorDir, 'hooks.json');

  // Copy hooks to ~/.cursor/decision/hooks/
  const hooksSrc = path.join(PKG_ROOT, 'hooks');
  if (fs.existsSync(hooksSrc)) {
    copyDirSync(hooksSrc, path.join(cursorDecisionDir, 'hooks'));
  }

  // Merge into ~/.cursor/hooks.json
  const currentHooks = readJson(cursorHooksFile, { hooks: {} });
  if (!currentHooks.hooks) currentHooks.hooks = {};

  const isWindows = process.platform === 'win32';
  const shCmd = (script) => isWindows 
    ? `bash "${windowsPath(path.join(cursorDecisionDir, 'hooks', script))}"`
    : `bash "$HOME/.cursor/decision/hooks/${script}"`;

  const decisionHooks = {
    sessionStart: [{ command: shCmd('session-start.sh'), async: false }],
    beforeSubmitPrompt: [{ command: shCmd('autosave.sh'), async: true }],
    stop: [{ command: shCmd('session-end.sh'), async: false }]
  };

  for (const [event, items] of Object.entries(decisionHooks)) {
    if (!currentHooks.hooks[event]) {
      currentHooks.hooks[event] = [];
    }
    for (const item of items) {
      if (!currentHooks.hooks[event].some(h => h.command && h.command.includes('decision'))) {
        currentHooks.hooks[event].push(item);
      }
    }
  }

  writeJson(cursorHooksFile, currentHooks);
}

function copyGlobalSkillsAndCommands() {
  const skillRoots = [
    path.join(homeDir(), '.claude', 'skills'),
    path.join(homeDir(), '.gemini', 'config', 'skills'),
    path.join(homeDir(), '.agents', 'skills'),
    path.join(homeDir(), '.cline', 'skills'),
    path.join(homeDir(), '.roo', 'skills'),
  ];

  const commandRoots = [
    path.join(homeDir(), '.claude', 'commands'),
    path.join(homeDir(), '.gemini', 'config', 'rules'),
    path.join(homeDir(), '.cursor', 'rules'),
    path.join(homeDir(), '.windsurf', 'rules'),
    path.join(homeDir(), '.continue', 'prompts'),
    path.join(homeDir(), '.copilot', 'instructions'),
  ];

  // 1. Copy skills to all skill target roots
  const skillsSrc = path.join(PKG_ROOT, 'skills');
  if (fs.existsSync(skillsSrc)) {
    for (const item of fs.readdirSync(skillsSrc)) {
      const itemSrc = path.join(skillsSrc, item);
      if (fs.statSync(itemSrc).isDirectory()) {
        for (const root of skillRoots) {
          const dest = path.join(root, item);
          rmrf(dest);
          copyDirSync(itemSrc, dest);
        }
        // Also copy as Cursor rule directory
        const cursorDest = path.join(homeDir(), '.cursor', 'rules', item);
        rmrf(cursorDest);
        copyDirSync(itemSrc, cursorDest);

        console.log(`  - skill: ${item} -> synced across Claude, Antigravity, Cursor & Agents`);
      }
    }
  }

  // 2. Copy commands & rules to command roots
  const commandsSrc = path.join(PKG_ROOT, 'commands');
  if (fs.existsSync(commandsSrc)) {
    for (const root of commandRoots) {
      fs.mkdirSync(root, { recursive: true });
      for (const item of fs.readdirSync(commandsSrc)) {
        if (item.endsWith('.md')) {
          const fileSrc = path.join(commandsSrc, item);
          const fileDest = path.join(root, item);
          fs.copyFileSync(fileSrc, fileDest);
        }
      }
    }
    console.log(`  - slash commands & rules -> synced across Claude, Antigravity, Cursor, Windsurf, Continue, Copilot`);
  }

  // 3. Configure Cursor hooks
  try {
    configureCursorHooks();
    console.log(`  - cursor hooks -> configured in ~/.cursor/hooks.json`);
  } catch (_) {}
}

function status() {
  const marketplaceExists = fs.existsSync(MARKETPLACE_MANIFEST);
  const pluginExists = fs.existsSync(path.join(PLUGIN_DIR, '.claude-plugin', 'plugin.json'));
  const known = readJson(KNOWN_MARKETPLACES, {});
  const registered = !!known[MARKETPLACE_NAME];
  const claudeSkillExists = fs.existsSync(path.join(CLAUDE_SKILLS_ROOT, 'decision', 'SKILL.md'));
  const antigravitySkillExists = fs.existsSync(path.join(homeDir(), '.gemini', 'config', 'skills', 'decision', 'SKILL.md'));
  const cursorRuleExists = fs.existsSync(path.join(homeDir(), '.cursor', 'rules', 'decision', 'SKILL.md'));
  const agentsSkillExists = fs.existsSync(path.join(AGENTS_SKILLS_ROOT, 'decision', 'SKILL.md'));

  console.log(`decision: installed & synced across multi-agent environments`);
  console.log(`  Claude Code:  ${claudeSkillExists ? 'OK' : 'MISSING'} (${CLAUDE_SKILLS_ROOT})`);
  console.log(`  Antigravity:  ${antigravitySkillExists ? 'OK' : 'MISSING'} (~/.gemini/config/skills)`);
  console.log(`  Cursor:       ${cursorRuleExists ? 'OK' : 'MISSING'} (~/.cursor/rules)`);
  console.log(`  Agents Std:   ${agentsSkillExists ? 'OK' : 'MISSING'} (${AGENTS_SKILLS_ROOT})`);
  console.log(`  Marketplace:  ${registered ? 'OK' : 'MISSING'} (${MARKETPLACE_DIR})`);
  return 0;
}

function install() {
  console.log(`decision: installing to ${MARKETPLACE_DIR}`);

  // 1. Copy plugin files into the marketplace plugins dir.
  copyPluginFiles();

  // 2. Copy skills & commands to global agent directories.
  copyGlobalSkillsAndCommands();

  // 3. Write marketplace manifest.
  writeMarketplaceManifest();
  console.log(`  - marketplace.json`);

  // 4. Register marketplace & installed plugin.
  registerMarketplace();
  registerInstalledPlugin();
  console.log(`  - known_marketplaces.json & installed_plugins.json`);

  console.log(`\ndecision: done. Available slash commands:\n` +
              `  /decision\n` +
              `  /decision-review\n` +
              `  /decision-logger\n` +
              `  /decision-briefing\n`);
}

function uninstall() {
  if (fs.existsSync(MARKETPLACE_DIR)) {
    console.log(`decision: removing ${MARKETPLACE_DIR}`);
    rmrf(MARKETPLACE_DIR);
  }
  unregisterMarketplace();
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
  process.exit(0);
}
