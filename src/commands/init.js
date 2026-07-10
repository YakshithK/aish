import fs from 'node:fs';
import path from 'node:path';
import { AGENT_INSTRUCTIONS, CURSOR_INSTRUCTIONS } from '../agent-rules.js';
import { globalRoutingLines } from '../global-routing.js';
import { joinLines, result } from '../output.js';

export async function run(root = '.', options = {}) {
  if (typeof options === 'boolean') options = { force: options };
  const { force = false, yes = false, noGlobal = false, home } = options;
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
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    exists ? updated += 1 : created += 1;
    lines.push(`${exists ? 'update' : 'create'} ${file}`);
  }
  lines.push(skipped ? 'suggestion=run "aish init --force" to refresh existing files' : 'suggestion=run "aish doctor"');
  lines.push(...await globalRoutingLines({ yes, noGlobal, home }));
  return result(joinLines([`agent_rules=installed created=${created} updated=${updated} skipped=${skipped}`, ...lines]));
}
