from pathlib import Path
import shutil, hashlib, json, re

LOCAL=Path(__file__).resolve().parents[2]
MASTER=Path(r'\\192.168.1.71\nas\projects\DigiStayBook\marketing')
CAMPAIGN=Path('campaigns/host-voice-research-2026-10-30')
FILES=['MARKETING_PLAN.html','MARKETING_PRODUCTION.html','MARKETING_STRATEGY.html','MARKETING_REFERENCE.html','builder/build_marketing_plan.py']

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for name in FILES:
    assert sha(LOCAL/name)==sha(MASTER/name),f'Local and master differ: {name}; reconcile first'
before={name:sha(MASTER/name) for name in FILES}
embedded=re.search(r'<script id="marketing-content" type="application/json">(.*?)</script>',(MASTER/'MARKETING_PLAN.html').read_text(encoding='utf8'),re.S).group(1)
(LOCAL/CAMPAIGN/'CALENDAR_BEFORE.json').write_text(embedded,encoding='utf8')
for root in [LOCAL,MASTER]:
    archive=root/'_archive/2026-10-30-before-host-voice-research'
    assert not archive.exists(),'Archive already exists; do not replace it'
    for name in FILES:
        target=archive/name;target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(root/name,target)

source=(LOCAL/'builder/build_marketing_plan.py').read_text(encoding='utf8')
needle="(ROOT/'MARKETING_PLAN.html').write_text(page,encoding='utf-8')"
assert source.count(needle)==1
addition='''research='campaigns/host-voice-research-2026-10-30/CAMPAIGN_REVIEW.html'
if (ROOT/research).is_file():
    campaign_section=f'<section id="campaigns"><h2>Campaigns</h2><p><a href="{research}"><b>October 30 · Host voice: research, Claude review and five campaign drafts →</b></a></p><p class="small">New policy research and a proposed message test. Draft alternatives; the dated calendar is unchanged.</p></section>'
    page=page.replace('<section id="more">',campaign_section+'<section id="more">',1)
'''
(LOCAL/'builder/build_marketing_plan.py').write_text(source.replace(needle,addition+needle),encoding='utf8')
(MASTER/CAMPAIGN).mkdir(parents=True,exist_ok=False)
shutil.copytree(LOCAL/CAMPAIGN,MASTER/CAMPAIGN,dirs_exist_ok=True)
shutil.copy2(LOCAL/'builder/build_marketing_plan.py',MASTER/'builder/build_marketing_plan.py')
(LOCAL/CAMPAIGN/'INTEGRATION_BEFORE.json').write_text(json.dumps(before,indent=2),encoding='utf8')
print('Archived five files on local and NAS; copied campaign and updated builder. Run the NAS builder, then verify calendar equality.')
