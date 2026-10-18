import fs from 'node:fs';

export function installAiTestView(doc) {
  const controls=doc.querySelector('.environment-switcher');
  doc.querySelector('.standfirst').textContent='Review AI results alongside your own Mobile and Desktop checks. Both progress summaries stay visible for the selected environment.';
  doc.getElementById('environmentSaveHint').textContent='AI evidence is saved in this document. Human entries save in this browser.';
  const matrix=(side=false)=>`<table class="joint-progress"><caption>${side?'Progress':'AI and human progress'}</caption><thead><tr><th>Steps</th><th>AI</th><th>Human</th></tr></thead><tbody>${[['complete','Complete'],['pass','Pass'],['fail','Fail'],['remaining','Remaining'],['review','Needs review']].map(([key,label])=>`<tr data-joint="${key}"><th scope="row">${label}</th><td data-ai>0</td><td data-human>0</td></tr>`).join('')}</tbody></table>`;
  const joint=doc.createElement('section');joint.id='jointProgress';joint.setAttribute('aria-label','AI and human progress');joint.innerHTML=matrix()+'<p id="jointProgressNote"></p>';controls.after(joint);
  const side=doc.createElement('div');side.id='jointSidebarProgress';side.innerHTML=matrix(true);doc.getElementById('tally').after(side);doc.getElementById('tally').hidden=true;
  doc.getElementById('bReset').textContent='Reset human';
  for(const option of doc.querySelectorAll('option[value="blocked"]'))option.textContent='Blocked / not built';
  for(const table of doc.querySelectorAll('table.steps')) {
    const head=table.querySelector('thead tr'),th=doc.createElement('th');th.scope='col';th.className='ai-result-column';th.textContent='Tested with AI';head.insertBefore(th,head.children[3]);
    head.children[4].textContent='Human Mobile';head.children[5].textContent='Human Desktop';head.children[6].textContent='Human date';head.children[7].textContent='Human evidence / notes';
    for(const row of table.querySelectorAll('tr[data-step-id]')) {
      const cell=doc.createElement('td');cell.className='ai-result-column';cell.dataset.label='Tested with AI';
      for(const record of row.querySelectorAll('.ai-step-record')) {
        const outcome=record.querySelector('.ai-outcome'),detail=record.querySelector('.ai-evidence');detail.querySelector('summary').textContent='Evidence';
        for(const content of [...record.querySelectorAll('.ai-date,:scope > p')])detail.insertBefore(content,detail.children[1]);
        record.querySelector('.ai-tested').remove();record.replaceChildren(outcome,detail);cell.append(record);
      }row.insertBefore(cell,row.children[3]);
    }
  }
  const indexHead=doc.querySelector('table.idx thead tr');indexHead.children[2].textContent='Human progress';
  const aiHead=doc.createElement('th');aiHead.textContent='AI progress';aiHead.className='idxprogress-ai-head';indexHead.insertBefore(aiHead,indexHead.children[2]);
  for(const row of doc.querySelectorAll('table.idx tbody tr')) {
    const human=row.querySelector('.idxprogress');if(human){const ai=human.cloneNode(true);ai.className='idxprogress-ai';human.before(ai);}else if(row.querySelector('[colspan]'))row.querySelector('[colspan]').colSpan=6;
  }
  function disclosure(label,nodes,id){const panel=doc.createElement('details');panel.className='reference-panel';if(id)panel.id=id;const summary=doc.createElement('summary');summary.textContent=label;panel.append(summary);nodes[0].before(panel);panel.append(...nodes);return panel;}
  const runcard=doc.getElementById('runcard'),how=runcard.previousElementSibling;
  const setup=disclosure('How to use this checklist and run details',[how,runcard],'checklist-help');
  const basis=doc.getElementById('basis'),basisNodes=[basis];let next=basis.nextSibling;
  while(next&&!(next.nodeType===1&&next.matches('h2.sec'))){basisNodes.push(next);next=next.nextSibling;}
  disclosure('Before you start · accounts, files and recording results',basisNodes,'before-start-guide');
  const scope=doc.getElementById('test-data-scope-2026-10-06'),decisions=doc.getElementById('final-test-decisions-2026-10-06');
  const safety=doc.createElement('details');safety.className='reference-panel';safety.innerHTML='<summary>Agreed test scope and expectations</summary>';setup.after(safety);safety.append(scope,decisions);
  const progress=doc.getElementById('checksProgress');disclosure('Detailed human procedure and device totals',[progress],'human-progress-detail');
  const summary=doc.getElementById('ai-run-summary'),compact=doc.createElement('details');compact.id=summary.id;compact.className='reference-panel';compact.innerHTML='<summary>AI run evidence and findings · 17 October 2026</summary>';compact.append(...summary.childNodes);summary.replaceWith(compact);
  compact.querySelector('p').textContent='AI and human results appear together. Record a different human result and explain it in the notes when your observation differs. Partial or blocked AI steps remain incomplete.';
  const oldNote=[...compact.querySelectorAll('p')].find(p=>p.textContent.startsWith('Partial does not count'));oldNote.textContent='AI results and human results are independent. Existing human results and dates, evidence and previous shared-register entries are retained.';
  const style=doc.createElement('style');style.textContent=`
    @media screen and (min-width:901px){#shell{grid-template-columns:var(--sidebar) minmax(0,1fr)}.wrap{max-width:none;padding-inline:20px}}
    @media screen and (min-width:1100px){:root{--sidebar:260px}}
    .mast{padding:24px 0 18px;margin-bottom:18px}.mast h1{font-size:36px}.mast .standfirst{margin-bottom:14px}.docctl{display:none}
    .environment-switcher{flex-wrap:wrap}.environment-switcher select{font:inherit;padding:7px 10px}
    #jointProgress{margin-top:16px;border:1px solid var(--rule);border-radius:6px;background:white;padding:10px 14px}
    .joint-progress{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}
    .joint-progress caption{text-align:left;font-weight:700;margin-bottom:6px}.joint-progress th,.joint-progress td{padding:4px 10px;border-bottom:1px solid var(--rule);text-align:right}
    .joint-progress th:first-child{text-align:left;width:42%;font-weight:500}.joint-progress thead th{font-weight:700}.joint-progress td{font-weight:700;font-variant-numeric:tabular-nums}
    #jointProgressNote{font-size:11px;color:var(--ink-500);margin:8px 0 0}
    #jointSidebarProgress{margin:12px 12px 16px;padding:8px;background:rgba(245,241,232,.06);border-radius:5px}
    #jointSidebarProgress .joint-progress{font-size:11px}#jointSidebarProgress th,#jointSidebarProgress td{padding:4px;border-color:rgba(245,241,232,.12)}
    .reference-panel,#ai-run-summary{border:1px solid var(--rule);border-radius:5px;padding:10px 14px;margin:10px 0;background:var(--paper-050)}
    .reference-panel>summary{font-size:13px;font-weight:700;cursor:pointer}.reference-panel .panel{margin:12px 0}.reference-panel h2{margin-top:16px}
    #tally[hidden]{display:none}.ai-result-column .ai-step-record{border:0;margin:0;padding:0;min-width:0}.ai-result-column .ai-outcome{font-size:12px;margin:0 0 6px}.ai-result-column .ai-evidence p{overflow-wrap:anywhere}
    table.idx{table-layout:fixed;width:100%}table.idx th:first-child{width:11%!important}table.idx th:nth-child(2){width:30%}table.idx th:nth-child(3),table.idx th:nth-child(4){width:17%!important}table.idx th:nth-child(5){width:9%!important}table.idx th:nth-child(6){width:16%!important}
    table.idx .idxprogress-ai{font-size:11px;vertical-align:top}table.idx .idxprogress-ai .check-outcome,table.idx .idxprogress-ai .check-counts{display:block}
    table.idx td,table.idx th{overflow-wrap:anywhere}table.idx .pill{white-space:normal;max-width:100%;font-size:8px;box-sizing:border-box}table.idx .idxid{white-space:normal}
    table.idx .idxb{display:table-cell!important;width:auto!important}table.idx .idxb .pill{display:table;white-space:normal!important;width:auto;max-width:100%;margin:2px 0;overflow-wrap:anywhere}
    @media screen and (min-width:901px){@container(min-width:840px){
      table.steps{display:table;width:100%}table.steps thead{display:table-header-group}table.steps tbody{display:table-row-group}table.steps tr{display:table-row;padding:0}
      table.steps td{display:table-cell!important;width:auto;padding:8px 5px;vertical-align:top;border-bottom:1px solid var(--rule)}table.steps td::before{content:none!important}
      table.steps th:first-child,table.steps td.step-id{width:9%}table.steps th:nth-child(2){width:18%}table.steps th:nth-child(3){width:24%}
      table.steps th.ai-result-column,table.steps td.ai-result-column{width:11%;text-align:left}table.steps th:nth-child(5),table.steps th:nth-child(6){width:6%;font-size:10px;letter-spacing:0;overflow-wrap:normal;word-break:normal}
      table.steps th.step-date-heading,table.steps td.step-date-cell{width:11%}table.steps th.step-evidence-heading,table.steps td.step-evidence-cell{width:15%}
      table.steps td.exp{margin:0;border-radius:0}table.steps select.step-device-result{width:100%}table.steps input.step-test-date{width:100%}
    }}
    @container(max-width:839px){table.steps td.ai-result-column{display:block;width:100%;padding:8px 0}table.steps td.ai-result-column::before{content:'Tested with AI';display:block;font-weight:700;margin-bottom:5px}}
    @media(max-width:760px){.joint-progress{font-size:12px}table.idx th,table.idx td{overflow-wrap:anywhere}table.idx .idxprogress-ai,table.idx .idxprogress-ai-head{display:table-cell!important}}
  `;doc.head.append(style);
  const script=[...doc.scripts].find(s=>s.textContent.includes("var KEY = 'dsb-testproc-v2'"));script.before(doc.getElementById('ai-run-results'));
  let source=script.textContent;
  const replace=(before,after)=>{if(!source.includes(before))throw Error('Missing joint-view integration anchor: '+before);source=source.replace(before,after);};
  replace('  var state = store._environmentRuns[activeEnvironment];','  var state = store._environmentRuns[activeEnvironment];\n'+fs.readFileSync(new URL('./ai-qa-joint-runtime.js',import.meta.url),'utf8'));
  replace('    });\n  }\n\n  /* ---- run selector','    });\n    refreshJointProgress(scope);\n  }\n\n  /* ---- run selector');
  replace('      var status = testProgress(t).status;','      var statuses = [testProgress(t).status,aiTestProgress(t).status];');
  replace("      var matches = selected === 'all' || selected === status || selected === 'complete' && (status === 'pass' || status === 'fail') || selected === 'incomplete' && ['untested','progress','review','blocked'].indexOf(status) > -1;","      var matches = statuses.some(function(status){return selected === 'all' || selected === status || selected === 'complete' && (status === 'pass' || status === 'fail') || selected === 'incomplete' && ['untested','progress','review','blocked'].indexOf(status)>-1;});");
  replace("  on('bCopy', 'click', function(){","  on('bCopy', 'click', function(){\n    copyJointResults();return;");
  replace("Clear the '","Clear the human '");
  replace('<span class="rk">Result</span>','<span class="rk">Human result</span>');
  replace("    if (!target) return;\n    var test = target.classList.contains('test')", "    if (!target) return;\n    var guide=target.closest('details.reference-panel');if(guide)guide.open=true;\n    var test = target.classList.contains('test')");
  replace('  /* ---- highlight the contents entry in view ---- */',`  document.addEventListener('click',function(event){var link=event.target.closest('a[href^="#"]');if(!link)return;var target=byId(link.getAttribute('href').slice(1));if(!target)return;var panel=target.closest('details.reference-panel');if(panel)panel.open=true;});
  /* ---- highlight the contents entry in view ---- */`);
  script.textContent=source;
}
