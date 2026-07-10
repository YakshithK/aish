import { spawn } from 'node:child_process';
export const CAPTURE_MAX_BYTES = 200000, DEFAULT_TIMEOUT_SECONDS = 120;
export function runCommand(args, { cwd, timeout = DEFAULT_TIMEOUT_SECONDS, maxBytes = CAPTURE_MAX_BYTES } = {}) {
  return new Promise((resolve) => { const outChunks=[],errChunks=[]; let truncated=false,timedOut=false,settled=false;
    let child; try { child=spawn(args[0],args.slice(1),{cwd,shell:false,stdio:['ignore','pipe','pipe']}); } catch(error){resolve({args,stdout:'',stderr:`error=subprocess_failed detail=${error.message}`,exitCode:3});return;}
    child.stdout.on('data',c=>outChunks.push(c)); child.stderr.on('data',c=>errChunks.push(c));
    const captured=chunks=>{const buffer=Buffer.concat(chunks);if(buffer.length<=maxBytes)return buffer.toString('utf8');truncated=true;return buffer.subarray(0,maxBytes).toString('utf8')+'\n...truncated';};
    child.on('error',error=>{if(settled)return;settled=true;clearTimeout(timer);resolve({args,stdout:'',stderr:`error=command_not_found command=${error.path}`,exitCode:127,missing:true,truncated});});
    child.on('close',code=>{if(settled)return;settled=true;clearTimeout(timer);const stdout=captured(outChunks),stderr=captured(errChunks);resolve({args,stdout,stderr,exitCode:timedOut?124:(code??3),timedOut,truncated});});
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},timeout*1000);
  });
}
