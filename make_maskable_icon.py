#!/usr/bin/env python3
"""Build a padded 512x512 maskable PWA icon from the QueueZeroTwo logo mark.

Run from the repo root:
    python3 make_maskable_icon.py

Dependencies:
    python3 -m pip install pillow cairosvg

The generated artwork is centered on the app background, rasterized to PNG,
and checked pixel-by-pixel against Android's 80% diameter (40% radius)
maskable safe circle.
"""

from pathlib import Path
import io
import math

try:
    import cairosvg
    from PIL import Image
except ImportError as exc:
    raise SystemExit(
        "Missing dependency. Install with: python3 -m pip install pillow cairosvg"
    ) from exc

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "brand" / "logo-mark.svg"
TARGET = ROOT / "icon-maskable-512.png"

SIZE = 512
ARTWORK_SCALE = 0.65
SAFE_RADIUS = SIZE * 0.40
ALPHA_THRESHOLD = 16
PALETTE_COLORS = 8
BACKGROUND = (11, 15, 25, 255)  # QueueZeroTwo #0B0F19


def render_source():
    if not SOURCE.exists():
        raise SystemExit(f"Missing source artwork: {SOURCE}")
    png = cairosvg.svg2png(
        url=str(SOURCE),
        output_width=SIZE,
        output_height=SIZE,
    )
    return Image.open(io.BytesIO(png)).convert("RGBA")


def place_artwork(src):
    if not src.getchannel("A").getbbox():
        raise SystemExit("Source artwork is empty.")

    artwork_size = round(SIZE * ARTWORK_SCALE)
    src.thumbnail((artwork_size, artwork_size), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (SIZE, SIZE), BACKGROUND)
    x = (SIZE - src.width) // 2
    y = (SIZE - src.height) // 2
    canvas.alpha_composite(src, (x, y))
    return canvas, src, x, y


def assert_inside_circle(alpha, x, y):
    pixels = alpha.load()
    max_radius = 0.0
    for py in range(alpha.height):
        for px in range(alpha.width):
            if pixels[px, py] < ALPHA_THRESHOLD:
                continue
            cx = x + px + 0.5
            cy = y + py + 0.5
            radius = math.hypot(cx - SIZE / 2, cy - SIZE / 2)
            max_radius = max(max_radius, radius)
            if radius > SAFE_RADIUS:
                raise SystemExit(
                    f"Artwork leaves the maskable safe circle at "
                    f"({cx:.1f}, {cy:.1f}); radius {radius:.1f} > {SAFE_RADIUS:.1f}."
                )
    return max_radius


def main():
    canvas, placed, x, y = place_artwork(render_source())
    max_radius = assert_inside_circle(placed.getchannel("A"), x, y)

    # PNG-8 keeps the simple three-color mark compact while preserving antialiasing.
    canvas = canvas.convert("RGB").quantize(
        colors=PALETTE_COLORS,
        method=Image.Quantize.MEDIANCUT,
    ).convert("RGB")
    canvas.save(TARGET, format="PNG", optimize=True)

    print(f"Wrote {TARGET}")
    print(f"Artwork scale: {ARTWORK_SCALE:.0%}")
    print(f"Maximum artwork radius: {max_radius:.1f}px")
    print(f"Maskable safe radius: {SAFE_RADIUS:.1f}px")
    print(f"Palette: {PALETTE_COLORS} colors")
    print("Circular safe-zone check: PASS")


if __name__ == "__main__":
    main()
