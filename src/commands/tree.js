import fs from 'node:fs'; import path from 'node:path';
import { IGNORED_NAMES, TREE_MAX_DEPTH, TREE_MAX_FILES, displayPath } from '../fs.js'; import { csv, joinLines, result } from '../output.js';
const IMPORTANT = ['pyproject.toml','package.json','Cargo.toml','go.mod','README.md','src','tests'];
export function run(root = '.') {
  let files = 0, dirs = 0, truncated = false; const omitted = new Set(), groups = new Map();
  function walk(dir, depth) {
    const rel = path.relative(root, dir), names = fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name)); const visible=[]; const children=[];
    for (const entry of names) { if (files >= TREE_MAX_FILES) { truncated=true; break; } if (IGNORED_NAMES.has(entry.name)) { omitted.add(entry.name); continue; } if (entry.isSymbolicLink()) { omitted.add(`${entry.name}@`); continue; } visible.push(entry.name); if (entry.isDirectory()) { if (depth >= TREE_MAX_DEPTH) omitted.add(entry.name); else { dirs++; children.push(path.join(dir,entry.name)); } } else files++; }
    if (visible.length) groups.set(rel || 'root', visible.sort((a,b) => (IMPORTANT.indexOf(a)<0?99:IMPORTANT.indexOf(a))-(IMPORTANT.indexOf(b)<0?99:IMPORTANT.indexOf(b)) || a.localeCompare(b)).slice(0,12));
    for (const child of children) walk(child, depth+1);
  }
  walk(root,0); const project = [['python','pyproject.toml'],['node','package.json'],['rust','Cargo.toml'],['go','go.mod']].find(([,f])=>fs.existsSync(path.join(root,f)))?.[0] ?? 'unknown';
  const lines=[`project=${project} files=${files} dirs=${dirs} important=${csv(IMPORTANT.filter(f=>fs.existsSync(path.join(root,f))))}`];
  for (const [name, entries] of [...groups].sort((a,b)=>a[0]==='root'?-1:b[0]==='root'?1:a[0].localeCompare(b[0]))) lines.push(`${displayPath(name)}: ${csv(entries)}`);
  if (omitted.size || truncated) lines.push(`omitted: ${csv([...omitted].sort().concat(truncated?['max_files']:[]))}`); return result(joinLines(lines));
}
