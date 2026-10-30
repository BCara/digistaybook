from pathlib import Path
import re, html, json
import markdown

HERE = Path(__file__).resolve().parent
ax = (HERE / 'CLAUDE_REVIEW_AX.txt').read_text(encoding='utf-8')
structured = ax.split('\nDocument text:')[0]
rows=[]
list_indent=None
for line in structured.splitlines():
    match=re.match(r'^(\s+)(\d+) (heading|text|item|list item|link) (.*)$', line)
    if not match or not (1742 <= int(match[2]) <= 2135):
        continue
    indent=len(match[1]);role,content=match[3],match[4]
    if list_indent is not None and indent<=list_indent:list_indent=None
    if list_indent is not None and role!='link':continue
    if not content.strip():continue
    if role=='list item':
        # The AX list item holds the complete sentence, while child text may be fragments.
        rows.append('- '+content)
        list_indent=indent
    elif role=='heading':rows.append('## '+content)
    elif role=='link':
        if ' Value: https://' in content:
            label,url=content.rsplit(' Value: ',1)
            rows.append(f'[{label}]({url})')
    else:rows.append(content)
(HERE/'CLAUDE_REVIEW.md').write_text('# Claude independent review\n\nCaptured from the completed Claude desktop conversation on October 30, 2026. Accessibility extraction preserves wording but flattens tables and can repeat list text. Product ideas and proposed metrics are suggestions, not implemented features. The campaign review contains the editorial assessment.\n\nConversation: https://claude.ai/chat/dd50092a-343d-4b10-905e-d5446f55b353\n\n'+'\n\n'.join(rows)+'\n',encoding='utf-8')

css='''*{box-sizing:border-box}html{scroll-behavior:smooth}body{overflow-wrap:anywhere;margin:0;background:#f7f2e8;color:#18272a;font:17px/1.65 system-ui,sans-serif}header{background:#18272a;color:#fff9ef;padding:42px max(24px,calc((100% - 1050px)/2))}header a{color:#efd09d}header p{max-width:740px}h1{font:clamp(36px,7vw,62px)/1.1 Georgia,serif;margin:18px 0}h2{font:31px/1.2 Georgia,serif;margin:54px 0 18px}h3{font-size:22px;margin-top:32px}main{max-width:1110px;padding:0 30px 70px;margin:auto}a{color:#9b3b23;overflow-wrap:anywhere}p,li{max-width:850px}table{border-collapse:collapse;width:100%;font-size:14px;background:#fffdf8}th,td{text-align:left;vertical-align:top;padding:14px;border:1px solid #d8d3c7}th{background:#e9e2d3}.table-scroll{overflow-x:auto;margin:24px 0}table{min-width:700px}.badge{display:inline-block;border:1px solid #8c9a97;padding:4px 10px;font-size:13px;letter-spacing:.06em}nav{display:flex;gap:14px;flex-wrap:wrap}footer{border-top:1px solid #d8d3c7;padding-top:20px;margin-top:50px;color:#5c6b6d;font-size:14px}code{font-size:13px;overflow-wrap:anywhere}button{font:inherit;padding:7px 12px;background:#fffdf8;border:1px solid #d8d3c7;border-radius:4px;color:#18272a;cursor:pointer}.caption{background:#fffdf8;border-left:4px solid #9b3b23;padding:20px;margin:18px 0}.caption p{white-space:pre-wrap}@media(max-width:600px){body{font-size:16px}main{padding:0 18px 50px}header{padding:28px 20px}h2{font-size:27px}}@media print{header{background:white;color:black}button{display:none}a{color:inherit}h2{break-after:avoid}.table-scroll{overflow:visible}table{min-width:0}}'''
for name,title in [('CAMPAIGN_REVIEW','Host voice campaign review'),('CLAUDE_REVIEW','Claude independent review')]:
    body=markdown.markdown((HERE/f'{name}.md').read_text(encoding='utf-8'),extensions=['tables','fenced_code','sane_lists'])
    body=re.sub(r'<h1>.*?</h1>','',body,count=1,flags=re.S)
    body=re.sub(r'(<table>.*?</table>)',r'<div class="table-scroll">\1</div>',body,flags=re.S)
    for index,heading in enumerate(re.findall(r'<h2>(.*?)</h2>',body)):
        body=body.replace(f'<h2>{heading}</h2>',f'<h2 id="section-{index}">{heading}</h2>',1)
    nav='<a href="../../MARKETING_PLAN.html#files">← Marketing plan</a> · <a href="CAMPAIGN_REVIEW.html">Campaign recommendation</a> · <a href="CLAUDE_REVIEW.html">Claude review</a>'
    doc=f'<!doctype html><html lang="en-US"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DigiStayBook · {title}</title><style>{css}</style><header><nav>{nav}</nav><p class="badge">RESEARCH + DRAFTS · OCTOBER 30, 2026</p><h1>{html.escape(title)}</h1><p>A timely campaign about practical hospitality and a personal welcome. Prepared for Cara and Joe.</p></header><main>{body}<footer>Draft for review. No publishing, scheduling, outreach or spending performed. <a href="{name}.md">Download Markdown source</a> · <button onclick="print()">Print</button></footer></main></html>'
    (HERE/f'{name}.html').write_text(doc,encoding='utf-8')
print('Built campaign recommendation and extracted Claude review.')
