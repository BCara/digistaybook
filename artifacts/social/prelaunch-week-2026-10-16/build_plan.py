"""Renders PRELAUNCH_WEEK_1.html from content.json. Run: python build_plan.py"""
import html
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(HERE, "content.json"), encoding="utf-8"))
e = html.escape


def para(text):
    return "".join(f"<p>{e(b).replace(chr(10), '<br>')}</p>" for b in text.split("\n\n"))


tabs, days = [], []
for i, p in enumerate(data["posts"]):
    img = f"images/{p['id']}-{p['day'].split()[0].lower()}.jpg"
    key = f"dsb-prelaunch-1-{p['id']}"
    tabs.append(f'<a class="tab" href="#d{p["id"]}"><span>{e(p["day"].split()[0])}</span><b>{e(p["day"].split()[1])}</b></a>')
    days.append(f"""
<section class="day" id="d{p['id']}">
  <header class="day-head">
    <p class="eyebrow">Day {i + 1} · {e(p['date'])}</p>
    <h2>{e(p['theme'])}</h2>
    <p class="goal">{e(p['goal'])}</p>
  </header>
  <div class="day-body">
    <figure class="shot">
      <a href="{img}" target="_blank" rel="noopener"><img src="{img}" alt="{e(p['alt'])}" loading="lazy" width="1080" height="1350"></a>
      <figcaption><a href="{img}" download>Download image · 1080 × 1350</a></figcaption>
    </figure>
    <ol class="steps">
      <li>
        <label class="done"><input type="checkbox" data-key="{key}-a"> Done</label>
        <h3>Check the draft and publish <span class="time">{e(p['time'])}</span></h3>
        <p>The post is already saved as a draft on the Digi Staybook Page, with this image and caption. Open the Page's drafts in Meta Business Suite, read it through, then publish it at the time above or schedule it for then.</p>
        <p class="links"><a class="btn" href="https://business.facebook.com/latest/posts/draft_posts/?asset_id=1378771845320763" target="_blank" rel="noopener">Open drafts</a></p>
      </li>
      <li>
        <label class="done"><input type="checkbox" data-key="{key}-b"> Done</label>
        <h3>Reply to comments</h3>
        <p>Spend five minutes later that evening replying to anyone who comments. A short, friendly answer is enough. Mention that DigiStayBook is launching soon, and don't promise dates or prices yet.</p>
        <p class="links"><a class="btn ghost" href="{e(data['pageUrl'])}" target="_blank" rel="noopener">Open the Page</a></p>
      </li>
    </ol>
  </div>
  <details class="copy" open>
    <summary>Caption</summary>
    <div class="text" id="cap{p['id']}">{para(p['caption'])}</div>
    <button type="button" class="btn ghost" data-copy="cap{p['id']}">Copy caption</button>
  </details>
  <details class="copy">
    <summary>Alt text</summary>
    <div class="text" id="alt{p['id']}"><p>{e(p['alt'])}</p></div>
    <button type="button" class="btn ghost" data-copy="alt{p['id']}">Copy alt text</button>
  </details>
</section>""")

