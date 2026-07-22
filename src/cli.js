import process from 'node:process';
import { AishError, EXIT_RUNTIME, EXIT_USAGE, result } from './output.js';
import { observeCommand, ARBITRARY_TIMEOUT_DEFAULT } from './command-observer.js';
import { matchCompoundCommand } from './command-router.js';

export const commands = ['tree', 'view', 'search', 'status', 'diff', 'inspect', 'init', 'doctor', 'skill', 'test', 'build', 'benchmark', 'run'];
const summaries = {
  tree: 'show compact project structure', view: 'safely view a file or line range', search: 'search compactly',
  status: 'show compact git status', diff: 'summarize git diffs without dumping full patches',
  inspect: 'summarize repo setup, git state, and project structure', init: 'install agent instructions for this repo',
  doctor: 'check AgentShell setup',
  skill: 'print AgentShell skill/rule content', test: 'run and summarize a test command',
  build: 'run and summarize a build or install command', benchmark: 'measure raw vs compact fixture output',
  run: 'observe an external command, including native-name collisions',
};

function help() {
  return `usage: aish [-h] {${commands.join(',')}} ...\n\nCompact terminal observations for AI coding agents.\n\ncommands:\n${commands.map((name) => `  ${name.padEnd(14)} ${summaries[name]}`).join('\n')}\n`;
}

function commandHelp(command) {
  const usage = {
    tree: '[path]', view: 'target', search: 'query [path]', status: '[path]', diff: '[--staged] [target]', inspect: '[path]',
    init: '[--force] [--yes] [--no-global] [path]', doctor: '[--agents] [path]',
    skill: 'print {claude,codex,cursor,opencode,generic}', test: '[--] <command...>', build: '[--] <command...>', benchmark: '',
    run: '[--timeout SECONDS] [--] <command...>',
  }[command];
  return `usage: aish ${command}${usage ? ` ${usage}` : ''}\n\n${summaries[command]}\n`;
}

function usage(message) { throw new AishError(`error=usage ${message}`, EXIT_USAGE); }
function editDistance(a, b) {
  const rows = a.length + 1, cols = b.length + 1;
  const d = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let j = 1; j < cols; j += 1) d[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
    }
  }
  return d[rows - 1][cols - 1];
}
function closestCommand(command) {
  if (command.length < 2) return null;
  const ranked = commands.map((name) => [name, editDistance(command, name)]).filter(([, dist]) => dist <= 2).sort((a, b) => a[1] - b[1]);
  if (!ranked.length || (ranked[1] && ranked[1][1] === ranked[0][1])) return null;
  return ranked[0][0];
}
function rejectUnknownOptions(args, allowed = []) {
  const unknown = args.find((arg) => arg.startsWith('-') && !allowed.includes(arg));
  if (unknown) usage(`unknown_option=${unknown}`);
}
function positional(args) { return args.filter((arg) => !arg.startsWith('-')); }
function atMost(items, count) { if (items.length > count) usage(`unexpected_argument=${items[count]}`); }

