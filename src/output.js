export const EXIT_OK = 0;
export const EXIT_CHILD_FAILED = 1;
export const EXIT_USAGE = 2;
export const EXIT_RUNTIME = 3;
export const EXIT_TIMEOUT = 124;

export class AishError extends Error {
  constructor(message, exitCode = EXIT_RUNTIME) {
    super(message);
    this.exitCode = exitCode;
  }
}

export const result = (stdout = '', stderr = '', exitCode = EXIT_OK) => ({ stdout, stderr, exitCode });
export const joinLines = (lines) => `${lines.filter((line) => line != null).join('\n').trimEnd()}\n`;
export const csv = (items, empty = '-') => items.length ? items.join(',') : empty;
export const truncateValue = (value, limit = 180) => {
  const chars = Array.from(String(value));
  return chars.length <= limit ? String(value) : `${chars.slice(0, limit - 12).join('')}...truncated`;
};
export function quoteCommand(args) {
  return args.map((arg) => !arg ? "''" : /^[\w./:=+-]+$/u.test(arg) ? arg : `'${arg.replaceAll("'", `'"'"'`)}'`).join(' ');
}
