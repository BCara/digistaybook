"""Builds MARKETING_PLAN.html, the DigiStayBook marketing hub, in the same layout as the
DigiGuestbook marketing plan. Post copy comes from each campaign's content.json; the
styling and review script are the DigiGuestbook ones (copied into _reference/).

Run: python build_marketing_plan.py   (from this folder)
"""
import datetime as dt
import html
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
e = html.escape
CSS = open(os.path.join(HERE, "_reference", "plan.css"), encoding="utf-8").read()
JS = open(os.path.join(HERE, "_reference", "plan.js"), encoding="utf-8").read()
# Own storage key, and "today" from the viewer's clock instead of a build-time date.
JS = JS.replace("KEY='dg-plan-review'", "KEY='dsb-plan-review'")
JS = JS.replace("TODAY='2026-10-16', WEEKEND='2026-10-22'",
                "TODAY=new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10), "
                "WEEKEND=new Date(Date.now()-new Date().getTimezoneOffset()*6e4+6*864e5).toISOString().slice(0,10)")

STATUSES = ["Planned", "Manual review – changes needed", "Manual review – confirmed", "Drafted", "Scheduled", "Posted", "Skipped"]
COLOURS = {"Planned": "#8a8178", "Manual review – changes needed": "#b0493a", "Manual review – confirmed": "#2f7d4f",
           "Drafted": "#b07d12", "Scheduled": "#2f5fb0", "Posted": "#245f50", "Skipped": "#6b6b6b"}
MEANING = {"Planned": "in the plan; nothing in Meta yet",
           "Manual review – changes needed": "you reviewed it and want edits before it goes to Facebook",
           "Manual review – confirmed": "you reviewed it; OK to schedule",
           "Drafted": "saved as a draft in Business Suite",
           "Scheduled": "set to go out at its date and time", "Posted": "live", "Skipped": "not going out"}

CAMPAIGN_DIR = "prelaunch-week-2026-10-16"
data = json.load(open(os.path.join(HERE, CAMPAIGN_DIR, "content.json"), encoding="utf-8"))
YEAR = 2026
MONTHS = {"October": 10}


def post_date(p):
    _, d, month = p["date"].split()
    return dt.date(YEAR, MONTHS[month], int(d))


posts = []
for p in data["posts"]:
    d = post_date(p)
    posts.append({
        **p,
        "iso": d.isoformat(),
        "short": d.strftime("%a ") + str(d.day) + d.strftime(" %b"),
        "key": f"pl1-{p['id']}:facebook",
        "anchor": f"d-pl1-{p['id']}-facebook",
        "img": f"{CAMPAIGN_DIR}/images/{p['id']}-{p['day'].split()[0].lower()}.jpg",
        "status": p.get("status", "Drafted"),
    })
for p in posts:
    p["label"] = f"{p['theme']} · Facebook · {p['short']}"

counts = {s: sum(1 for p in posts if p["status"] == s) for s in STATUSES}


def select(p):
    opts = "".join(f"<option{' selected' if s == p['status'] else ''}>{e(s)}</option>" for s in STATUSES)
    return (f'<select class="st" data-key="{p["key"]}" data-orig="{e(p["status"])}" '
            f'data-label="{e(p["label"])}">{opts}</select>')


week_title = "Prelaunch week 1 · Fri 16 – Thu 22 October 2026"
week_theme = "Meet DigiStayBook: what it is, why hosts need it, how it works"
task_page = f"{CAMPAIGN_DIR}/PRELAUNCH_WEEK_1.html"

rows = [f'<tr class="wk" data-end="2026-10-22"><td colspan="6"><b>Prelaunch week 1</b> · Fri 16 – Thu 22 October 2026 · '
        f'{e(week_theme)} <span class="small">· Prelaunch · <a href="{task_page}" target="_blank">week task page</a></span></td></tr>']
