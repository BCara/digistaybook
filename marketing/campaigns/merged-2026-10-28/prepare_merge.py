"""Reproducible editorial merge. Reads preserved campaign sources; never publishes."""
from pathlib import Path
from datetime import date, timedelta
from urllib.parse import urlencode
import json, shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
S = json.loads((HERE/'original-sources.json').read_text(encoding='utf-8'))
month = S['campaigns/month-2026-10-23']['posts']
home = S['campaigns/home-2026-11-02']['posts']
voice = S['campaigns/respect-host-voice-2026-10-28']
V = 'campaigns/respect-host-voice-2026-10-28/assets/'
H = 'campaigns/home-2026-11-02/'
A = 'campaigns/merged-2026-10-28/assets/'
items = []

def add(id, day, title, format, topic, caption, assets=(), brief='', alt='', source=(), goal='Demo visit', frames=(), channel='Facebook', role='Main', cta='Explore the guest demo', destination='/stay/demo-cottage', placement='caption', production='Ready media; review copy and current UI'):
    url = 'https://digistaybook.com'+destination+'?'+urlencode(dict(utm_source=channel.lower().replace(' ','_'),utm_medium='organic_social',utm_campaign='host_welcome_202611',utm_content=id)) if destination else ''
    caption = caption.strip().replace('{link}',url)
    if url and '{link}' not in caption and url not in caption and placement=='caption': caption += '\n\n'+cta+': '+url
    p = dict(id=id,date=day,time='19:30' if channel=='Facebook' else '20:30' if channel=='Pinterest' else '08:00',channel=channel,role=role,format=format,topic=topic,title=title,caption=caption,assets=list(assets),visual=brief,alt=alt or title,source_ids=list(source),goal=goal,cta=cta,destination=url,link_placement=placement,frames=list(frames),production=production,status='Planned',revision='merge-20261028-v1')
    p['week']=(date.fromisoformat(day)-date(2026,10,29)).days//7+1
    p['first_comment']=('Explore the fictional Seabreeze Cottage guest demo: '+url) if url and placement=='first comment' else ''
    items.append(p)
    return p

add('r-07','2026-10-30','One scan: welcome, essentials, memories','Reel','overview',
    'One scan opens a welcome from the hosts, the practical details for the stay, and memories from past guests.\n\nThis is the fictional Seabreeze Cottage demo. Guests open DigiStayBook in a browser, with no guest account or app download.\n\nExplore the guest demo: {link}',
    [H+'week1-assets/2026-11-04_instagram_reel_your-welcome.mp4'],source=['r-07','m1-29','r-26'],brief='Existing 25-second Canva export with real demo screens. Silent version is usable; add only music licensed for the destination. Keep demo labels visible.',alt='A phone showing a fictional welcome, house essentials and guest memories over real interior footage.')
add('r-04','2026-11-01','Five things worth telling every guest','Carousel','arrival-checklist',
    'A useful welcome answers more than “what is the Wi-Fi password?”\n\nIntroduce yourself, give a little context about the home, explain how things work, make practical details easy to find, and share your local favourites.\n\nThe notes in these slides are illustrative examples to adapt to your home, including your actual bin colours and collection day.\n\nSave the checklist, then explore an example welcome: {link}',
    [H+f'week1-assets/2026-11-01_instagram_carousel-{i}.png' for i in range(1,8)],source=['r-04','m1-03','r-17'],brief='Seven existing photo-led slides in order. Facebook multi-image post; optional Instagram carousel uses this same creative, not another concept.',alt='Seven photo-led slides covering a host introduction, the home story, practical details, bins and local favourites.')
add('voice-fb-02','2026-11-03','Same boundary. Better explanation.','Carousel','wording',
    voice['facebook'][1]['finalCaption'].replace('Tomorrow we will show where a note like this can live in DigiStayBook.','Explore the guest demo to see where practical notes can live.'),
    [V+f for f in voice['facebook'][1]['files']],source=['voice-fb-02','r-16','r-10'],brief='Existing three-slide writing lesson: request, reason, practical help. No policy or compliance claim.',alt=voice['facebook'][1]['alt'])
