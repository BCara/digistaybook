"""Build one merged proposal from campaigns/merged-2026-10-28/content.json; no publishing."""
from pathlib import Path
from datetime import date, timedelta
import json, html, hashlib, csv, importlib.util
BUILDER=Path(__file__).resolve().parent
ROOT=BUILDER.parent
HERE=ROOT/'campaigns'/'merged-2026-10-28'
data=json.loads((HERE/'content.json').read_text(encoding='utf-8'))
posts=data['posts']; main=[p for p in posts if p['role']=='Main']
e=lambda x:html.escape(str(x),quote=True)
# US first (MARKETING_NOTES.md): post times are US Eastern, with Sydney beside them for the reviewers.
from datetime import datetime as _dt
from zoneinfo import ZoneInfo as _Zone
def sydney(p):
    t=_dt.fromisoformat(f"{p['date']}T{p['time']}").replace(tzinfo=_Zone('America/New_York')).astimezone(_Zone('Australia/Sydney'))
    return f"{t:%a} {t.day} {t:%b %H:%M}"
statuses=['Planned','Manual review – changes needed','Approved – Cara','Approved – Joe','Approved – Cara and Joe','Manual review – confirmed','Drafted','Scheduled','Posted','Skipped']
labels={'Manual review – confirmed':'Approved – reviewer not recorded'}
assert len({p['id'] for p in posts})==len(posts)
assert len({p['date'] for p in main})==len(main),'Competing main posts'
assert len({a for p in main for a in p['assets']})==sum(len(p['assets']) for p in main),'Repeated main media'
for p in posts:
    for a in p['assets']:assert (ROOT/a).is_file(),a
    if p['role']=='Main':assert p['assets'] or p['frames'],p['id']
    p['media_ready']=bool(p['assets'])
    p['content_hash']=hashlib.sha256(json.dumps({k:p[k] for k in ['date','caption','assets','visual']},sort_keys=True).encode()).hexdigest()[:16]
def select(p):
    return f'<select class="st" data-key="{p["id"]}" aria-label="Status: {e(p["title"])}">'+''.join(f'<option value="{e(s)}">{e(labels.get(s,s))}</option>' for s in statuses)+'</select>'
def media(p):
    out=[]
    for a in p['assets']:
        if a.endswith('.mp4'):out.append(f'<div><video controls playsinline preload="none" aria-label="{e(p["alt"])}" src="{e(a)}"></video><a href="{e(a)}" download>Download MP4</a></div>')
        else:out.append(f'<a href="{e(a)}" target="_blank" rel="noopener"><img loading="lazy" src="{e(a)}" alt="{e(p["alt"])}"></a>')
    if not out:out=[f'<div class="missing"><b>{e(p["production"])}</b><p>No final MP4 exists. The shot list is a production brief.</p></div>' if p['frames'] else '<p>Text-only listening task; no media required.</p>']
    return '<div class="media">'+''.join(out)+'</div>'
