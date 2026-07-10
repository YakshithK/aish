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
