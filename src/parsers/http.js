import { joinLines, result, truncateValue } from '../output.js';
import { sanitizeTerminalText } from '../terminal.js';

const EVIDENCE_LIMIT = 12;
const noise = line => /^[.=#* -]+$/u.test(line) || /^\[\d+\/\d+\]|^\d+(?:\.\d+)?%/u.test(line) || /^(Downloading |Installing |Collecting |Requirement already satisfied)/u.test(line);
const usefulLines = output => output.split('\n').map(line => line.trim()).filter(line => line && !noise(line));
const distinct = lines => [...new Set(lines)];
const omission = (total, shown) => total > shown ? `omitted=${total - shown},progress,full_output` : 'omitted=progress,full_output';

export function parse(input) {
  const lines = usefulLines(sanitizeTerminalText(`${input.stdout}\n${input.stderr}`));
  const statusLines = lines.filter(line => /^HTTP\/\S+\s+\d{3}(?:\s|$)/iu.test(line));
  const status = statusLines.at(-1)?.match(/^HTTP\/\S+\s+(\d{3})/iu)?.[1] ?? '?';
  const contentType = lines.find(line => /^content-type\s*:/iu.test(line));
  const body = lines.filter(line => !/^HTTP\/\S+\s+\d{3}(?:\s|$)/iu.test(line) && !/^[\w-]+\s*:/u.test(line)).slice(-EVIDENCE_LIMIT);
  const curlErrors = lines.filter(line => /^curl:\s*\(\d+\)/iu.test(line));
  const evidence = distinct([...curlErrors, ...body]).slice(0, EVIDENCE_LIMIT).map(line => `HTTP ${truncateValue(line)}`);
  return result(joinLines([
    `status=${input.exitCode ? 'failed' : 'observed'} exit=${input.exitCode} family=http http_status=${status} command="${input.command}"`,
    ...(contentType ? [contentType] : []), ...evidence, ...(lines.length ? [] : ['no_http_output']),
    omission(lines.length, evidence.length + statusLines.length + (contentType ? 1 : 0)), `truncated=${input.truncated}`,
  ]), '', input.exitCode);
}
