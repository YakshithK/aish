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
  if (PACKAGE_MANAGERS.has(executable) && subcommand === 'run' && /(?:^|[-_:])test(?:$|[-_:])/u.test(third)) return 'test';
  if (PACKAGE_MANAGERS.has(executable) && subcommand === 'run' && /(?:^|[-_:])build(?:$|[-_:])/u.test(third)) return 'build';
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

// Maps a small, unambiguous set of raw invocations onto the aish subcommand
// that produces equivalent (but compact) output. Only matches narrow shapes
// with no extra flags/args, since those are the only ones where the aish
// equivalent is a guaranteed drop-in replacement rather than a guess at
// intent (e.g. `find . -name '*.js'` is real filtering, not `aish tree`).
export function matchCompoundCommand(argv) {
  if (!argv.length) return null;
  const executable = normalizeExecutable(argv[0]);
  const rest = argv.slice(1).map(String);
  if (executable === 'git' && rest[0] === 'status' && rest.length === 1) return ['status'];
  if (executable === 'git' && rest[0] === 'diff') {
    const flags = rest.slice(1);
    if (flags.length === 0) return ['diff'];
    if (flags.length === 1 && flags[0] === '--staged') return ['diff', '--staged'];
    if (flags.length === 1 && !flags[0].startsWith('-')) return ['diff', flags[0]];
    return null;
  }
  if (executable === 'cat' && rest.length === 1 && !rest[0].startsWith('-')) return ['view', rest[0]];
  if (executable === 'find' && rest.length === 1 && rest[0] === '.') return ['tree'];
  if (executable === 'ls' && rest.length === 1 && rest[0] === '-R') return ['tree'];
  if (executable === 'grep' && (rest[0] === '-R' || rest[0] === '-r')) {
    if (rest.length === 2) return ['search', rest[1]];
    if (rest.length === 3) return ['search', rest[1], rest[2]];
  }
  return null;
}
