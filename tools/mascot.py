#!/usr/bin/env python3
"""Install mascot artwork for one mood - a still picture or an animation.

    python3 tools/mascot.py SOURCE MOOD [--frames N] [--rows R] [--fps F | --durations MS,MS,...]

MOOD     idle | happy | think | sorry | sleep
SOURCE   a still picture (png / webp / jpg), or
         an animation (gif / apng / animated webp), or
         a sprite sheet (png) - then also pass --frames N (and --rows R if it
         has more than one row; frames are read left to right, top to bottom).
--fps    playback speed for a sprite sheet (default 12).
--durations   how long each frame stays on screen, in milliseconds, one number
         per frame (overrides --fps; lets a few frames make a long, calm loop).

The picture must be a square bust shot, framed like assets/mascot/idle.webp:
head centred, ears touching the top edge, shoulders at the bottom.  A plain
white background is removed automatically; a transparent one is kept.

Writes into assets/mascot/:
    MOOD.webp        whole picture   (home banner, empty states)
    MOOD-face.webp   head and ears   (small companion in the top bar)
and records the mood in IMAGES at the top of js/mascot.js as 'still' or
'animated'.  Still pictures get the built-in breathing/blinking animation
(js/live.js); animated ones play as they are.

Needs Pillow:  pip install pillow
"""
import argparse
import os
import re
from collections import deque

from PIL import Image, ImageFilter

MOODS = ("idle", "happy", "think", "sorry", "sleep")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "mascot")
MASCOT_JS = os.path.join(ROOT, "js", "mascot.js")
# Head-and-ears crop as fractions of the picture: (left, top, right, bottom).
# js/mascot.js (FACE_BOX) must use the same numbers.
FACE_BOX = (0.10, 0.0, 0.90, 0.80)
STILL_SIZE, STILL_FACE = 640, 192
ANIM_SIZE, ANIM_FACE = 480, 160


def remove_white_background(im):
    """Make the white area connected to the picture's edge transparent."""
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    queue = deque()
    for x in range(w):
        queue.extend(((x, 0), (x, h - 1)))
    for y in range(h):
        queue.extend(((0, y), (w - 1, y)))
    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
            continue
        p = px[x, y]
        if not (p[0] > 244 and p[1] > 244 and p[2] > 244):
            continue
        seen[y * w + x] = 1
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    mask = Image.frombytes("L", (w, h), bytes(0 if s else 255 for s in seen))
    mask = mask.filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: 0 if v < 128 else min(255, (v - 128) * 2))
    im.putalpha(mask)
    return im


def prepare(frame, size):
    """Square-crop, shrink and clean one frame; returns (full, face)."""
    im = frame.convert("RGBA")
    w, h = im.size
    side = min(w, h)
    im = im.crop(((w - side) // 2, 0, (w - side) // 2 + side, side))
    work = max(size, 640)
    im = im.resize((work, work), Image.LANCZOS)
    if im.getextrema()[3][0] == 255:        # fully opaque: assume a white backdrop
        im = remove_white_background(im)
    l, t, r, b = FACE_BOX
    face = im.crop((int(l * work), int(t * work), int(r * work), int(b * work)))
    return im, face


def read_frames(args):
    """Return ([frames], [durations in ms]); a single frame means a still picture."""
    src = Image.open(args.source)
    if args.frames:
        rows = args.rows
        cols = -(-args.frames // rows)
        fw, fh = src.width // cols, src.height // rows
        frames = [src.crop(((n % cols) * fw, (n // cols) * fh, (n % cols + 1) * fw, (n // cols + 1) * fh))
                  for n in range(args.frames)]
        if args.durations:
            durations = [int(x) for x in args.durations.split(",")]
            if len(durations) != args.frames:
                raise SystemExit("--durations needs exactly %d numbers, got %d" % (args.frames, len(durations)))
            return frames, durations
        return frames, [round(1000 / args.fps)] * len(frames)
    if getattr(src, "n_frames", 1) > 1:
        frames, durations = [], []
        for n in range(src.n_frames):
            src.seek(n)
            src.load()                      # animated WebP only reports a frame's duration once it is loaded
            frames.append(src.convert("RGBA"))
            durations.append(src.info.get("duration", 83) or 83)
        return frames, durations
    return [src], [0]


def record(mood, kind):
    """Set `mood: '<kind>'` inside IMAGES in js/mascot.js."""
    with open(MASCOT_JS, encoding="utf-8") as f:
        text = f.read()
    new, n = re.subn(r"(\n\s*%s:\s*)[^,\n]+," % mood, r"\g<1>'%s'," % kind, text, count=1)
    if not n:
        raise SystemExit("could not find '%s:' in IMAGES in js/mascot.js" % mood)
    with open(MASCOT_JS, "w", encoding="utf-8") as f:
        f.write(new)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source")
    ap.add_argument("mood", choices=MOODS)
    ap.add_argument("--frames", type=int, default=0, help="number of frames in a sprite sheet")
    ap.add_argument("--rows", type=int, default=1, help="rows in the sprite sheet (default 1)")
    ap.add_argument("--fps", type=float, default=12, help="sprite sheet playback speed (default 12)")
    ap.add_argument("--durations", help="milliseconds per frame, comma separated (overrides --fps)")
    args = ap.parse_args()

    frames, durations = read_frames(args)
    animated = len(frames) > 1
    size, face_size = (ANIM_SIZE, ANIM_FACE) if animated else (STILL_SIZE, STILL_FACE)
    fulls, faces = [], []
    for f in frames:
        full, face = prepare(f, size)
        fulls.append(full.resize((size, size), Image.LANCZOS))
        faces.append(face.resize((face_size, face_size), Image.LANCZOS))

    os.makedirs(OUT, exist_ok=True)
    for images, name in ((fulls, args.mood + ".webp"), (faces, args.mood + "-face.webp")):
        path = os.path.join(OUT, name)
        if animated:
            images[0].save(path, format="WEBP", save_all=True, append_images=images[1:], duration=durations,
                           loop=0, quality=84, method=4, minimize_size=True)
        else:
            images[0].save(path, format="WEBP", quality=88, method=6)
        print("wrote %-18s %4d KB" % (name, os.path.getsize(path) // 1024))
    record(args.mood, "animated" if animated else "still")
    print("%s is now '%s' in js/mascot.js (%d frame%s)" % (
        args.mood, "animated" if animated else "still", len(frames), "s" if animated else ""))


if __name__ == "__main__":
    main()