add('m1-10','2026-11-05','Make a local recommendation useful','Carousel','local-tips',
    '“There is a beach nearby” gives guests a place. A personal note gives them a reason to try it.\n\nFor each recommendation, add: why you like it, who it suits, and one practical detail worth checking.\n\nExample wording: “We like this walk for a quiet morning. Check the tide and conditions before setting out.” This is a writing example, not a verified destination recommendation.\n\nSee how local notes appear in the guest demo: {link}',[A+f'local-{i}.png' for i in range(1,4)],source=['m1-10'],brief='Three-slide coastal photo, editorial note and product-context sequence. Existing genuine memory-coast photo, not a customer property.',alt='A coastal photograph followed by prompts for writing a personal local recommendation and an example guest note.')
add('m1-01','2026-11-06','Bags down. Where is the Wi-Fi?','Reel','wifi',
    'The bags are inside. The next question is practical.\n\nShow guests where to find the Wi-Fi details alongside the rest of their stay information. No guest app or account is needed.\n\nThe recording will use the fictional demo; never show a real property password. Explore it yourself: {link}',source=['m1-01','voice-idea-2-3'],brief='New 12–15 second actual screen recording. Start with the question, open the demo essentials, tap Wi-Fi and hold the answer. Use demo data only. Do not substitute another slow slideshow.',frames=['0–2s: Bags down. Where is the Wi-Fi?','2–5s: Guest demo opens in a phone browser.','5–10s: Tap the actual Wi-Fi essential; show demo-only information.','10–15s: Hold the answer, then “Explore the guest demo”.'],production='NEEDS VIDEO V1 · due 4 Nov · actual tap recording')
add('voice-video-02','2026-11-08','A memory and private feedback have different places','Reel','feedback',
    'A holiday memory and practical feedback are different things to share.\n\nDigiStayBook has a memory wall, an option for hosts to require approval for new memories, and a separate private-feedback form.\n\nPrivate feedback is not an urgent in-stay help service. Use the booking app to contact the host for help during a stay. Booking-platform reviews stay on that platform.\n\nThis video uses the fictional demo. Explore it: {link}',[V+'video-02-memories-feedback.mp4'],source=['voice-video-02','m1-18','voice-idea-3-4'],brief='Existing 18-second silent captioned export; it demonstrates the distinction, not proven customer behaviour.',alt='A fictional memory wall and a separate private-feedback form, with an explanation of host approval.')
add('voice-fb-01','2026-11-09','The care guests do not see','Photo','host-story',voice['facebook'][0]['finalCaption'],[V+'fb-01-care.png'],source=['voice-fb-01','r-08','r-09','voice-idea-2-5','voice-idea-3-1'],brief='Existing genuine fireplace photograph. Thirteen days after the recorded 28 Oct story post; no invented host biography.',alt=voice['facebook'][0]['alt'])
add('m1-06','2026-11-11','Asked twice? Give the answer a home.','Photo','repeat-question',
    'Before the next changeover, look at the practical questions you have answered more than once.\n\nCould one clear note help the next guest find the answer? Where spare blankets live, how the heating starts, or which door leads to the garden?\n\nPick one topic and put the answer beside your welcome. The image is a writing prompt, not a claim that DigiStayBook has reduced messages for customers.\n\nExplore the demo house guidance: {link}',[A+'asked-twice.png'],source=['m1-06','m1-11','voice-idea-2-1'],brief='Photo of a tabletop, concise checklist and one example note. Use genuine memory-table photo, with a different crop and structure from other posts.',alt='A table photograph beside three prompts: repeated question, clear answer, easy place to find it.')
add('m1-08','2026-11-13','One local tip, opened on a phone','Reel','local-demo',
    'Show one recommendation, not a long list.\n\nThis walkthrough opens a real local-information section in the fictional demo and shows how a host can add context to a stay.\n\nLocal details are examples. Hosts should check their own recommendations before sharing them. Explore the guest view: {link}',source=['m1-08','voice-idea-3-5'],brief='New 15–20 second live demo recording: open the relevant actual section and show one note. Verify the control exists in production first; if it does not, use an actual host-note example and change the caption to match.',frames=['0–2s: “What would you recommend here?”','2–7s: Open the relevant actual demo section.','7–14s: Hold one note; highlight why it is useful.','14–20s: Demo label and “Explore the guest view”.'],production='NEEDS VIDEO V2 · due 11 Nov · local-note demonstration')
