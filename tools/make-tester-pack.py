"""Build the file pack the external tester uses for the guest photo checks.

The testing checklist (docs/handbook/DIGISTAYBOOK_TEST_PROCEDURES.html,
TP-GUEST-03) refers to these files by name, so the names here are part of that
document. The pack is sent to the tester alongside the sign-in details and is
not committed.

    python tools/make-tester-pack.py      ->  artifacts/tester-pack.zip
"""
import io
import os
import random
import zipfile

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "artifacts", "tester-pack.zip")

# Upload limits the guest form enforces today (plan deviation D-02): JPEG, PNG
# or WebP, at most 5 MB each, no animation.
TOO_BIG_BYTES = 6 * 1024 * 1024


def font(size):
    for name in ("arialbd.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def numbered_photo(n):
    hue = (n * 37) % 360
    img = Image.new("RGB", (1200, 900), f"hsl({hue}, 45%, 62%)")
    draw = ImageDraw.Draw(img)
    draw.text((600, 400), f"Test photo {n:02d}", fill="white", font=font(110), anchor="mm")
    draw.text((600, 540), "DigiStayBook tester pack", fill="white", font=font(44), anchor="mm")
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return buf.getvalue()


def too_big_photo():
    # Random noise does not compress, so a modest canvas clears the limit.
    rng = random.Random(7)
    side = 1800
    img = Image.frombytes("RGB", (side, side), bytes(rng.getrandbits(8) for _ in range(side * side * 3)))
    ImageDraw.Draw(img).text((side // 2, side // 2), "Too big (over 5 MB)", fill="white", font=font(110), anchor="mm")
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=100)
    data = buf.getvalue()
    assert len(data) > TOO_BIG_BYTES, len(data)
    return data


def animated_gif():
    frames = []
    for i, colour in enumerate(("#b4472a", "#33604c", "#2b5378")):
        frame = Image.new("RGB", (400, 300), colour)
        ImageDraw.Draw(frame).text((200, 150), f"Frame {i + 1}", fill="white", font=font(48), anchor="mm")
        frames.append(frame)
    buf = io.BytesIO()
    frames[0].save(buf, "GIF", save_all=True, append_images=frames[1:], duration=400, loop=0)
    return buf.getvalue()


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_STORED) as z:
        for n in range(1, 12):
            z.writestr(f"tester-pack/photo-{n:02d}.jpg", numbered_photo(n))
        z.writestr("tester-pack/too-big.jpg", too_big_photo())
        z.writestr("tester-pack/not-a-photo.jpg", b"This is a text file with a .jpg name. The upload should refuse it.\n")
        z.writestr("tester-pack/animated.gif", animated_gif())
    print(f"Wrote {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
