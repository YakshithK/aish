import { joinLines, result, truncateValue } from '../output.js';

const EVIDENCE_LIMIT = 12;
const noise = line => /^[.=#* -]+$/u.test(line) || /^\[\d+\/\d+\]|^\d+(?:\.\d+)?%/u.test(line) || /^(Downloading |Installing |Collecting |Requirement already satisfied)/u.test(line);
const usefulLines = output => output.split('\n').map(line => line.trim()).filter(line => line && !noise(line));
const buildTail = (output, count) => usefulLines(output).slice(-count).map(line => `TAIL ${truncateValue(line)}`);

export function parse(input) {
  const output = `${input.stdout}\n${input.stderr}`.trim();
  const warnings = output.split('\n').filter(line => /warning:|^warn /iu.test(line.trim()));
  let evidence = input.exitCode
    ? output.split('\n').map(line => line.trim()).filter(line => /error:|^error |^fatal:| failed|^failed |traceback |exception/iu.test(line)).slice(0, EVIDENCE_LIMIT).map(line => `ERROR ${truncateValue(line)}`)
    : warnings.slice(0, 5).map(line => `WARN ${truncateValue(line.trim())}`);
  if (input.exitCode && !evidence.length) evidence = buildTail(output, EVIDENCE_LIMIT);
  return result(joinLines([
    `status=${input.exitCode ? 'failed' : 'passed'} exit=${input.exitCode} warnings=${warnings.length} command="${input.command}"`,
    ...evidence, 'omitted=progress,downloads,successful_steps', ...(input.exitCode ? ['parser=build'] : []), `truncated=${input.truncated}`,
  ]), '', input.exitCode);
}
