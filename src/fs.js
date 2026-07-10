import fs from 'node:fs';
import path from 'node:path';
import { AishError, EXIT_RUNTIME, EXIT_USAGE } from './output.js';

export const IGNORED_NAMES = new Set(['.git','.agents','.codex','node_modules','dist','build','target','.venv','venv','__pycache__','.pytest_cache','.mypy_cache','.ruff_cache']);
export const VIEW_INLINE_MAX_LINES = 120, VIEW_RANGE_MAX_LINES = 240, TREE_MAX_DEPTH = 3, TREE_MAX_FILES = 200, SEARCH_MAX_FILES = 20, SEARCH_MAX_LINES_PER_FILE = 5;
export const displayPath = (value) => value.split(path.sep).join('/');
export function parsePathRange(raw) {
  const match = raw.match(/^(.+):(\d+)-(\d+)$/u);
  if (!match) return { path: raw, start: null, end: null };
  const start = Number(match[2]), end = Number(match[3]);
  if (start < 1 || end < start) throw new AishError('error=invalid_range expected=START-END', EXIT_USAGE);
  if (end - start + 1 > VIEW_RANGE_MAX_LINES) throw new AishError(`error=range_too_large max_lines=${VIEW_RANGE_MAX_LINES}`, EXIT_USAGE);
  return { path: match[1], start, end };
}
export function requireFile(file) {
  if (!fs.existsSync(file)) throw new AishError(`error=missing_file path=${file}`, EXIT_RUNTIME);
  if (fs.statSync(file).isDirectory()) throw new AishError(`error=is_directory path=${file}`, EXIT_RUNTIME);
  return file;
}
export function looksBinary(file) {
  const fd = fs.openSync(file, 'r'); const sample = Buffer.alloc(4096); const size = fs.readSync(fd, sample); fs.closeSync(fd);
  if (!size) return false;
  let control = 0;
  for (const byte of sample.subarray(0, size)) { if (byte === 0) return true; if (byte < 9 || (byte > 13 && byte < 32)) control++; }
  return control / size > .2;
}
export const readLines = (file) => fs.readFileSync(file).toString('utf8').split(/\r?\n/u).slice(0, -Number(fs.readFileSync(file).toString('utf8').endsWith('\n')) || undefined);
export function walkFiles(root) {
  const files = [];
  function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) { const item = path.join(dir, entry.name); if (IGNORED_NAMES.has(entry.name) || entry.isSymbolicLink()) continue; if (entry.isDirectory()) walk(item); else files.push(item); } }
  walk(root); return files;
}