page = f"""<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DigiStayBook Prelaunch Week</title>
<style>
:root {{
  --bg:#fefaf1; --surface:#ffffff; --ink:#1e252a; --muted:#6b6058; --line:#e8dcc8; --rust:#ba4e2e; --rust-soft:#f6e6dc; --ok:#245f50;
  color-scheme: light;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{ --bg:#12171a; --surface:#1b2226; --ink:#f5f1e8; --muted:#b3a99c; --line:#2e383d; --rust:#dd8465; --rust-soft:#2a201c; --ok:#7cc4ad; color-scheme: dark; }}
}}
:root[data-theme="dark"] {{ --bg:#12171a; --surface:#1b2226; --ink:#f5f1e8; --muted:#b3a99c; --line:#2e383d; --rust:#dd8465; --rust-soft:#2a201c; --ok:#7cc4ad; color-scheme: dark; }}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:var(--bg); color:var(--ink); font:16px/1.6 "Segoe UI", system-ui, -apple-system, sans-serif; }}
.wrap {{ max-width:980px; margin:0 auto; padding:32px 16px 80px; }}
h1, h2, h3 {{ font-family: Georgia, "Times New Roman", serif; line-height:1.2; margin:0; }}
h1 {{ font-size:clamp(30px, 6vw, 44px); margin:6px 0 10px; }}
.eyebrow {{ color:var(--rust); font-weight:700; letter-spacing:.14em; text-transform:uppercase; font-size:13px; margin:0; }}
.lede {{ color:var(--muted); max-width:62ch; margin:0 0 18px; }}
.note {{ background:var(--rust-soft); border-left:4px solid var(--rust); padding:12px 16px; border-radius:6px; margin:18px 0; }}
.note p {{ margin:4px 0; }}
.tabs {{ position:sticky; top:0; z-index:2; display:flex; gap:8px; overflow-x:auto; padding:12px 0; background:var(--bg); border-bottom:1px solid var(--line); margin-bottom:8px; }}
.tab {{ flex:0 0 auto; text-decoration:none; color:var(--ink); border:1px solid var(--line); background:var(--surface); border-radius:10px; padding:6px 14px; text-align:center; line-height:1.2; }}
.tab span {{ display:block; font-size:12px; color:var(--muted); }}
.tab b {{ font-size:18px; }}
.tab.done {{ border-color:var(--ok); }}
.tab.done span::after {{ content:" ✓"; color:var(--ok); }}
.day {{ background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:24px; margin:24px 0; scroll-margin-top:90px; }}
.day-head h2 {{ font-size:28px; margin:6px 0; }}
.goal {{ color:var(--muted); margin:0 0 18px; }}
.day-body {{ display:grid; grid-template-columns: 260px 1fr; gap:24px; align-items:start; }}
.shot {{ margin:0; }}
.shot img {{ width:100%; height:auto; border-radius:10px; border:1px solid var(--line); display:block; }}
.shot figcaption {{ font-size:14px; margin-top:6px; }}
a {{ color:var(--rust); }}
.steps {{ list-style:none; counter-reset:s; padding:0; margin:0; }}
.steps li {{ counter-increment:s; position:relative; padding:0 0 18px 48px; }}
.steps li::before {{ content:counter(s); position:absolute; left:0; top:0; width:32px; height:32px; border-radius:50%; background:var(--rust); color:var(--bg); display:grid; place-items:center; font-weight:700; }}
.steps h3 {{ font-size:19px; margin:4px 0 6px; padding-right:90px; }}
.steps p {{ margin:0 0 8px; }}
.time {{ display:inline-block; font:600 13px "Segoe UI", sans-serif; background:var(--rust-soft); color:var(--rust); border-radius:20px; padding:2px 10px; margin-left:6px; vertical-align:middle; }}
.done {{ position:absolute; right:0; top:4px; font-size:14px; color:var(--muted); display:flex; gap:6px; align-items:center; cursor:pointer; }}
.done input {{ width:18px; height:18px; accent-color:var(--ok); }}
.btn {{ display:inline-block; font:600 14px "Segoe UI", sans-serif; background:var(--rust); color:var(--bg); border:1px solid var(--rust); border-radius:8px; padding:7px 14px; text-decoration:none; cursor:pointer; }}
.btn.ghost {{ background:transparent; color:var(--rust); }}
.copy {{ border-top:1px solid var(--line); margin-top:16px; padding-top:12px; }}
.copy summary {{ cursor:pointer; font-weight:600; }}
.copy .text {{ background:var(--bg); border:1px solid var(--line); border-radius:8px; padding:4px 16px; margin:10px 0; white-space:normal; }}
.copy .text p {{ margin:10px 0; }}
footer {{ color:var(--muted); font-size:14px; border-top:1px solid var(--line); padding-top:16px; }}
@media (max-width: 680px) {{
  .day {{ padding:18px; }}
  .day-body {{ grid-template-columns: 1fr; }}
  .shot {{ max-width:320px; }}
  .steps h3 {{ padding-right:0; margin-top:28px; }}
}}
</style>
</head>
<body>
<div class="wrap">
  <p><a href="../MARKETING_PLAN.html">← Marketing plan</a></p>
  <p class="eyebrow">DigiStayBook · {e(data['campaign'])}</p>
  <h1>Your prelaunch week on Facebook.</h1>
  <p class="lede">{e(data['dates'])}. Seven posts introduce DigiStayBook before launch: what it is, the problem it solves, how it works, and questions that get hosts talking. All times are {e(data['timezone'])}.</p>
  <div class="note">
    <p><strong>Everything is already drafted.</strong> Each post below is saved as a draft on the <a href="{e(data['pageUrl'])}" target="_blank" rel="noopener">Digi Staybook Page</a> with its image and caption. Nothing has been published.</p>
    <p>Each day: open the draft, check it, publish or schedule it, then reply to comments. About ten minutes a day.</p>
  </div>
  <div class="note">
    <p><strong>Prelaunch rules for this week.</strong> No prices, launch dates or sign-up links yet; the call to action is "follow the Page". Seabreeze Cottage is a made-up demo property, and the captions say so. The images use only the real logo and real screenshots of the product. Its photos are Unsplash images, which are licensed for commercial use.</p>
  </div>
  <nav class="tabs" aria-label="Days">{''.join(tabs)}</nav>
  {''.join(days)}
  <footer>
    <p>Files: <code>images/</code> holds the seven post images; <code>content.json</code> holds the copy. To change a caption or image, edit <code>content.json</code> and run <code>build_images.py</code> and <code>build_plan.py</code>. Ticks are saved in this browser only, and ticking a box doesn't publish anything.</p>
  </footer>
</div>
<script>
(function () {{
  function get(k) {{ try {{ return localStorage.getItem(k); }} catch (e) {{ return null; }} }}
  function set(k, v) {{ try {{ localStorage.setItem(k, v); }} catch (e) {{}} }}
  function refreshTabs() {{
    document.querySelectorAll('.day').forEach(function (day) {{
      var boxes = day.querySelectorAll('input[type=checkbox]');
      var all = Array.prototype.every.call(boxes, function (b) {{ return b.checked; }});
      var tab = document.querySelector('.tab[href="#' + day.id + '"]');
      if (tab) tab.classList.toggle('done', all);
    }});
  }}
  document.querySelectorAll('input[data-key]').forEach(function (b) {{
    b.checked = get(b.dataset.key) === '1';
    b.addEventListener('change', function () {{ set(b.dataset.key, b.checked ? '1' : '0'); refreshTabs(); }});
  }});
  refreshTabs();
  document.querySelectorAll('[data-copy]').forEach(function (btn) {{
    btn.addEventListener('click', function () {{
      var el = document.getElementById(btn.dataset.copy);
      var text = Array.prototype.map.call(el.querySelectorAll('p'), function (p) {{ return p.innerText; }}).join('\\n\\n');
      var label = btn.textContent;
      function ok() {{ btn.textContent = 'Copied'; setTimeout(function () {{ btn.textContent = label; }}, 1500); }}
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(ok, function () {{}});
    }});
  }});
}})();
</script>
</body>
</html>
"""
open(os.path.join(HERE, "PRELAUNCH_WEEK_1.html"), "w", encoding="utf-8").write(page)
print("written")
