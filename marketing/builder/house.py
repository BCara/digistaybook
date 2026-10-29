"""House format for the marketing hub page. The same file lives in every project's marketing/builder/.

    python builder/house.py                (formats ../MARKETING_PLAN.html using builder/house.json)

Run it as the last build step (the project's builder calls it). It is idempotent: everything it adds sits
between <!--house:...--> markers or in <style id="house-style">, and is replaced on the next run.

What it standardises, so the three projects' hubs look and read the same:
  * one style layer (type, header band, contents sidebar, section headings, tables, buttons, review bar),
    coloured from the project's brand tokens in house.json;
  * the header: "<Project> · Marketing", "Marketing plan", one purpose line with the updated date, quick links;
  * the shared section titles (Needs you, Strategy, Posts, Post details, Campaigns, Marketing assistant,
    What changed, Your notes, Where things are), in the page and in its contents list;
  * the same section order (the list above), in the page and in its contents list;
  * "Where things are": the standard folder table, with this project's campaigns listed from campaigns/;
  * a Print button on the review bar, and the same footer.
The page's own content, scripts and saved reviews (localStorage keys) are left alone.
"""
import datetime as dt
import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CFG = json.loads((HERE / 'house.json').read_text(encoding='utf-8'))
PAGE = ROOT / CFG.get('page', 'MARKETING_PLAN.html')
e = html.escape

STANDARD_TITLES = {
    'needs': 'Needs you', 'strategy': 'Strategy', 'posts': 'Posts', 'details': 'Post details',
    'campaigns': 'Campaigns', 'assistant': 'Marketing assistant', 'changes': 'What changed',
    'notes': 'Your notes', 'files': 'Where things are',
}

FOLDERS = [
    ('MARKETING_PLAN.html', 'This page: the one place to look. Strategy, what needs you, every post and its status, campaigns.'),
    ('MARKETING_NOTES.md', 'Your preferences and rules. Every AI reads this before drafting anything.'),
    ('HOW_TO_EDIT.md', 'How anyone (or their AI) changes a post and rebuilds this page, plus the changes log.'),
    ('AGENTS.md', 'Rules for any AI working here: real photos only, drafts for review, nothing posted without approval.'),
    ('EDIT_REQUESTS.md', 'Requests that need the owner’s PC, such as new or redrawn images and reels.'),
    ('README.txt', 'This folder layout in plain text.'),
    ('campaigns/', 'One folder per campaign, named name-YYYY-MM-DD: its brief or review page, posts, captions, images and videos.'),
    ('content/', 'Reusable material not tied to one campaign: stock photo library, source libraries, shared images.'),
    ('assistant/', 'The marketing assistant: briefs, inbox and reports.'),
    ('reference/', 'Background: brand, pricing, research, audits and older documents.'),
    ('builder/', 'The machinery behind this page: build scripts, house format, post statuses and saved reviews.'),
    ('_archive/', 'Retired pages and before-change backups, kept for the record. Nothing in them is current.'),
]

PAGE_NAMES = re.compile(r'(PLAN|CAMPAIGN|BRIEF|REVIEW|index|CONTENT|PINS|WHY_|COMPARISON|README)', re.I)


def campaign_rows():
    camp = ROOT / 'campaigns'
    if not camp.is_dir():
        return ''
    def date_key(p):
        m = re.search(r'(\d{4})-(\d{2})(?:-(\d{2}))?', p.name)
        return (m.group(1), m.group(2), m.group(3) or '00') if m else ('0', '0', '0')
    rows = []
    for d in sorted((p for p in camp.iterdir() if p.is_dir() and not p.name.startswith(('_', '.'))), key=date_key, reverse=True):
        pages = sorted((f for f in d.iterdir() if f.is_file() and f.suffix.lower() in ('.html', '.md', '.txt') and PAGE_NAMES.search(f.name)),
                       key=lambda f: (f.suffix.lower() != '.html', not re.search('PLAN|CAMPAIGN|BRIEF', f.name, re.I), f.name.lower()))
        link = f'campaigns/{d.name}/' + (pages[0].name if pages else '')
        label = CFG.get('campaign_notes', {}).get(d.name, '')
        rows.append(f'<li><a href="{e(link)}">{e(d.name)}</a>{(" — " + e(label)) if label else ""}</li>')
    return '<ul class="house-camps">' + ''.join(rows) + '</ul>'


