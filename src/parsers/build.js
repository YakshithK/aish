import { joinLines, result, truncateValue } from '../output.js';
import { sanitizeTerminalText } from '../terminal.js';

const EVIDENCE_LIMIT = 12;
const noise = line => /^[.=#* -]+$/u.test(line) || /^\[\d+\/\d+\]|^\d+(?:\.\d+)?%/u.test(line) || /^(Downloading |Installing |Collecting |Requirement already satisfied)/u.test(line);
const usefulLines = output => output.split('\n').map(line => line.trim()).filter(line => line && !noise(line));
const buildTail = (output, count) => usefulLines(output).slice(-count).map(line => `TAIL ${truncateValue(line)}`);

export function parse(input) {
  const output = sanitizeTerminalText(`${input.stdout}\n${input.stderr}`).trim();
  const warnings = output.split('\n').filter(line => /warning:|^warn /iu.test(line.trim()));
  const errors = output.split('\n').map(line => line.trim()).filter(line => /error:|^error |^fatal:| failed|^failed |traceback |exception/iu.test(line));
  let evidence = errors.slice(0, EVIDENCE_LIMIT).map(line => `ERROR ${truncateValue(line)}`);
  if (!evidence.length) evidence = warnings.slice(0, 5).map(line => `WARN ${truncateValue(line.trim())}`);
  if (input.exitCode && !evidence.length) evidence = buildTail(output, EVIDENCE_LIMIT);
  const status = input.exitCode ? 'failed' : errors.length ? 'passed_with_errors_in_output' : 'passed';
  return result(joinLines([
    `status=${status} exit=${input.exitCode} warnings=${warnings.length} command="${input.command}"`,
    ...evidence, 'omitted=progress,downloads,successful_steps', ...(input.exitCode ? ['parser=build'] : []), `truncated=${input.truncated}`,
  ]), '', input.exitCode || (errors.length ? 1 : 0));
}
