import { spawn } from 'node:child_process';
export const CAPTURE_MAX_BYTES = 200000, DEFAULT_TIMEOUT_SECONDS = 120;
export function runCommand(args, { cwd, timeout = DEFAULT_TIMEOUT_SECONDS, maxBytes = CAPTURE_MAX_BYTES } = {}) {
  return new Promise((resolve) => { let stdout='',stderr='',truncated=false,timedOut=false,settled=false;
    let child; try { child=spawn(args[0],args.slice(1),{cwd,shell:false}); } catch(error){resolve({args,stdout:'',stderr:`error=subprocess_failed detail=${error.message}`,exitCode:3});return;}
    const append=(kind,chunk)=>{let value=kind==='out'?stdout:stderr;value+=chunk.toString('utf8');if(Buffer.byteLength(value)>maxBytes){value=Buffer.from(value).subarray(0,maxBytes).toString('utf8')+'\n...truncated';truncated=true;}if(kind==='out')stdout=value;else stderr=value;};
    child.stdout.on('data',c=>append('out',c)); child.stderr.on('data',c=>append('err',c));
    child.on('error',error=>{if(settled)return;settled=true;clearTimeout(timer);resolve({args,stdout,stderr:`error=command_not_found command=${error.path}`,exitCode:127,missing:true,truncated});});
    child.on('close',code=>{if(settled)return;settled=true;clearTimeout(timer);resolve({args,stdout,stderr,exitCode:timedOut?124:(code??3),timedOut,truncated});});
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},timeout*1000);
  });
}
