import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const out='artifacts/qa/2026-10-17';
fs.mkdirSync(out,{recursive:true});
const nas='//192.168.1.71/nas/projects/DigiStayBook/business-operations/DIGISTAYBOOK_TEST_PROCEDURES.html';
for(const [key,path] of [['nas',nas],['local','docs/handbook/DIGISTAYBOOK_TEST_PROCEDURES.html']]) {
  const html=fs.readFileSync(path,'utf8');fs.writeFileSync(`${out}/${key}-before.html`,html);
  const doc=new JSDOM(html).window.document;
  const steps=[...doc.querySelectorAll('details.test')].flatMap(test=>[...test.querySelectorAll('tr[data-step-id]')].map(row=>({id:row.dataset.stepId,test:test.id,env:test.dataset.env,action:row.cells[1].textContent.trim(),expected:row.cells[2].textContent.trim()})));
  fs.writeFileSync(`${out}/${key}-steps.json`,JSON.stringify(steps,null,2));
  console.log(key,doc.querySelectorAll('details.test').length,steps.length);
}
// Keep the other project's running emulators untouched. Use a separate local stack.
const ports={5181:15181,4400:14400,9099:19099,8080:18080,9199:19199,5001:15001,4000:14000,4500:14500,9150:19150,9299:19299,9499:19499};
const replacePorts=s=>s.replace(/\b(5181|4400|9099|8080|9199|5001|4000|4500|9150|9299|9499)\b/g,m=>String(ports[m]));
const config=JSON.parse(replacePorts(fs.readFileSync('firebase.test.json','utf8')));
config.functions.source='.local-test-ai/functions';
Object.assign(config.emulators,{hub:{host:'127.0.0.1',port:14400},logging:{host:'127.0.0.1',port:14500},eventarc:{host:'127.0.0.1',port:19299},tasks:{host:'127.0.0.1',port:19499}});
config.emulators.firestore.websocketPort=19150;
fs.writeFileSync('firebase.ai-qa.json',JSON.stringify(config,null,2));
let launcher=replacePorts(fs.readFileSync('tools/local-test.mjs','utf8')).replaceAll('.local-test/','.local-test-ai/').replaceAll("'.local-test'","'.local-test-ai'").replaceAll('firebase.test.json','firebase.ai-qa.json');
// Configure the temporary Vite mode without changing the normal local-test environment.
launcher=launcher.replace("await cp('.env.emulator','.env.emulator.local');","await writeFile('.env.ai-qa',"+JSON.stringify(replacePorts(fs.readFileSync('.env.emulator','utf8')))+");");
launcher=launcher.replace("'--mode','emulator'","'--mode','ai-qa'");
launcher=launcher.replace('},30000);','},300000);');
fs.writeFileSync('tools/.ai-qa-local.mjs',launcher);
for(const name of ['verify-local-test','verify-public-wall','verify-guest-contribution','verify-storage-deletion','verify-reporting','verify-incomplete-screening','verify-consent-retention','verify-guest-names','verify-screening-budget','verify-operations-notify']) {
  fs.writeFileSync(`tools/.ai-qa-${name}.mjs`,replacePorts(fs.readFileSync(`tools/${name}.mjs`,'utf8')));
}
