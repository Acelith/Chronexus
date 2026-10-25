# Herald Illustrations (M15a)

Status: **installed on 25 October 2026**. Illustrations provided by the user
(generated externally from the prompts below, without campaign data) and
converted locally with ffmpeg: `herald.webp` 630×840 with original alpha (113 KB);
`manifesto.webp` 1200×857, white background rendered transparent with colorkey (94 KB).
Originals are not stored in the repository. If a file is removed, set the
entry to `null` in `heraldArt.ts`: the geometric SVG emblem (trumpet with
banner) returns. No images are downloaded at runtime.

## Expected Files

| File | Content | Format |
| --- | --- | --- |
| `herald.webp` | Full-figure vassal/herald playing a trumpet, facing right | WebP with alpha, approx. 768×1024, ≤ 300 KB |
| `manifesto.webp` | Empty unrolled scroll, background for the announcement text | WebP, approx. 1400×1000, ≤ 300 KB, clear and uniform central area |

To activate them, set in `src/features/updates/heraldArt.ts`:

```ts
herald: new URL("../../../assets/herald/herald.webp", import.meta.url).href,
manifesto: new URL("../../../assets/herald/manifesto.webp", import.meta.url).href,
```

## Suggested Prompts

**herald.webp**

> Original illustration of a medieval herald (vassal) in full figure, side
> three-quarter view facing right, raising a long straight brass fanfare trumpet
> to his lips; a burgundy (#6c302b) pennant with a simple ivory eight-pointed star
> hangs from the trumpet. Tabard in burgundy and dark green (#354b3e) with brass
> (#b89b60) trim, leather boots, calm proud stance. Style: hand-engraved
> copperplate illustration with fine cross-hatching, warm sepia ink (#321d13) and
> muted brass highlights, consistent with an old map engraving. Transparent
> background, no ground shadow, no text, no letters, no logos, no frame, no
> heraldic symbols of real nations or organizations.

**manifesto.webp**

> Top-down flat view of an unrolled blank parchment scroll, ivory parchment
["> (#ead9b1) with subtle fibres and soft age stains toward the edges, rolled ends"
"> top and bottom with slight shadow, thin double burgundy (#6c302b) ruled border.
"> The central area must be clean, even and light for overlaid text. No writing,
"> no letters, no seals, no logos. Flat lighting, no perspective distortion.

## Vincoli

[- No rasterized text: title, version, notes and buttons remain HTML text.]
- No campaign data in the prompts. Keep the source/tool used here,
  the date and any licenses; originals outside the repository.
- After insertion, verify text contrast on the parchment (≥ 4.5:1),
  reduced movement and narrow window with `scripts/qa/m15a-herald.mjs`.
