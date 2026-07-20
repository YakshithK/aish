import { joinLines, result, truncateValue } from '../output.js';
import { sanitizeTerminalText } from '../terminal.js';

export function parse(input) {
  const output = sanitizeTerminalText(`${input.stdout}\n${input.stderr}`).trim();
  const [parser, failures] = parseFailures(output);
  const [passed, failed] = countTests(output, input.exitCode === 0 ? 0 : failures.length);
  if (input.exitCode === 0) {
    return result(joinLines([
      `status=${failed === '0' || failed === '?' ? 'passed' : 'passed_with_failures_in_output'} exit=0 command="${input.command}"`,
      `passed=${passed} failed=${failed}`,
      ...(failed === '0' || failed === '?' ? [] : failures),
      ...(failed === '0' || failed === '?' ? [] : [`parser=${parser}`]),
      `truncated=${input.truncated}`,
    ]), '', failed === '0' || failed === '?' ? 0 : 1);
  }
  return result(joinLines([
    `status=failed exit=${input.exitCode} passed=${passed} failed=${failed} command="${input.command}"`,
    ...failures, 'omitted=passing_tests,progress,full_stack_traces', `parser=${parser}`, `truncated=${input.truncated}`,
  ]), '', input.exitCode);
}

function parseFailures(output) {
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
    return ['go', lines.length ? lines : testTail(output)];
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
  if (/FAIL: .* \(|FAILED \(/u.test(output)) {
    const lines = [...output.matchAll(/^FAIL:\s+(.+)$/gmu)].map(item => `FAIL ${item[1]}`).slice(0, 10);
    return ['unittest', lines.length ? lines : testTail(output)];
  }
  return ['generic', testTail(output)];
}

const noise = line => /^[.=#* -]+$/u.test(line) || /^\[\d+\/\d+\]|^\d+(?:\.\d+)?%/u.test(line) || /^(Downloading |Installing |Collecting |Requirement already satisfied)/u.test(line);
const usefulLines = output => output.split('\n').map(line => line.trim()).filter(line => line && !noise(line));
const testTail = output => usefulLines(output).filter(line => !line.startsWith('collected ')).slice(-12).map(line => `TAIL ${truncateValue(line)}`);

function countTests(output, fallback) {
  const cargo = output.match(/test result: FAILED\.\s+(\d+)\s+passed;\s+(\d+)\s+failed/u); if (cargo) return [cargo[1], cargo[2]];
  const js = output.match(/(?:Tests:\s+)?(\d+)\s+failed[,;]\s+(\d+)\s+passed/u); if (js) return [js[2], js[1]];
  const failedFirst = output.match(/(\d+)\s+failed/u);
  const passed = output.match(/(\d+)\s+passed/u)?.[1] ?? '?';
  if (failedFirst) return [passed, failedFirst[1]];
  if (fallback === 0) return [passed, '0'];
  const go = (output.match(/--- FAIL:/gu) || []).length;
  return ['?', String(go || fallback || '?')];
}
