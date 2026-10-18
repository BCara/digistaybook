from pathlib import Path
import json,zipfile,html
p=Path(__file__).resolve().parent
log=json.loads((p/"publication-log.json").read_text(encoding="utf-8"))
assert len(log)==10 and len({x["facebookPostId"] for x in log})==10
assert all(x.get("publicCaptionVerified") and x.get("aiLabelVisibleOnCheckedView") is False for x in log)
byid={x["id"]:x for x in log}
posts=json.loads((p/"posts.json").read_text(encoding="utf-8"))
for row in posts:
    row["status"]="published"
    row["facebook_url"]=byid[row["id"]]["url"]
(p/"posts.json").write_text(json.dumps(posts,indent=2,ensure_ascii=False),encoding="utf-8")
manifest=json.loads((p/"source-manifest.json").read_text(encoding="utf-8"))
manifest["posts"]=posts
manifest["publication_status"]="All 10 published and checked on Facebook."
manifest["ai_label_observation"]="No AI-content label visible on any of the 10 checked post views. This is an observation at checking time, not a guarantee about future platform labelling."
(p/"source-manifest.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding="utf-8")
page=(p/"gallery.html").read_text(encoding="utf-8").replace("PREVIEW ONLY · 17 OCTOBER 2026","PUBLISHED · 17 OCTOBER 2026")
for row in posts:
    marker='<a download href="'+row["image"]+'">Download PNG</a>'
    page=page.replace(marker,marker+' · <a href="'+html.escape(row["facebook_url"])+'" target="_blank">View published post</a>')
(p/"gallery.html").write_text(page,encoding="utf-8")
with zipfile.ZipFile(p/"digistaybook-10-new-posts.zip","w",zipfile.ZIP_DEFLATED) as z:
    for f in (p/"images").glob("*.png"):z.write(f,f.relative_to(p))
    for name in ["posts.json","source-manifest.json","photo-credits.md","gallery.html","publication-log.json"]:z.write(p/name,name)
print("Verified 10 unique published posts; all public captions checked; no AI labels visible on checked post views.")

