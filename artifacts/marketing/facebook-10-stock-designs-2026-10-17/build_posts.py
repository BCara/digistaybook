"""Ten original graphic layouts using existing licensed photos and real product screenshots.
No image-generation tools, generated-image inputs, or AI-provenance removal.
Run with Pillow. Source credits are retained in source-manifest.json.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import json, html, shutil, zipfile
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
W,H=1080,1350
CREAM="#F7F2E8"; INK="#14181B"; RUST="#B4472A"; SAGE="#7D8872"; WHITE="#FFFDF8"
OUT=HERE/"images"; OUT.mkdir(parents=True,exist_ok=True)
FONT=Path("C:/Windows/Fonts")
def font(size,bold=False,serif=False):
    return ImageFont.truetype(str(FONT/("georgiab.ttf" if serif and bold else "georgia.ttf" if serif else "segoeuib.ttf" if bold else "segoeui.ttf")),size)
def text(im,xy,lines,size=70,color=INK,bold=False,serif=False,leading=1.14):
    d=ImageDraw.Draw(im); y=xy[1]
    for line in lines.split("\n"):
        d.text((xy[0],y),line,font=font(size,bold,serif),fill=color)
        y+=int(size*leading)
    return y
def fitphoto(name,size):
    return ImageOps.fit(Image.open(ROOT/"public/wall"/name).convert("RGB"),size,method=Image.Resampling.LANCZOS)
def photo(im,name,box):
    im.paste(fitphoto(name,(box[2]-box[0],box[3]-box[1])),box[:2])
def brand(im,x=64,y=1190,width=385):
    logo=Image.open(ROOT/"src/assets/logo-long.png").convert("RGB")
    logo=logo.resize((width,round(logo.height*width/logo.width)),Image.Resampling.LANCZOS)
    d=ImageDraw.Draw(im);d.rounded_rectangle((x-16,y-12,x+width+16,y+logo.height+12),radius=14,fill=CREAM)
    im.paste(logo,(x,y))
def footer(im,dark=False):
    brand(im)
    text(im,(725,1222),"digistaybook.com",25,CREAM if dark else INK)
def eyebrow(im,s,x=66,y=65,color=RUST):
    text(im,(x,y),s,23,color,True)
def phone(im,shot,x,y,width,height):
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((x+9,y+14,x+width+9,y+height+14),46,fill="#D2C8B8")
    d.rounded_rectangle((x,y,x+width,y+height),46,fill=INK)
    src=Image.open(ROOT/"artifacts/social/prelaunch-week-2026-10-16/source"/shot).convert("RGB")
    inner=(width-24,height-24)
    # Retain real screenshot proportions. Crop vertically only; never invent controls or product text.
    src=src.resize((inner[0],round(src.height*inner[0]/src.width)),Image.Resampling.LANCZOS)
    canvas=Image.new("RGB",inner,CREAM);canvas.paste(src,(0,0))
    mask=Image.new("L",inner); ImageDraw.Draw(mask).rounded_rectangle((0,0,inner[0],inner[1]),36,fill=255)
    im.paste(canvas,(x+12,y+12),mask)
def save(im,id,title,caption,assets,layout):
    path=OUT/(id+".png");im.save(path)
    posts.append(dict(id=id,title=title,caption=caption,image="images/"+path.name,assets=assets,layout=layout,status="preview_only_not_published"))
posts=[]
# 1. Split editorial product demonstration.
im=Image.new("RGB",(W,H),CREAM)
d=ImageDraw.Draw(im);d.rectangle((610,0,W,H),fill="#DDD8CA")
eyebrow(im,"THE DIGITAL GUESTBOOK")
text(im,(64,185),"A guestbook.\nMade for\nmemories.",75,serif=True)
text(im,(66,525),"Guest photos.\nLittle messages.\nAll in one place.",34,leading=1.5)
phone(im,"wall-memory.jpg",600,175,410,892)
text(im,(660,1100),"REAL PRODUCT · DEMO",19,INK,True)
footer(im)
save(im,"01-digital-guestbook","A guestbook. Made for memories.","A guestbook is a little record of the people who have enjoyed your place. DigiStayBook brings that idea to your guests' phones, with photos and messages on a digital guest wall.\n\nReal product screenshot shown from our fictional demo property.\n\ndigistaybook.com",["wall-memory.jpg"],"split editorial with real screen")
# 2. Coast photograph with broad bottom panel.
im=Image.new("RGB",(W,H),CREAM);photo(im,"memory-coast.webp",(0,0,W,850))
ImageDraw.Draw(im).rectangle((0,760,W,H),fill=CREAM)
eyebrow(im,"A MOMENT FROM THE STAY",y=805)
text(im,(64,865),"The view is\nworth sharing.",76,serif=True)
text(im,(66,1065),"Give holiday photos a home in your digital guestbook.",29)
footer(im)
save(im,"02-view-worth-sharing","The view is worth sharing.","Some holiday photos deserve more than a place in the camera roll. Invite guests to share a favourite view, a lovely walk or a little discovery in your digital guestbook.\n\ndigistaybook.com",["memory-coast.webp"],"full-width stock photo with cream panel")
# 3. Pure typography with hand-drawn geometric symbols.
im=Image.new("RGB",(W,H),INK);eyebrow(im,"WHAT WILL YOUR GUESTS LEAVE?",color="#E6A68E")
d=ImageDraw.Draw(im)
for y,word,c in [(215,"Photos.",CREAM),(455,"Messages.",CREAM),(695,"Memories.", "#E6A68E")]:
    text(im,(65,y),word,112,c,serif=True)
    d.line((68,y+155,1000,y+155),fill="#596064",width=2)
text(im,(68,960),"A digital guestbook for the little things\nthat make a stay memorable.",35,CREAM,leading=1.5)
footer(im,True)
save(im,"03-photos-messages-memories","Photos. Messages. Memories.","A favourite photo. A few words about the weekend. A thank-you for the host.\n\nThe little things belong in a digital guestbook too.\n\ndigistaybook.com",[],"dark oversized typography")
# 4. Games photo in a bordered editorial card.
im=Image.new("RGB",(W,H),WHITE)
eyebrow(im,"THE STAY, AS THEY REMEMBER IT")
photo(im,"memory-games.webp",(64,150,1016,800))
text(im,(64,850),"The little\nmoments count.",83,serif=True)
text(im,(68,1060),"Leave a photo. Tell the story.",34,RUST)
footer(im)
save(im,"04-little-moments","The little moments count.","A games night, a long chat, one more round before bed. Often it's the ordinary little moments that make a holiday.\n\nGive guests somewhere to leave their photos and stories with DigiStayBook.\n\ndigistaybook.com",["memory-games.webp"],"framed photo and serif heading")
# 5. Strong terracotta workflow poster.
im=Image.new("RGB",(W,H),RUST)
eyebrow(im,"A DIGITAL GUESTBOOK",color=CREAM)
text(im,(64,145),"A few taps.\nA lovely memory.",84,CREAM,serif=True)
d=ImageDraw.Draw(im)
for n,y,label,desc in [(1,485,"Open the guestbook","From your phone browser"),(2,675,"Choose a photo","A little moment from the stay"),(3,865,"Leave a message","A few words to go with it")]:
    d.ellipse((68,y,170,y+102),fill=CREAM)
    text(im,(101,y+15),str(n),46,RUST,True)
    text(im,(210,y+2),label,44,CREAM,True)
    text(im,(212,y+71),desc,28,CREAM)
footer(im,True)
save(im,"05-few-taps","A few taps. A lovely memory.","Your digital guestbook is ready for little contributions: a photo, a message, a memory from the stay. Guests can open it in their phone browser, without downloading an app.\n\ndigistaybook.com",[],"numbered terracotta workflow poster")
# 6. Offset garden photograph and side label.
im=Image.new("RGB",(W,H),SAGE)
d=ImageDraw.Draw(im);d.rectangle((0,0,320,H),fill=CREAM)
photo(im,"memory-garden.webp",(270,70,1016,845))
d.rectangle((64,690,940,1105),fill=CREAM)
eyebrow(im,"ONE STAY AT A TIME",x=98,y=725)
text(im,(94,790),"Let every stay\nadd to the story.",76,serif=True)
text(im,(98,1000),"A digital guestbook that grows with your place.",28)
footer(im,True)
save(im,"06-add-to-story","Let every stay add to the story.","Your place means something different to every guest. Let those little stories build over time through photos and messages in your DigiStayBook digital guestbook.\n\ndigistaybook.com",["memory-garden.webp"],"sage offset photograph with overlap")
# 7. Sunset photograph with solid dark panel; text never obscured.
im=Image.new("RGB",(W,H),INK);photo(im,"memory-tide.webp",(0,0,W,680))
d=ImageDraw.Draw(im);d.rectangle((0,630,W,H),fill=INK)
eyebrow(im,"WHEN THE HOLIDAY ENDS",y=685,color="#E6A68E")
text(im,(64,750),"Gone home.\nStill remembered.",80,CREAM,serif=True)
text(im,(68,980),"Keep a little piece of each stay\nin your digital guestbook.",34,CREAM,leading=1.45)
footer(im,True)
save(im,"07-still-remembered","Gone home. Still remembered.","The bags are packed and the keys are back. A photo and a few kind words can leave a little piece of the stay behind.\n\nMake room for those memories with a DigiStayBook digital guestbook.\n\ndigistaybook.com",["memory-tide.webp"],"sunset photograph and dark panel")
# 8. Two authentic product screens.
im=Image.new("RGB",(W,H),CREAM)
eyebrow(im,"YOUR DIGITAL GUESTBOOK")
text(im,(64,120),"Your place. Their stories.",67,serif=True)
text(im,(68,225),"A guest wall for photos, notes and holiday memories.",29)
phone(im,"wall-top.jpg",105,340,393,780)
phone(im,"wall-memory.jpg",580,400,393,780)
text(im,(120,1140),"REAL PRODUCT · DEMO",20,INK,True)
footer(im)
save(im,"08-their-stories","Your place. Their stories.","Show guests the story of your place and invite them to add their own little memory. DigiStayBook brings guest photos and messages together on a digital wall.\n\nReal product screenshots shown from our fictional demo property.\n\ndigistaybook.com",["wall-top.jpg","wall-memory.jpg"],"paired real product screens")
# 9. Photo mosaic with contrasting stacked blocks.
im=Image.new("RGB",(W,H),CREAM)
photo(im,"memory-window.webp",(0,0,520,570))
photo(im,"memory-table.webp",(540,0,W,570))
photo(im,"memory-fire.webp",(540,590,W,1130))
d=ImageDraw.Draw(im);d.rectangle((0,590,520,1130),fill=RUST)
text(im,(50,660),"More than\na place\nto stay.",66,CREAM,serif=True,leading=1.25)
text(im,(52,970),"A place for\nmemories.",33,CREAM,leading=1.4)
footer(im)
save(im,"09-place-for-memories","More than a place to stay.","The light through a window. Dinner around the table. A quiet evening by the fire.\n\nDigiStayBook gives guests a place to share the moments that made your rental feel special.\n\ndigistaybook.com",["memory-window.webp","memory-table.webp","memory-fire.webp"],"three-photo mosaic and colour block")
# 10. Conversation-starter question with a round photographic window.
im=Image.new("RGB",(W,H),CREAM)
eyebrow(im,"A LITTLE QUESTION FOR YOUR GUESTS")
text(im,(64,145),"What was your\nfavourite\nmoment?",89,serif=True,leading=1.12)
pic=fitphoto("memory-evening.webp",(565,565));mask=Image.new("L",pic.size)
ImageDraw.Draw(mask).ellipse((0,0,564,564),fill=255);im.paste(pic,(450,580),mask)
text(im,(66,660),"A photo.\nA few words.\nA memory\nto leave behind.",38,RUST,leading=1.6)
footer(im)
save(im,"10-favourite-moment","What was your favourite moment?","Try this little invitation at checkout: What was your favourite moment from your stay?\n\nA simple question can start a lovely digital guestbook entry.\n\ndigistaybook.com",["memory-evening.webp"],"editorial question and circular stock photograph")
# Explicit source ledger; no prior generated marketing images are used.
credits=(ROOT/"docs/demo-photo-credits.md").read_text(encoding="utf-8")
(HERE/"photo-credits.md").write_text(credits,encoding="utf-8")
manifest={"created":"2026-10-17","method":"Original layouts rendered with Pillow from text, shapes, existing logo, licensed Unsplash photographs and real product screenshots. No generative image model used.","brand":"Authentic logo; Stay is terracotta, Digi and Book charcoal.","photos":"Existing public/wall files; individual source URLs in photo-credits.md","screenshots":"Existing actual demo screenshots in artifacts/social/prelaunch-week-2026-10-16/source; fictional property, labelled DEMO on artwork.","prior_generated_images_used":False,"provenance_removal_performed":False,"facebook_label_guarantee":False,"posts":posts}
(HERE/"source-manifest.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding="utf-8")
(HERE/"posts.json").write_text(json.dumps(posts,indent=2,ensure_ascii=False),encoding="utf-8")
cards=[]
for n,p in enumerate(posts,1):
    cards.append(f'<article><a href="{p["image"]}" target="_blank"><img src="{p["image"]}" alt="{html.escape(p["title"])}"></a><div><small>POST {n:02}</small><h2>{html.escape(p["title"])}</h2><p>{html.escape(p["caption"]).replace(chr(10),"<br>")}</p><a download href="{p["image"]}">Download PNG</a></div></article>')
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DigiStayBook — ten new image posts</title><style>*{box-sizing:border-box}body{background:#f7f2e8;color:#14181b;margin:0;font:16px/1.55 system-ui}header{max-width:1000px;padding:40px}h1{font-size:42px;line-height:1.1}em{color:#b4472a;font-style:normal}.grid{padding:0 32px 40px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}article{background:#fffdf8;border-radius:16px;overflow:hidden;border:1px solid #ddd5c9}article img{display:block;width:100%;height:auto}article>div{padding:24px}small,a{color:#a54229}h2{font-size:23px}p{white-space:normal}</style><header><p>PREVIEW ONLY · 17 OCTOBER 2026</p><h1>Digi<em>Stay</em>Book<br>Ten new image posts</h1><p>Original graphic layouts, licensed stock photographs and real product screenshots. No generative image tools or previous generated marketing images were used. Facebook controls its own labels, so no label-free guarantee is made.</p><p><a href="posts.json" download>Captions</a> · <a href="photo-credits.md">Photo credits</a> · <a href="source-manifest.json">Source ledger</a></p></header><main class="grid">'''+''.join(cards)+'</main></html>'
(HERE/"gallery.html").write_text(page,encoding="utf-8")
# Contact sheet for visual review. It is an overview, not a posting asset.
sheet=Image.new("RGB",(1800,1070),"#E5DFD4")
for i,p in enumerate(posts):
    img=Image.open(HERE/p["image"]);img.thumbnail((340,425),Image.Resampling.LANCZOS)
    x=20+(i%5)*356;y=20+(i//5)*525
    sheet.paste(img,(x,y));ImageDraw.Draw(sheet).text((x,y+440),str(i+1).zfill(2)+"  "+p["title"][:27],font=font(19),fill=INK)
sheet.save(HERE/"contact-sheet.jpg",quality=93)
with zipfile.ZipFile(HERE/"digistaybook-10-new-posts.zip","w",zipfile.ZIP_DEFLATED) as z:
    for p in OUT.glob("*.png"):z.write(p,p.relative_to(HERE))
    for name in ["posts.json","source-manifest.json","photo-credits.md","gallery.html"]:z.write(HERE/name,name)
print(json.dumps({"images":len(posts),"folder":str(HERE),"contact_sheet":str(HERE/"contact-sheet.jpg")}))

