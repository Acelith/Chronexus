# Logo in Chronexus (M21)

Illustrations chosen by the user on 25 October 2026: herald with trumpet and
banner. Generated externally by the user, without campaign data. Integrate in M21:
`assets/chronexus.svg` (source of `pnpm icons`) is a copy of
`chronexus-icon.svg`; the sidebar uses `chronexus-logo.webp`; the README uses
`chronexus-wordmark.webp` and `chronexus-icon.webp`.

## Originals (do not modify)

| File | Content |
| --- | --- |
| `source/icon-original.webp` | Square icon 1254×1254 on burgundy parchment, black background at corners |
| `source/wordmark-original.webp` | Horizontal herald logo + «CHRONEXUS», 2000×667, alpha |
| `source/logo-original.webp` | Vertical herald logo above «CHRONEXUS», 1254×1254, alpha |

## Prepared variants

| File | Intended use | Preparation |
| --- | --- | --- |
| `chronexus-icon.svg` | Source of `pnpm icons` (window, taskbar, installer) | Rounded corners made transparent (mask with radius 232 px), 1024×1024, PNG at 256 colors embedded. `tauri icon` tested: generates all sizes |
| `chronexus-icon.webp` | Icon for documents and README | 512×512, alpha |
| `chronexus-logo.webp` | Vertical logo in the sidebar | 640 px, original alpha |
| `chronexus-wordmark.webp` | Horizontal logo for README and pages | 1400 px, original alpha |

Conversions with ffmpeg 7.1.1. To regenerate, always start from `source/`.
At 16–32 px, the icon retains the shape but loses details: M21 evaluates a simplified variant
for small sizes. The app name remains accessible text
(`alt`/title), never just drawn letters.

## Windows installer (0.9.2)

The NSIS welcome/finish pages use `installer/sidebar.bmp` (164x314), while
intermediate pages and uninstaller use `installer/header.bmp` (150x57). The
existing `src-tauri/icons/icon.ico` supplies installer/uninstaller icons. Both
bitmaps are opaque RGB, composited on the app's leather palette with brass and
burgundy accents; the original logos retain their aspect ratios. Native headings
and controls remain ordinary text. No custom NSIS template or installer behavior
is introduced. Updater passive mode can omit wizard pages as before.

Regenerate with Pillow: `python scripts/release/installer_branding.py`.
The generator reads only `source/wordmark-original.webp` and
`source/logo-original.webp`, never modifying them. Prepared BMP files are committed
so normal builds do not require Python or Pillow.
