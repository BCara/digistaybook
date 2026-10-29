"""The "Control your own narrative" campaign, as a section of the main marketing plan.

build_marketing_plan.py (one folder up) imports this and places it at the top of MARKETING_PLAN.html.
Edit content.json here, then run python build_marketing_plan.py in the marketing folder.
"""
from pathlib import Path
from datetime import date, timedelta
from collections import Counter
import html
import json

ROOT = Path(__file__).resolve().parent
HERE = ROOT.name
data = json.loads((ROOT / 'content.json').read_text(encoding='utf-8'))
start = date.fromisoformat(data['start'])
e = lambda v: html.escape(str(v), quote=True)

STATUSES = ['Planned', 'Manual review – changes needed', 'Manual review – confirmed', 'Drafted', 'Scheduled', 'Posted', 'Skipped']
COLOURS = ['#8a8178', '#b0493a', '#2f7d4f', '#b07d12', '#2f5fb0', '#245f50', '#6b6b6b']
MEANING = ['outline only; nothing written or made yet', 'you reviewed it and want changes', 'you reviewed it; OK to write in full',
           'caption/script written and saved as a draft', 'set to go out at its date and time', 'live', 'not going out']

posts = []
for i, p in enumerate(sorted(data['posts'], key=lambda p: p['day'])):
    d = start + timedelta(days=p['day'])
    posts.append(dict(p, id=f'r-{i+1:02}', date=d.isoformat(), when=d.strftime('%a ') + str(d.day) + d.strftime(' %b'),
                      caption='\n'.join('• ' + x for x in p['points'])))
platforms = sorted(Counter(p['platform'] for p in posts).items(), key=lambda kv: -kv[1])
weeks = {w['n']: w for w in data['weeks']}


def select(p):
    return (f'<select class="st" data-key="{p["id"]}" aria-label="Status: {e(p["title"])}">'
            + ''.join(f'<option>{e(s)}</option>' for s in STATUSES) + '</select>')


def copyable(label, text):
    return (f'<div class="label">{e(label)} <button class="copy" type="button">Copy</button></div>'
            f'<pre class="copytext">{e(text)}</pre>')


def full_block(p):
    f = p.get('full')
    if not f:
        return ''
    out = []
    if f.get('script'):
        rows_ = ''.join(f'<tr><td class="when-cell">{e(x["t"])}</td><td>{e(x["shot"])}</td><td>{e(x["say"]) or "–"}</td><td>{e(x["text"]) or "–"}</td></tr>'
                        for x in f['script'])
        out.append('<div class="label">Script</div><div style="overflow-x:auto"><table class="script"><thead><tr><th>Time</th><th>Shot</th>'
                   f'<th>Said</th><th>On screen</th></tr></thead><tbody>{rows_}</tbody></table></div>')
    if f.get('slides'):
        li = ''.join(f'<li><b>{e(x["head"])}</b><br>{e(x["body"])}' + (f'<br><span class="small">{e(x["small"])}</span>' if x.get('small') else '')
                     + f'<br><span class="small">Alt text: {e(x["alt"])}</span></li>' for x in f['slides'])
        out.append(f'<div class="label">Slides</div><ol class="slides">{li}</ol>')
    if f.get('brief'):
        out.append('<div class="label">Visual brief</div><ul>' + ''.join(f'<li>{e(x)}</li>' for x in f['brief']) + '</ul>')
    if f.get('notes'):
        out.append('<div class="label">Posting notes</div><ul>' + ''.join(f'<li>{e(x)}</li>' for x in f['notes']) + '</ul>')
    if not out:
        return ''
    names = [n for k, n in (('script', 'script'), ('slides', 'slides'), ('brief', 'visual brief'), ('notes', 'posting notes')) if f.get(k)]
    return f'<details class="full"><summary>More: {", ".join(names)}</summary>{"".join(out)}</details>'


