import { classifyCommand } from './command-router.js';
import { getParser, hasParser, parserRegistry } from './parsers/index.js';
import { parse as parseGeneric } from './parsers/generic.js';
import { runCommand } from './subprocess.js';
import { joinLines, quoteCommand, result, truncateValue } from './output.js';

export const ARBITRARY_TIMEOUT_DEFAULT = 30;
const EVIDENCE_LIMIT = 12;

export async function observeCommand(argv, { family, timeoutSeconds = ARBITRARY_TIMEOUT_DEFAULT, executor = runCommand, parserRegistry: registry = parserRegistry, ...executorOptions } = {}) {
  if (!argv.length) throw new TypeError('observeCommand requires non-empty argv');
  const selected = hasParser(family) ? family : classifyCommand(argv);
  const command = quoteCommand(argv);
  const execution = await executor(argv, { ...executorOptions, timeout: timeoutSeconds });
  if (execution.missing) return result(joinLines([
    `status=error exit=127 family=${selected} command="${command}"`, execution.stderr,
  ]), '', 127);
  if (execution.timedOut) return result(joinLines([
    `status=timeout exit=124 timeout=true family=${selected} command="${command}"`,
    ...usefulLines(execution.interleaved || `${execution.stdout}\n${execution.stderr}`).slice(-EVIDENCE_LIMIT).map(line => `TAIL ${truncateValue(line)}`),
    `truncated=${Boolean(execution.truncated)}`,
  ]), '', 124);
  const input = { argv, ...execution, command, family: selected, truncated: Boolean(execution.truncated) };
  try { return getParser(selected, registry)(input); }
  catch { return parseGeneric(input); }
}

const noise = line => /^[.=#* -]+$/u.test(line) || /^\[\d+\/\d+\]|^\d+(?:\.\d+)?%/u.test(line) || /^(Downloading |Installing |Collecting |Requirement already satisfied)/u.test(line);
const usefulLines = output => output.split('\n').map(line => line.trim()).filter(line => line && !noise(line));
