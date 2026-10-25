# Espruar and Dethek — Pixel Sagas / Neale Davidson

Regular OTF original fonts, downloaded from the author's archives on October 24
2026. The original archives include OFL 1.1 and Readme: copies are present next to
each font. Do not use the obsolete "personal use" labels from mirrors as
license: the OFL files included in the original archives indicated here prevail.

- Espruar: https://www.pixelsagas.com/?download=espruar
- Dethek: https://www.pixelsagas.com/?download=dethek
- Download and SHA-256 in metadata.json.

No font files modified; CSS aliases to integrate them into the app. OpenType cmap
verified: A–Z and a–z have assigned glyphs, 26 distinct glyphs for uppercase.
Lowercase/uppercase variants belong to the font design and remain
the originals. Automatic ligatures disabled: letter-by-letter rendering,
not elven/dwarven translation or grammar. Figures and punctuation remain normal;
unicode-range limits the font to U+0041–005A/U+0061–007A and renders other characters
with standard fonts. Do not replace with runes from other languages.

There is no new Unicode encoding of the alphabets in this implementation:
the rendering text uses the same ASCII codes and requires the indicated font.
The reversible package v2 records writing and alphabetRevision=1, maintaining
the original. v1 preferences are read and updated in memory to v2; the file is
updated only upon saving. Old builds may require Italian recovery
for v2 preferences; documents/SQLite 015/backup do not change.