def post_view(p):
    """The post as it will appear: the made image or video, and the words that go with it."""
    media, links = [], []
    for a in p.get('assets', []):
        f = a['file']
        href = f if f.startswith('http') else f'{HERE}/{f}'
        if f.endswith('.png'):
            media.append(f'<a href="{e(href)}" target="_blank" rel="noopener"><img loading="lazy" src="{e(href)}" alt="{e(a["label"])}"></a>')
        elif f.endswith('.mp4'):
            media.append(f'<video controls preload="metadata" src="{e(href)}"></video>')
            links.append(f'<a href="{e(href)}" download>Download {e(a["label"])} ↓</a>')
        else:
            links.append(f'<a href="{e(href)}" target="_blank" rel="noopener">{e(a["label"])} ↗</a>')
    if media:
        hint = '<span class="small">Scroll for all slides →</span>' if len(media) > 1 else ''
        left = f'<div class="media-strip">{"".join(media)}</div>{hint}'
    else:
        text_only = p['visual'].lower().startswith(('text only', 'none'))
        why = p.get('assets_note') or ('Text only: no image.' if text_only else 'Not made yet.')
        left = f'<div class="media-empty"><b>{e(why)}</b>{"" if text_only else "<span>" + e(p["visual"]) + "</span>"}</div>'
    if links:
        left += '<p class="small">' + ' · '.join(links) + '</p>'
    f = p.get('full') or {}
    copy = []
    if f.get('post_title'):
        copy.append(copyable('Post title', f['post_title']))
    if f.get('caption'):
        copy.append(copyable('Post text' if p['platform'] == 'Reddit' else 'Caption', f['caption']))
    if f.get('first_comment'):
        copy.append(copyable('First comment', f['first_comment']))
    for r in f.get('replies', []) if not f.get('caption') else []:
        copy.append(copyable('Reply · ' + r['when'], r['text']))
    if not copy:
        copy.append('<p class="small">Not written yet: this item is still an outline (see below).</p>')
    replies = ''
    if f.get('caption') and f.get('replies'):
        replies = '<details class="full"><summary>Reply templates</summary>' + ''.join(copyable('Reply · ' + r['when'], r['text']) for r in f['replies']) + '</details>'
    return (f'<div class="post-view"><div class="post-media"><div class="label">The post</div>{left}</div>'
            f'<div class="post-copy"><div class="label">Written with it</div>{"".join(copy)}{replies}</div></div>')


rows, cards, seen = [], [], set()
for p in posts:
    w = p['week']
    if w not in seen:
        seen.add(w)
        wk = weeks[w]
        a, b = start + timedelta(days=(w - 1) * 7), start + timedelta(days=(w - 1) * 7 + 6)
        span = f'{a.day} {a:%b} – {b.day} {b:%b}'
        rows.append(f'<tr class="cwk" data-week="{w}"><td colspan="6"><b>Week {w}</b> · {span} · {e(wk["theme"])}</td></tr>')
        cards.append(f'<h3 class="wkh" id="cweek-{w}">Week {w} · {span} · {e(wk["theme"])}</h3>')
    rows.append(f'<tr class="cpost" data-id="{p["id"]}"><td class="when-cell">{e(p["when"])}</td><td><a href="#{p["id"]}">{e(p["title"])}</a>'
                f'<br><span class="small">{e(p["pillar"])}</span>{' <span class="written">Written</span>' if p.get('full') else ''}{' <span class="written made">Made</span>' if p.get('assets') else ''}</td><td>{e(p["platform"])}</td><td>{e(p["format"])}</td><td>{select(p)}</td>'
                f'<td><a href="#{p["id"]}" class="view">View ↓</a></td></tr>')
    note = f'<p class="fact">⚠ {e(p["note"])}</p>' if p.get('note') else ''
    cards.append(f'''<article class="card" id="{p['id']}">
  <div class="head"><div><div class="when">{e(p['when'])} · {e(p['platform'])} · {e(p['format'])}</div><h3>{e(p['title'])}</h3>
  <span class="small">Pillar: {e(p['pillar'])} · Week {p['week']}: {e(weeks[p['week']]['theme'])}</span></div><label class="small">Status<br>{select(p)}</label></div>
  {post_view(p)}
  <div class="cols"><div><div class="label">Hook</div><p><i>{e(p['hook'])}</i></p><div class="label">Visual</div><p>{e(p['visual'])}</p>
  <div class="label">Call to action</div><p>{e(p['cta'])}</p>{note}</div>
  <div><label class="label" for="caption-{p['id']}">What the content includes · <span class="edit-hint">click to edit</span></label>
  <textarea class="tx" id="caption-{p['id']}" data-id="{p['id']}" spellcheck="true">{e(p['caption'])}</textarea>
  <div class="tx-bar small"><span class="tx-state" aria-live="polite"></span><button class="restore" type="button">Restore original</button></div>
  <label class="label" for="comment-{p['id']}">Comment for Claude</label><textarea class="cm" id="comment-{p['id']}" data-id="{p['id']}" rows="2" placeholder="What would you change?"></textarea>
  <p class="small"><a href="#priority">↑ Back to the campaign table</a></p></div></div>{full_block(p)}</article>''')

