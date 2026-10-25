// Explicit local inference on the English-default QA campaign only.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
assert.equal(process.env.CHRONEXUS_AI_QA, "isolated");
const policy = JSON.parse(await readFile("src/ai-models.json", "utf8"));
const browser = await chromium.connectOverCDP("http://127.0.0.1:9224");
const page = browser
  .contexts()[0]
  .pages()
  .find((p) => p.url().includes("1420"));
assert(page);
const call = (name, args = {}) =>
  page.evaluate(
    ([n, a]) => window.__TAURI_INTERNALS__.invoke(n, a),
    [name, args],
  );
const campaigns = await call("list_campaigns");
assert.equal(campaigns.length, 1);
assert.equal(campaigns[0].name, "Varek’s Tower");
const campaignId = campaigns[0].id;
const entry =
  (await call("list_pages", { campaignId })).find((p) => p.title === "Mirna") ??
  (await call("create_page", {
    campaignId,
    title: "Mirna",
    kind: "npc",
    status: "active",
    aliases: [],
  }));
await call("save_page_document", {
  campaignId,
  id: entry.id,
  revision: entry.revision,
  document: {
    version: 1,
    blocks: [
      {
        id: randomUUID(),
        type: "paragraph",
        props: {},
        children: [],
        content: [
          {
            type: "text",
            styles: {},
            text: "Varek gave Mirna a brass key at the inn. Mirna says she works for the Cartographers’ Guild; this claim is unconfirmed.",
          },
        ],
      },
    ],
  },
});
await call("configure_local_ai", {
  enabled: true,
  model: policy.primary.name,
  campaignId,
  multilingualConsent: true,
});
const before = JSON.stringify(await call("list_pages", { campaignId }));
const results = [];
for (const [locale, question, expected] of [
  ["en", "Who gave Mirna the key?", /Varek/],
  ["en", "What material is Mirna’s key?", /brass/i],
  [
    "en",
    "Is Mirna’s claim about the guild confirmed?",
    /unconfirmed|not confirmed|not established|not a confirmed/i,
  ],
  [
    "en",
    "How many siblings does Mirna have?",
    /Not found in the available sources/,
  ],
  ["it", "Di quale materiale è la chiave di Mirna?", /ottone/i],
]) {
  const request = {
    id: randomUUID(),
    campaignId,
    question,
    mode: "campaign",
    edition: null,
    ruleKeys: [],
    locale,
  };
  const turn = await page.evaluate(async (request) => {
    const { Channel } = await import("/node_modules/@tauri-apps/api/core.js");
    return window.__TAURI_INTERNALS__.invoke("ask_local_ai", {
      request,
      events: new Channel(() => {}),
    });
  }, request);
  assert.equal(turn.status, "complete", turn.error);
  assert.match(turn.answer, expected);
  if (!turn.answer.startsWith("Not found"))
    assert.match(turn.answer, /\[S\d+\]/);
  results.push({ locale, question, answer: turn.answer, model: turn.model });
}
assert.equal(JSON.stringify(await call("list_pages", { campaignId })), before);
await writeFile(
  ".tools/i18n-en/assistant-report.json",
  JSON.stringify({ results, canonicalPagesUnchanged: true }, null, 2),
);
console.log(
  "PASS Qwen native: 4 English answers, Italian selection, citations/uncertainty/absence, canonical pages unchanged",
);
await browser.close();
