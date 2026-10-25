// Native cancellation/clear acceptance; synthetic isolated profile only.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
assert.equal(process.env.CHRONEXUS_TRANSLATION_QA, "isolated");
const b = await chromium.connectOverCDP("http://127.0.0.1:9226");
const p = b.contexts()[0].pages()[0];
const call = (n, a = {}) =>
  p.evaluate(([n, a]) => window.__TAURI_INTERNALS__.invoke(n, a), [n, a]);
const campaigns = await call("list_campaigns");
assert.equal(campaigns.length, 1);
assert.equal(campaigns[0].name, "Collaudo traduzione M17");
await call("save_interface_preferences", {
  preferences: {
    version: 2,
    locale: "it",
    script: "standard",
    showOriginal: true,
  },
});
let epoch = await call("wiki_cache_epoch");
await call("store_wiki_cache", {
  key: "entry/spells/m17-boundary",
  epoch,
  payload: {
    entry: {
      key: "m17-boundary",
      name: "Boundary Light",
      desc: "A light shines for 1 minute. ".repeat(200),
      document: { key: "test-srd" },
    },
    document: { key: "test-srd", name: "Synthetic boundary source" },
  },
});
const start = async () => {
  const id = crypto.randomUUID();
  await p.evaluate((id) => {
    window.__m17Result = window.__TAURI_INTERNALS__
      .invoke("translate_wiki", {
        request: {
          provider: "open5e",
          key: "entry/spells/m17-boundary",
          locale: "it",
          requestId: id,
        },
      })
      .then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
  }, id);
  await expect.poll(() => call("update_announcement_blocked")).toBe(true);
  return id;
};
const id = await start();
await call("cancel_local_ai", { id });
const cancelled = await p.evaluate(() => window.__m17Result);
assert.match(String(cancelled.error), /annullata/);
assert.equal(
  await call("read_wiki_translation", {
    provider: "open5e",
    key: "entry/spells/m17-boundary",
    locale: "it",
  }),
  null,
);
await expect.poll(() => call("update_announcement_blocked")).toBe(false);
await start();
const before = await call("wiki_cache_epoch");
await call("clear_wiki_cache", { provider: "open5e" });
const cleared = await p.evaluate(() => window.__m17Result);
assert.match(String(cleared.error), /cache.*cambiati/);
assert((await call("wiki_cache_epoch")) > before);
assert.equal(
  await call("read_wiki_cache", { key: "entry/spells/m17-boundary" }),
  null,
);
await expect.poll(() => call("update_announcement_blocked")).toBe(false);
await writeFile(
  ".tools/m17/boundary-report.json",
  JSON.stringify(
    {
      cancelled,
      cleared,
      staleWriteRejected: true,
      sharedAiLockReleased: true,
    },
    null,
    2,
  ),
);
console.log(
  "PASS native cancellation, no partial cache, epoch rejects late write, shared AI lock released",
);
await b.close();
