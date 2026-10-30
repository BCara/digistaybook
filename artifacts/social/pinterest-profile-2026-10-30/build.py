from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
cream = '#F7F2E8'
ink = '#14181B'
rust = '#B4472A'

# Existing approved brand mark, inset to survive Pinterest's circular crop.
icon = Image.open(ROOT / 'artifacts/brand/digistaybook-logo-512.png').convert('RGB')
profile = Image.new('RGB', (800, 800), cream)
profile.paste(icon.resize((560, 560), Image.Resampling.LANCZOS), (120, 120))
profile.save(OUT / 'profile-logo.png')

# Typeset artwork only: actual logo, shapes and text. No generated photography.
cover = Image.new('RGB', (1600, 900), cream)
d = ImageDraw.Draw(cover)
d.rectangle((80, 80, 1520, 820), outline='#DBCFBF', width=2)
d.line((700, 346, 900, 346), fill=rust, width=4)
logo = Image.open(ROOT / 'src/assets/logo-long.png').convert('RGBA')
logo.thumbnail((770, 185), Image.Resampling.LANCZOS)
cover.paste(logo, ((1600-logo.width)//2, 130), logo)

def text(y, value, size, color=ink, serif=False):
    font = ImageFont.truetype('C:/Windows/Fonts/georgia.ttf' if serif else 'C:/Windows/Fonts/arial.ttf', size)
    d.text((800, y), value, font=font, anchor='mt', fill=color)

text(402, 'A warm welcome.', 76, serif=True)
text(501, 'A story worth keeping.', 76, rust, serif=True)
text(649, 'House guidance. Local favorites. Guest memories.', 32)
text(720, 'digistaybook.com', 29, rust)
cover.save(OUT / 'profile-cover.png')
print(OUT)
