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

function copyGlobalSkillsAndCommands() {
  // 1. Copy skills to ~/.claude/skills/ and ~/.agents/skills/
  const skillsSrc = path.join(PKG_ROOT, 'skills');
  if (fs.existsSync(skillsSrc)) {
    for (const item of fs.readdirSync(skillsSrc)) {
      const itemSrc = path.join(skillsSrc, item);
      if (fs.statSync(itemSrc).isDirectory()) {
        const destClaude = path.join(CLAUDE_SKILLS_ROOT, item);
        const destAgents = path.join(AGENTS_SKILLS_ROOT, item);
        rmrf(destClaude);
        rmrf(destAgents);
        copyDirSync(itemSrc, destClaude);
        copyDirSync(itemSrc, destAgents);
        console.log(`  - skill: ${item}`);
      }
    }
  }

  // 2. Copy commands to ~/.claude/commands/
  const commandsSrc = path.join(PKG_ROOT, 'commands');
  if (fs.existsSync(commandsSrc)) {
    fs.mkdirSync(CLAUDE_COMMANDS_ROOT, { recursive: true });
    for (const item of fs.readdirSync(commandsSrc)) {
      if (item.endsWith('.md')) {
        const fileSrc = path.join(commandsSrc, item);
        const fileDest = path.join(CLAUDE_COMMANDS_ROOT, item);
        fs.copyFileSync(fileSrc, fileDest);
        console.log(`  - command: /${item.replace(/\.md$/, '')}`);
      }
    }
  }
}

function status() {
  const marketplaceExists = fs.existsSync(MARKETPLACE_MANIFEST);
  const pluginExists = fs.existsSync(path.join(PLUGIN_DIR, '.claude-plugin', 'plugin.json'));
  const known = readJson(KNOWN_MARKETPLACES, {});
  const registered = !!known[MARKETPLACE_NAME];
  const mainSkillExists = fs.existsSync(path.join(CLAUDE_SKILLS_ROOT, 'decision', 'SKILL.md'));
  const mainCmdExists = fs.existsSync(path.join(CLAUDE_COMMANDS_ROOT, 'decision.md'));

  if (!marketplaceExists && !pluginExists && !registered && !mainSkillExists) {
    console.log(`decision: not installed`);
    return 1;
  }

  console.log(`decision: installed`);
  console.log(`  marketplace: ${marketplaceExists ? 'OK' : 'MISSING'} ${MARKETPLACE_DIR}`);
  console.log(`  plugin:      ${pluginExists ? 'OK' : 'MISSING'} ${PLUGIN_DIR}`);
  console.log(`  registered:  ${registered ? 'OK' : 'MISSING'} in known_marketplaces.json`);
  console.log(`  skills:      ${mainSkillExists ? 'OK' : 'MISSING'} in ${CLAUDE_SKILLS_ROOT}`);
  console.log(`  commands:    ${mainCmdExists ? 'OK' : 'MISSING'} in ${CLAUDE_COMMANDS_ROOT}`);
  if (!marketplaceExists || !pluginExists || !registered) return 1;
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
