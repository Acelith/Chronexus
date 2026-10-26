"""Prepare native NSIS bitmaps from the user-approved Chronexus brand originals.

Requires Pillow. This only resizes and composites existing artwork; originals are
never changed. Run from any directory, then commit the generated installer assets.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / "assets" / "brand"
OUTPUT = BRAND / "installer"
LEATHER = "#241e17"
BRASS = "#b89b60"
BURGUNDY = "#6c302b"


def artwork(name: str, size: tuple[int, int]) -> Image.Image:
    with Image.open(BRAND / "source" / name) as source:
        return ImageOps.contain(source.convert("RGBA"), size, Image.Resampling.LANCZOS)


def render() -> None:
    OUTPUT.mkdir(exist_ok=True)
    # MUI2's native dimensions. RGB BMP avoids alpha/palette rendering differences
    # in the installer; scaling preserves the original artwork's aspect ratio.
    header = Image.new("RGBA", (150, 57), LEATHER)
    wordmark = artwork("wordmark-original.webp", (140, 47))
    header.alpha_composite(wordmark, ((150 - wordmark.width) // 2, (57 - wordmark.height) // 2))
    header.convert("RGB").save(OUTPUT / "header.bmp")

    sidebar = Image.new("RGBA", (164, 314), LEATHER)
    draw = ImageDraw.Draw(sidebar)
    draw.rectangle((7, 7, 156, 306), outline=BRASS)
    draw.rectangle((8, 286, 155, 305), fill=BURGUNDY)
    logo = artwork("logo-original.webp", (148, 148))
    sidebar.alpha_composite(logo, ((164 - logo.width) // 2, (286 - logo.height) // 2))
    sidebar.convert("RGB").save(OUTPUT / "sidebar.bmp")


if __name__ == "__main__":
    render()
    print("Prepared Chronexus NSIS header (150x57) and sidebar (164x314).")