def files_block():
    trs = []
    for name, desc in FOLDERS:
        p = ROOT / name.rstrip('/')
        extra = CFG.get('folder_notes', {}).get(name, '')
        if not p.exists():
            trs.append(f'<tr class="house-missing"><td><code>{e(name)}</code></td><td>{e(desc)} <em>(not used yet in this project)</em></td></tr>')
            continue
        cell = f'<a href="{e(name)}"><code>{e(name)}</code></a>'
        body = e(desc) + (f' {e(extra)}' if extra else '')
        if name == 'campaigns/':
            body += campaign_rows()
        trs.append(f'<tr><td>{cell}</td><td>{body}</td></tr>')
    nas = CFG['nas']
    return ('<!--house:files--><div class="house-files"><p class="house-note">Every project’s marketing folder has this same layout. '
            f'The NAS copy is the only copy: <code>{e(nas)}</code></p>'
            '<table class="house-table"><thead><tr><th>Folder or file</th><th>What it holds</th></tr></thead><tbody>'
            + ''.join(trs) + '</tbody></table></div><!--/house:files-->')


def house_css():
    b = CFG['brand']
    css = (HERE / 'house.css').read_text(encoding='utf-8')
    tokens = ';'.join(f'--h-{k}:{v}' for k, v in b.items())
    return f'<style id="house-style">:root{{{tokens}}}\n{css}</style>'


ORDER = ['needs', 'strategy', 'posts', 'details', 'campaigns', 'assistant', 'changes', 'notes', 'files']
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
TAG = re.compile(r'<!--.*?-->|<(script|style|template)\b.*?</\1\s*>|<(/?)([a-zA-Z][\w-]*)\b(?:"[^"]*"|\'[^\']*\'|[^\'">])*?(/?)>', re.S | re.I)


def key_of(ident, maps=('order', 'section_ids', 'ids')):
    """The standard section an element id belongs to, or None. "order" ids only place a section; they keep their title."""
    if not ident:
        return None
    for m in maps:
        if ident in CFG.get(m, {}):
            return CFG[m][ident]
    return ident if ident in STANDARD_TITLES else None


def top_chunks(text):
    """Split markup into its top-level elements (with the text between them as separate chunks)."""
    chunks, depth, start, last = [], 0, None, 0
    for m in TAG.finditer(text):
        if m.group(1) or m.group(0).startswith('<!--'):
            if depth == 0:
                chunks += [text[last:m.start()], m.group(0)]; last = m.end()
            continue
        close, tag, selfclose = m.group(2), m.group(3).lower(), m.group(4)
        if not close and (tag in VOID or selfclose):
            if depth == 0:
                chunks += [text[last:m.start()], m.group(0)]; last = m.end()
            continue
        if not close:
            if depth == 0:
                chunks.append(text[last:m.start()]); start = m.start()
            depth += 1
        else:
            depth -= 1
            if depth == 0:
                chunks.append(text[start:m.end()]); last = m.end()
    chunks.append(text[last:])
    return [c for c in chunks if c]


def chunk_key(c):
    """A chunk's standard section: its own id or data-page, else (for a section) its first heading's id."""
    if not c.startswith('<') or c.startswith('<!--'):
        return None
    tag = re.match(r'<[^>]*>', c).group(0)
    for attr in ('id', 'data-page'):
        m = re.search(rf'\b{attr}="([^"]*)"', tag)
        if m and key_of(m.group(1)):
            return key_of(m.group(1))
    if re.match(r'<section\b', c):
        m = re.search(r'<h2[^>]*\bid="([^"]*)"', c)
        return key_of(m.group(1)) if m else None
    return None


