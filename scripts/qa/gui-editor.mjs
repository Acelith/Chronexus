// Run against an isolated debug profile only. No personal campaign is accepted.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
assert.equal(
  process.env.CHRONEXUS_UI_QA,
  "isolated",
  "Launch with an isolated NODEX_DEV_DATA_DIR and set CHRONEXUS_UI_QA=isolated.",
);
const phase = process.argv[2] ?? "check";
assert(["check", "restart"].includes(phase));
await expect
  .poll(
    async () => {
      try {
        return (await fetch("http://127.0.0.1:9223/json/version")).ok;
      } catch {
        return false;
      }
    },
    { timeout: 20000 },
  )
  .toBe(true);
const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
await expect
  .poll(
    () =>
      browser
        .contexts()
        .flatMap((context) => context.pages())
        .some((page) => page.url().includes("1420")),
    { timeout: 20000 },
  )
  .toBe(true);
const page = browser
  .contexts()[0]
  .pages()
  .find((p) => p.url().includes("1420"));
assert(page);
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
const fixture = await page.evaluate(async (phase) => {
  const call = window.__TAURI_INTERNALS__.invoke;
  const campaigns = await call("list_campaigns");
  if (
    campaigns.length &&
    (campaigns.length !== 1 || campaigns[0].name !== "Collaudo GUI e Markdown")
  )
    throw Error("Profile is not an isolated UI fixture; no writes performed.");
  if (phase === "restart" && !campaigns.length)
    throw Error("Missing fixture after restart.");
  const campaign =
    campaigns[0] ??
    (await call("create_campaign", { name: "Collaudo GUI e Markdown" }));
  let pages = await call("list_pages", { campaignId: campaign.id });
  if (!pages.length) {
    const page = await call("create_page", {
      campaignId: campaign.id,
      title: "Varek",
      kind: "npc",
      status: "active",
      aliases: [],
    });
    pages = [page];
    for (let i = 1; i <= 35; i++)
      await call("create_page", {
        campaignId: campaign.id,
        title: `Voce di collaudo ${i}`,
        kind: "note",
        status: "stub",
        aliases: [],
      });
  }
  let sessions = await call("list_sessions", { campaignId: campaign.id });
  if (!sessions.length) {
    const session = await call("create_session", {
      campaignId: campaign.id,
      sequence: 1,
      title: "Indizio del viandante",
      playedOn: null,
    });
    await call("save_document", {
      campaignId: campaign.id,
      id: session.id,
      revision: 0,
      document: {
        version: 1,
        blocks: [
          {
            id: "qa-source-block",
            type: "paragraph",
            props: { textAlignment: "center", textColor: "red" },
            content: [
              {
                type: "text",
                text: "Abbiamo incontrato ",
                styles: { underline: true, backgroundColor: "yellow" },
              },
              {
                type: "pageMention",
                props: { pageId: pages[0].id, label: pages[0].title },
              },
            ],
            children: [],
          },
        ],
      },
    });
    for (let i = 2; i <= 40; i++)
      await call("create_session", {
        campaignId: campaign.id,
        sequence: i,
        title: `Sessione di collaudo ${i}`,
        playedOn: null,
      });
  }
  return { campaign };
}, phase);
await page.reload();
await page.getByRole("button", { name: "Journal", exact: true }).click();
await page
  .locator(".session-list button")
  .filter({ hasText: "Indizio del viandante" })
  .click();
await page.getByRole("toolbar", { name: "Note commands" }).waitFor();
await mkdir(".tools/ui-refresh", { recursive: true });
if (phase === "check") {
  const windows = [];
  for (const [width, height] of [
    [1586, 992],
    [900, 700],
    [760, 540],
  ]) {
    await page.setViewportSize({ width, height });
    const state = await page.evaluate(() => {
      const list = document.querySelector(".session-list");
      list.scrollTop = 900;
      return {
        width: innerWidth,
        height: innerHeight,
        scroll: list.scrollTop,
        body: document.scrollingElement.scrollTop,
        overflow: document.documentElement.scrollWidth > innerWidth,
        font: document.fonts.check('18px "Chronexus Text"'),
      };
    });
    assert(state.scroll > 0 && !state.body && !state.overflow && state.font);
    windows.push(state);
  }
  await page.setViewportSize({ width: 1586, height: 992 });
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  const source = page.getByRole("textbox", { name: "Markdown source" });
  const markdown = await source.inputValue();
  assert(markdown.includes("chronexus://page/"));
  await source.fill(
    markdown +
      "\n\n## Verifica Markdown\n\n- **Indizio persistente**\n- [x] Controllato\n",
  );
  await page
    .getByRole("button", { name: "Apply and return to visual mode" })
    .click();
  await page.getByRole("button", { name: "Save now", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved on the computer" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  const good = await source.inputValue();
  await source.fill(good + "\n\n```js\nalert(1)\n```");
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  await expect(source).toBeVisible();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(source).toHaveValue(/```js/);
  await page.getByRole("button", { name: "Discard Markdown changes" }).click();
  await page.getByRole("button", { name: "Codex", exact: true }).click();
  const codexScroll = await page
    .getByRole("navigation", { name: "Codex pages" })
    .evaluate((e) => {
      e.scrollTop = 900;
      return e.scrollTop;
    });
  assert(codexScroll > 0);
  await page
    .getByRole("button", { name: "Campaign settings", exact: true })
    .click();
  await expect(
    page
      .getByRole("navigation", { name: "Campaign views" })
      .getByRole("button", { name: "Campaign settings" }),
  ).toHaveCount(0);
  await writeFile(
    ".tools/ui-refresh/qa-windows.json",
    JSON.stringify(windows, null, 2),
  );
}
const saved = await page.evaluate(
  async (campaignId) =>
    (
      await window.__TAURI_INTERNALS__.invoke("list_sessions", { campaignId })
    ).find((s) => s.sequence === 1),
  fixture.campaign.id,
);
assert(JSON.stringify(saved.document).includes("Indizio persistente"));
const original = saved.document.blocks[0];
assert.equal(original.id, "qa-source-block");
assert.equal(original.props.textAlignment, "center");
assert.equal(original.content[0].styles.underline, true);
assert.equal(original.content[0].styles.backgroundColor, "yellow");
assert.equal(original.content[1].type, "pageMention");
await page.getByRole("button", { name: "Journal", exact: true }).click();
await page
  .locator(".session-list button")
  .filter({ hasText: "Indizio del viandante" })
  .click();
await expect(page.locator(".note-sheet")).toContainText("Indizio persistente");
await page.screenshot({ path: `.tools/ui-refresh/editor-${phase}.png` });
assert.deepEqual(pageErrors, []);
await writeFile(
  `.tools/ui-refresh/qa-${phase}.json`,
  JSON.stringify({ phase, checks: "PASS", pageErrors }, null, 2),
);
console.log(
  `PASS ${phase}: editor, UUID, source IDs, visual formats, SQLite${phase === "check" ? ", windows, scrolling, navigation guard and settings" : " after restart"}.`,
);
// Disconnect without closing the native application (consistent with the AI harness).
process.exit(0);
