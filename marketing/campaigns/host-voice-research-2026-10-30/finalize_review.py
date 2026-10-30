from pathlib import Path
import re,json,shutil,hashlib

HERE=Path(__file__).resolve().parent
LOCAL=HERE.parents[1]
MASTER=Path(r'\\192.168.1.71\nas\projects\DigiStayBook\marketing')
REL=HERE.relative_to(LOCAL)
hub=(MASTER/'MARKETING_PLAN.html').read_text(encoding='utf8')
data=json.loads(re.search(r'<script id="marketing-content" type="application/json">(.*?)</script>',hub,re.S).group(1))
assert data==json.loads((HERE/'CALENDAR_BEFORE.json').read_text(encoding='utf8')),'Calendar changed'
assert 'id="campaigns"' in hub and str(REL).replace('\\','/')+'/CAMPAIGN_REVIEW.html' in hub
for name in ['MARKETING_PLAN.html','MARKETING_PRODUCTION.html','MARKETING_STRATEGY.html','MARKETING_REFERENCE.html']:
    shutil.copy2(MASTER/name,LOCAL/name)
posts=set();comments=set()
for p in HERE.glob('facebook-*.txt'):
    text=p.read_text(encoding='utf8')
    posts.update(re.findall(r'https://www.facebook.com/groups/\d+/posts/\d+/',text))
    comments.update(re.findall(r'comment_id=(\d+)',text))
assert len(posts)==6 and len(comments)==12,(len(posts),len(comments))
evidence={'observed_sydney_date':'2026-10-30','posts':sorted(posts),'distinct_visible_comment_ids':len(comments),'groups':2,'method':'Convenience sample from Recent activity and Most relevant feeds; displayed comment previews; not a frequency study','claude_conversation':'https://claude.ai/chat/dd50092a-343d-4b10-905e-d5446f55b353','calendar_items_unchanged':len(data['posts']),'browser_recovery_error':'encode latest capture frame failed: window crop is outside captured monitor; repeated after window recovery; further Facebook sampling stopped'}
(HERE/'EVIDENCE_SUMMARY.json').write_text(json.dumps(evidence,indent=2),encoding='utf8')
shutil.copytree(HERE,MASTER/REL,dirs_exist_ok=True)
files=[]
for p in HERE.iterdir():
    if not p.is_file() or p.name=='NAS_COPY_PROOF.json':continue
    target=MASTER/REL/p.name
    sha=lambda v:hashlib.sha256(v.read_bytes()).hexdigest()
    assert sha(p)==sha(target),p.name
    files.append({'file':p.name,'sha256':sha(p)})
proof={'files':files,'calendar_unchanged':True,'hub_sha256':hashlib.sha256(hub.encode('utf8')).hexdigest(),'scope':'Review documents and hub links only; no external publication, account actions, app deployment or spending'}
(HERE/'NAS_COPY_PROOF.json').write_text(json.dumps(proof,indent=2),encoding='utf8')
shutil.copy2(HERE/'NAS_COPY_PROOF.json',MASTER/REL/'NAS_COPY_PROOF.json')
print(json.dumps({'files_verified':len(files),'facebook_posts':len(posts),'visible_comments':len(comments),'calendar_items_unchanged':len(data['posts'])}))
