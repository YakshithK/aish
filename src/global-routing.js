import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { CLAUDE_GLOBAL_INSTRUCTIONS, CLAUDE_GLOBAL_MARKER, CURSOR_INSTRUCTIONS, SKILL_INSTRUCTIONS } from './agent-rules.js';

export const HOSTS = ['claude', 'codex', 'cursor', 'opencode'];

const BASH_HOOK_COMMAND = 'aish-hook-bash';

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return {}; }
}

function hasBashHook(settings) {
  const entries = settings?.hooks?.PreToolUse ?? [];
  return entries.some((entry) => entry.matcher === 'Bash' &&
    entry.hooks?.some((hook) => hook.type === 'command' && hook.command === BASH_HOOK_COMMAND));
}

function installBashHook(filePath) {
  const settings = readJson(filePath);
  settings.hooks ??= {};
  settings.hooks.PreToolUse ??= [];
  if (hasBashHook(settings)) return;
  settings.hooks.PreToolUse.push({ matcher: 'Bash', hooks: [{ type: 'command', command: BASH_HOOK_COMMAND }] });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(settings, null, 2)}\n`);
}

function appendMarkedBlock(filePath, marker, block) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (existing.includes(marker)) return;
  const separator = !existing ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  fs.writeFileSync(filePath, `${existing}${separator}${block}`);
}

function writeInstall(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

export function installsFor(host, home = os.homedir()) {
  if (host === 'all') return HOSTS.flatMap((name) => installsFor(name, home));
  if (host === 'claude') {
    const claudeMdPath = path.join(home, '.claude', 'CLAUDE.md');
    const settingsPath = path.join(home, '.claude', 'settings.json');
    return [
      {
        host, path: claudeMdPath,
        present: () => fs.existsSync(claudeMdPath) && fs.readFileSync(claudeMdPath, 'utf8').includes(CLAUDE_GLOBAL_MARKER),
        install: () => appendMarkedBlock(claudeMdPath, CLAUDE_GLOBAL_MARKER, CLAUDE_GLOBAL_INSTRUCTIONS),
      },
      {
        host, path: settingsPath,
        present: () => hasBashHook(readJson(settingsPath)),
        install: () => installBashHook(settingsPath),
      },
    ];
  }
  const paths = {
    codex: ['.codex/skills/agentshell/SKILL.md', SKILL_INSTRUCTIONS],
    cursor: ['.cursor/rules/agentshell.mdc', CURSOR_INSTRUCTIONS],
    opencode: ['.config/opencode/skills/agentshell/SKILL.md', SKILL_INSTRUCTIONS],
  };
  if (!paths[host]) throw new Error(`unknown_host=${host}`);
  const filePath = path.join(home, paths[host][0]);
  const content = paths[host][1];
  return [{
    host, path: filePath, content,
    present: () => fs.existsSync(filePath),
    install: () => writeInstall(filePath, content),
  }];
}

export function missingGlobalHosts(home = os.homedir()) {
  return HOSTS.filter((host) => installsFor(host, home).some((install) => !install.present()));
}

export async function globalRoutingLines({ yes = false, noGlobal = false, home = os.homedir() } = {}) {
  if (noGlobal) {
    const missing = missingGlobalHosts(home);
    return [
      'global_agent_routing=skipped',
      `missing_global_hosts=${missing.join(',')}`,
      'note=repo_rules_installed_global_routing_skipped',
    ];
  }
  const missing = missingGlobalHosts(home);
  if (!missing.length) return ['global_agent_routing=ok missing=0'];
  if (yes || await confirmGlobalInstall(missing)) return installMissingGlobal(missing, home);
  return [
    'global_agent_routing=missing',
    `missing_global_hosts=${missing.join(',')}`,
    'suggestion=run "aish init --yes" to install global agent routing',
  ];
}

async function confirmGlobalInstall(missing) {
  if (!input.isTTY) return false;
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      `Global AgentShell routing is not installed for ${missing.join(', ')}. Install it now? [Y/n] `,
    );
    return ['', 'y', 'yes'].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

export function installMissingGlobal(missing, home = os.homedir()) {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const lines = [];
  for (const host of missing) {
    for (const install of installsFor(host, home)) {
      if (install.present()) {
        skipped += 1;
        lines.push(`skip global host=${host} path=${install.path}`);
        continue;
      }
      install.install();
      created += 1;
      lines.push(`create global host=${host} path=${install.path}`);
    }
  }
  return [
    `global_agent_routing=installed created=${created} updated=${updated} skipped=${skipped}`,
    ...lines,
    'suggestion=run "aish doctor --agents"',
  ];
}
