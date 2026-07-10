import process from 'node:process';
import { AishError, EXIT_RUNTIME, EXIT_USAGE, result } from './output.js';

export const commands = ['tree', 'view', 'search', 'status', 'diff', 'inspect', 'init', 'doctor', 'skill', 'test', 'build', 'benchmark'];
const summaries = {
  tree: 'show compact project structure', view: 'safely view a file or line range', search: 'search compactly',
  status: 'show compact git status', diff: 'summarize git diffs without dumping full patches',
  inspect: 'summarize repo setup, git state, and project structure', init: 'install agent instructions for this repo',
  doctor: 'check AgentShell setup',
  skill: 'print AgentShell skill/rule content', test: 'run and summarize a test command',
  build: 'run and summarize a build or install command', benchmark: 'measure raw vs compact fixture output',
};

function help() {
  return `usage: aish [-h] {${commands.join(',')}} ...\n\nCompact terminal observations for AI coding agents.\n\ncommands:\n${commands.map((name) => `  ${name.padEnd(14)} ${summaries[name]}`).join('\n')}\n`;
}

function commandHelp(command) {
  const usage = {
    tree: '[path]', view: 'target', search: 'query [path]', status: '[path]', diff: '[--staged] [target]', inspect: '[path]',
    init: '[--force] [--yes] [--no-global] [path]', doctor: '[--agents] [path]',
    skill: 'print {claude,codex,cursor,opencode,generic}', test: '-- <command...>', build: '-- <command...>', benchmark: '',
  }[command];
  return `usage: aish ${command}${usage ? ` ${usage}` : ''}\n\n${summaries[command]}\n`;
}

function usage(message) { throw new AishError(`error=usage ${message}`, EXIT_USAGE); }
function rejectUnknownOptions(args, allowed = []) {
  const unknown = args.find((arg) => arg.startsWith('-') && !allowed.includes(arg));
  if (unknown) usage(`unknown_option=${unknown}`);
}
function positional(args) { return args.filter((arg) => !arg.startsWith('-')); }
function atMost(items, count) { if (items.length > count) usage(`unexpected_argument=${items[count]}`); }

export async function dispatch(argv) {
  if (argv[0] === '--help' || argv[0] === '-h') return result(help());
  if (!argv.length) usage('missing=command');
  const [command, ...args] = argv;
  if (!commands.includes(command)) usage(`unknown_command=${command}`);
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
    const separator = args.indexOf('--');
    if (separator !== 0) usage(`expected="${command} -- <command...>"`);
    return (await import(`./commands/${command}.js`)).run(args.slice(1));
  }
  if (command === 'benchmark') { rejectUnknownOptions(args); atMost(args, 0); return (await import('./commands/benchmark.js')).run(); }
  throw new AishError(`error=not_implemented command=${command}`, EXIT_RUNTIME);
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