add('voice-fb-05','2026-11-15','Your first welcome, in three lines','Worksheet','welcome-writing',voice['facebook'][4]['finalCaption'].split('See how the pieces')[0]+'See how the pieces fit in the guest demo: {link}',[V+'fb-05-worksheet.png'],source=['voice-fb-05','m1-04','voice-idea-4-1'],brief='Existing three-line worksheet. Twelve days after the practical wording lesson; different task and layout.',alt=voice['facebook'][4]['alt'])
add('m1-19','2026-11-16','Where would a guest notice the QR display?','Diagram','qr-placement',
    'A useful guest guide needs a place guests notice.\n\nTry a clear spot on the welcome counter or beside the welcome folder. Keep the display easy to see, and test the scan from a normal standing position.\n\nThis is a placement illustration. Your real property QR belongs at the property; keep private stay links and access details out of public posts.\n\nSee what a guest can open: {link}',[A+'qr-placement.png'],source=['m1-19','voice-idea-4-2'],brief='Purpose-made placement diagram. No fake scannable QR and no private property URL.',alt='A diagram showing a guest-guide display on a welcome counter, with sightline and scan-testing tips.')
add('new-approval','2026-11-17','Choose when a new memory appears','Reel','approval',
    'Want to check new memories before they appear on your DigiStayBook wall?\n\nHosts can switch on approval for new memories. This demonstration uses a test property and a clearly labelled sample submission.\n\nIt shows the host approval choice; booking-platform reviews remain on the booking platform. Explore the guest side: {link}',source=['m1-20','voice-idea-3-3'],brief='New 20–25 second recording on an isolated test property. Show the actual require-approval control, a pending sample and approval result. Never create or change a real customer submission. Export only after verifying both sides.',frames=['0–3s: “Want to check a memory first?”','3–9s: Test-property approval setting.','9–17s: Sample pending memory and actual approve action.','17–25s: Resulting guest wall; demo label and next step.'],production='NEEDS VIDEO V3 · due 15 Nov · isolated test-property approval')
add('new-wet-weather','2026-11-19','Give guests a rainy-day alternative','Photo','weather',
    'A wet forecast is a good reason to add one thoughtful local note.\n\nSuggest an option that fits your guests, say why you like it, and include anything they should check before going.\n\nA useful writing prompt: “If the beach is off today, we like ___ because ___. Check ___ before you leave.”\n\nFill it with a real recommendation you know. The photo is stock, and the wording is a template. Explore the example guest notes: {link}',[A+'rainy-day.png'],source=['m1-12','voice-idea-2-6'],brief='Full-bleed genuine window photograph with a short cream note. No invented local business.',alt='A window photograph with a fill-in prompt for a host’s rainy-day recommendation.')
add('voice-fb-03','2026-11-20','Your welcome, on their phone','Reel','host-voice-demo',
    voice['facebook'][2]['finalCaption'].split('Explore the demo:')[0]+'Explore the demo: {link}',[V+'video-01-welcome.mp4'],source=['voice-fb-03','voice-video-01'],brief='Existing 20-second captioned screen-capture composition. Twenty-one days after the broader arrival Reel, not a second welcome walkthrough the same week.',alt=voice['facebook'][2]['alt'])
add('r-18','2026-11-22','A house-guide starter you can copy','Carousel','guide-template',
    'Start with the details a guest needs, then make them sound like you.\n\nSwipe for a short house-guide structure: a hello, the essentials, a personal note and one local favourite. Copy the headings from the slides; there is no email gate or promised download.\n\nAll examples are illustrative. Add your actual details and follow the terms that apply to your property.\n\nSee how the sections fit together: {link}',[A+f'guide-{i}.png' for i in range(1,4)],source=['r-18','r-12','r-13','m1-24'],brief='Three usable starter slides. Practical information, without a policy workaround, mandatory-chores claim or nonexistent PDF offer.',alt='Three starter slides for a house guide: welcome, essential answers and personal local notes.')
add('new-neighbours','2026-11-23','The quiet-hours sentence','Graphic','neighbours',
    'A good house note tells guests what matters and gives them practical help.\n\nFor a neighbourly note, use the actual time, the place it applies, and a true reason. For example: “Please bring conversations indoors after [time]; our neighbours start work early.”\n\nAdapt this example to your home and the terms that apply to it. A note cannot guarantee guest behaviour.\n\nExplore how a host note appears: {link}',[A+'quiet-hours.png'],source=['voice-idea-2-4','r-22'],brief='Distinct large clock and short note layout. No party footage or threat of penalties.',alt='A clock illustration and a fill-in neighbourly quiet-hours note.')