rows=[];cards=[]
for p in posts:
    day=date.fromisoformat(p['date']).strftime('%d %b')
    ready='Media exported' if p['media_ready'] else 'Video needed' if p['frames'] else 'Text task'
    rows.append(f'<tr class="post" data-id="{p["id"]}" data-week="{p["week"]}"><td>{day}<span class="small row-time">{p["time"]} ET · Sydney {sydney(p)}</span></td><td><a class="post-title" href="#{p["id"]}">{e(p["title"])}</a><span class="small row-meta">{e(p["channel"])} · {e(p["format"])}<span class="mobile-readiness"> · {ready}</span></span></td><td><span class="pill {"ok" if p["media_ready"] else "need"}">{ready}</span></td><td>{select(p)}</td></tr>')
    shots='<ol>'+''.join(f'<li>{e(s)}</li>' for s in p['frames'])+'</ol>' if p['frames'] else ''
    link=f'<a class="tracked-link" href="{e(p["destination"])}" target="_blank" rel="noopener">{e(p["destination"])}</a>' if p['destination'] else 'No outbound link for this listening item.'
    comment='<div class="copy-block"><b>First comment</b><button class="copy-text">Copy</button><pre>'+e(p['first_comment'])+'</pre></div>' if p['first_comment'] else ''
    parent=f'<p class="small">Companion to <a href="#{p["parent_id"]}">{e(p["parent_id"])}</a>.</p>' if p.get('parent_id') else ''
    cards.append(f'''<details class="card" id="{p['id']}"><summary><b>{day} · {e(p['title'])}</b><span>{e(p['channel'])} · {e(p['format'])} · {ready}</span></summary><div class="card-inner"><nav class="post-nav" aria-label="Post navigation"><a href="#posts">↑ Post overview</a><a href="#top">↑ Top</a></nav><div class="card-head"><p>{p['date']} · {p['time']} US Eastern (Sydney {sydney(p)}) · {e(p['goal'])}</p>{select(p)}</div><p class="saved-warning" hidden></p><div class="cols"><div>{media(p)}<details><summary>Production brief, alt text &amp; sources</summary><p>{e(p['visual'])}</p>{shots}<p><b>Alt text:</b> {e(p['alt'])}</p><p class="small">Merged sources: {e(', '.join(p['source_ids']))}</p></details>{parent}</div><div><label for="caption-{p['id']}"><b>Caption · edit here</b></label><textarea class="tx" id="caption-{p['id']}" data-id="{p['id']}">{e(p['caption'])}</textarea><div class="actions"><button class="copy-caption">Copy caption</button><button class="restore">Restore reviewed source</button><span class="tx-state small"></span></div><p><b>Next step:</b> {e(p['cta'])}<br><b>Link placement:</b> {e(p['link_placement'])}</p>{link}{comment}<label for="comment-{p['id']}"><b>Your review / changes needed</b></label><textarea class="cm" id="comment-{p['id']}" data-id="{p['id']}" rows="3"></textarea><details class="prior-review" hidden><summary>Earlier browser review · preserved</summary><pre></pre></details><p class="small">Media exported means the file exists. Approval, native draft, scheduling and publication are separate checks.</p></div></div><nav class="post-nav" aria-label="Back from this post"><a href="#posts">↑ Post overview</a><a href="#top">↑ Top</a></nav></div></details>''')
decisions=[]
for p in data['decisions']:
    targets=', '.join(f'<a href="#{t}">{e(t)}</a>' for t in p['targets']) or '—'
    decisions.append(f'<tr id="archive-{p["id"]}" data-archive-id="{p["id"]}"><td><b>{e(p["id"])}</b><br>{e(p["original_date"])}</td><td>{e(p["title"])}<details><summary>Original source record</summary><pre>{e(json.dumps(p["original"],ensure_ascii=False,indent=2))}</pre></details><span class="archive-review small"></span></td><td>{e(p["decision"])}<p>{e(p["reason"])}</p>{targets}</td></tr>')
legacy=json.loads((ROOT/'reference/prelaunch-week-1.json').read_text(encoding='utf-8'))
history=''.join(f'<tr><td>{e(p["date"])} · {e(p["time"])}</td><td>{e(p["theme"])}</td><td>{e(p["status"])}</td></tr>' for p in legacy['posts'])
video_rows=''.join(f'<tr><td>{p["date"]}</td><td><a href="#{p["id"]}">{e(p["title"])}</a></td><td>{e(p["production"])}</td></tr>' for p in main if p['frames'])
sources=''.join(f'<li><a href="{e(s["url"])}" target="_blank" rel="noopener">{e(s["title"])}</a></li>' for s in data['sources'])
css=(HERE/'plan.css').read_text(encoding='utf-8')
sections=(HERE/'review-sections.html').read_text(encoding='utf-8').replace('VIDEO_ROWS',video_rows).replace('SOURCE_LINKS',sources)
filters=''.join(f'<label>{label}<select id="{id}"><option value="">All</option>'+''.join(f'<option>{e(v)}</option>' for v in values)+'</select></label>' for id,label,values in [('f-channel','Channel',sorted({p['channel'] for p in posts})),('f-role','Role',sorted({p['role'] for p in posts})),('f-format','Format',sorted({p['format'] for p in posts})),('f-status','Review',statuses)])
week_themes=['A welcome in your own words','Practical answers and guest feedback','Local tips and host control','Useful guides and guest memories','Questions and a first-property setup']
week_links=[]
for w in range(1,6):
    first=date.fromisoformat(data['start'])+timedelta(days=7*(w-1))
    last=min(first+timedelta(days=6),date.fromisoformat(data['end']))
    n=sum(p['role']=='Main' and p['week']==w for p in posts)
    week_links.append(f'<a class="week-link" href="#posts" data-plan-week="{w}"><b>Week {w}<span>{first.strftime("%d %b")}–{last.strftime("%d %b")}</span></b><span>{e(week_themes[w-1])}<small>{n} main Facebook posts</small></span><span aria-hidden="true">→</span></a>')
