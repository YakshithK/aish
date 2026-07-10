export const ROUTING_TABLE=`| Need | Prefer | Avoid |
|---|---|---|
| inspect project structure | \`aish tree\` | \`tree\`, \`find .\`, \`ls -R\` |
| read a file | \`aish view <file>\` | \`cat <file>\` |
| read exact lines | \`aish view <file>:<start>-<end>\` | dumping whole files |
| search code | \`aish search "<query>"\` | raw \`grep -R\`, huge \`rg\` output |
| git state | \`aish status\` | verbose \`git status\` |
| inspect changes | \`aish diff\` or \`aish diff <file>\` | raw \`git diff\` |
| tests | \`aish test -- <command>\` | raw noisy test logs |
| builds/install | \`aish build -- <command>\` | raw build logs |`;
export const AGENT_INSTRUCTIONS=`# AgentShell Instructions

For repository inspection, prefer AgentShell commands before raw shell commands.

## Routing

${ROUTING_TABLE}

Principle: summary first, details only when needed.
Preserve exact paths, line numbers, commands, exit codes, and error names from \`aish\` output.
`;
export const CURSOR_INSTRUCTIONS=`---
description: Prefer AgentShell compact terminal observations
globs:
  - "**/*"
alwaysApply: true
---

# AgentShell

${AGENT_INSTRUCTIONS}`;
export const SKILL_INSTRUCTIONS=`---
name: agentshell
description: Use AgentShell when inspecting, debugging, reviewing, or modifying a codebase so terminal observations stay compact and exact.
---

${AGENT_INSTRUCTIONS}`;
