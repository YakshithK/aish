import { classifyCommand, matchCompoundCommand } from './command-router.js';
import { quoteCommand } from './output.js';

// Shell metacharacters mean the string isn't a single simple invocation
// (pipes, chaining, redirection, substitution, quoting). Rewriting those
// safely would require a real shell parser, so anything with one of these
// is left untouched rather than guessed at.
const SHELL_METACHARACTERS = /[|;&<>$`'"\\]/u;

// Only these two classifyCommand families are rewritten automatically.
// `logs` and `http` commands are frequently long-running/streaming
// (`docker logs -f`, a slow endpoint) and `aish run` applies a timeout,
// so auto-wrapping them could kill a command that was meant to keep going.
const AUTO_WRAP_FAMILIES = new Set(['test', 'build']);

function tokenize(command) {
  return command.trim().split(/\s+/u).filter(Boolean);
}

// Given a PreToolUse hook payload for the Bash tool, returns the aish
// command string to substitute, or null if the command should run unchanged.
export function computeRewrite(payload) {
  if (payload?.tool_name !== 'Bash') return null;
  const command = payload?.tool_input?.command;
  if (typeof command !== 'string' || !command.trim()) return null;
  if (SHELL_METACHARACTERS.test(command)) return null;

  const argv = tokenize(command);
  if (!argv.length) return null;

  const compound = matchCompoundCommand(argv);
  if (compound) return quoteCommand(['aish', ...compound]);

  const family = classifyCommand(argv);
  if (AUTO_WRAP_FAMILIES.has(family)) return quoteCommand(['aish', 'run', '--', ...argv]);

  return null;
}

export function handlePayload(payload) {
  const updatedCommand = computeRewrite(payload);
  if (!updatedCommand) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      updatedInput: { command: updatedCommand },
    },
  };
}