for p in posts:
    rows.append(
        f'<tr class="post" data-date="{p["iso"]}" data-plat="facebook"><td class="nowrap">{e(p["short"])}<br>'
        f'<span class="small">{e(p["time"])}</span></td><td><a href="#{p["anchor"]}">{e(p["theme"])}</a></td>'
        f'<td>Facebook</td><td class="small">Feed post</td><td>{select(p)}</td>'
        f'<td><a class="view" href="#{p["anchor"]}">View ↓</a></td></tr>')

cards = [f'<h3 class="wkh" id="wk1" data-end="2026-10-22">{e(week_title)}</h3>']
for p in posts:
    notes = [f"Goal: {p['goal']}", f"Alt text (add when publishing): {p['alt']}"]
    if p.get("note"):
        notes.append(p["note"])
    cards.append(f"""<article class="card" id="{p['anchor']}">
  <div class="head"><div><div class="when">{e(p['short'])} · {e(p['time'])} · Facebook · Feed post</div><h3>{e(p['theme'])}</h3>
  <div class="small">Prelaunch · <a href="{task_page}" target="_blank">Week 1 task page (downloads, copy buttons)</a></div></div>
  <label class="small" style="text-align:right">Status<br>{select(p)}</label></div>
  <div class="cols"><div class="imgs"><a href="{p['img']}" target="_blank"><img loading="lazy" src="{p['img']}" alt="{e(p['alt'])}"></a></div>
  <div class="txt"><div class="label">Text · <span class="edit-hint">click to edit</span></div><textarea class="tx" data-key="{p['key']}" data-label="{e(p['label'])}" spellcheck="true">{e(p['caption'])}</textarea><div class="tx-bar small"><span class="tx-state"></span> <button type="button" class="tx-reset">Reset to original</button></div>{''.join(f'<p class="small">{e(n)}</p>' for n in notes)}
  <input class="cm" type="text" data-key="{p['key']}" data-label="{e(p['label'])}" placeholder="Comment for Claude (optional)">
  <p class="small"><a href="#posts">↑ Back to the table</a></p></div></div>
</article>""")

legend = "".join(f'<li><span class="badge" style="background:{COLOURS[s]}">{e(s)}</span> <span class="small">{e(MEANING[s])}</span> <b>{counts[s]}</b></li>' for s in STATUSES)
updated = dt.date.today()
updated_txt = updated.strftime("%A ") + str(updated.day) + updated.strftime(" %B %Y")

