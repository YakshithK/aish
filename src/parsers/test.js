import { joinLines, result, truncateValue } from '../output.js';

export function parse(input) {
  const output = `${input.stdout}\n${input.stderr}`.trim();
  if (input.exitCode === 0) {
    const match = output.match(/(\d+)\s+passed/u);
    return result(joinLines([
      `status=passed exit=0 command="${input.command}"`, `passed=${match?.[1] ?? '?'} failed=0`, `truncated=${input.truncated}`,
    ]));
  }
  const [parser, failures] = parseFailures(output);
  const [passed, failed] = countTests(output, failures.length);
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

const noise = line => /^[.=#* -]+$/u.test(line) || /^\[\d+\/\d+\]|^\d+(?:\.\d+)?%/u.test(line) || /^(Downloading |Installing |Collecting |Requirement already satisfied)/u.test(line);
const usefulLines = output => output.split('\n').map(line => line.trim()).filter(line => line && !noise(line));
const testTail = output => usefulLines(output).filter(line => !line.startsWith('collected ')).slice(-12).map(line => `TAIL ${truncateValue(line)}`);

function countTests(output, fallback) {
  let match = output.match(/(\d+)\s+passed.*?(\d+)\s+failed/su); if (match) return [match[1], match[2]];
  match = output.match(/(?:Tests:\s+)?(\d+)\s+failed[,;]\s+(\d+)\s+passed/su); if (match) return [match[2], match[1]];
  match = output.match(/test result: FAILED\.\s+(\d+)\s+passed;\s+(\d+)\s+failed/su); if (match) return [match[1], match[2]];
  const go = (output.match(/--- FAIL:/gu) || []).length;
  return ['?', String(go || fallback || '?')];
}
