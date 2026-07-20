import fs from 'node:fs';
import path from 'node:path';
import { AGENT_INSTRUCTIONS, CURSOR_INSTRUCTIONS } from '../agent-rules.js';
import { globalRoutingLines, missingGlobalHosts } from '../global-routing.js';
import { joinLines, result } from '../output.js';

const matchesGeneratedContent = (name, content) => (
  (name === 'AGENTS.md' || name === 'CLAUDE.md') ? content === AGENT_INSTRUCTIONS :
    name === '.cursor/rules/agentshell.mdc' ? content === CURSOR_INSTRUCTIONS : false
);

export async function run(root = '.', options = {}) {
  if (typeof options === 'boolean') options = { force: options };
  const { force = false, yes = false, noGlobal = false, home } = options;
  let routingLines = null;
  if (!noGlobal) {
    const missing = missingGlobalHosts(home);
    if (missing.length) {
      routingLines = await globalRoutingLines({ yes, home });
      if (routingLines[0].startsWith('global_agent_routing=installed')) return result(joinLines(routingLines));
    }
  }
  fs.mkdirSync(root, { recursive: true });
  const files = [
    ['AGENTS.md', AGENT_INSTRUCTIONS],
    ['CLAUDE.md', AGENT_INSTRUCTIONS],
    ['.cursor/rules/agentshell.mdc', CURSOR_INSTRUCTIONS],
  ];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const lines = [];
  for (const [name, content] of files) {
    const file = path.join(root, name);
    const exists = fs.existsSync(file);
    if (exists && !force) {
      skipped += 1;
      lines.push(`skip ${file}`);
      continue;
    }
    if (exists && force) {
      const current = fs.readFileSync(file, 'utf8');
      if (!matchesGeneratedContent(name, current)) {
        const backup = `${file}.bak`;
        fs.copyFileSync(file, backup);
        lines.push(`backup ${backup}`);
      }
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    exists ? updated += 1 : created += 1;
    lines.push(`${exists ? 'update' : 'create'} ${file}`);
  }
  lines.push(skipped ? 'suggestion=run "aish init --force" to refresh existing files' : 'suggestion=run "aish doctor"');
  lines.push(...(routingLines ?? await globalRoutingLines({ noGlobal, home })));
  return result(joinLines([`agent_rules=installed created=${created} updated=${updated} skipped=${skipped}`, ...lines]));
}
