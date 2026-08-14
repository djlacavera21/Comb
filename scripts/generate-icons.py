"""Regenerate Comb's PNG extension icons from simple vector primitives.

Requires Pillow only when brand assets are intentionally regenerated. The packaged
extension and its verification suite have no Python or JavaScript dependencies.
"""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = ROOT / "icons"
SCALE = 4
MASTER_SIZE = 128 * SCALE


def scaled_points(points):
    return [(round(x * SCALE), round(y * SCALE)) for x, y in points]


def make_master():
    image = Image.new("RGBA", (MASTER_SIZE, MASTER_SIZE), (0, 0, 0, 0))
    mask = Image.new("L", image.size, 0)
    mask_draw = ImageDraw.Draw(mask)
    outer_hex = scaled_points([(64, 4), (116, 34), (116, 94), (64, 124), (12, 94), (12, 34)])
    mask_draw.polygon(outer_hex, fill=255)

    gradient = Image.new("RGBA", image.size)
    pixels = gradient.load()
    for y in range(MASTER_SIZE):
        for x in range(MASTER_SIZE):
            progress = (x + y) / (2 * (MASTER_SIZE - 1))
            color = tuple(round(a + (b - a) * progress) for a, b in zip((23, 71, 53), (7, 26, 20)))
            pixels[x, y] = (*color, 255)
    image.paste(gradient, (0, 0), mask)

    draw = ImageDraw.Draw(image)
    inner_hex = scaled_points([(64, 9), (111.7, 36.5), (111.7, 91.5), (64, 119), (16.3, 91.5), (16.3, 36.5)])
    draw.line(inner_hex + [inner_hex[0]], fill=(224, 182, 93, 255), width=6 * SCALE, joint="curve")

    draw.arc(
        scaled_points([(33, 33), (95, 95)]),
        start=45,
        end=315,
        fill=(239, 200, 116, 255),
        width=14 * SCALE,
    )

    for center_y in (45.5, 82.5):
        cx, cy = 94, center_y
        decorative_hex = scaled_points(
            [
                (cx, cy - 10.5),
                (cx + 9, cy - 5.3),
                (cx + 9, cy + 5.2),
                (cx, cy + 10.5),
                (cx - 9, cy + 5.2),
                (cx - 9, cy - 5.3),
            ]
        )
        draw.polygon(decorative_hex, fill=(247, 221, 160, 255))

    return image


def main():
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    master = make_master()
    for size in (16, 32, 48, 128):
        output = master.resize((size, size), Image.Resampling.LANCZOS)
        output.save(ICON_DIR / f"comb-{size}.png", optimize=True)
    print("Generated Comb icons: 16, 32, 48, and 128 px")


if __name__ == "__main__":
    main()
