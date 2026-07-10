import { classifyCommand, parserFamilies } from './command-router.js';
import { runCommand } from './subprocess.js';
import { joinLines, quoteCommand, result, truncateValue } from './output.js';

export const ARBITRARY_TIMEOUT_DEFAULT = 30;
const EVIDENCE_LIMIT = 12;

export async function observeCommand(argv, { family, timeoutSeconds = ARBITRARY_TIMEOUT_DEFAULT, executor = runCommand, compatibility = false, parserRegistry = parsers, ...executorOptions } = {}) {
  if (!argv.length) throw new TypeError('observeCommand requires non-empty argv');
  const selected = parserFamilies.includes(family) ? family : classifyCommand(argv);
  const command = quoteCommand(argv);
  const execution = await executor(argv, { ...executorOptions, timeout: timeoutSeconds });
  if (compatibility && execution.missing) return result(joinLines([
    `status=error exit=${execution.exitCode} command="${command}"`, execution.stderr,
  ]), '', execution.exitCode);
  if (execution.missing) return result(joinLines([
    `status=error exit=127 family=${selected} command="${command}"`, execution.stderr,
  ]), '', 127);
  if (compatibility && execution.timedOut) {
    const combined = `${execution.stdout}\n${execution.stderr}`.trim();
    const evidence = selected === 'build' ? buildTail(combined, 8) : usefulLines(combined).slice(-10).map(line => `TAIL ${truncateValue(line)}`);
    return result(joinLines([`status=timeout exit=124 timeout=true command="${command}"`, ...evidence]), '', 124);
  }
  if (execution.timedOut) return result(joinLines([
    `status=timeout exit=124 timeout=true family=${selected} command="${command}"`,
    ...usefulLines(execution.interleaved || `${execution.stdout}\n${execution.stderr}`).slice(-EVIDENCE_LIMIT).map(line => `TAIL ${truncateValue(line)}`),
    `truncated=${Boolean(execution.truncated)}`,
  ]), '', 124);
  const input = { argv, ...execution, command, family: selected, truncated: Boolean(execution.truncated) };
  try { return parserRegistry[selected](input); }
  catch { return parseGeneric(input); }
}

export function parseTest(input) {
  const output = `${input.stdout}\n${input.stderr}`.trim();
  if (input.exitCode === 0) {
    const match = output.match(/(\d+)\s+passed/u);
    return result(joinLines([
      `status=passed exit=0 command="${input.command}"`, `passed=${match?.[1] ?? '?'} failed=0`, `truncated=${input.truncated}`,
    ]));
  }
  const [parser, failures] = parseTestFailures(output);
  const [passed, failed] = countTests(output, failures.length);
  return result(joinLines([
    `status=failed exit=${input.exitCode} passed=${passed} failed=${failed} command="${input.command}"`,
    ...failures, 'omitted=passing_tests,progress,full_stack_traces', `parser=${parser}`, `truncated=${input.truncated}`,
  ]), '', input.exitCode);
}

