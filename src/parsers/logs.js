import { joinLines, result, truncateValue } from '../output.js';

const EVIDENCE_LIMIT = 12;
const noise = line => /^[.=#* -]+$/u.test(line) || /^\[\d+\/\d+\]|^\d+(?:\.\d+)?%/u.test(line) || /^(Downloading |Installing |Collecting |Requirement already satisfied)/u.test(line);
const usefulLines = output => output.split('\n').map(line => line.trim()).filter(line => line && !noise(line));
const distinct = lines => [...new Set(lines)];
const omission = (total, shown) => total > shown ? `omitted=${total - shown},progress,full_output` : 'omitted=progress,full_output';

export function parse(input) {
  const lines = usefulLines(input.interleaved || `${input.stdout}\n${input.stderr}`);
  const errors = lines.filter(line => /(^|\W)(error|fatal|panic|exception)(\W|$)/iu.test(line));
  const warnings = lines.filter(line => /(^|\W)warn(?:ing)?(\W|$)/iu.test(line));
  const marked = distinct(lines.filter(line => /(^|\W)(error|fatal|panic|exception|warn(?:ing)?)(\W|$)/iu.test(line))).slice(0, EVIDENCE_LIMIT);
  const evidence = (marked.length ? marked : lines.slice(-EVIDENCE_LIMIT)).map(line => `LOG ${truncateValue(line)}`);
  return result(joinLines([
    `status=${input.exitCode ? 'failed' : 'passed'} exit=${input.exitCode} family=logs errors=${errors.length} warnings=${warnings.length} command="${input.command}"`,
    ...evidence, ...(lines.length ? [] : ['no_log_output']), omission(lines.length, evidence.length), `truncated=${input.truncated}`,
  ]), '', input.exitCode);
}