add('new-page-purposes','2026-11-24','Two pages. Two purposes.','Comparison','page-purposes',
    'Your house guidance and your public memories have different jobs.\n\nThe in-stay view brings the welcome and practical guidance together. Hosts can also enable an optional public memory page. The public page is not the place for access codes or private stay information.\n\nAn in-stay link is not an authenticated guest login. The screenshots are from the fictional demo. Compare the guest views: {link}',[A+'two-pages.png'],source=['m1-13','voice-idea-3-2'],brief='Side-by-side actual demo arrival and public-wall crops, explicitly labelled. No security promise.',alt='A comparison of fictional in-stay welcome and optional public memories, with their different purposes.')
add('m1-15','2026-11-25','Leave a memory without another account','Reel','memory-upload',
    'A small holiday moment can become part of the guestbook.\n\nThis walkthrough uses a test property to show the actual guest memory flow without a guest account. Host approval may apply before a new memory appears.\n\nSample content is labelled, and this is not a booking-platform review. Explore the guest demo: {link}',source=['m1-15','r-24','r-25'],brief='New 15–20 second actual guest-flow recording using a disposable test property and owned sample photo. Do not submit to a production property. If the public demo cannot submit, say so and label the separate test-property recording.',frames=['0–3s: “A memory, without another account.”','3–8s: Open the actual guest contribution flow.','8–14s: Add an owned demo photo/message on the test property.','14–20s: Show actual confirmation; explain approval if applicable.'],production='NEEDS VIDEO V4 · due 23 Nov · guest memory flow')
add('voice-fb-04','2026-11-27','What would you want guests to understand?','Question card','host-question',voice['facebook'][3]['finalCaption'],[V+'fb-04-question.png'],source=['voice-fb-04','m1-27'],goal='Useful host replies',destination='',cta='Share one non-sensitive detail',brief='Existing question card. This is the one primary conversation-only item; do not turn every other post into the same question.',alt=voice['facebook'][3]['alt'])
add('new-setup','2026-11-29','Start with one property and one useful note','Reel','first-property',
    'Start with one property, a welcome in your own words, and one practical answer guests can find.\n\nThis demonstration will show the actual setup and guest preview on a test account. It makes no promise about how long setup takes.\n\nExplore the guest demo, then use the website’s host account route if you want to try your own: {link}',source=['m1-22','m1-25','voice-idea-4-3','voice-idea-4-7'],brief='New 25–35 second coherent setup-to-preview recording. Verify actual account, plan and activation requirements before filming. Keep email, billing, identifiers and access details out. CTA leads to demo first; do not invent a free plan or activation promise.',frames=['0–3s: “What would your first welcome say?”','3–10s: Actual test-property welcome field.','10–17s: Add one practical house essential.','17–26s: Open actual guest preview.','26–35s: Demo first, then website host-account route.'],production='NEEDS VIDEO V5 · due 27 Nov · setup-to-preview demonstration')

# Searchable evergreen Pins have separate destinations and copy; no new channel is assumed active.
pin_days=['2026-11-02','2026-11-06','2026-11-10','2026-11-14','2026-11-18']
for p,day in zip(voice['pinterest'],pin_days):
    caption=p.get('finalCaption',p.get('description',''))
    caption += '\n\nExplore the example guest welcome and notes: {link}'
    add('voice-'+p['id'],day,p['title'],'Pin','pin-'+p['id'],caption,[V+f for f in p['files']],source=['voice-'+p['id']],channel='Pinterest',role='Search support',brief='Existing 1000×1500 Pin. Use the native destination field. Caption describes the on-image prompt; the destination is the product demo, not a promised downloadable resource.',alt=p['alt'],placement='destination field')