export function parseBuild(input) {
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

export function parseLogs(input) {
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

export function parseHttp(input) {
  const lines = usefulLines(`${input.stdout}\n${input.stderr}`);
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

export function parseGeneric(input) {
  const lines = usefulLines(input.interleaved || `${input.stdout}\n${input.stderr}`);
  const errorLike = lines.filter(line => /(^|\W)(error|fatal|panic|exception|failed)(\W|$)/iu.test(line));
  const selected = distinct(input.exitCode && errorLike.length ? errorLike : lines.slice(-EVIDENCE_LIMIT)).slice(0, EVIDENCE_LIMIT);
  return result(joinLines([
    `status=${input.exitCode ? 'failed' : 'passed'} exit=${input.exitCode} family=generic command="${input.command}"`,
    ...selected.map(line => `TAIL ${truncateValue(line)}`), ...(lines.length ? [] : ['no_command_output']),
    omission(lines.length, selected.length), `truncated=${input.truncated}`,
  ]), '', input.exitCode);
}

const parsers = { test: parseTest, build: parseBuild, logs: parseLogs, http: parseHttp, generic: parseGeneric };
const noise = line => /^[.=#* -]+$/u.test(line) || /^\[\d+\/\d+\]|^\d+(?:\.\d+)?%/u.test(line) || /^(Downloading |Installing |Collecting |Requirement already satisfied)/u.test(line);
const usefulLines = output => output.split('\n').map(line => line.trim()).filter(line => line && !noise(line));
const distinct = lines => [...new Set(lines)];
const omission = (total, shown) => total > shown ? `omitted=${total - shown},progress,full_output` : 'omitted=progress,full_output';
const buildTail = (output, count) => usefulLines(output).slice(-count).map(line => `TAIL ${truncateValue(line)}`);

function parseTestFailures(output) {
  let match;
  if (/FAILED .+::|FAILURES/u.test(output)) {
    const lines = [...output.matchAll(/^FAILED\s+(\S+)\s+-\s+(.+)$/gmu)].slice(0, 10).map(item => `FAIL ${item[1]} ${truncateValue(item[2])}`);
    return ['pytest', lines.length ? lines : testTail(output)];
  }
  if (/--- FAIL:/u.test(output)) {
    const lines = [];
    for (const line of output.split('\n')) {
      match = line.trim().match(/^--- FAIL:\s+(\S+)/u);
      if (match) lines.push(`FAIL ${match[1]}`);
      else { match = line.trim().match(/^([\w./-]+\.go:\d+):\s+(.+)/u); if (match && lines.length) lines[lines.length - 1] += ` ${match[1]} ${truncateValue(match[2], 120)}`; }
    }
    return ['go', lines];
  }
  if (/^\s*FAIL\s+/mu.test(output) || /[×✕]\s+/u.test(output)) {
    let file = ''; const lines = [];
    for (const line of output.split('\n')) {
      match = line.trim().match(/^FAIL\s+(.+)/u); if (match) file = match[1];
      match = line.trim().match(/^[×✕]\s+(.+)/u); if (match) lines.push(`FAIL ${file} ${match[1]}`.trim());
    }
    return ['javascript', lines.length ? lines : file ? [`FAIL ${file}`] : testTail(output)];
  }
  if (/test result: FAILED|---- .+ stdout ----/u.test(output)) {
    const lines = [];
    for (const line of output.split('\n')) {
      match = line.trim().match(/^----\s+(.+?)\s+stdout\s+----/u); if (match) lines.push(`FAIL ${match[1]}`);
      match = line.match(/panicked at (.+)/u); if (match && lines.length) lines[lines.length - 1] += ` ${truncateValue(match[1], 120)}`;
    }
    return ['cargo', lines.length ? lines : testTail(output)];
  }
  if (/FAIL: .* \(|FAILED \(/u.test(output)) return ['unittest', [...output.matchAll(/^FAIL:\s+(.+)$/gmu)].map(item => `FAIL ${item[1]}`).slice(0, 10)];
  return ['generic', testTail(output)];
}

const testTail = output => usefulLines(output).filter(line => !line.startsWith('collected ')).slice(-12).map(line => `TAIL ${truncateValue(line)}`);
function countTests(output, fallback) {
  let match = output.match(/(\d+)\s+passed.*?(\d+)\s+failed/su); if (match) return [match[1], match[2]];
  match = output.match(/(?:Tests:\s+)?(\d+)\s+failed[,;]\s+(\d+)\s+passed/su); if (match) return [match[2], match[1]];
  match = output.match(/test result: FAILED\.\s+(\d+)\s+passed;\s+(\d+)\s+failed/su); if (match) return [match[1], match[2]];
  const go = (output.match(/--- FAIL:/gu) || []).length;
  return ['?', String(go || fallback || '?')];
}
