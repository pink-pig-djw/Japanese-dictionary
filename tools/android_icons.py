#!/usr/bin/env python3
"""Generate the Android app icons and splash screens from the mascot artwork.

    python3 tools/android_icons.py

Reads assets/mascot/idle.webp (first frame) and writes into
android/app/src/main/res/: legacy and round launcher icons, adaptive-icon
foregrounds, and portrait/landscape splash images.  Needs Pillow.
"""
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
SRC = os.path.join(ROOT, "assets", "mascot", "idle.webp")
FACE_BOX = (0.10, 0.0, 0.90, 0.80)          # same crop as tools/mascot.py
PINK, PEACH = (255, 111, 159), (255, 164, 92)
SPLASH_BG_TOP, SPLASH_BG_BOTTOM = (255, 228, 238), (226, 242, 255)
DENSITY = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def gradient(size, a, b, diagonal=True):
    w, h = size
    g = Image.new("RGB", (w, h))
    px = g.load()
    for y in range(h):
        for x in range(w):
            t = ((x / max(w - 1, 1)) + (y / max(h - 1, 1))) / 2 if diagonal else y / max(h - 1, 1)
            px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return g


def face():
    im = Image.open(SRC)
    im.seek(0)
    im = im.convert("RGBA")
    s = im.width
    l, t, r, b = FACE_BOX
    return im.crop((int(l * s), int(t * s), int(r * s), int(b * s)))


def sparkle(draw, cx, cy, r, fill):
    pts = []
    for i in range(8):
        rr = r if i % 2 == 0 else r * 0.28
        import math
        a = math.pi / 4 * i - math.pi / 2
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    draw.polygon(pts, fill=fill)


def icon_square(size, art, round_mask):
    big = size * 4
    bg = gradient((big, big), PINK, PEACH).convert("RGBA")
    d = ImageDraw.Draw(bg)
    sparkle(d, big * 0.2, big * 0.22, big * 0.07, (255, 255, 255, 200))
    sparkle(d, big * 0.83, big * 0.3, big * 0.045, (255, 255, 255, 170))
    a = art.resize((int(big * 0.9), int(big * 0.9)), Image.LANCZOS)
    bg.alpha_composite(a, ((big - a.width) // 2, big - a.height + int(big * 0.04)))
    mask = Image.new("L", (big, big), 0)
    md = ImageDraw.Draw(mask)
    if round_mask:
        md.ellipse((0, 0, big - 1, big - 1), fill=255)
    else:
        md.rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * 0.22), fill=255)
    bg.putalpha(mask)
    return bg.resize((size, size), Image.LANCZOS)


def foreground(size, art):
    # adaptive icons: 108dp canvas, only the centre 66dp is guaranteed visible
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    a = art.resize((int(size * 0.66), int(size * 0.66)), Image.LANCZOS)
    out.alpha_composite(a, ((size - a.width) // 2, (size - a.height) // 2 + int(size * 0.02)))
    return out


def splash(w, h, art):
    bg = gradient((w, h), SPLASH_BG_TOP, SPLASH_BG_BOTTOM, diagonal=False).convert("RGBA")
    d = ImageDraw.Draw(bg)
    m = min(w, h)
    for fx, fy, fr in ((0.18, 0.2, 0.035), (0.82, 0.16, 0.022), (0.75, 0.72, 0.03), (0.22, 0.8, 0.02)):
        sparkle(d, w * fx, h * fy, m * fr, (255, 255, 255, 230))
    disc = int(m * 0.5)
    # blur only the alpha, so the glow stays white instead of picking up grey edges
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse(((w - disc) // 2, (h - disc) // 2, (w + disc) // 2, (h + disc) // 2), fill=190)
    glow = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    glow.putalpha(mask.filter(ImageFilter.GaussianBlur(m * 0.05)))
    bg.alpha_composite(glow)
    a = art.resize((int(m * 0.42), int(m * 0.42)), Image.LANCZOS)
    # the bust is cut straight at the shoulders: fade the bottom edge out
    fade = Image.linear_gradient("L").resize(a.size)
    fade = fade.point(lambda v: 255 if v < 170 else max(0, 255 - (v - 170) * 3))
    alpha = Image.composite(a.getchannel("A"), Image.new("L", a.size, 0), fade)
    a.putalpha(alpha)
    bg.alpha_composite(a, ((w - a.width) // 2, (h - a.height) // 2))
    return bg.convert("RGB")


def main():
    art = face()
    for name, k in DENSITY.items():
        d = os.path.join(RES, "mipmap-" + name)
        icon_square(round(48 * k), art, False).save(os.path.join(d, "ic_launcher.png"))
        icon_square(round(48 * k), art, True).save(os.path.join(d, "ic_launcher_round.png"))
        foreground(round(108 * k), art).save(os.path.join(d, "ic_launcher_foreground.png"))
    for folder in os.listdir(RES):
        p = os.path.join(RES, folder, "splash.png")
        if os.path.exists(p):
            w, h = Image.open(p).size
            splash(w, h, art).save(p, optimize=True)
    print("icons and splash screens written to", RES)


if __name__ == "__main__":
    main()
