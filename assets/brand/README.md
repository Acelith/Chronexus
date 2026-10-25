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
