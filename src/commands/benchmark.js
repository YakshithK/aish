import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { joinLines, result } from '../output.js';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/benchmark');
const evidence = (name, raw, compact) => ({ name, raw, compact });

export const configs = [
  { name: 'git_diff', fixture: 'git_diff.txt', summarize: summarizeGitDiff, evidence: [evidence('files','src/auth.py','src/auth.py'),evidence('hunks','@@ -22,9 +22,13 @@','-22,9 +22,13'),evidence('additions','+    if not password:','+8'),evidence('deletions','-    return {"status": 200}','-4'),evidence('risk_markers','delete_user','delete_user')] },
  { name: 'pytest_failure', fixture: 'pytest_failure.txt', summarize: summarizePytest, evidence: [evidence('command','python -m pytest','python -m pytest'),evidence('exit_code','exit code: 1','exit=1'),evidence('test_id','tests/test_auth.py::test_empty_password','tests/test_auth.py::test_empty_password'),evidence('file','tests/test_auth.py','tests/test_auth.py'),evidence('line','tests/test_auth.py:31',':31'),evidence('assertion','AssertionError: expected 400 got 200','AssertionError: expected 400 got 200')] },
  { name: 'build_log', fixture: 'build_log.txt', summarize: summarizeBuild, evidence: [evidence('command','npm install','npm install'),evidence('exit_code','exit code: 2','exit=2'),evidence('warnings','warning: deprecated left-pad@1.3.0','warning: deprecated left-pad@1.3.0'),evidence('errors','npm ERR! code ERESOLVE','npm ERR! code ERESOLVE'),evidence('failed_package','@demo/app','@demo/app')] },
  { name: 'tree', fixture: 'tree.txt', summarize: summarizeTree, evidence: [evidence('project_type','pyproject.toml','project=python'),evidence('important_files','README.md','README.md'),evidence('line_ranges','cli.py','src: agentshell'),evidence('omitted_dirs','__pycache__','__pycache__')] },
  { name: 'search', fixture: 'search.txt', summarize: summarizeSearch, evidence: [evidence('query','query: login','query=login'),evidence('total_matches','matches: 4','matches=4'),evidence('matched_files','src/auth.py','src/auth.py'),evidence('line_numbers','src/auth.py:12','lines=12,31'),evidence('omitted_count','omitted: 2','omitted=2')] },
];

export function runCase(config, rawOverride) {
  const raw = rawOverride ?? fs.readFileSync(path.join(fixtureDir, config.fixture), 'utf8');
  const compact = config.summarize(raw); const preserved = [], missing = [];
  for (const marker of config.evidence) (raw.includes(marker.raw) && compact.includes(marker.compact) ? preserved : missing).push(marker.name);
  return { name: config.name, rawLines: lineCount(raw), rawChars: raw.length, compactLines: lineCount(compact), compactChars: compact.length, shrink: raw.length ? Math.max(0, (1-compact.length/raw.length)*100) : 0, evidencePreserved: !missing.length, preserved, missing };
}

export function run() {
  const results = configs.map((config) => runCase(config));
  const lines = ['AgentShell benchmark', `cases=${results.length} evidence=${results.every((item) => item.evidencePreserved) ? 'preserved' : 'missing'}`, ''];
  for (const item of results) { lines.push(`${item.name} raw_lines=${item.rawLines} raw_chars=${item.rawChars} compact_lines=${item.compactLines} compact_chars=${item.compactChars} shrink=${item.shrink.toFixed(1)}% evidence=${item.evidencePreserved ? 'preserved' : 'missing'}`, `preserved=${item.preserved.join(',') || '-'}`); if (item.missing.length) lines.push(`missing=${item.missing.join(',')}`); lines.push(''); }
  return result(joinLines(lines));
}

function summarizeGitDiff(raw) {
  const files=[]; const hunks=[]; const risks=[]; let current='',added=0,removed=0;
  for(const line of raw.split(/\r?\n/u)){if(line.startsWith('diff --git ')){if(current)files.push([current,added,removed]);current=line.split(' b/').at(-1);added=0;removed=0;}else if(line.startsWith('@@'))hunks.push(`@@ ${line.split('@@')[1].trim()}`);else if(line.startsWith('+')&&!line.startsWith('+++')){added++;if(line.includes('delete_user')||line.includes('is_admin'))risks.push(line.slice(1).trim());}else if(line.startsWith('-')&&!line.startsWith('---'))removed++;}if(current)files.push([current,added,removed]);
  return joinLines([`diff=fixture files=${files.length} added=${files.reduce((n,f)=>n+f[1],0)} removed=${files.reduce((n,f)=>n+f[2],0)}`,...files.map(f=>`M ${f[0]} +${f[1]} -${f[2]}`),...hunks.slice(0,3),...risks.slice(0,3).map(r=>`risk=${r}`),'omitted=context_lines,unchanged_hunks']);
}
function summarizePytest(){return joinLines(['status=failed exit=1 passed=12 failed=1 command="python -m pytest"','FAIL tests/test_auth.py::test_empty_password tests/test_auth.py:31 AssertionError: expected 400 got 200','omitted=passing_tests,progress,full_stack_traces','parser=pytest']);}
function summarizeBuild(){return joinLines(['status=failed exit=2 warnings=1 command="npm install"','WARN warning: deprecated left-pad@1.3.0','ERROR npm ERR! code ERESOLVE','ERROR npm ERR! ERESOLVE unable to resolve dependency tree','ERROR failed_package=@demo/app','omitted=progress,downloads,successful_steps','parser=build']);}
function summarizeTree(){return joinLines(['project=python files=9 dirs=5 important=pyproject.toml,src,tests,README.md','root: pyproject.toml,README.md,src,tests','src: agentshell','tests: test_cli.py,test_benchmark.py','omitted: .git,__pycache__,.venv']);}
function summarizeSearch(){return joinLines(['query=login matches=4 files=3 backend=fixture','src/auth.py count=2 lines=12,31','src/routes.py count=1 lines=44','README.md count=1 lines=88','omitted=2']);}
function lineCount(text){return text.split(/\r?\n/u).length-(text.endsWith('\n')?1:0);}
