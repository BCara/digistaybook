  var aiRun = JSON.parse(document.getElementById('ai-run-results').textContent);
  function aiRecord(row) { return aiRun.steps[row.dataset.stepId][activeEnvironment]; }
  function aiStepCounts(scope) {
    var c={pass:0,fail:0,partial:0,blocked:0,na:0};
    scope.forEach(function(test){list('tr[data-step-id]',test).forEach(function(row){c[aiRecord(row).status]++;});});return c;
  }
  function aiTestProgress(test) {
    var c=aiStepCounts([test]),total=c.pass+c.fail+c.partial+c.blocked;
    return {status:!total?'na':c.fail?'fail':c.pass===total?'pass':c.partial?'review':c.pass?'progress':'blocked',pass:c.pass,fail:c.fail,review:c.partial,untested:c.blocked,recorded:c.pass+c.fail+c.partial,total:total};
  }
  function humanStepCounts(scope) {
    var c={pass:0,fail:0,partial:0,review:0,blocked:0,na:0,untested:0};
    scope.forEach(function(test){list('tr[data-step-id]',test).forEach(function(row){
      var values=list('.step-device-result',row).map(function(input){return input.value;}),manual=(state[test.id]||{}).status;
      var status=values.indexOf('fail')>=0?'fail':values.indexOf('review')>=0?'review':values.length&&values.every(function(value){return value==='pass';})?'pass':manual==='na'?'na':manual==='blocked'?'blocked':values.some(Boolean)?'partial':'untested';
      c[status]++;
    });});return c;
  }
  function combinedStatus(test) {
    var a=aiTestProgress(test).status,h=testProgress(test).status;
    return a==='fail'||h==='fail'?'fail':a==='review'||h==='review'?'review':a==='pass'&&h==='pass'?'pass':a==='na'&&h==='na'?'na':a==='blocked'&&h==='untested'?'blocked':'progress';
  }
  function refreshJointProgress(scope) {
    var a=aiStepCounts(scope),h=humanStepCounts(scope),at=a.pass+a.fail+a.partial+a.blocked,ht=h.pass+h.fail+h.partial+h.review+h.blocked+h.untested;
    var fields={complete:[(a.pass+a.fail)+' / '+at,(h.pass+h.fail)+' / '+ht],pass:[a.pass,h.pass],fail:[a.fail,h.fail],remaining:[a.partial+a.blocked,h.partial+h.review+h.blocked+h.untested],review:[a.partial,h.partial+h.review]};
    Object.keys(fields).forEach(function(key){list('[data-joint="'+key+'"]').forEach(function(row){row.querySelector('[data-ai]').textContent=fields[key][0];row.querySelector('[data-human]').textContent=fields[key][1];});});
    byId('jointProgressNote').textContent='Step totals for '+(activeEnvironment==='local'?'Local Test':'Live site')+'. AI: '+a.partial+' partial, '+a.blocked+' blocked. Human: a step passes when both Mobile and Desktop pass; one-device checks remain incomplete. Complete = pass + fail.';
    tests.forEach(function(test){
      var p=aiTestProgress(test),row=indexRow(test.id),cell=row&&row.querySelector('.idxprogress-ai');
      if(cell){cell.querySelector('.check-outcome').textContent={pass:'Passed',fail:'Failed',review:'Partial',progress:'In progress',blocked:'Blocked',na:'Outside scope'}[p.status];cell.querySelector('.check-outcome').dataset.status=p.status;cell.querySelector('.check-counts').textContent=(p.pass+p.fail)+'/'+p.total+' complete';}
      var humanCell=row&&row.querySelector('.idxprogress'),hc=humanStepCounts([test]),htotal=hc.pass+hc.fail+hc.partial+hc.review+hc.blocked+hc.untested;
      if(humanCell){humanCell.querySelector('.check-counts').textContent=(hc.pass+hc.fail)+'/'+htotal+' complete';humanCell.title='Human steps: '+hc.pass+' passed, '+hc.fail+' failed, '+(hc.review+hc.partial)+' need review; '+(hc.untested+hc.blocked)+' not completed. Overall human procedure result remains separate.';}
      ['pass','fail','review','blocked','na'].forEach(function(status){test.classList.toggle('is-'+status,combinedStatus(test)===status);});
      var link=tocLink(test.id);if(link)link.dataset.st=combinedStatus(test);
    });
  }
  function copyJointResults() {
    var clean=function(value){return String(value||'').replace(/\|/g,'/').replace(/\r?\n/g,'<br>');};
    var lines=['# DigiStayBook — AI and human results — '+(activeEnvironment==='local'?'Local Test':'Live site'),'','| Step | AI result | AI evidence | Human Mobile | Human Desktop | Human date | Human evidence |','| --- | --- | --- | --- | --- | --- | --- |'];
    tests.filter(inRun).forEach(function(test){list('tr[data-step-id]',test).forEach(function(row){var a=aiRecord(row);lines.push('| '+row.dataset.stepId+' | '+a.status+' | '+clean(a.note)+' | '+(row.querySelector('.step-mobile').value||'Not run')+' | '+(row.querySelector('.step-desktop').value||'Not run')+' | '+clean(row.querySelector('.step-test-date').value)+' | '+clean(stepRecordedNotes(row))+' |');});});
    var text=lines.join('\n');if(navigator.clipboard)navigator.clipboard.writeText(text).then(function(){alert('Copied AI and human results.');},function(){window.prompt('Copy results:',text);});else window.prompt('Copy results:',text);
  }
