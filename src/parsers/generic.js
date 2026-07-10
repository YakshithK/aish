import { joinLines, result, truncateValue } from '../output.js';

const EVIDENCE_LIMIT = 12;
const noise = line => /^[.=#* -]+$/u.test(line) || /^\[\d+\/\d+\]|^\d+(?:\.\d+)?%/u.test(line) || /^(Downloading |Installing |Collecting |Requirement already satisfied)/u.test(line);
const usefulLines = output => output.split('\n').map(line => line.trim()).filter(line => line && !noise(line));
const distinct = lines => [...new Set(lines)];
const omission = (total, shown) => total > shown ? `omitted=${total - shown},progress,full_output` : 'omitted=progress,full_output';

export function parse(input) {
  const lines = usefulLines(input.interleaved || `${input.stdout}\n${input.stderr}`);
  const errorLike = lines.filter(line => /(^|\W)(error|fatal|panic|exception|failed)(\W|$)/iu.test(line));
  const selected = distinct(input.exitCode && errorLike.length ? errorLike : lines.slice(-EVIDENCE_LIMIT)).slice(0, EVIDENCE_LIMIT);
  return result(joinLines([
    `status=${input.exitCode ? 'failed' : 'passed'} exit=${input.exitCode} family=generic command="${input.command}"`,
    ...selected.map(line => `TAIL ${truncateValue(line)}`), ...(lines.length ? [] : ['no_command_output']),
    omission(lines.length, selected.length), `truncated=${input.truncated}`,
  ]), '', input.exitCode);
}
