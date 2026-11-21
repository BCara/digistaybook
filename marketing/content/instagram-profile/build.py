"""Instagram profile artwork for @digistaybook.

Run from anywhere: python marketing/content/instagram-profile/build.py
Uses only the real logo (public/logo.jpg), flat shapes and text. No generated photography.
"""
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
cream = (254, 252, 240)  # the logo's own background, so there is no visible square
ink = (20, 24, 27)
rust = (180, 71, 42)
line = (219, 207, 191)
georgia = 'C:/Windows/Fonts/georgia.ttf'
arial = 'C:/Windows/Fonts/arial.ttf'


def logo_mark():
    """The logo cropped to the mark, with an alpha mask so it sits on any background."""
    logo = Image.open(ROOT / 'public/logo.jpg').convert('RGB')
    diff = ImageChops.difference(logo, Image.new('RGB', logo.size, cream)).convert('L')
    mask = diff.point(lambda v: 0 if v < 12 else min(255, (v - 12) * 4))
    box = mask.getbbox()
    mark = logo.crop(box)
    mark.putalpha(mask.crop(box))
    return mark


def profile_photo(size=1080):
    """Inset so the whole mark survives Instagram's circle crop."""
    mark = logo_mark()
    canvas = Image.new('RGB', (size, size), cream)
    # The mark's corners must sit inside the circle: keep its half-diagonal within ~84% of the radius.
    half_diag = ((mark.width ** 2 + mark.height ** 2) ** 0.5) / 2
    scale = (size / 2) * 0.84 / half_diag
    mark = mark.resize((round(mark.width * scale), round(mark.height * scale)), Image.Resampling.LANCZOS)
    # Nudge down slightly: the roof's peak is visually heavier than the book's base.
    canvas.paste(mark, ((size - mark.width) // 2, (size - mark.height) // 2 + 10), mark)
    return canvas


def highlight_cover(draw_glyph):
    """1080 x 1920 story-sized cover; Instagram shows only the centre circle."""
    img = Image.new('RGB', (1080, 1920), cream)
    d = ImageDraw.Draw(img)
    d.ellipse((240, 660, 840, 1260), fill=rust)
    draw_glyph(d, 540, 960)
    return img


def glyph_demo(d, cx, cy):  # a phone
    d.rounded_rectangle((cx - 105, cy - 190, cx + 105, cy + 190), radius=34, outline=cream, width=22)
    d.rounded_rectangle((cx - 35, cy - 160, cx + 35, cy - 145), radius=8, fill=cream)
    d.ellipse((cx - 16, cy + 132, cx + 16, cy + 164), fill=cream)


def glyph_guestbook(d, cx, cy):  # an open book with writing
    w = 22
    d.line((cx, cy - 120, cx, cy + 130), fill=cream, width=w)
    d.line((cx - 200, cy - 130, cx, cy - 110), fill=cream, width=w)
    d.line((cx + 200, cy - 130, cx, cy - 110), fill=cream, width=w)
    d.line((cx - 200, cy - 130, cx - 200, cy + 110), fill=cream, width=w)
    d.line((cx + 200, cy - 130, cx + 200, cy + 110), fill=cream, width=w)
    d.line((cx - 200, cy + 110, cx, cy + 130), fill=cream, width=w)
    d.line((cx + 200, cy + 110, cx, cy + 130), fill=cream, width=w)
    for i, y in enumerate((cy - 55, cy, cy + 55)):
        d.line((cx - 150, y, cx - 50, y + 8), fill=cream, width=14)
        d.line((cx + 50, y + 8, cx + 150 - i * 30, y), fill=cream, width=14)


def glyph_qr(d, cx, cy):  # QR finder squares and a few modules
    s = 70
    for ox, oy in ((-1, -1), (1, -1), (-1, 1)):
        x, y = cx + ox * 110, cy + oy * 110
        d.rectangle((x - s, y - s, x + s, y + s), outline=cream, width=22)
        d.rectangle((x - 26, y - 26, x + 26, y + 26), fill=cream)
    for x, y in ((80, 80), (150, 80), (80, 150), (150, 150), (115, 115)):
        d.rectangle((cx + x - 22, cy + y - 22, cx + x + 22, cy + y + 22), fill=cream)


def glyph_setup(d, cx, cy):  # a tick
    d.line((cx - 150, cy + 10, cx - 45, cy + 115, cx + 160, cy - 110), fill=cream, width=40, joint='curve')


def preview(photo):
    """How the profile header reads on a phone: circle crop at real size, name, bio, links, highlights."""
    W, H = 1080, 1320
    img = Image.new('RGB', (W, H), (255, 255, 255))
    d = ImageDraw.Draw(img)
    f = lambda size, bold=False: ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf' if bold else arial, size)

    def circle(src, box):
        size = box[2] - box[0]
        tile = src.resize((size, size), Image.Resampling.LANCZOS)
        m = Image.new('L', (size, size), 0)
        ImageDraw.Draw(m).ellipse((0, 0, size - 1, size - 1), fill=255)
        img.paste(tile, box[:2], m)

    d.text((48, 40), 'digistaybook', font=f(44, True), fill='black')
    circle(photo, (48, 130, 288, 370))
    d.ellipse((47, 129, 289, 371), outline=(219, 219, 219), width=2)
    for i, (n, label) in enumerate((('0', 'posts'), ('0', 'followers'), ('0', 'following'))):
        x = 420 + i * 220
        d.text((x, 205), n, font=f(40, True), fill='black', anchor='mm')
        d.text((x, 255), label, font=f(32), fill='black', anchor='mm')
    y = 410
    d.text((48, y), NAME, font=f(34, True), fill='black'); y += 50
    d.text((48, y), CATEGORY, font=f(32), fill=(115, 115, 115)); y += 50
    for row in (r for para in BIO.split('\n') for r in textwrap.wrap(para, 52)):
        d.text((48, y), row, font=f(32), fill='black'); y += 46
    d.text((48, y + 4), '🔗', font=ImageFont.truetype('C:/Windows/Fonts/seguiemj.ttf', 30), embedded_color=True)
    d.text((96, y + 4), f'{LINKS[0][1]} and 1 more', font=f(32, True), fill=(0, 55, 107)); y += 120
    for i, (label, glyph) in enumerate(HIGHLIGHTS):
        x = 48 + i * 250
        cover = highlight_cover(glyph).crop((240, 660, 840, 1260))
        d.ellipse((x - 6, y - 6, x + 166, y + 166), outline=(219, 219, 219), width=3)
        circle(cover, (x, y, x + 160, y + 160))
        d.text((x + 80, y + 200), label, font=f(28), fill='black', anchor='mm')
    # Smallest place the avatar appears: feed and comments (about 32 px on a phone, shown at 3x).
    y += 290
    d.text((48, y), 'At feed size:', font=f(28), fill=(115, 115, 115))
    circle(photo, (260, y - 18, 356, y + 78))
    return img


NAME = 'DigiStayBook | Vacation Rental Guestbook'
CATEGORY = 'Software'
BIO = ('Make your vacation rental feel like home.\n'
       'One QR code: house guide, local tips and a guestbook that grows every stay.\n'
       'No guest app. Try the demo ↓')
LINKS = [('Try the demo', 'digistaybook.com/i/demo'), ('28-day free trial', 'digistaybook.com/i/trial')]
HIGHLIGHTS = [('Demo', glyph_demo), ('Guestbook', glyph_guestbook), ('QR signs', glyph_qr), ('Setup', glyph_setup)]

if __name__ == '__main__':
    assert len(NAME) <= 64 and len(BIO) <= 150, (len(NAME), len(BIO))
    photo = profile_photo()
    photo.save(OUT / 'profile-photo-1080.png')
    photo.convert('RGB').save(OUT / 'profile-photo-1080.jpg', quality=95)
    for label, glyph in HIGHLIGHTS:
        highlight_cover(glyph).save(OUT / f'highlight-{label.lower().replace(" ", "-")}.png')
    preview(photo).save(OUT / 'preview-profile.png')
    print(f'name {len(NAME)}/64, bio {len(BIO)}/150 -> {OUT}')