page = f"""<!doctype html>
<!-- GENERATED FILE: do not edit by hand; hand edits are lost on the next rebuild. To change a post, edit the
     campaign's content.json and run build_marketing_plan.py next to this file. -->
<html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Marketing Plan</title>
<style>
{CSS}
</style></head>
<body>
<header><div><div class="small" style="color:#cfe0d8;letter-spacing:.08em;text-transform:uppercase;font-weight:700">DigiStayBook · Marketing</div>
<h1>Marketing plan</h1><div>The one page for all marketing: every post and its status, what needs you, the strategy and the campaigns. Updated by Claude · {updated_txt}. Nothing is scheduled or posted without your approval.</div></div></header>
<div class="layout">
<aside class="side"><details id="toc" open><summary>Contents</summary><div class="sh">On this page</div><ul><li><a href="#strategy" title="Who we’re talking to, what we say and the rules.">Strategy</a></li><li><a href="#campaigns" title="Each campaign, its brief and its week pages.">Campaigns</a></li><li><a href="#changes" title="Changes since the last review.">What changed</a></li><li><a href="#needs" title="Things only you can do.">Needs you</a></li><li><a href="#posts" title="Every post with its status, and how to review one.">Posts</a></li><li><a href="#files" title="The folders on the NAS.">Where things are</a></li><li><a href="#details" title="Each post’s image and text, plus a comment box.">Post details</a></li></ul><div class="sh">Weeks</div><ul class="weeks"><li class="now"><a href="#wk1" title="Fri 16 Oct – Thu 22 Oct · Prelaunch"><b>Week 1</b> {e(week_theme)} <span class=tag>This week</span></a></li></ul><div class="sh">Campaign briefs</div><ul><li><a href="{task_page}" target="_blank" title="Running · 16 – 22 Oct 2026">Prelaunch week 1</a></li></ul></details></aside>
<main>
<h2 id="strategy">Strategy</h2>
<div class="box">
<p><b>Where we are (October 2026).</b> DigiStayBook is built and running on its test address, but hasn’t launched. The Facebook Page (Digi Staybook) was created on 15 October with the logo, cover, bio and website link. There are no followers or customers yet.</p>
<p><b>The job of this period is an audience, not revenue.</b> Before launch we want short-term rental hosts following the Page, and their own words about the questions guests ask and what they’d want from a digital guestbook. Those answers shape the launch messaging.</p>
</div>

<h3>What we track until launch</h3>
<table><tr><th>Measure</th><th>Where it’s read</th><th>Target</th></tr>
<tr><td>Page followers</td><td>Business Suite → Insights</td><td>Set after week 1, once there’s a baseline</td></tr>
<tr><td>Comments from hosts</td><td>The posts that ask a question (Sat, Tue, Wed, Thu)</td><td>Read and noted weekly</td></tr>
<tr><td>Reach per post</td><td>Business Suite → Content</td><td>Compare post types week to week</td></tr></table>
<p class="small">No numbers are guessed in advance. The first week sets the baseline.</p>

<h3>Constraints</h3>
<ul>
<li>Prelaunch: no prices, launch dates or sign-up links. The call to action is “follow the Page”.</li>
<li>Real product screens and the real logo only. No AI-generated people, scenes or photos in post images.</li>
<li>Seabreeze Cottage is a made-up demo property, and every post that shows it says so. No invented testimonials, customers or feedback.</li>
<li>Claude drafts; you approve. Posts sit in Business Suite as drafts until you publish or schedule them.</li>
</ul>

<h3>Who we talk to</h3>
<ul>
<li><b>Short-term rental hosts</b> with one or a few properties, listing on Airbnb, Stayz or Booking.com, who answer the same guest questions every changeover.</li>
<li>Hosts who already leave a paper guestbook or a house manual, and would like guests to actually use it.</li>
</ul>

<h3>What we say</h3>
<p class="box"><i>One QR code on the counter opens your house guidance, your local favourites and a wall of guest memories. No app and no account for guests.</i></p>
<ul>
<li><b>Always:</b> no app to download and no guest sign-up; the host stays in control (safety checks, approval, hide or remove posts); label the demo as a demo.</li>
<li><b>Never:</b> promise a launch date or price before it’s set; suggest it gets hosts better reviews; present demo messages as real guests.</li>
</ul>

<h3>Channels</h3>
<table><tr><th>Channel</th><th>Role</th><th>Rhythm</th></tr>
<tr><td>Facebook Page (Digi Staybook)</td><td>Build a following of hosts before launch</td><td>One feed post a day in week 1, then review</td></tr>
<tr><td>Host Facebook groups</td><td>Where hosts already talk (later, with each group’s rules)</td><td>Not started</td></tr>
<tr><td>Instagram</td><td>Not connected yet</td><td>Not started</td></tr></table>

<h3>How the work runs</h3>
<ol>
<li><b>Drafting:</b> Claude writes each post, builds its image and saves it as a <b>draft</b> in Meta Business Suite, then sets its status here.</li>
<li><b>Review:</b> you review on this page (status and “Comment for Claude” on each card → <b>Copy my review</b> → paste to Claude).</li>
<li><b>Publishing:</b> you publish or schedule the draft on its day, or ask Claude to schedule it after your approval.</li>
</ol>

<h2 id="campaigns">Campaigns</h2>
<p class="small">Each campaign has its own folder and week page. This page tracks all of them.</p>
<div class="box"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><h3 style="margin:0">Prelaunch week 1</h3>
<span class="badge" style="background:#245f50">Running</span></div><div class="small">16 – 22 Oct 2026 · folder <code>{CAMPAIGN_DIR}</code></div>
<p>Seven Facebook feed posts introducing DigiStayBook: what it is, the questions every host knows, how it works, the guest wall, local tips, guest ease and host control, and a question for hosts. Each has its own image built from the logo and real screenshots of the demo.</p><p><a class="btn" href="{task_page}" target="_blank">Open the week task page →</a></p></div>

<h2 id="changes">What changed since the last review</h2><div class="box"><ul>
<li><b>Facebook Page created</b> (15 Oct): Digi Staybook, category Software, with the bio, the website link, the logo as profile picture and the “story worth keeping” cover.</li>
<li><b>Prelaunch week 1 drafted:</b> seven posts for 16–22 October were saved as drafts in Business Suite.</li>
<li><b>Say hello posted</b> (16 Oct, 9:53 pm) by you, with reworded copy.</li>
<li><b>The other six scheduled</b> (16 Oct) at their planned Sydney times: Sat 9:00 am, Sun 7:30 pm, Mon 12:30 pm, Tue 7:30 pm, Wed 7:30 pm, Thu 7:30 pm. Wednesday’s post had lost its image card; it was re-attached before scheduling.</li>
<li><b>This page:</b> the DigiStayBook marketing hub, in the same layout as the DigiGuestbook plan.</li>
</ul></div>

<h2 id="needs">Needs you</h2>
<div class="box warn"><b>Things only you can do</b><ul>
<li>Delete the stray draft that starts “#ShortTermRental #HolidayRental…” in Business Suite, if you don’t need it (it may not show under the default date filter).</li>
<li>Fix where the website link goes: <b>digistaybook.com</b> shows a GoDaddy page, not the app, and the Page links there.</li>
<li>The cover image’s phone screen reads “DigiSook”. Replace the cover when you have a corrected version.</li>
<li>Close the leftover Business Suite tab in Chrome (an unfinished post from 15 Oct) and choose discard.</li>
</ul></div>

<h2 id="posts">Posts</h2>
<ul class="legend">{legend}</ul>
<div class="box"><b>How to review a post</b><ul>
<li>This week’s posts are all <b>scheduled</b> or <b>posted</b>. To change one, edit it under Scheduled in Business Suite before its time.</li>
<li>Facebook drafts don’t keep alt text. It’s in each post’s details; add it when you publish.</li>
<li>Captions that show the demo say it’s a made-up property. Keep that line if you edit them.</li>
<li>All times are Sydney time.</li>
</ul></div>
<p class="small">One row per post. Set the <b>status</b> as you review (your changes turn yellow and are saved in this browser), add comments in the post’s details, then press <b>Copy my review</b> and paste it to Claude, who makes it official. <b>View ↓</b> jumps to the image and text.</p>
<div class="filters"><label>Show <select id="f-when"><option value="upcoming" selected>From today</option><option value="week">Next 7 days</option><option value="all">All, including past</option></select></label>
<label>Where <select id="f-plat"><option value="">Everywhere</option><option value="facebook">Facebook</option></select></label>
<span class="small" id="shown"></span></div>
<div style="overflow-x:auto"><table id="t"><tr><th>When</th><th>Post</th><th>Where</th><th>Type</th><th>Status</th><th></th></tr>{''.join(rows)}</table></div>

<h2 id="files">Where things are</h2><div style="overflow-x:auto"><table>
<tr><td><code>MARKETING_PLAN.html</code></td><td>This page. The one place to look; Claude keeps it up to date.</td></tr>
<tr><td><code>{CAMPAIGN_DIR}/</code></td><td>Prelaunch week 1: the week task page (PRELAUNCH_WEEK_1.html), images/, the source screenshots, content.json (the copy) and the scripts that build the images and pages.</td></tr>
<tr><td><code>_reference/</code></td><td>The page styling and review script, shared with the DigiGuestbook plan.</td></tr>
</table></div>

<h2 id="details">Post details</h2>
<p class="small">Image, text and notes for every post, in date order. <a href="#posts">↑ Back to the table</a></p>
{''.join(cards)}
</main>
</div>
<div class="bar"><span id="count">No changes yet</span><button id="copy">Copy my review</button><button id="clear" style="background:#fffdf7">Clear my changes</button></div>
<script>
{JS}
</script></body></html>
"""
open(os.path.join(HERE, "MARKETING_PLAN.html"), "w", encoding="utf-8").write(page)
print("written", len(page))
