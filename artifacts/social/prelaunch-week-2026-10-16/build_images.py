"""Builds the 1080x1350 feed images for the prelaunch week from content.json.

Only the real logo, real product screenshots and plain text/shapes are used.
Run: python build_images.py  (from this folder)
"""
import json
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
W, H = 1080, 1350
CREAM = (254, 250, 241)
INK = (30, 37, 42)
RUST = (186, 78, 46)
MUTED = (96, 88, 80)
LINE = (226, 214, 196)
FONTS = "C:/Windows/Fonts/"


def font(name, size):
    return ImageFont.truetype(FONTS + name, size)


SERIF_B = lambda s: font("georgiab.ttf", s)
SANS = lambda s: font("segoeui.ttf", s)
SANS_B = lambda s: font("segoeuib.ttf", s)


def spaced(d, xy, text, f, fill, spacing=3):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + spacing


def wrap(d, text, f, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= width:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def base():
    im = Image.new("RGB", (W, H), CREAM)
    logo = Image.open(os.path.join(ROOT, "src/assets/logo-long.png")).convert("RGBA")
    lw = 300
    logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    im.paste(logo, (80, 70), logo)
    return im, ImageDraw.Draw(im)


def header(d, c, y=210):
    spaced(d, (80, y), c["eyebrow"], SANS_B(26), RUST, 4)
    y += 56
    for line in c["headline"]:
        d.text((80, y), line, font=SERIF_B(76), fill=INK)
        y += 92
    return y


def phone(im, shot, crop, box_top, pw=600):
    src = Image.open(shot).convert("RGB").crop(crop)
    inner_w = pw - 36
    src = src.resize((inner_w, int(src.height * inner_w / src.width)), Image.LANCZOS)
    ph = min(H - box_top + 80, src.height + 36)  # runs off the bottom edge when long enough
    x = (W - pw) // 2
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([x + 6, box_top + 18, x + pw + 6, box_top + ph + 18], 64, fill=(60, 40, 20, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    im.paste(shadow, (0, 0), shadow)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([x, box_top, x + pw, box_top + ph], 64, fill=(24, 26, 28))
    screen = Image.new("RGB", (inner_w, ph - 36), (255, 255, 255))
    screen.paste(src, (0, 0))
    mask = Image.new("L", screen.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, screen.width, screen.height], 48, fill=255)
    im.paste(screen, (x + 18, box_top + 18), mask)


def build_phone(c, out):
    im, d = base()
    y = header(d, c)
    d.text((80, y + 6), c["body"], font=SANS(34), fill=MUTED)
    phone(im, os.path.join(HERE, "source", c["screenshot"]), c["crop"], y + 90, c.get("phoneWidth", 600))
    im.save(out, quality=92)


def build_card(c, out):
    im, d = base()
    y = header(d, c, 300)
    d.rounded_rectangle([80, y + 24, 180, y + 30], 3, fill=RUST)
    y += 70
    for line in wrap(d, c["body"], SANS(40), W - 160):
        d.text((80, y), line, font=SANS(40), fill=MUTED)
        y += 58
    y += 40
    for t in c["ticks"]:
        d.ellipse([80, y + 6, 124, y + 50], fill=RUST)
        d.line([(91, y + 29), (99, y + 37), (114, y + 19)], fill=CREAM, width=5, joint="curve")
        d.text((150, y), t, font=SANS(40), fill=INK)
        y += 78
    for b in c.get("bubbles", []):
        f = SANS(40)
        bw = d.textlength(b, font=f) + 70
        d.rounded_rectangle([80, y, 80 + bw, y + 84], 42, fill=(255, 255, 255), outline=LINE, width=2)
        d.polygon([(118, y + 82), (110, y + 108), (142, y + 82)], fill=(255, 255, 255))
        d.text((115, y + 16), b, font=f, fill=INK)
        y += 130
    d.line([(80, H - 120), (W - 80, H - 120)], fill=LINE, width=2)
    d.text((80, H - 96), "Launching soon  ·  Follow the Page to hear first", font=SANS(30), fill=MUTED)
    im.save(out, quality=92)


def build_qr(c, out):
    im, d = base()
    y = header(d, c)
    card = Image.open(os.path.join(HERE, "source", c["screenshot"])).convert("RGB")
    # soften the QR so the demo code isn't scannable from a post
    qr = (90, 116, 250, 276)
    card.paste(card.crop(qr).filter(ImageFilter.GaussianBlur(3)), qr[:2])
    cw = 400
    card = card.resize((cw, int(card.height * cw / card.width)), Image.LANCZOS)
    cx, cy = W - cw - 80, y + 60
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle([cx + 8, cy + 16, cx + cw + 8, cy + card.height + 16], fill=(60, 40, 20, 80))
    shadow = shadow.filter(ImageFilter.GaussianBlur(20))
    im.paste(shadow, (0, 0), shadow)
    im.paste(card, (cx, cy))
    d = ImageDraw.Draw(im)
    sy = y + 80
    for i, s in enumerate(c["steps"], 1):
        d.ellipse([80, sy, 150, sy + 70], fill=RUST)
        n = str(i)
        d.text((115 - d.textlength(n, font=SERIF_B(40)) / 2, sy + 9), n, font=SERIF_B(40), fill=CREAM)
        ty = sy + 4
        for line in wrap(d, s, SANS(36), cx - 190):
            d.text((172, ty), line, font=SANS(36), fill=INK)
            ty += 48
        sy = max(ty, sy + 70) + 50
    d.text((80, H - 96), "Demo property shown. Launching soon.", font=SANS(30), fill=MUTED)
    im.save(out, quality=92)


def main():
    data = json.load(open(os.path.join(HERE, "content.json"), encoding="utf-8"))
    os.makedirs(os.path.join(HERE, "images"), exist_ok=True)
    for p in data["posts"]:
        c = p["image"]
        out = os.path.join(HERE, "images", f"{p['id']}-{p['day'].split()[0].lower()}.jpg")
        {"phone": build_phone, "card": build_card, "qr": build_qr}[c["type"]](c, out)
        print(out)


if __name__ == "__main__":
    main()
