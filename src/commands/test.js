import { observeCommand } from '../command-observer.js';
import { AishError, EXIT_USAGE } from '../output.js';

export async function run(command, options = {}) {
  if (!command.length) throw new AishError("error=missing_test_command use='aish test -- <command...>'", EXIT_USAGE);
  const { timeout = 120, ...executorOptions } = options;
  return observeCommand(command, { family: 'test', timeoutSeconds: timeout, ...executorOptions });
}