week_toc = ''.join(f'<li><a href="#cweek-{w["n"]}"><b>Week {w["n"]}</b> {e(w["theme"])}</a></li>' for w in data['weeks'])
plat_summary = ' · '.join(f'{e(k)} {v}' for k, v in platforms)
end = date.fromisoformat(data['end'])
span_txt = f'{start.day} {start:%B} – {end.day} {end:%B %Y}'
CSS = '''
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.say{border-left:5px solid #2f7d4f}.dont{border-left:5px solid #b0493a}
.full{margin-top:12px;border-top:1px solid var(--line);padding-top:8px}.full>summary{font-weight:700;cursor:pointer;color:#33604c}
.copytext{white-space:pre-wrap;font:inherit;background:#fbf8f2;border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:4px 0 10px}
.copy{border:1px solid var(--line);border-radius:5px;background:#fff;padding:2px 8px;font-size:12px;cursor:pointer;margin-left:6px;text-transform:none;letter-spacing:0}
table.script{font-size:13px;margin:4px 0 10px}table.script td{vertical-align:top}.slides li{margin:0 0 8px}
.written{display:inline-block;font-size:11px;font-weight:700;color:#fff;background:#33604c;border-radius:9px;padding:1px 7px}.written.made{background:#b4472a}
.post-view{display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:18px;margin:12px 0 14px;padding:12px;background:#fbf8f2;border:1px solid var(--line);border-radius:10px}
.media-strip{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:4px}.media-strip>*{flex:0 0 auto;scroll-snap-align:start}
.media-strip img{display:block;width:280px;aspect-ratio:4/5;object-fit:cover;border-radius:8px;border:1px solid var(--line)}.media-strip video{display:block;width:240px;aspect-ratio:9/16;background:#14181b;border-radius:8px}
.media-empty{width:100%;max-width:280px;aspect-ratio:4/5;border:2px dashed var(--line);border-radius:8px;display:flex;flex-direction:column;justify-content:center;gap:8px;padding:18px;color:var(--soft);font-size:13px;text-align:center}
.post-copy .copytext{background:#fff}
#priority .cols{grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr)}
@media(max-width:760px){.two{grid-template-columns:1fr}.post-view{grid-template-columns:1fr}}@media print{.copy,.asset video{display:none}}
'''

channels = [
    ('Facebook Page', 'Home base. Hosts are already here', 'Now', '1 feed post a week + reels cross-posted'),
    ('Facebook host groups', 'Where hosts talk about guests. Listen and help first', 'Now', '1 helpful contribution a week; follow each group’s rules'),
    ('Instagram', 'Guests and hosts; carousels and reels carry the respect message best', 'Now (needs account)', '1–2 a week + Stories'),
    ('TikTok', 'Reach beyond hosts: humour, POV, host life. The respect message travels here', 'Now (needs account)', '2 short videos a week'),
    ('Reddit', 'Honest host conversations; language and objections we can learn from', 'Now (founder account)', '1 discussion a week, value first, no links unless allowed'),
    ('YouTube Shorts', 'Search-friendly reuse of the reels/TikToks', 'Reuse', 'Repurpose 1 a week'),
    ('Pinterest', 'Evergreen: hosts searching welcome-note and house-guide ideas', 'Later in month', '3–5 pins linked to blog'),
    ('Website blog', 'SEO articles that the other channels link to', 'Now', '1 article in the month'),
    ('LinkedIn', 'Property managers and partners', 'Light', '1 founder post'),
    ('Email', 'Interest list, opted-in only', 'When a list exists', '1 update in the month'),
]
channel_rows = ''.join(f'<tr><td><b>{e(a)}</b></td><td>{e(b)}</td><td>{e(c)}</td><td>{e(d)}</td></tr>' for a, b, c, d in channels)

