"""Draws the GTG Vibral app icons (a balanced rotor with an amber weight) into assets/images."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

NAVY = (15, 31, 51, 255)
STEEL = (61, 101, 148, 255)
AMBER = (255, 176, 32, 255)
WHITE = (255, 255, 255, 255)
OUT = Path(__file__).resolve().parent.parent / "assets" / "images"


def rotor(size: int, fg=WHITE, accent=AMBER, bg=None, scale=0.62) -> Image.Image:
    img = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size / 2
    r = size * scale / 2
    w = max(2, int(size * 0.045))
    d.ellipse([c - r, c - r, c + r, c + r], outline=fg, width=w)
    for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
        d.line([c + dx * r * 0.25, c + dy * r * 0.25, c + dx * r * 0.82, c + dy * r * 0.82], fill=fg, width=w)
    hub = r * 0.18
    d.ellipse([c - hub, c - hub, c + hub, c + hub], fill=fg)
    k = r * 0.17
    px, py = c + r * 0.7, c - r * 0.7
    d.ellipse([px - k, py - k, px + k, py + k], fill=accent)
    return img


OUT.mkdir(parents=True, exist_ok=True)
rotor(1024, bg=NAVY).save(OUT / "icon.png")
rotor(1024, scale=0.5).save(OUT / "android-icon-foreground.png")
rotor(1024, fg=WHITE, accent=WHITE, scale=0.5).save(OUT / "android-icon-monochrome.png")
rotor(512, scale=0.8).save(OUT / "splash-icon.png")
rotor(64, bg=NAVY, scale=0.8).save(OUT / "favicon.png")
print("icons written to", OUT)
