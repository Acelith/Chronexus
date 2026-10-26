import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
assert.equal(process.env.CHRONEXUS_I18N_QA, "isolated");
const out = ".tools/m10";
const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
const page = browser
  .contexts()[0]
  .pages()
  .find((p) => p.url().includes("1420"));
assert(page);
const errors = [],
  remote = [];
page.on("pageerror", (e) => errors.push(e.message));
const hosts = new Set([
  "localhost",
  "127.0.0.1",
  "ipc.localhost",
  "asset.localhost",
]);
await page
  .context()
  .route(/^https?:/, (r) =>
    hosts.has(new URL(r.request().url()).hostname) ? r.continue() : r.abort(),
  );
page.on("request", (r) => {
  if (/^https?:/.test(r.url()) && !hosts.has(new URL(r.url()).hostname))
    remote.push(r.url());
});
const call = (name, args = {}) =>
  page.evaluate(
    ({ name, args }) => window.__TAURI_INTERNALS__.invoke(name, args),
    { name, args },
  );
const defaults = {
  version: 2,
  locale: "it",
  script: "standard",
  showOriginal: true,
};
const campaigns = await call("list_campaigns");
assert(campaigns.length === 1 && campaigns[0].name.startsWith("Collaudo M10"));
const campaignId = campaigns[0].id;
const catalogs = {};
for (const l of ["it", "en", "ja", "ar"])
  catalogs[l] = JSON.parse(
    await readFile(`src/i18n/catalogs/${l}.json`, "utf8"),
  );
const ui = async (source) =>
  catalogs[await page.locator("html").getAttribute("lang")][
    "m_" + createHash("sha256").update(source).digest("hex").slice(0, 12)
  ] ?? source;
const click = async (source) =>
  page.getByRole("button", { name: await ui(source), exact: true }).click();
const changeLocale = async (locale) => {
  await click("App settings");
  await page.locator(".language-settings select").first().selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator(".language-settings select").first()).toBeEnabled();
};
await call("save_interface_preferences", { preferences: defaults });
await page.reload();
await expect(page.locator(".campaign-picker select")).toHaveValue(campaignId);
const fonts = await page.evaluate(async () => {
  const out = {};
  for (const [font, text] of [
    ["Chronexus Arabic", "العربية"],
    ["Chronexus Japanese", "日本語"],
    ["Chronexus Korean", "한국어"],
    ["Chronexus Chinese", "简体中文"],
    ["Chronexus Galactic", "\ueb40\ueb59"],
  ]) {
    const faces = await document.fonts.load(`16px "${font}"`, text);
    out[font] = faces.length > 0 && faces.every((f) => f.status === "loaded");
  }
  return out;
});
assert(Object.values(fonts).every(Boolean));
// Real local font request failure, with browser cache disabled. Ordinary semantic labels must remain visible.
const client = await page.context().newCDPSession(page);
await client.send("Network.enable");
await client.send("Network.setCacheDisabled", { cacheDisabled: true });
await page.route(/Monocraft.*\.ttf/, (r) => r.abort());
await call("save_interface_preferences", {
  preferences: {
    ...defaults,
    locale: "en",
    script: "galactic",
    showOriginal: false,
  },
});
await page.reload();
await expect(
  page
    .getByRole("button", { name: "Journal", exact: true })
    .locator(".script-original"),
).toBeVisible();
await page.screenshot({
  path: `out-font-missing.png`.replace("out-", out + "/"),
});
await click("App settings");
await page
  .getByRole("button", {
    name: "English · Reset language and script",
    exact: true,
  })
  .click();
await expect(page.locator("html")).toHaveAttribute("lang", "it");
await expect(page.locator("html")).toHaveAttribute("data-script", "standard");
await page.unroute(/Monocraft.*\.ttf/);
await client.send("Network.setCacheDisabled", { cacheDisabled: false });
await click("Journal");
const session = (await call("list_sessions", { campaignId }))[0],
  originalBlock = session.document.blocks[0].id;
await click("Markdown");
const source = page.getByRole("textbox", { name: "Markdown source" });
const original = await source.inputValue();
const marker = "\n\n日本語の入力 — العربية — café — e\u0301\n";
await source.fill(original + marker);
await click("Apply and return to visual mode");
const editor = page.locator('.bn-editor[contenteditable="true"]');
await expect(editor).toBeVisible();
await editor.click();
await page.keyboard.press("Control+End");
await editor.dispatchEvent("compositionstart", { data: "" });
const composed = " 入力テスト مرحبا";
await page.keyboard.insertText(composed);
await editor.dispatchEvent("compositionend", { data: composed });
await expect(editor).toContainText("入力テスト");
await expect
  .poll(async () =>
    JSON.stringify((await call("list_sessions", { campaignId }))[0].document),
  )
  .toContain("入力テスト");
const saved = (await call("list_sessions", { campaignId }))[0];
assert.equal(saved.document.blocks[0].id, originalBlock);
const serialized = JSON.stringify(saved.document);
assert(serialized.includes("日本語の入力"));
assert(serialized.includes("العربية"));
assert(serialized.includes("e\u0301"));
for (const locale of ["ja", "ar"]) {
  await changeLocale(locale);
  await click("Journal");
  await expect(editor).toContainText("入力テスト");
  assert.deepEqual((await call("list_sessions", { campaignId }))[0], saved);
  await page.screenshot({ path: `${out}/editor-${locale}.png` });
}
await page.keyboard.press("Control+k");
await expect(page.getByRole("dialog")).toBeVisible();
await page.getByRole("searchbox").fill("日本語");
await expect(page.locator(".search-results")).toContainText(session.title);
await page.keyboard.press("Escape");
assert.deepEqual((await call("list_sessions", { campaignId }))[0], saved);
await changeLocale("it");
assert.deepEqual(errors, []);
assert.deepEqual(remote, []);
await writeFile(
  `${out}/input-result.json`,
  JSON.stringify(
    {
      fonts,
      fontFailureRecovery: true,
      markdownUnicode: true,
      simulatedComposition: true,
      realSystemIME: false,
      firstBlockIdPreserved: true,
      cjkSearch: true,
      localeChangesPreserveSavedDocument: true,
      errors,
      remote,
    },
    null,
    2,
  ),
);
console.log(
  "PASS: 5 local fonts, missing font, Unicode Markdown/visual and simulated composition, CJK search, UUIDs and data preserved. System IME not tested.",
);
process.exit(0);
