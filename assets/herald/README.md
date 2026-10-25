# Illustrazioni dell’araldo (M15a)

Stato: **da fornire**. Finché mancano, l’annuncio mostra l’emblema geometrico
SVG (trombetta con stendardo) definito in `src/features/updates/HeraldAnnouncement.tsx`.
Nessuna immagine viene scaricata a runtime.

## File attesi

| File | Contenuto | Formato |
| --- | --- | --- |
| `herald.webp` | Vassallo/araldo a figura intera che suona la trombetta, rivolto a destra | WebP con alpha, circa 768×1024, ≤ 300 KB |
| `manifesto.webp` | Pergamena srotolata vuota, sfondo del testo dell’annuncio | WebP, circa 1400×1000, ≤ 300 KB, area centrale chiara e uniforme |

Per attivarli impostare in `src/features/updates/heraldArt.ts`:

```ts
herald: new URL("../../../assets/herald/herald.webp", import.meta.url).href,
manifesto: new URL("../../../assets/herald/manifesto.webp", import.meta.url).href,
```

## Prompt suggeriti

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
> (#ead9b1) with subtle fibres and soft age stains toward the edges, rolled ends
> top and bottom with slight shadow, thin double burgundy (#6c302b) ruled border.
> The central area must be clean, even and light for overlaid text. No writing,
> no letters, no seals, no logos. Flat lighting, no perspective distortion.

## Vincoli

- Nessun testo rasterizzato: titolo, versione, note e pulsanti restano testo HTML.
- Nessun dato di campagna nei prompt. Conservare qui la fonte/strumento usato,
  la data e le eventuali licenze; gli originali fuori dal repository.
- Dopo l’inserimento verificare contrasto del testo sulla pergamena (≥ 4.5:1),
  movimento ridotto e finestra stretta con `scripts/qa/m15a-herald.mjs`.
