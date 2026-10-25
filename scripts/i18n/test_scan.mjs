import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { idFor } from "./scan.mjs";

test("switching the source language preserves existing catalog identities", async () => {
  const catalog = JSON.parse(
    await readFile("src/i18n/catalogs/en.json", "utf8"),
  );
  const id = Object.keys(catalog).find(
    (key) => catalog[key] === "New campaign",
  );
  assert(id);
  assert.equal(idFor("New campaign"), id);
  const source = "A new English source message without a stored identity.";
  assert.equal(
    idFor(source),
    "m_" + createHash("sha256").update(source).digest("hex").slice(0, 12),
  );
});