export async function dispatch(argv, { observer = observeCommand } = {}) {
  if (argv[0] === '--help' || argv[0] === '-h') return result(help());
  if (!argv.length) usage('missing=command hint="aish --help"');
  const rewritten = !commands.includes(argv[0]) ? matchCompoundCommand(argv) : null;
  const [command, ...args] = rewritten ?? argv;
  if (!commands.includes(command)) {
    const output = await observer(argv, { timeoutSeconds: ARBITRARY_TIMEOUT_DEFAULT });
    if (output.exitCode === 127 && /error=command_not_found/u.test(`${output.stdout}${output.stderr}`)) {
      const suggestion = closestCommand(command);
      if (suggestion) return { ...output, stdout: `${output.stdout.trimEnd()}\nhint=did you mean "aish ${suggestion}"?\n` };
    }
    return output;
  }
  if (args[0] === '--help' || args[0] === '-h') return result(commandHelp(command));

  if (command === 'tree' || command === 'status' || command === 'inspect') {
    rejectUnknownOptions(args); atMost(args, 1);
    return (await import(`./commands/${command}.js`)).run(args[0] ?? '.');
  }
  if (command === 'view') {
    rejectUnknownOptions(args); atMost(args, 1); if (!args[0]) usage('missing=target');
    return (await import('./commands/view.js')).run(args[0]);
  }
  if (command === 'search') {
    rejectUnknownOptions(args); atMost(args, 2); if (!args[0]) usage('missing=query');
    return (await import('./commands/search.js')).run(args[0], args[1] ?? '.');
  }
  if (command === 'diff') {
    rejectUnknownOptions(args, ['--staged']); const values = positional(args); atMost(values, 1);
    return (await import('./commands/diff.js')).run('.', values[0] ?? null, args.includes('--staged'));
  }
  if (command === 'init' || command === 'doctor') {
    const allowed = command === 'init' ? ['--force', '--yes', '--no-global'] : ['--agents'];
    rejectUnknownOptions(args, allowed);
    const values = positional(args); atMost(values, 1);
    if (command === 'init') {
      return (await import('./commands/init.js')).run(values[0] ?? '.', {
        force: args.includes('--force'),
        yes: args.includes('--yes'),
        noGlobal: args.includes('--no-global'),
      });
    }
    return (await import('./commands/doctor.js')).run(values[0] ?? '.', args.includes('--agents'));
  }
  if (command === 'skill') {
    rejectUnknownOptions(args); atMost(args, 2);
    if (args[0] !== 'print' || !args[1]) usage('expected="skill print <host>"');
    if (!['claude','codex','cursor','opencode','generic'].includes(args[1])) usage(`invalid_host=${args[1]}`);
    return (await import('./commands/skill.js')).printSkill(args[1]);
  }
  if (command === 'test' || command === 'build') {
    if (!args.length) usage(`expected="${command} [--] <command...>"`);
    // `--` is accepted for parity with Unix CLI convention and remains
    // required when the child command's own first token starts with `-`
    // (ambiguous otherwise), but is optional in the common case — some
    // shells (PowerShell's `$args` binding) silently drop a bare `--` before
    // it ever reaches this process, so requiring it unconditionally broke
    // `aish test -- npm test` for PowerShell users even though it worked
    // fine in cmd.exe and POSIX shells.
    if (args[0] !== '--' && args[0].startsWith('-')) usage(`unknown_option=${args[0]}`);
    const childArgv = args[0] === '--' ? args.slice(1) : args;
    if (!childArgv.length) usage(`expected="${command} [--] <command...>"`);
    return (await import(`./commands/${command}.js`)).run(childArgv);
  }
  if (command === 'run') {
    const { childArgv, timeoutSeconds } = parseRunArguments(args);
    return observer(childArgv, { timeoutSeconds });
  }
  if (command === 'benchmark') { rejectUnknownOptions(args); atMost(args, 0); return (await import('./commands/benchmark.js')).run(); }
  throw new AishError(`error=not_implemented command=${command}`, EXIT_RUNTIME);
}

function parseRunArguments(args) {
  if (!args.length) usage('missing=run_command');
  // `--` before the command is optional (see the note in dispatch()); it is
  // still required to disambiguate when the command's own first token is
  // `--timeout` or some other `-`-prefixed token we don't recognize.
  let index = 0;
  let timeoutSeconds = ARBITRARY_TIMEOUT_DEFAULT;
  let seenTimeout = false;
  while (args[index] === '--timeout') {
    if (seenTimeout) usage('duplicate_option=--timeout');
    const raw = args[index + 1];
    if (raw == null) usage('missing_value=--timeout');
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0.1 || value > 3600) usage(`invalid_timeout=${raw}`);
    timeoutSeconds = value;
    seenTimeout = true;
    index += 2;
  }
  if (args[index] === '--') index += 1;
  else if (args[index]?.startsWith('-')) usage(`unknown_option=${args[index]}`);
  const childArgv = args.slice(index);
  if (!childArgv.length) usage('missing=run_command');
  return { childArgv, timeoutSeconds };
}

export async function main(argv, io = process) {
  try {
    const output = await dispatch(argv);
    if (output.stdout) io.stdout.write(output.stdout);
    if (output.stderr) io.stderr.write(output.stderr);
    return output.exitCode;
  } catch (error) {
    if (error instanceof AishError) { io.stderr.write(`${error.message}\n`); return error.exitCode; }
    if (process.env.AISH_DEBUG === '1') io.stderr.write(`${error.stack}\n`);
    else io.stderr.write(`error=unexpected detail=${error.name}: ${error.message}\n`);
    return EXIT_RUNTIME;
  }
}
