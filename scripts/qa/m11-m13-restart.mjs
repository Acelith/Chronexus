import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
assert.equal(process.env.CHRONEXUS_RELEASE_QA, "isolated");
const b = await chromium.connectOverCDP("http://127.0.0.1:9223");
const p = b
  .contexts()[0]
  .pages()
  .find((p) => p.url().includes("1420"));
assert(p);
const call = (name, args = {}) =>
  p.evaluate(
    ({ name, args }) => window.__TAURI_INTERNALS__.invoke(name, args),
    { name, args },
  );
const report = JSON.parse(
  await readFile(".tools/m11-m13/native-report.json", "utf8"),
);
const campaigns = await call("list_campaigns");
assert.equal(campaigns.length, 1);
assert.equal(campaigns[0].name, "Collaudo M11-M13");
const prefs = await call("get_interface_preferences");
assert.equal(prefs.script, "dethek");
assert.equal(prefs.version, 2);
const rolls = [];
let before = null;
do {
  const h = await call("list_dice_rolls", {
    campaignId: report.campaignId,
    before,
  });
  rolls.push(...h.rolls);
  before = h.nextCursor;
} while (before);
assert.equal(
  createHash("sha256")
    .update(JSON.stringify(rolls.sort((a, b) => a.id.localeCompare(b.id))))
    .digest("hex"),
  report.dataHash,
);
if (process.argv[2] === "backup") {
  const receipt = await call("create_backup");
  assert(receipt);
  const extra = await call("roll_dice", {
    campaignId: report.campaignId,
    requestId: randomUUID(),
    selections: [{ sides: 20, quantity: 1 }],
  });
  assert(extra);
  const preview = await call("inspect_backup");
  assert(preview?.token);
  await call("restore_backup", { token: preview.token });
  assert.equal((await call("get_interface_preferences")).script, "dethek");
  const rows = [];
  let cursor = null;
  do {
    const h = await call("list_dice_rolls", {
      campaignId: report.campaignId,
      before: cursor,
    });
    rows.push(...h.rolls);
    cursor = h.nextCursor;
  } while (cursor);
  assert.deepEqual(
    rows.sort((a, b) => a.id.localeCompare(b.id)),
    rolls,
  );
  await writeFile(
    ".tools/m11-m13/backup-report.json",
    JSON.stringify(
      { path: receipt.path, rollCount: rolls.length, preserved: true },
      null,
      2,
    ),
  );
}
console.log(
  "PASS restart/data/preferences" +
    (process.argv[2] === "backup" ? " and backup restore" : ""),
);
await b.close();