for id,day,title,file,caption,sources in [
    ('pin-qr','2026-11-21','Where to put a holiday-home guest QR display','pin-qr.png','A welcome counter or folder can give a property QR display a clear home. Save the placement prompts, then explore what a guest can open.', ['voice-idea-4-2']),
    ('pin-pages','2026-11-25','House guidance and public guest memories','pin-pages.png','In-stay house information and an optional public memory page serve different purposes. Explore the fictional guest demo; keep private stay details out of public artwork.', ['voice-idea-3-2']),
    ('pin-setup','2026-11-28','A first-property welcome checklist','pin-setup.png','Write your welcome, add one practical essential, check the guest preview and test your property QR. Explore the example guest view before planning your own.', ['voice-idea-4-6'])]:
    add(id,day,title,'Pin','pin-'+id,caption,[A+file],source=sources,channel='Pinterest',role='Search support',placement='destination field',brief='Purpose-made vertical 1000×1500 Pin with one specific useful task and a native demo destination.')

# Stories support the chosen ideas; they are not another competing daily campaign.
for p,day,parent in zip(voice['stories'],['2026-11-09','2026-11-03','2026-11-20','2026-11-01','2026-11-27','2026-11-14','2026-11-15'],['voice-fb-01','voice-fb-02','voice-fb-03','r-04','voice-fb-04','','voice-fb-05']):
    item=add('voice-'+p['id'],day,p['title'],'Story','support-'+p['id'],p['headline'].replace('\n',' ')+'\n\n'+p['body'].replace('\n',' '),[V+p['file']],source=['voice-'+p['id']],channel='Facebook Stories',role='Companion',placement='native sticker if available',brief=p['interaction']+' Verify that the current Page editor offers the sticker and test the link. Otherwise direct viewers to the corresponding Page post; do not render a fake interactive button.',goal='Support the linked main post',alt=p['title'])
    item['parent_id']=parent
    item['time']='20:15' if parent else '08:00'

for id,day,title,caption,src in [
    ('r-03','2026-10-31','Listen: which arrival detail is hardest to explain?', 'For hosts with one or a few holiday homes: which practical arrival detail is hardest to explain in a message? I am building DigiStayBook, a digital welcome and guestbook product, and would value the topic rather than guest names or private messages. No product link here. Please share only if this discussion fits the community rules.', ['r-03','r-11','r-27']),
    ('r-05','2026-11-12','Answer one relevant host question', 'If a host asks how to make a house note clearer, offer an example: “[clear request], because [true reason]. You can find [practical help] at [actual location].” Say it is example wording and adapt it to the question. Disclose that you build DigiStayBook if discussing the product. Do not claim personal hosting experience or post a promotional link.', ['r-05']),
    ('community-review','2026-11-26','Collect actual objections for the next demo', 'Review actual relevant questions and identify one thing the next walkthrough should explain. If posting a question, disclose that you build DigiStayBook and check the community rules first. Share no invented findings, testimonials or product links.', ['m1-21','m1-26','m1-28','m1-30','voice-idea-3-7','voice-idea-4-4'])]:
    add(id,day,title,'Discussion','community',caption,source=src,channel='Host communities',role='Optional listening',goal='Learn actual host questions',destination='',cta='Respond helpfully where allowed',production='Text ready; community relevance and permission to post unverified')

items.sort(key=lambda p:(p['date'],p['time'],p['id']))
# Every original item remains findable, with a decision instead of a second live calendar.
catalog=[]
for i,p in enumerate(month): catalog.append(dict(id=f'm1-{i+1:02}',title=p['title'],source='month-2026-10-23/content.json',original_date=str(date(2026,10,23)+timedelta(days=i)),original=p))
for i,p in enumerate(home): catalog.append(dict(id=f'r-{i+1:02}',title=p['title'],source=H+'content.json',original_date=str(date(2026,10,29)+timedelta(days=p['day'])),original=p))
for group in ['facebook','pinterest','stories','videos']:
    for p in voice[group]: catalog.append(dict(id='voice-'+p['id'],title=p['title'],source='campaigns/respect-host-voice-2026-10-28/content.json',original_date=str(date(2026,11,2)+timedelta(days=p['day']-1)),original=p))
for w in voice['weeks'][1:]:
    for i,p in enumerate(w['ideas']): catalog.append(dict(id=f"voice-idea-{w['n']}-{i+1}",title=p[1],source='campaigns/respect-host-voice-2026-10-28/content.json',original_date=str(date(2026,11,2)+timedelta(days=(w['n']-1)*7+i)),original=p))