week_summary=''.join(week_links)
sections=sections.replace('id="traffic" open','id="traffic"').replace('id="production" open','id="production"')
spec=importlib.util.spec_from_file_location('build_info_pages',HERE/'build_info_pages.py')
info=importlib.util.module_from_spec(spec);spec.loader.exec_module(info)
info_pages=info.build(ROOT,sections,decisions,history,data,e)
if (ROOT/'campaigns/people-2026-10-28/REVIEW.html').is_file():
    info_pages.append(('campaigns/people-2026-10-28/REVIEW.html','Photo-led content: 5 posts + 3 Stories'))
if (ROOT/'campaigns/reels-people-2026-10-29/REVIEW.html').is_file():
    info_pages.append(('campaigns/reels-people-2026-10-29/REVIEW.html','Reels: 2 new videos with real people'))
more_links='<nav class="more-links" aria-label="Supporting information">'+''.join(f'<a href="{file}">{e(title)} →</a>' for file,title in info_pages)+'</nav>'

# "Why hosts choose us": rendered from the "## Why choose DigiStayBook" section of MARKETING_NOTES.md, so the notes stay
# the one place it is written. Handles the little Markdown that section uses: ### headings, - bullets (with indented
# continuation lines), paragraphs, **bold** and "quoted lines".
import re as _re
def why_choose_section():
    notes=(ROOT/'MARKETING_NOTES.md').read_text(encoding='utf-8')
    m=_re.search(r'^## Why choose DigiStayBook\s*$(.*?)(?=^## )',notes,_re.S|_re.M)
    if not m:return ''
    inline=lambda t:_re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',e(t))
    blocks=[];cur=None;para=[];items=[]
    def flush():
        nonlocal para,items
        if para:cur.append(f'<p>{inline(" ".join(para))}</p>');para=[]
        if items:cur.append('<ul>'+''.join(f'<li>{inline(i)}</li>' for i in items)+'</ul>');items=[]
    intro=[];cur=intro
    for line in m.group(1).splitlines():
        if line.startswith('### '):
            flush();cur=[f'<h3>{inline(line[4:].strip())}</h3>'];blocks.append(cur)
        elif line.startswith('- '):
            if para:flush()
            items.append(line[2:].strip())
        elif line.startswith('  ') and items:items[-1]+=' '+line.strip()
        elif line.strip():
            if items:flush()
            para.append(line.strip())
        else:flush()
    flush()
    cards=''.join(f'<article class="why-card{" why-core" if i==0 else ""}">{"".join(b)}</article>' for i,b in enumerate(blocks))
    return ('<section id="why-choose" aria-labelledby="why-choose-title"><h2 id="why-choose-title">Why hosts choose us</h2>'
            +''.join(intro)+f'<div class="why-grid">{cards}</div><p class="small">Written in <a href="MARKETING_NOTES.md">MARKETING_NOTES.md</a>; change it there and rebuild.</p></section>')
