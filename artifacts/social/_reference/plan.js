
const C={"Planned": "#8a8178", "Drafted": "#b07d12", "Manual review \u2013 changes needed": "#b0493a", "Manual review \u2013 confirmed": "#2f7d4f", "Scheduled": "#2f5fb0", "Posted": "#245f50", "Skipped": "#6b6b6b"}, TODAY='2026-10-16', WEEKEND='2026-10-22', KEY='dg-plan-review';
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(x){}
const paint=s=>{s.style.background=C[s.value]||'#888';const box=s.closest('tr')||s.closest('.card');if(box)box.classList.toggle('changed',s.value!==s.dataset.orig)};
const has=v=>v&&(v.s||v.c||v.t!==undefined);const tidy=k=>{if(!has(saved[k]))delete saved[k]};
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(saved))}catch(x){};const n=Object.values(saved).filter(has).length;document.getElementById('count').textContent=n?n+' post'+(n>1?'s':'')+' with your changes':'No changes yet'};
document.querySelectorAll('select.st').forEach(s=>{const k=s.dataset.key;if(saved[k]&&saved[k].s)s.value=saved[k].s;paint(s);
 s.addEventListener('change',()=>{saved[k]={...saved[k],l:s.dataset.label,o:s.dataset.orig};if(s.value===s.dataset.orig)delete saved[k].s;else saved[k].s=s.value;tidy(k);
  document.querySelectorAll('select.st').forEach(o=>{if(o.dataset.key===k){o.value=s.value;paint(o)}});save()})});
document.querySelectorAll('input.cm').forEach(t=>{const k=t.dataset.key;t.value=(saved[k]&&saved[k].c)||'';
 t.addEventListener('input',()=>{saved[k]={...saved[k],l:t.dataset.label,c:t.value};if(!t.value)delete saved[k].c;tidy(k);save()})});
document.querySelectorAll('textarea.tx').forEach(t=>{const k=t.dataset.key,orig=t.value,card=t.closest('.card'),st=card.querySelector('.tx-state');
 const grow=()=>{t.style.height='auto';t.style.height=(t.scrollHeight+4)+'px'};
 const mark=()=>{const ed=t.value!==orig;t.classList.toggle('edited',ed);st.textContent=ed?'Edited (not yet sent to Claude)':'';card.classList.toggle('changed',ed||card.classList.contains('changed'))};
 if(saved[k]&&saved[k].t!==undefined)t.value=saved[k].t;grow();mark();
 t.addEventListener('input',()=>{saved[k]={...saved[k],l:t.dataset.label};if(t.value===orig)delete saved[k].t;else saved[k].t=t.value;tidy(k);grow();mark();save()});
 card.querySelector('.tx-reset').addEventListener('click',()=>{t.value=orig;t.dispatchEvent(new Event('input'))})});
function filter(){const w=document.getElementById('f-when').value,p=document.getElementById('f-plat').value;let n=0;
 document.querySelectorAll('tr.post').forEach(r=>{const d=r.dataset.date;const ok=(w==='all'||(d>=TODAY&&(w==='upcoming'||d<=WEEKEND)))&&(!p||r.dataset.plat===p);r.style.display=ok?'':'none';if(ok)n++});
 document.querySelectorAll('tr.wk').forEach(h=>{let x=h.nextElementSibling,any=false;while(x&&!x.classList.contains('wk')){if(x.style.display!=='none')any=true;x=x.nextElementSibling};h.style.display=any?'':'none'});
 document.getElementById('shown').textContent=n+' posts shown'}
document.getElementById('f-when').onchange=filter;document.getElementById('f-plat').onchange=filter;filter();
document.getElementById('copy').onclick=async()=>{const lines=Object.entries(saved).filter(([k,v])=>has(v)).map(([k,v])=>`- ${v.l} [${k}]: ${v.s?(v.o||'?')+' → '+v.s:'status unchanged'}${v.c?' — '+v.c:''}${v.t!==undefined?'\n  NEW TEXT:\n'+v.t.split('\n').map(x=>'  | '+x).join('\n'):''}`);
 const txt='My marketing review:\n'+(lines.join('\n')||'(no changes)');try{await navigator.clipboard.writeText(txt);alert('Copied. Paste it to Claude.')}catch(x){prompt('Copy this:',txt)}};
document.getElementById('clear').onclick=()=>{if(confirm('Clear your status changes, comments and text edits in this browser?')){saved={};save();location.reload()}};save();
const toc=document.getElementById('toc'),narrow=matchMedia('(max-width:900px)');const fit=()=>{toc.open=!narrow.matches};fit();narrow.addEventListener('change',fit);
toc.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{if(narrow.matches)toc.open=false}));
const links=[...toc.querySelectorAll('a[href^="#"]')],targets=links.map(a=>document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
const mark=()=>{let cur=null;for(const t of targets){if(t.getBoundingClientRect().top<120)cur=t};links.forEach(a=>a.classList.toggle('on',!!cur&&a.getAttribute('href')==='#'+cur.id))};
addEventListener('scroll',mark,{passive:true});mark();
