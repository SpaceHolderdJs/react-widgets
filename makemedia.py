#!/usr/bin/env python3
"""
Turn a frame sequence captured by capture.mjs into the media the README embeds.

    node capture.mjs && python3 makemedia.py

A GIF, because it is the one animated format both npmjs.com and GitHub render
inside a README — npm will not play a <video>, and a still would not show the
thing the package does.

Dithering is off. The frames are a dark gradient, and dithering one adds noise
a GIF cannot compress: the same sequence came out 640 KB dithered and 275 KB
not, for a difference nobody sees on a near-black background.

An mp4 is written alongside at full width for anyone who wants to look
properly. It is a third the size at several times the quality; it just cannot
go in a README.

(ffmpeg's palettegen/paletteuse pair would be the obvious way to make the GIF
and fails with an internal error on globbed input here, so the quantising is
done in Pillow.)
"""
import glob
import os
import subprocess
import sys

from PIL import Image

IN = os.environ.get('IN', '/tmp/cap')
OUT = os.environ.get('OUT', 'docs/media')
WIDTH = int(os.environ.get('GIF_WIDTH', 480))
COLORS = int(os.environ.get('GIF_COLORS', 64))
FRAME_MS = int(os.environ.get('GIF_MS', 130))
HOLD_MS = int(os.environ.get('GIF_HOLD', 1500))
MP4_WIDTH = int(os.environ.get('MP4_WIDTH', 900))

os.makedirs(OUT, exist_ok=True)

prefixes = sorted({os.path.basename(f).rsplit('-', 1)[0] for f in glob.glob(f'{IN}/*-*.png')})
if not prefixes:
    sys.exit(f'no frames in {IN} — run capture.mjs first')


def kb(path):
    return round(os.path.getsize(path) / 1024)


for prefix in prefixes:
    files = sorted(glob.glob(f'{IN}/{prefix}-*.png'))
    frames = [Image.open(f).convert('RGB') for f in files]
    frames = [im.resize((WIDTH, round(WIDTH * im.height / im.width)), Image.LANCZOS)
              for im in frames]

    # One palette for the whole sequence, taken from a middle frame: a
    # per-frame palette makes the background shimmer between frames.
    palette = frames[len(frames) // 2].quantize(colors=COLORS, method=Image.MEDIANCUT)
    quantised = [im.quantize(palette=palette, dither=Image.NONE) for im in frames]

    durations = [FRAME_MS] * len(quantised)
    durations[-1] = HOLD_MS          # let the final frame land before looping

    gif = f'{OUT}/{prefix}.gif'
    quantised[0].save(gif, save_all=True, append_images=quantised[1:],
                      duration=durations, loop=0, optimize=True, disposal=2)

    mp4 = f'{OUT}/{prefix}.mp4'
    subprocess.run(
        ['ffmpeg', '-y', '-framerate', f'{1000 / FRAME_MS:.4f}',
         '-pattern_type', 'glob', '-i', f'{IN}/{prefix}-*.png',
         '-vf', f'scale={MP4_WIDTH}:-2:flags=lanczos,format=yuv420p',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', '26',
         '-movflags', '+faststart', mp4],
        check=True, capture_output=True)

    print(f'{prefix}: {len(files)} frames -> {gif} {kb(gif)} KB, {mp4} {kb(mp4)} KB')