def in_order(chunks, key, trailing=lambda c: False):
    """Stable-sort chunks into ORDER. A chunk without a key travels with the keyed chunk before it; anything before
    the first keyed chunk stays first, and a trailing run that trailing() accepts stays last."""
    tail = []
    while chunks and (not chunks[-1].strip() or trailing(chunks[-1])):
        tail.insert(0, chunks.pop())
    groups = [[-1, []]]
    for c in chunks:
        k = key(c)
        if k in ORDER:
            groups.append([ORDER.index(k), [c]])
        else:
            groups[-1][1].append(c)
    groups.sort(key=lambda g: g[0])
    return ''.join(''.join(g[1]) for g in groups) + ''.join(tail)


def order_sections(s):
    """Put the page's sections, and its contents list, in the standard order."""
    m = re.search(r'(<main\b[^>]*>)(.*)(</main>)', s, re.S)
    if m:
        body = in_order(top_chunks(m.group(2)), chunk_key, lambda c: c.startswith(('<footer', '<script', '<!--')))
        s = s[:m.start(2)] + body + s[m.end(2):]
    head_end = s.find('<!--/house:header-->')
    def href_key(c):
        h = re.search(r'href="#([^"]+)"', c)
        return key_of(h.group(1)) if h else None
    def toc(mm):
        inner = mm.group(2)
        items = top_chunks(inner)
        if sum(1 for c in items if href_key(c)) < 3:
            return mm.group(0)
        def item_key(c):
            return href_key(c) if c.startswith(('<li', '<a')) else None
        def trailing(c):
            return not c.startswith(('<li', '<a')) or not href_key(c)
        new = in_order(items, item_key, trailing)
        # retitle the contents entry of every standard section, here only (other links keep their own wording)
        def retitle(a):
            k = key_of(a.group(2), ('section_ids', 'ids'))
            return a.group(1) + e(STANDARD_TITLES[k]) + a.group(3) if k else a.group(0)
        new = re.sub(r'(<a[^>]*href="#([^"]+)"[^>]*>)[^<]*(</a>)', retitle, new)
        return mm.group(1) + new + mm.group(3)
    rest = s[head_end:] if head_end >= 0 else s
    main_at = rest.find('<main')
    nav, after = (rest[:main_at], rest[main_at:]) if main_at >= 0 else (rest, '')
    nav = re.sub(r'(<ul\b[^>]*>)(.*?)(</ul>)', toc, nav, flags=re.S)
    nav = re.sub(r'(<nav\b(?![^>]*house-quick)[^>]*>)(.*?)(</nav>)', toc, nav, flags=re.S)
    return (s[:head_end] if head_end >= 0 else '') + nav + after


def sub_marked(text, name, new, anchor_fn):
    """Replace <!--house:name-->...<!--/house:name--> or insert via anchor_fn."""
    rx = re.compile(rf'<!--house:{name}-->.*?<!--/house:{name}-->', re.S)
    if rx.search(text):
        return rx.sub(lambda m: new, text, count=1)
    return anchor_fn(text, new)


