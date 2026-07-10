import path from 'node:path';

const WINDOWS_SUFFIX = /\.(?:exe|cmd|bat)$/u;
const PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun']);
const TEST_EXECUTABLES = new Set(['pytest', 'unittest', 'jest', 'vitest', 'mocha']);

export function normalizeExecutable(executable = '') {
  const basename = path.posix.basename(String(executable).replaceAll('\\', '/')).toLowerCase();
  return basename.replace(WINDOWS_SUFFIX, '');
}

export function classifyCommand(argv) {
  if (!argv.length) return 'generic';
  const executable = normalizeExecutable(argv[0]);
  const subcommand = String(argv[1] ?? '').toLowerCase();
  const third = String(argv[2] ?? '').toLowerCase();
  if (TEST_EXECUTABLES.has(executable)) return 'test';
  if (PACKAGE_MANAGERS.has(executable) && subcommand === 'test') return 'test';
  if ((executable === 'cargo' || executable === 'go') && subcommand === 'test') return 'test';
  if (PACKAGE_MANAGERS.has(executable) && ['install', 'build', 'ci'].includes(subcommand)) return 'build';
  if (executable === 'cargo' && ['build', 'check'].includes(subcommand)) return 'build';
  if (executable === 'go' && subcommand === 'build') return 'build';
  if (executable === 'pip' && subcommand === 'install') return 'build';
  if (executable === 'uv' && ['sync', 'build'].includes(subcommand)) return 'build';
  if ((executable === 'docker' && subcommand === 'logs') ||
      (executable === 'docker' && subcommand === 'compose' && third === 'logs') ||
      (executable === 'docker-compose' && subcommand === 'logs') ||
      (executable === 'kubectl' && subcommand === 'logs')) return 'logs';
  if (executable === 'curl') return 'http';
  return 'generic';
}

export const parserFamilies = Object.freeze(['test', 'build', 'logs', 'http', 'generic']);
