import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {rememberProcessTree,stopProcessTree} from './local-test-processes.mjs';

async function fixture() {
  const serverCode = `const server=require('node:http').createServer((req,res)=>res.end('ready'));server.listen(0,'127.0.0.1',()=>console.log(server.address().port));`;
  const parentCode = `const child=require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(serverCode)}],{stdio:['ignore','pipe','inherit'],windowsHide:true});child.stdout.pipe(process.stdout);setInterval(()=>{},1000);`;
  const parent=spawn(process.execPath,['-e',parentCode],{detached:true,windowsHide:true,stdio:['ignore','pipe','inherit']});
  const [chunk]=await once(parent.stdout,'data',{signal:AbortSignal.timeout(10000)});
  const port=Number(String(chunk).trim());
  assert.ok(port>0);
  const members=await rememberProcessTree(parent);
  assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(),'ready');
  return {parent,port,members};
}

async function assertReleased(port) {
  const probe=createServer();
  await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(port,'127.0.0.1',resolve);});
  await new Promise(resolve=>probe.close(resolve));
}

test('stopping a live launcher releases its child server port',async()=>{
  const {parent,port,members}=await fixture();
  try { await stopProcessTree(parent,members); await assertReleased(port); }
  finally { await stopProcessTree(parent,members); }
});

test('cleanup releases a child port even after its parent has crashed',async()=>{
  const {parent,port,members}=await fixture();
  try {
    const exited=once(parent,'exit');
    parent.kill('SIGKILL');
    await exited;
    await stopProcessTree(parent,members);
    await assertReleased(port);
  } finally { await stopProcessTree(parent,members); }
});

test('the detached watchdog cleans Test children when launcher IPC closes',async()=>{
  const {parent,port,members}=await fixture();
  const watchdog=spawn(process.execPath,['tools/local-test-watchdog.mjs'],{
    detached:true,windowsHide:true,stdio:['ignore','ignore','ignore','ipc']
  });
  try {
    await new Promise((resolve,reject)=>watchdog.send({action:'track',trees:[{pid:parent.pid,members}]},error=>error?reject(error):resolve()));
    const exited=once(watchdog,'exit',{signal:AbortSignal.timeout(30000)});
    watchdog.disconnect();
    await exited;
    await assertReleased(port);
  } finally { await stopProcessTree(parent,members); if(watchdog.connected)watchdog.disconnect(); }
});