def main():
    raw = PAGE.read_bytes()
    s = raw.decode('utf-8')
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=11))).date()
    when = today.strftime('%A %#d %B %Y' if sys.platform == 'win32' else '%A %-d %B %Y')

    # 1. style layer
    s = re.sub(r'<style id="house-style">.*?</style>', '', s, flags=re.S)
    s = s.replace('</head>', house_css() + '</head>', 1)
    def body_class(m):
        attrs = m.group(1)
        if re.search(r'class="[^"]*\bhouse\b', attrs): return m.group(0)
        if 'class="' in attrs: return '<body' + attrs.replace('class="', 'class="house ', 1) + '>'
        return f'<body class="house"{attrs}>'
    s = re.sub(r'<body([^>]*)>', body_class, s, count=1)

    # 2. header
    quick = ''.join(f'<a href="{e(h)}">{e(t)}</a>' for t, h in CFG.get('quick', []))
    head = (f'<!--house:header--><div class="house-head"><div class="house-kicker">{e(CFG["project"])} · Marketing</div>'
            f'<h1>Marketing plan</h1><p class="house-sub">{e(CFG["purpose"])} Updated {e(when)}. '
            'Nothing is scheduled or posted without your approval.</p>'
            + (f'<nav class="house-quick" aria-label="Quick links">{quick}</nav>' if quick else '') + '</div><!--/house:header-->')
    m = re.search(r'<header([^>]*)>(.*?)</header>', s, re.S)
    if m:
        s = s[:m.start()] + f'<header{m.group(1)}>{head}</header>' + s[m.end():]

    # 3. standard section titles (page and contents list)
    for sid, std in {**{k: STANDARD_TITLES[v] for k, v in CFG.get('ids', {}).items()},
                     **{k: v for k, v in STANDARD_TITLES.items() if re.search(rf'<h2[^>]*id="{k}"', s)}}.items():
        detail = CFG.get('title_detail', {}).get(sid, '')
        title = std + (f' · {detail}' if detail else '')
        s = re.sub(rf'(<h2[^>]*\bid="{re.escape(sid)}"[^>]*>).*?(</h2>)', lambda m: m.group(1) + e(title) + m.group(2), s, count=1, flags=re.S)
        s = re.sub(rf'(<a[^>]*href="#{re.escape(sid)}"[^>]*>)[^<]*(</a>)',
                   lambda m: m.group(1) + e(std) + m.group(2) if 'house-quick' not in m.group(1) else m.group(0), s,
                   flags=re.S) if CFG.get('retitle_nav', True) else s

    # sections whose h2 has no id of its own: {"section id": "standard key"}
    for sec, key in CFG.get('section_ids', {}).items():
        detail = CFG.get('title_detail', {}).get(sec, '')
        title = STANDARD_TITLES[key] + (f' · {detail}' if detail else '')
        s = re.sub(rf'(<section[^>]*\bid="{re.escape(sec)}"[^>]*>(?:(?!</section>).)*?<h2[^>]*>).*?(</h2>)',
                   lambda m: m.group(1) + e(title) + m.group(2), s, count=1, flags=re.S)

    # 4. where things are
    fid = CFG.get('files_id', 'files')
    def put_files(text, block):
        mm = re.search(rf'<h2[^>]*\bid="{re.escape(fid)}"[^>]*>.*?</h2>', text, re.S)
        if mm:
            return text[:mm.end()] + block + text[mm.end():]
        sec = f'<section id="{fid}" class="house-section"><h2>Where things are</h2>{block}</section>'
        i = text.rfind('</main>')
        return text[:i] + sec + text[i:]
    s = sub_marked(s, 'files', files_block(), put_files)
    if CFG.get('replace_files_section'):  # drop the page's own older folder list that followed the standard block
        s = re.sub(r'(<!--/house:files-->)' + CFG['replace_files_section'], r'\1', s, count=1, flags=re.S)

    # 4b. standard section order: Needs you, Strategy, Posts, Post details, Campaigns, Marketing assistant,
    # What changed, Your notes, Where things are. house.json "order" maps extra section ids to one of these.
    s = order_sections(s)

    # 5. print button on the review bar
    if 'id="print"' not in s and 'house-print' not in s:
        s = re.sub(r'(<div class="bar"[^>]*>.*?)(</div>)', lambda m: m.group(1) + '<button class="house-print" type="button" onclick="window.print()">Print</button>' + m.group(2), s, count=1, flags=re.S)

    # 6. footer
    foot = (f'<!--house:footer--><footer class="house-foot">{e(CFG["project"])} · marketing · '
            f'<code>{e(CFG["nas"])}\\MARKETING_PLAN.html</code> · house format, built {today.isoformat()}</footer><!--/house:footer-->')
    s = sub_marked(s, 'footer', foot, lambda t, b: t[:t.rfind('</main>')] + b + t[t.rfind('</main>'):])

    PAGE.write_text(s, encoding='utf-8', newline='')
    # A builder that guards against hand edits keeps the hash of its last output; keep it in step.
    stamp = HERE / '.last-build.sha1'
    if stamp.exists():
        import hashlib
        if stamp.read_text().strip() == hashlib.sha1(raw).hexdigest():
            stamp.write_text(hashlib.sha1(PAGE.read_bytes()).hexdigest())
    print('house format applied to', PAGE.name)


if __name__ == '__main__':
    main()
