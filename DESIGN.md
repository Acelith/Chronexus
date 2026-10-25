# Chronexus — Reference GUI
## Authority and Surface
Operate Mode. Binding reference: .tools/ui-refresh/reference.png, attached by the user on October 24 2026. The revision reproduces composition, materials, frames, typography, and hierarchy; the content remains that of the selected campaign.
## Composition
At reference 1586×992: dark left coast approximately 270 px wide; brand with compass rose, campaign selector, actions, and landscape engraved at the foot. Right area in parchment; campaign title at the top, real date, and compact actions menu; below, navigation with icons. Settings and the assistant are on the left coast, without adding items to the reference bar.
Graph: title and subtitle, horizontal filters, framed map with detail on the right, zoom commands below. Labels always legible and distinct from mentions/relations.
## Materials and Colors
Ivory parchment #ead9b1, ink #321d13, leather #241e17, brass #b89b60, burgundy #6c302b, green #354b3e. Discrete real textures, no rasterized text in controls. Thin frames and decorated corners.
## Typography
EB Garamond for text and titles, Cinzel for the brand; local fonts with OFL license. Campaign title 46–52 px, surface title 34–40 px, text 18–21 px, controls 17–19 px. Dimensions adapted to compact windows without changing the graphic language.
## Interaction
Window occupied at 100%, header and menu fixed. Independent scroll for session/page lists and for the document. Editor with permanent bar, labeled dialogues, explicit Markdown mode, and error recovery. No silent changes to UUID links.
## Assets and Constraints
Coherent SVG icons, compass roses, and geometric frames; textures and engraving as separate assets. The graphics do not incorporate names, buttons, or fictitious results. No remote dependencies at runtime.

## Tiradadi M9 — Operate with scenic moment

Dedicated panel from the left menu. On desktop, vertical composer with seven
geometries on the left, bronze dragon circle in the center, and chronicles on the right.
On compact windows, the history moves below and the composer becomes a grid.
The original illustrations of dragons/flames are separate from the SVG dice and from the
values: large ivory numbers, dark stone, and explicit type including d100.
A single animated moment: rolling, landing, fire, revelation, and counting of
slots in 2,5 seconds independent of the number of dice. Flames precede the numbers,
do not cover the final results; reduced movement directly shows the result.
Maximum 14 dice in the scene, distributed across all selected types; the semantic detail
preserves and renders all values legible, even on 100 dice.


## M10 — Languages and Scripts

Preserve parchment, ornaments, and Latin typography of the reference. Arabic/CJK languages
use legible local Noto fonts, without requiring remote font services.
Arabic mirrors the layout and isolates mixed data; campaign texts and
quotes remain original. No translation via DOM rewriting.
SGA uses Monocraft OFL, not real language glyphs masquerading as the Minecraft alphabet.
aria-hidden decorative glyphs and semantic text, English recovery always ordinary;
missing font or unrepresentable character preserve the legible text.
The "show ordinary text too" box governs only the controlled labels.
Critical dialogues, data, and native menus remain ordinary. Details: docs/I18N.md.

## M15a — Update Herald

The only animated moment outside the tiradadi: herald on the left overlapping the
manifesto parchment (double burgundy frame), ~1,5 s, skippable and static with
reduced movement. Text, version, notes, and buttons always HTML. Until raster
illustrations (`assets/herald/`) are missing, the geometric trumpet and
standard emblem are used, never a hand-drawn figure in SVG. On narrow windows, the emblem
moves over the manifesto.


## M21 — Herald Logo

The sidebar shows the vertical herald logo instead of the compass rose
and the compound name; the title remains "Chronexus" as alternative text. The app
icon uses the same illustration on burgundy leather. Originals and variants in
`assets/brand/`; no other interface text is rasterized.
