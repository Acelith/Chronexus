import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
const root = new URL("../../assets/fonts/forgotten-realms/", import.meta.url);
const metadata = JSON.parse(
  readFileSync(new URL("metadata.json", root), "utf8"),
);
for (const family of ["Espruar", "Dethek"]) {
  test(`${family}: original font, letters and licence`, () => {
    const file = readFileSync(new URL(`${family}.otf`, root));
    assert.equal(
      createHash("sha256").update(file).digest("hex"),
      metadata.fonts[family].sha256,
    );
    assert.equal(Object.keys(metadata.fonts[family].glyphIds).length, 52);
    assert.ok(
      Object.values(metadata.fonts[family].glyphIds).every((id) => id > 0),
    );
    assert.equal(metadata.fonts[family].uniqueUppercaseGlyphs, 26);
    const license = readFileSync(new URL(`${family}-OFL.txt`, root), "utf8");
    assert.ok(license.includes("SIL OPEN FONT LICENSE Version 1.1"));
    assert.ok(license.includes("Neale Davidson"));
  });
}