why_css='.why-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,330px),1fr));gap:14px}.why-card{border:1px solid #d9d0bf;background:#fffaf2;border-radius:8px;padding:4px 18px 10px}.why-card h3{font-size:20px;margin:14px 0 8px}.why-card ul{padding-left:18px}.why-card li{margin:5px 0}.why-core{grid-column:1/-1;border-left:5px solid #a64026}'
why_section=why_choose_section()
page=f'''<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DigiStayBook · merged marketing plan</title><style>{css}{why_css}</style></head><body><header id="top" tabindex="-1"><div class="eyebrow">DIGISTAYBOOK / MARKETING</div><h1>Marketing plan</h1><p>29 October–29 November 2026 · US Eastern time, Sydney time beside each post</p><nav class="header-nav" aria-label="Plan navigation"><a href="#posts">Post overview ↓</a><a href="MARKETING_PRODUCTION.html#production">Videos needed</a></nav></header><div class="layout"><aside><details id="toc" open><summary>Contents</summary><ul><li><a href="#overview">What changed</a></li><li><a href="#why-choose">Why hosts choose us</a></li><li><a href="#posts">One working calendar</a></li><li><a href="MARKETING_STRATEGY.html#traffic">Traffic review</a></li><li><a href="MARKETING_PRODUCTION.html#production">Videos still needed</a></li><li><a href="MARKETING_STRATEGY.html#scorecard">Measurement</a></li><li><a href="#details">Post details</a></li><li><a href="MARKETING_REFERENCE.html#archive">98 source decisions</a></li><li><a href="MARKETING_REFERENCE.html#existing">Preserved records</a></li><li><a href="MARKETING_REFERENCE.html#files">Files &amp; sources</a></li></ul></details></aside><main>
<section id="overview" aria-labelledby="plan-summary-title"><h2 id="plan-summary-title">The plan at a glance</h2><ul class="cadence"><li><b>Facebook · most days</b><span>Aim for 4–5 posts a week: 20 main posts, including 8 Reels.</span></li><li><b>Pinterest · about twice a week</b><span>8 useful Pins, if the account is ready.</span></li><li><b>Stories · support the main posts</b><span>7 companion Stories. Instagram / YouTube can reuse approved videos.</span></li></ul><p class="readiness-summary"><b>15 of 20 main posts have media.</b> 12 image posts + 3 videos are exported; <a href="MARKETING_PRODUCTION.html#production">5 videos still to make</a>.</p><h3 class="week-heading">Campaign by week</h3><nav class="week-plan" aria-label="Campaign weeks">{week_summary}</nav><p class="small plan-note">Suggested dates, pending review. No external schedules changed. <a href="MARKETING_REFERENCE.html#existing">Existing scheduled-post record</a>.</p></section>
{why_section}
<section id="posts" tabindex="-1"><div class="section-heading"><h2>Post overview</h2><a href="#top">↑ Top</a></div><p class="overview-hint">Tap anywhere on a post row for its caption, images or video. Choose a week above, or use the filters below.</p><details class="filter-panel"><summary>Filter posts <span id="shown" class="small"></span></summary><div class="filters"><label>Week<select id="f-week"><option value="">Every week</option><option value="1">Week 1</option><option value="2">Week 2</option><option value="3">Week 3</option><option value="4">Week 4</option><option value="5">Week 5</option></select></label><label>When<select id="f-when"><option value="all">Full proposal</option><option value="upcoming">From today</option><option value="week">Next 7 days</option></select></label>{filters}<label>Media<select id="f-media"><option value="">All readiness</option><option value="ready">Exported media</option><option value="missing">Production needed</option></select></label><label>Search<input id="search" type="search" placeholder="Topic, caption or ID"></label></div></details><p class="legend">Approved in this browser: <b id="ready-count">0</b> · Recorded as posted: <b id="live-count">0</b> · <span id="status-counts"></span></p><div class="table-wrap"><table id="t"><thead><tr><th>Date</th><th>Post &amp; placement</th><th>Media</th><th>Review status</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div><p class="small">Review statuses and caption edits are in each post. Browser reviews stay on this device; download a review before switching devices. These controls do not update Meta.</p></section>
<section id="details"><h2>Post details &amp; finished artwork</h2><p>Expand an item for its caption, actual files, tracked destination and production notes. Calendar filters also filter these cards.</p>{''.join(cards)}</section>
<section id="more"><h2>More information</h2>{more_links}</section>
</main></div><nav class="mobile-jump" aria-label="Quick navigation"><a href="#posts">↑ Post overview</a><a href="#top">↑ Top</a></nav><div class="bar"><span id="count" role="status">Local reviews</span><button id="copy">Copy my review</button><button id="download">Download review</button><button id="print">Print plan</button></div><script id="marketing-content" type="application/json">{json.dumps(data,ensure_ascii=False).replace('<',chr(92)+'u003c')}</script><script>{(BUILDER/'marketing-review.js').read_text(encoding='utf-8')}</script></body></html>'''
research='campaigns/host-voice-research-2026-10-30/CAMPAIGN_REVIEW.html'
if (ROOT/research).is_file():
    campaign_section=f'<section id="campaigns"><h2>Campaigns</h2><p><a href="{research}"><b>October 30 · Host voice: research, Claude review and five campaign drafts →</b></a></p><p class="small">New policy research and a proposed message test. Draft alternatives; the dated calendar is unchanged.</p></section>'
    page=page.replace('<section id="more">',campaign_section+'<section id="more">',1)
(ROOT/'MARKETING_PLAN.html').write_text(page,encoding='utf-8')
fields=['id','date','channel','role','format','title','destination','published_url','reach','outbound_clicks','tagged_landing_sessions','verified_signups','attributed_first_properties','saves','useful_host_replies','production_minutes','notes']
score=HERE/'scorecard.csv'
if not score.exists():
    with score.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
        for p in posts:w.writerow({k:p.get(k,'') for k in fields})
print(f'Built {len(posts)} active items; {len(main)} main; {sum(p["media_ready"] for p in main)} main media exported; {len(data["decisions"])} retained decisions.')
# Shared house format (same house.py in every project's marketing/builder/).
import subprocess, sys
subprocess.run([sys.executable, '-X', 'utf8', str(BUILDER/'house.py')], check=True)