SECTIONS = f'''<details class="section-panel" id="c-strategy"><summary>The message</summary><h2>Say everything. Require nothing.</h2>
<p class="box"><i>Every home has a story. Tell yours. Control your own narrative.</i></p>
<p><b>Why this angle:</b> hosts are frustrated and feel they’ve lost control of their own homes. We take their side, barely hint at the cause and hand them back something they <i>do</i> control: their voice. The platform limited what hosts can <b>require</b>; it didn’t limit what they can <b>say</b>. Guests who know the host, and know how the home works, treat it like a home rather than a hotel.</p>
<h3>Four content pillars</h3><ol>
<li><b>Narrative (hosts):</b> every home has a story; take back the welcome.</li>
<li><b>Humanise:</b> the person behind the listing: their name, why they bought the place, the story behind the furniture.</li>
<li><b>Information:</b> bin day, which bin is which, how the heating works. Information, never demands; always allowed.</li>
<li><b>Respect and memories (guests):</b> a home you’re borrowing, not a hotel; past guests’ memories set the tone. (Plus light <b>Community</b> and <b>Product</b> items.)</li></ol>
<div class="two"><div class="box say"><b>Always</b><ul>
<li>Hint, don’t explain: lead with homes, hosts and stories. At most a light nod (“a lot of hosts have felt their say has been taken away”). Never spell out the rule or list what can’t be asked.</li>
<li>Lean on the words: <b>control your own narrative, your home your story, humanise, respect, home not hotel, say everything require nothing</b>.</li>
<li>Write house info as information (“bin day is Tuesday”), not instruction (“take the bins out”).</li>
<li>Host-facing: empowering, not bitter. Guest-facing: warm, never guilt-tripping.</li>
<li>Use real hosts’ stories only with permission; label the demo property as a demo.</li></ul></div>
<div class="box dont"><b>Never</b><ul>
<li>Name Airbnb, use its logo, its coral colour or look-alike wordplay.</li>
<li>Misstate the rule. It limits what hosts can <i>require</i>, not what they can <i>say</i>; never claim information is banned.</li>
<li>Suggest DigiStayBook is a way to make guests do chores, or promise guests will clean.</li>
<li>Promote the boycott or tell hosts to leave a platform.</li>
<li>Promise less damage, fewer complaints, better reviews or more bookings; invent stories; use fake accounts or vote manipulation on Reddit.</li></ul></div></div>
<h3>Who we’re talking to</h3><ul>
<li><b>Hosts</b> with one or a few holiday homes who care about their place and want guests to feel it. They are the customers.</li>
<li><b>Guests and travellers</b> (TikTok, Instagram): the respect message builds goodwill and makes hosts want to share it.</li>
<li><b>Property managers</b> (LinkedIn, Reddit): later conversations, not this month’s focus.</li></ul></details>

<details class="section-panel" id="c-channels"><summary>Channels</summary><h2>Where each piece goes</h2>
<div style="overflow-x:auto"><table><thead><tr><th>Channel</th><th>Role</th><th>When</th><th>Rhythm</th></tr></thead><tbody>{channel_rows}</tbody></table></div>
<p class="small">One shoot feeds several channels: each short video goes to TikTok, Instagram Reels, Facebook Reels and YouTube Shorts with captions adjusted per platform.</p></details>

<details class="section-panel" id="c-needs"><summary>Needs you</summary><h2>Before any of this goes out</h2><div class="box warn"><ol>
<li>Review the {len(posts)} outlines below: confirm, ask for changes or skip each one.</li>
<li>Start date is Thu 29 Oct to catch the news while it’s hot. This overlaps the current Facebook month (23 Oct – 21 Nov) on Facebook. See “Overlap” above.</li>
<li>Create or confirm accounts: Instagram, TikTok (business account), a named founder account on Reddit, Pinterest business.</li>
<li>Find one or two willing hosts (or use your own property) for the changeover, story and guestbook videos.</li>
<li>Decide the call to action: follow only, or link to the website demo. That depends on launch status.</li>
<li>Email items need an opted-in list and an email tool first.</li></ol></div></details>

<details class="section-panel" id="c-scorecard"><summary>What we measure</summary><h2>Weekly check</h2>
<table><thead><tr><th>Measure</th><th>Where</th><th>What it tells us</th></tr></thead><tbody>
<tr><td>Followers per channel</td><td>Each platform’s insights</td><td>Is an audience forming, and where?</td></tr>
<tr><td>Saves and shares</td><td>Instagram, TikTok, Facebook</td><td>Does the respect message travel?</td></tr>
<tr><td>Host replies with real experience</td><td>Comments, Reddit, groups</td><td>Does the problem resonate? (Week learning questions below.)</td></tr>
<tr><td>Website visits from each channel</td><td>Site analytics</td><td>Which channel sends interested hosts?</td></tr>
<tr><td>Time spent per piece</td><td>Our own log</td><td>Can we keep this pace?</td></tr></tbody></table>
<ul>{''.join(f'<li><b>Week {w["n"]}:</b> {e(w["question"])}</li>' for w in data['weeks'])}</ul>
<p class="small">No targets are guessed in advance; week 1 sets the baseline.</p></details>'''
