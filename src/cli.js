import process from 'node:process';
import { AishError, EXIT_RUNTIME, EXIT_USAGE, result } from './output.js';

export const commands = ['tree', 'view', 'search', 'status', 'diff', 'inspect', 'init', 'doctor', 'install-agent', 'skill', 'test', 'build', 'benchmark'];

function help() {
  return `usage: aish <command> [options]\n\nCompact terminal observations for AI coding agents.\n\ncommands:\n${commands.map((name) => `  ${name}`).join('\n')}\n`;
}

export async function dispatch(argv) {
  if (!argv.length || argv[0] === '--help' || argv[0] === '-h') return result(help());
  const [command] = argv;
  if (!commands.includes(command)) throw new AishError(`error=unknown_command command=${command}`, EXIT_USAGE);
  if (command === 'tree') return (await import('./commands/tree.js')).run(argv[1] ?? '.');
  if (command === 'view') { if (!argv[1]) throw new AishError('error=missing_argument name=target', EXIT_USAGE); return (await import('./commands/view.js')).run(argv[1]); }
  if (command === 'search') { if (!argv[1]) throw new AishError('error=missing_argument name=query', EXIT_USAGE); return (await import('./commands/search.js')).run(argv[1], argv[2] ?? '.'); }
  if (command === 'status') return (await import('./commands/status.js')).run(argv[1] ?? '.');
  if (command === 'diff') { const staged=argv.includes('--staged'), rest=argv.slice(1).filter(x=>x!=='--staged'); return (await import('./commands/diff.js')).run('.',rest[0]??null,staged); }
  if (command === 'inspect') return (await import('./commands/inspect.js')).run(argv[1] ?? '.');
  if (command === 'init') { const force=argv.includes('--force'),p=argv.slice(1).find(x=>!x.startsWith('--'))??'.'; return (await import('./commands/init.js')).run(p,force); }
  if (command === 'doctor') { const agents=argv.includes('--agents'),p=argv.slice(1).find(x=>!x.startsWith('--'))??'.'; return (await import('./commands/doctor.js')).run(p,agents); }
  if (command === 'install-agent') { if(!argv[1])throw new AishError('error=missing_argument name=host',EXIT_USAGE);return (await import('./commands/install-agent.js')).run(argv[1],argv.includes('--force')); }
  if (command === 'skill') { if(argv[1]!=='print'||!argv[2])throw new AishError('error=usage expected="skill print <host>"',EXIT_USAGE);return (await import('./commands/skill.js')).printSkill(argv[2]); }
  throw new AishError(`error=not_implemented command=${command}`, EXIT_RUNTIME);
}

export async function main(argv, io = process) {
  try {
    const output = await dispatch(argv);
    if (output.stdout) io.stdout.write(output.stdout);
    if (output.stderr) io.stderr.write(output.stderr);
    return output.exitCode;
  } catch (error) {
    if (error instanceof AishError) {
      io.stderr.write(`${error.message}\n`);
      return error.exitCode;
    }
    if (process.env.AISH_DEBUG === '1') io.stderr.write(`${error.stack}\n`);
    else io.stderr.write(`error=unexpected detail=${error.name}: ${error.message}\n`);
    return EXIT_RUNTIME;
  }
}
