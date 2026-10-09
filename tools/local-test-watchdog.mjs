import {stopProcessTree} from './local-test-processes.mjs';

// Runs outside the terminal's process group. If the terminal or npm forcibly
// closes the launcher, its IPC disconnect still cleans up the known Test trees.
let trees=[];
let disarmed=false;
process.on('message',message=>{
  if(message.action==='track') trees=message.trees;
  if(message.action==='disarm') {disarmed=true;process.exit(0);}
});
process.on('disconnect',async()=>{
  if(disarmed)return;
  await Promise.allSettled(trees.map(tree=>stopProcessTree(
    {pid:tree.pid,exitCode:null,signalCode:null},tree.members
  )));
  process.exit(0);
});
