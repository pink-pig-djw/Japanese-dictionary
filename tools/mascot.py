#!/usr/bin/env python3
"""Install a mascot picture for one mood.

    python3 tools/mascot.py SOURCE_IMAGE MOOD [MOOD ...]

MOOD is one of: idle happy think sorry sleep.  The source should be a square
bust shot with a transparent background (a plain white background is removed
automatically).  Writes two files per mood into assets/mascot/:

    MOOD.webp        the whole picture, 640px  (home banner, empty states)
    MOOD-face.webp   head and ears only, 192px (the small companion in the top bar)

Then list the mood in IMAGES at the top of js/mascot.js.
Needs Pillow:  pip install pillow
"""
import os
import sys
from collections import deque

from PIL import Image, ImageFilter

MOODS = ("idle", "happy", "think", "sorry", "sleep")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "mascot")
# Head-and-ears crop as fractions of the picture: (left, top, right, bottom).
# Tuned for a centred bust shot whose ears reach the top edge.
FACE_BOX = (0.10, 0.0, 0.90, 0.80)


def remove_white_background(im):
    """Make the white area connected to the picture's edge transparent."""
    w, h = im.size
    px = im.load()
    is_bg = lambda p: p[0] > 244 and p[1] > 244 and p[2] > 244
    seen = bytearray(w * h)
    queue = deque()
    for x in range(w):
        queue.extend(((x, 0), (x, h - 1)))
    for y in range(h):
        queue.extend(((0, y), (w - 1, y)))
    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x] or not is_bg(px[x, y]):
            continue
        seen[y * w + x] = 1
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    mask = Image.frombytes("L", (w, h), bytes(255 if not s else 0 for s in seen))
    mask = mask.filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: 0 if v < 128 else min(255, (v - 128) * 2))
    im.putalpha(mask)
    return im


def main():
    if len(sys.argv) < 3 or any(m not in MOODS for m in sys.argv[2:]):
        sys.exit(__doc__)
    im = Image.open(sys.argv[1]).convert("RGBA")
    if im.getextrema()[3][0] == 255:        # fully opaque: assume a white backdrop
        im = remove_white_background(im)
    w, h = im.size
    side = min(w, h)
    im = im.crop(((w - side) // 2, 0, (w - side) // 2 + side, side))
    l, t, r, b = FACE_BOX
    face = im.crop((int(l * side), int(t * side), int(r * side), int(b * side)))
    os.makedirs(OUT, exist_ok=True)
    for mood in sys.argv[2:]:
        im.resize((640, 640), Image.LANCZOS).save(os.path.join(OUT, mood + ".webp"), quality=88, method=6)
        face.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, mood + "-face.webp"), quality=88, method=6)
        print("wrote", mood + ".webp and", mood + "-face.webp")


if __name__ == "__main__":
    main()
