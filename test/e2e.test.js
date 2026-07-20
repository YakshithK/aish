import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { dispatch } from '../src/cli.js';

test('Node command surface supports the complete agent workflow',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'aish-e2e-'));
  fs.writeFileSync(path.join(root,'pyproject.toml'),"[project]\nname='sample'\n");
  fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src','auth.py'),'def login():\n    return 200\n');
  spawnSync('git',['init'],{cwd:root});
  const previous=process.cwd();process.chdir(root);
  try {
    assert.match((await dispatch(['init'])).stdout,/agent_rules=installed/);
    assert.match((await dispatch(['doctor'])).stdout,/agent_rules=ok/);
    assert.match((await dispatch(['inspect'])).stdout,/next: aish view <important-file>/);
    assert.match((await dispatch(['tree'])).stdout,/project=python/);
    assert.match((await dispatch(['search','login'])).stdout,/src\/auth.py count=1 lines=1/);
    assert.match((await dispatch(['view','src/auth.py:1-2'])).stdout,/1: def login/);
    assert.match((await dispatch(['status'])).stdout,/branch=/);
    const failed=await dispatch(['test','--',process.execPath,'-e',"console.log('FAILED tests/test_auth.py::test_login - AssertionError: expected 200');process.exit(1)"]);
    assert.equal(failed.exitCode,1);assert.match(failed.stdout,/FAIL tests\/test_auth.py::test_login/);
  } finally { process.chdir(previous); }
});
