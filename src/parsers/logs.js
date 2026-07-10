import { joinLines, result } from '../output.js';

export const LOG_GROUP_MAX = 256;
export const LOG_EVIDENCE_EVENT_MAX = 12;
export const LOG_OUTPUT_MAX_BYTES = 12000;

const ANSI = /[\u001b\u009b](?:(?:\][^\u0007]*(?:\u0007|\u001b\\))|(?:\[[0-?]*[ -/]*[@-~])|(?:[()][0-2A-Z0-9])|(?:[ -/]*[@-~]))/gu;
const UNSAFE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001a\u001c-\u001f\u007f-\u009f]/gu;
const TIMESTAMP = /^(?:\[)?((?:\d{4}-\d{2}-\d{2}[T ][0-9:.+-]+Z?)|(?:\d{2}:\d{2}:\d{2}(?:\.\d+)?))(?:\])?\s+/u;
const SERVICE_PIPE = /^([\p{L}\p{N}_.\/-]+)\s+\|\s?/u;
const SERVICE_BRACKET = /^\[([\p{L}\p{N}_.\/-]+)\]\s*/u;
const ERROR_MARKER = /(^|\W)(error|fatal|panic|exception)(\W|$)/iu;
const WARNING_MARKER = /(^|\W)warn(?:ing)?(\W|$)/iu;
const PROGRESS_NOISE = /^(?:[.=#* -]+|\[\d+\/\d+\]|\d+(?:\.\d+)?%)(?:\s*)$/u;
const CONTINUATION = /^(?:\s+|at\s+|Caused by:|Traceback \(most recent call last\):|File "|During handling of the above exception|The above exception was the direct cause)/u;

export function sanitizeLogText(value) {
  return String(value ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n').replace(ANSI, '').replace(UNSAFE_CONTROL, '');
}

export function segmentLogEvents(value) {
  const sanitized = sanitizeLogText(value);
  const lines = sanitized.split('\n');
  if (lines.at(-1) === '') lines.pop();
  const events = [];
  let blankLines = 0;
  let noiseLines = 0;
  let truncationLines = 0;
  let current = null;

  for (const original of lines) {
    if (!original.trim()) { blankLines += 1; current = null; continue; }
    if (original.trim() === '...truncated') { truncationLines += 1; current = null; continue; }
    if (PROGRESS_NOISE.test(original.trim())) { noiseLines += 1; current = null; continue; }
    const metadata = extractMetadata(original);
    const continuation = current && !metadata.explicitStart && (CONTINUATION.test(original) || current.traceback);
    if (continuation) {
      current.lines.push(original);
      current.messageLines.push(original);
      current.sourceLines += 1;
      if (/^(?:\S+(?:Error|Exception):|\w*Error:)/u.test(original.trim())) current.traceback = false;
      continue;
    }
    current = {
      lines: [original],
      sourceLines: 1,
      timestamp: metadata.timestamp,
      service: metadata.service,
      messageLines: [metadata.message],
      traceback: /^Traceback \(most recent call last\):/u.test(metadata.message),
    };
    events.push(current);
  }
  return { events, rawLines: lines.length, blankLines, noiseLines, truncationLines };
}

export function parse(input) {
  const source = input.interleaved != null ? input.interleaved : [input.stdout, input.stderr].filter(Boolean).join('\n');
  const segmented = segmentLogEvents(source);
  const groups = new Map();
  const overflow = { groups: 0, events: 0, lines: 0, errors: 0, warnings: 0 };
  const services = new Set();
  let errors = 0;
  let warnings = 0;

  for (const [index, event] of segmented.events.entries()) {
    if (event.service) services.add(event.service);
    const severity = classify(event);
    if (severity === 'error') errors += 1;
    if (severity === 'warning') warnings += 1;
    const key = duplicateKey(event, severity);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalLines += event.sourceLines;
      if (event.service) existing.services.add(event.service);
      continue;
    }
    if (groups.size >= LOG_GROUP_MAX) {
      overflow.groups += 1; overflow.events += 1; overflow.lines += event.sourceLines;
      if (severity === 'error') overflow.errors += 1;
      if (severity === 'warning') overflow.warnings += 1;
      continue;
    }
    groups.set(key, { event, severity, count: 1, totalLines: event.sourceLines, firstIndex: index, services: new Set(event.service ? [event.service] : []) });
  }

  const all = [...groups.values()];
  const errorGroups = all.filter(group => group.severity === 'error').sort(byFirstSeen);
  const warningGroups = all.filter(group => group.severity === 'warning').sort(byFirstSeen);
  const routine = all.filter(group => group.severity === 'routine');
  const repeated = routine.filter(group => group.count > 1).sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex);
  const repeatedKeys = new Set(repeated);
  const recent = routine.filter(group => !repeatedKeys.has(group)).sort((a, b) => b.firstIndex - a.firstIndex);
  const candidates = [...errorGroups, ...warningGroups, ...repeated, ...recent];
  const selected = selectEvidence(candidates);
  const selectedSet = new Set(selected);

  let emittedLines = 0;
  let collapsedLines = 0;
  let routineOmittedLines = 0;
  let severityOmittedLines = 0;
  for (const group of all) {
    collapsedLines += group.totalLines - group.event.sourceLines;
    if (selectedSet.has(group)) emittedLines += group.event.sourceLines;
    else if (group.severity === 'routine') routineOmittedLines += group.event.sourceLines;
    else severityOmittedLines += group.event.sourceLines;
  }
  const accountedLines = emittedLines + collapsedLines + routineOmittedLines + severityOmittedLines + overflow.lines + segmented.blankLines + segmented.noiseLines + segmented.truncationLines;
  const serviceList = [...services].sort(compareText);
  const evidence = selected.flatMap(renderGroup);
  const status = input.exitCode ? 'failed' : 'passed';
  const metrics = `raw_lines=${segmented.rawLines} compact_lines=__COMPACT__ services=${serviceList.length ? serviceList.join(',') : '-'} errors=${errors} warnings=${warnings}`;
  const accounting = `accounted_lines=${accountedLines} emitted_lines=${emittedLines} collapsed_lines=${collapsedLines} routine_omitted_lines=${routineOmittedLines} severity_omitted_lines=${severityOmittedLines} noise_lines=${segmented.noiseLines} blank_lines=${segmented.blankLines} truncation_lines=${segmented.truncationLines}`;
  const overflowLine = `overflow_groups=${overflow.groups} overflow_events=${overflow.events} overflow_lines=${overflow.lines} overflow_errors=${overflow.errors} overflow_warnings=${overflow.warnings}`;
  const lines = [
    `status=${status} exit=${input.exitCode} family=logs command="${input.command}"`,
    metrics,
    ...evidence,
    ...(segmented.events.length ? [] : ['no_log_output']),
    accounting,
    overflowLine,
    `omitted=collapsed_repetitions,routine,noise,blank,overflow,full_output`,
    `truncated=${input.truncated}`,
  ];
  const compactLines = lines.length + evidence.reduce((sum, line) => sum + (line.match(/\n/gu)?.length ?? 0), 0);
  lines[1] = metrics.replace('__COMPACT__', String(compactLines));
  return result(joinLines(lines), '', input.exitCode);
}

function extractMetadata(line) {
  let rest = line;
  let timestamp = '';
  let service = '';
  let explicitStart = false;
  const timestampMatch = rest.match(TIMESTAMP);
  if (timestampMatch) { timestamp = timestampMatch[1]; rest = rest.slice(timestampMatch[0].length); explicitStart = true; }
  const serviceMatch = rest.match(SERVICE_PIPE) || rest.match(SERVICE_BRACKET);
  if (serviceMatch) { service = serviceMatch[1]; rest = rest.slice(serviceMatch[0].length); explicitStart = true; }
  return { timestamp, service, message: rest, explicitStart };
}

function classify(event) {
  const message = event.messageLines.join('\n');
  if (ERROR_MARKER.test(message)) return 'error';
  if (WARNING_MARKER.test(message)) return 'warning';
  return 'routine';
}

function duplicateKey(event, severity) {
  const normalized = event.lines.map((line, index) => {
    const message = index === 0 ? extractMetadata(line).message : line;
    return message.trim().replace(/\s+/gu, ' ');
  }).join('\n');
  return `${severity}\0${normalized}`;
}

function selectEvidence(candidates) {
  const selected = [];
  let bytes = 0;
  for (const group of candidates) {
    if (selected.length >= LOG_EVIDENCE_EVENT_MAX) break;
    const rendered = renderGroup(group).join('\n');
    const size = Buffer.byteLength(rendered);
    if (bytes + size > LOG_OUTPUT_MAX_BYTES) continue;
    selected.push(group);
    bytes += size;
  }
  return selected;
}

function renderGroup(group) {
  const services = [...group.services].sort(compareText);
  const label = group.severity === 'routine' ? 'LOG' : group.severity.toUpperCase();
  return [`${label} count=${group.count} services=${services.length ? services.join(',') : '-'}`, ...group.event.lines.map(line => `  ${line}`)];
}

const byFirstSeen = (a, b) => a.firstIndex - b.firstIndex;
const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