reasons={
 'r-01':'Recorded in source notes as scheduled in Meta for 28 Oct 19:30 Sydney, brought forward from 29 Oct. Preserve this record and asset; verify in Meta. Do not repost or move it. This run did not inspect Meta.',
 'r-02':'Needs genuine host footage; staged host identity would be misleading. Optional sixth video can use the actual founder instead.',
 'r-06':'Requires a willing genuine host. Defer; do not invent Rosa, her property or a testimonial.',
 'r-14':'LinkedIn is optional until the main-channel traffic baseline exists. Retain as a later property-manager test.',
 'r-19':'Guest-facing respect appeal has a weaker host-demo route. Replace with actual guest memory and approval demonstrations.',
 'r-20':'Requires real permissioned stories; none verified. Keep in reserve until genuine evidence exists.',
 'r-21':'Email audience, consent and live resource destinations are unverified. Retain as a gated later task; no send or draft in an external email service.',
 'r-23':'Repeated host-story poll. Reuse the finished support Stories instead of another campaign.',
 'r-28':'Generic gratitude/tagging is a weaker traffic route than the specific setup demonstration; retain for later genuine milestone.',
 'm1-17':'Another guest-memory question would repeat the memory Reel. Save for a later month with genuine examples.',
 'm1-23':'Similar next-changeover prompt is covered by the useful-answer and house-guide items.',
 'm1-07':'Weekly listening prompts consolidated into optional community review; no extra feed post.',
 'm1-09':'Late-arrival variant retained for a future dedicated demo; avoid another near-identical arrival post.',
 'm1-02':'Arrival question covered by the checklist and Wi-Fi demo.',
 'm1-05':'Guide-versus-guestbook question covered by the opening demonstration.',
 'm1-14':'Local-tip poll adds little beyond the useful recommendation and local demo.',
 'm1-16':'Memory question covered by the guest memory Reel.',
 'voice-idea-2-2':'Checkout flowchart kept in reserve. No claim about changing platform policy; publish only property-specific information that remains accurate.',
 'voice-idea-2-7':'Live rewrite clinic depends on genuine questions. Use the finished writing lesson and respond only to actual replies.',
 'voice-idea-3-6':'Three more host-voice examples would repeat the welcome worksheet; retain for a later month.',
 'voice-idea-4-5':'Optional sixth video: actual founder explains the product on camera. Requires genuine recording; no synthetic customer endorsement.'
}
for p in catalog:
    targets=[x for x in items if p['id'] in x['source_ids']]
    p['targets']=[x['id'] for x in targets]
    if targets:
        direct=any(x['id']==p['id'] for x in targets)
        p['decision']='Keep / revise / space' if direct else 'Merge into stronger item'
        p['reason']='One retained concept with full copy and media. Use the merged date only after checking any existing Meta schedule; original records are retained here.' if direct else 'Same underlying promise is already served by the linked item; no separate near-duplicate is added.'
    else:
        p['decision']='Preserve recorded schedule' if p['id']=='r-01' else 'Reserve / not in active calendar'
        p['reason']=reasons.get(p['id'],'Covered by the revised mix; retained as a future variation rather than adding more repeated daily posts.')

out=dict(title='DigiStayBook · merged traffic plan',updated='2026-10-28',start='2026-10-29',end='2026-11-29',timezone='Australia/Sydney',stage='Reviewable proposal; no external publishing or schedule changes',posts=items,decisions=catalog,recorded_schedule=dict(id='r-01',date='2026-10-28',time='19:30',status='Scheduled — recorded in existing notes; not reverified',title=home[0]['title'],asset=H+home[0]['assets'][0]['file']),sources=[dict(title='Meta: original creators',url='https://about.fb.com/news/2026/03/rewarding-original-creators-on-facebook/'),dict(title='Meta: spammy captions and content',url='https://about.fb.com/news/2025/04/cracking-down-spammy-content-facebook/'),dict(title='Google Analytics: campaign URL parameters',url='https://support.google.com/analytics/answer/10917952'),dict(title='Pinterest: guide to creating Pins',url='https://help.pinterest.com/en/guide/guide-to-creating-pins'),dict(title='YouTube: links and Shorts',url='https://support.google.com/youtube/answer/13748639')])
(HERE/'content.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Merged {len(catalog)} source records into {len(items)} active items; {sum(x["role"]=="Main" for x in items)} main posts.')
