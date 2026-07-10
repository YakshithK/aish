import fs from 'node:fs';
import { parsePathRange, requireFile, looksBinary, readLines, VIEW_INLINE_MAX_LINES } from '../fs.js'; import { joinLines, result } from '../output.js';
export function run(target) {
  const range=parsePathRange(target), file=requireFile(range.path); if (looksBinary(file)) return result(joinLines([`file=${file} binary=true lines=? omitted=content`]));
  const lines=readLines(file), total=lines.length; if (range.start != null || total<=VIEW_INLINE_MAX_LINES) { const start=range.start??1,end=Math.min(range.end??total,total); const out=[`file=${file} lines=${total} range=${start}-${end}`]; for(let i=start;i<=end;i++) out.push(`${i}: ${lines[i-1]??''}`); if ((range.end??total)>total) out.push('omitted=range_past_eof'); return result(joinLines(out)); }
  let imports=0,exports=0; const funcs=[]; const patterns=[/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/u,/^\s*function\s+([\w$]+)\s*\(/u,/^\s*(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:\(|[\w$]+\s*=>)/u];
  lines.forEach((text,index)=>{const s=text.trim();if(/^(import |from |#include)/u.test(s))imports++;if(s.startsWith('export '))exports++;for(const p of patterns){const m=text.match(p);if(m&&funcs.length<12){funcs.push(`${m[1]}:${index+1}-${Math.min(index+41,total)}`);break;}}});
  const first=funcs[0]?.split(':')[1]??`1-${Math.min(120,total)}`; return result(joinLines([`file=${file} lines=${total} imports=${imports} exports=${exports} funcs=${funcs.join(',')||'-'}`,`use: aish view ${file}:${first}`,'omitted=full_file']));
}
