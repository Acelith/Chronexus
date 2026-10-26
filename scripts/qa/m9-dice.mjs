// Native M9 acceptance. Only an explicitly isolated debug profile is accepted.
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename, stat } from "node:fs/promises";
assert.equal(
  process.env.CHRONEXUS_DICE_QA,
  "isolated",
  "Launch an isolated NODEX_DEV_DATA_DIR profile and set CHRONEXUS_DICE_QA=isolated.",
);
const phase = process.argv[2] ?? "check";
assert(["check", "restart", "restore"].includes(phase));
const output = ".tools/m9";
await mkdir(output, { recursive: true });
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
        .flatMap((c) => c.pages())
        .some((p) => p.url().includes("1420")),
    { timeout: 20000 },
  )
  .toBe(true);
const page = browser
  .contexts()[0]
  .pages()
  .find((p) => p.url().includes("1420"));
assert(page);
await page.context().setOffline(false);
await page.setViewportSize({ width: 1586, height: 992 });
await page.bringToFront();
const errors = [],
  remoteRequests = [];
page.on("pageerror", (error) => errors.push(error.message));
const localHosts = new Set([
  "127.0.0.1",
  "localhost",
  "ipc.localhost",
  "asset.localhost",
]);
page.on("request", (request) => {
  if (
    /^https?:/.test(request.url()) &&
    !localHosts.has(new URL(request.url()).hostname)
  )
    remoteRequests.push(request.url());
});
await page
  .context()
  .route(/^https?:/, (route) =>
    localHosts.has(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
const call = (name, args = {}) =>
  page.evaluate(
    ({ name, args }) => window.__TAURI_INTERNALS__.invoke(name, args),
    { name, args },
  );
let campaigns = await call("list_campaigns");
assert(
  campaigns.length <= 2 &&
    campaigns.every((c) => c.name.startsWith("Collaudo M9")),
  "Refusing non-fixture campaigns.",
);
let campaign = campaigns.find((c) => !c.name.endsWith("separata"));
if (!campaign) {
  assert.equal(phase, "check");
  campaign = await call("create_campaign", {
    name: "Collaudo M9 — Il cerchio dei draghi",
  });
}
async function all(campaignId) {
  const result = [];
  let before = null;
  do {
    const page = await call("list_dice_rolls", { campaignId, before });
    result.push(...page.rolls);
    before = page.nextCursor;
  } while (before);
  return result;
}
async function openDice() {
  await page.reload();
  await page.getByRole("button", { name: "Dice roller", exact: true }).click();
  await page.locator(".dice-composer").waitFor();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}
function validate(roll) {
  assert(roll.groups.length > 0);
  let total = 0;
  for (const group of roll.groups) {
    assert.equal(group.values.length, group.quantity);
    assert(
      group.values.every(
        (v) => Number.isInteger(v) && v >= 1 && v <= group.sides,
      ),
    );
    assert.equal(
      group.subtotal,
      group.values.reduce((sum, v) => sum + v, 0),
    );
    total += group.subtotal;
  }
  assert.equal(roll.total, total);
}
async function compareDetails(roll) {
  const detail = page.locator(".dice-current-detail");
  await detail.locator("summary").click();
  for (const group of roll.groups) {
    const values = await detail
      .getByRole("list", { name: `d${group.sides} results`, exact: true })
      .getByRole("listitem")
      .allTextContents();
    assert.deepEqual(values.map(Number), group.values);
  }
  assert.equal(
    Number(await detail.locator(".roll-total strong").innerText()),
    roll.total,
  );
  await detail.locator("summary").click();
}
async function rollUi(selections, { capture = false, skip = false } = {}) {
  const previous = await page
    .locator(".dice-scene")
    .getAttribute("data-roll-id");
  for (const selection of selections)
    await page
      .getByRole("spinbutton", {
        name: `Number of d${selection.sides}`,
        exact: true,
      })
      .fill(String(selection.quantity));
  await page
    .getByRole("button", { name: "Roll the dice", exact: true })
    .click();
  await expect
    .poll(() => page.locator(".dice-scene").getAttribute("data-roll-id"))
    .not.toBe(previous);
  const id = await page.locator(".dice-scene").getAttribute("data-roll-id");
  assert(id);
  const scene = page.locator(`.dice-scene[data-roll-id="${id}"]`);
  if (capture) {
    await page.locator('.dice-scene[data-phase="burn"]').waitFor();
    await page.screenshot({ path: `${output}/fire.png` });
  }
  if (skip)
    await page
      .getByRole("button", { name: "Skip animation", exact: true })
      .click();
  await expect(scene).toHaveAttribute("data-phase", "finished", {
    timeout: 6000,
  });
  const roll = (await all(campaign.id)).find((r) => r.id === id);
  assert(roll);
  validate(roll);
  assert.deepEqual(
    roll.groups.map((g) => ({ sides: g.sides, quantity: g.quantity })),
    selections.toSorted((a, b) => a.sides - b.sides),
  );
  for (const sides of [4, 6, 8, 10, 12, 20, 100])
    await expect(
      page.getByRole("spinbutton", {
        name: `Number of d${sides}`,
        exact: true,
      }),
    ).toHaveValue("0");
  const shown = await scene.locator(".thrown-die").evaluateAll((nodes) =>
    nodes.map((node) => ({
      sides: Number(
        node.querySelector(".thrown-die-kind").textContent.slice(1),
      ),
      value: Number(node.querySelector(".die-value").textContent),
    })),
  );
  for (const group of roll.groups) {
    const actual = shown
      .filter((v) => v.sides === group.sides)
      .map((v) => v.value);
    assert.deepEqual(actual, group.values.slice(0, actual.length));
    assert(actual.length > 0);
  }
  assert.equal(
    shown.length,
    Math.min(
      14,
      roll.groups.reduce((sum, g) => sum + g.quantity, 0),
    ),
  );
  await compareDetails(roll);
  return roll;
}
await openDice();
if (phase === "check") {
  const cases = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  const audit = await new AxeBuilder({ page })
    .include(".dice-workspace")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  await writeFile(`${output}/axe-empty.json`, JSON.stringify(audit, null, 2));
  assert.deepEqual(audit.violations, []);
  for (const sides of [4, 6, 8, 10, 12, 20, 100])
    cases.push((await rollUi([{ sides, quantity: 2 }])).id);
  // Measure rendered phase deadlines rather than assuming timers equal real duration.
  await page.evaluate(() => {
    window.__m9phases = [];
    let previous = "";
    new MutationObserver(() => {
      const scene = document.querySelector(".dice-scene");
      const key = scene?.dataset.rollId + ":" + scene?.dataset.phase;
      if (scene && key !== previous) {
        previous = key;
        window.__m9phases.push({
          id: scene.dataset.rollId,
          phase: scene.dataset.phase,
          time: performance.now(),
        });
      }
    }).observe(document.body, {
      subtree: true,
      attributes: true,
      childList: true,
    });
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const single = await rollUi([{ sides: 20, quantity: 1 }]);
  const mixed = await rollUi(
    [4, 6, 8, 10, 12, 20, 100].map((sides) => ({ sides, quantity: 1 })),
    { capture: true },
  );
  await page.screenshot({ path: `${output}/all-types.png` });
  const many = await rollUi([
    { sides: 20, quantity: 50 },
    { sides: 100, quantity: 50 },
  ]);
  await page.screenshot({ path: `${output}/many.png` });
  const phases = await page.evaluate(() => window.__m9phases);
  const durations = [single, mixed, many].map((roll) => {
    const states = phases.filter((p) => p.id === roll.id);
    const duration =
      states.find((p) => p.phase === "finished").time -
      states.find((p) => p.phase === "rolling").time;
    assert(duration >= 2300 && duration <= 3300, `Duration ${duration}ms`);
    return {
      id: roll.id,
      count: roll.groups.reduce((n, g) => n + g.quantity, 0),
      duration,
    };
  });
  const skipped = await rollUi([{ sides: 6, quantity: 3 }], { skip: true });
  assert(skipped.id);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await rollUi([{ sides: 100, quantity: 1 }]);
  await expect(
    page.getByText(
      "Reduced motion: results shown without rolling, flames or scrolling numbers.",
      { exact: true },
    ),
  ).toBeVisible();
  // An interrupted scene must be available after returning to the dice view.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page
    .getByRole("spinbutton", { name: "Quantity d8", exact: true })
    .fill("2");
  await page
    .getByRole("button", { name: "Roll the dice", exact: true })
    .click();
  await expect
    .poll(() => page.locator(".dice-scene").getAttribute("data-roll-id"))
    .not.toBe(reduced.id);
  const interrupted = await page
    .locator(".dice-scene")
    .getAttribute("data-roll-id");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Dice roller", exact: true }).click();
  await page.locator(".dice-history-list").waitFor();
  assert((await all(campaign.id)).some((r) => r.id === interrupted));
  // Idempotent retry and invalid payloads exercise real commands, not a mock transport.
  const requestId = randomUUID();
  const args = {
    campaignId: campaign.id,
    requestId,
    selections: [{ sides: 100, quantity: 2 }],
  };
  const first = await call("roll_dice", args);
  assert.deepEqual(await call("roll_dice", args), first);
  for (const selections of [
    [],
    [{ sides: 6, quantity: -1 }],
    [{ sides: 6, quantity: 51 }],
    [{ sides: 20, quantity: 1.5 }],
    [
      { sides: 6, quantity: 50 },
      { sides: 20, quantity: 50 },
      { sides: 100, quantity: 1 },
    ],
  ]) {
    await assert.rejects(() =>
      call("roll_dice", {
        campaignId: campaign.id,
        requestId: randomUUID(),
        selections,
      }),
    );
  }
  let other = campaigns.find((c) => c.name.endsWith("separata"));
  if (!other)
    other = await call("create_campaign", { name: "Collaudo M9 — separata" });
  assert(!(await all(other.id)).some((r) => r.campaignId === campaign.id));
  await assert.rejects(() =>
    call("roll_dice", { ...args, campaignId: other.id }),
  );
  if (!(await all(other.id)).length)
    await call("roll_dice", {
      campaignId: other.id,
      requestId: randomUUID(),
      selections: [{ sides: 4, quantity: 1 }],
    });
  for (let i = 0; i < 32; i++)
    await call("roll_dice", {
      campaignId: campaign.id,
      requestId: randomUUID(),
      selections: [{ sides: 6, quantity: 1 }],
    });
  await openDice();
  for (
    let pages = 0;
    await page
      .getByRole("button", { name: "Load earlier rolls", exact: true })
      .count();
    pages++
  ) {
    assert(pages < 20);
    await page
      .getByRole("button", { name: "Load earlier rolls", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Opening history…",
        exact: true,
      }),
    ).toHaveCount(0);
  }
  const records = await all(campaign.id);
  for (const record of records) validate(record);
  await expect(page.getByLabel(/^Tiro del/)).toHaveCount(records.length);
  const windows = [];
  for (const [width, height] of [
    [1586, 992],
    [1200, 800],
    [900, 700],
    [760, 540],
  ]) {
    await page.setViewportSize({ width, height });
    const bounds = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
      bodyScroll: document.scrollingElement.scrollTop,
    }));
    assert(!bounds.overflow && !bounds.bodyScroll);
    windows.push(bounds);
    await page.screenshot({ path: `${output}/viewport-${width}.png` });
  }
  await page.setViewportSize({ width: 1586, height: 992 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const final = await rollUi([
    { sides: 20, quantity: 2 },
    { sides: 6, quantity: 3 },
    { sides: 100, quantity: 1 },
  ]);
  await page.screenshot({ path: `${output}/final.png` });
  const finalAudit = await new AxeBuilder({ page })
    .include(".dice-workspace")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  await writeFile(
    `${output}/axe-result.json`,
    JSON.stringify(finalAudit, null, 2),
  );
  assert.deepEqual(finalAudit.violations, []);
  try {
    await stat(`${output}/qa.nodex`);
    await rename(
      `${output}/qa.nodex`,
      `${output}/previous-${Date.now()}.nodex`,
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const backup = await call("create_backup");
  assert(
    backup &&
      backup.counts.diceRolls ===
        (await all(campaign.id)).length + (await all(other.id)).length,
  );
  try {
    await stat(`${output}/export.zip`);
    await rename(
      `${output}/export.zip`,
      `${output}/previous-export-${Date.now()}.zip`,
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const exported = await call("export_campaign", { campaignId: campaign.id });
  assert(exported);
  const report = {
    campaignId: campaign.id,
    otherId: other.id,
    count: (await all(campaign.id)).length,
    otherCount: (await all(other.id)).length,
    last: final,
    durations,
    windows,
    cases,
    interrupted,
    backup,
    exported,
    remoteRequests,
    errors,
  };
  assert.deepEqual(errors, []);
  assert.deepEqual(remoteRequests, []);
  await writeFile(
    `${output}/native-check.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(
    `PASS native check: ${report.count} tiri, tutti i tipi, valori e totali reali, skip/interruzione/reduced, isolamento, paginazione, finestre, backup ed export. Timeline: ${durations.map((d) => Math.round(d.duration)).join("/")} ms. Axe: 0 violazioni rilevate.`,
  );
} else {
  const report = JSON.parse(
    await readFile(`${output}/native-check.json`, "utf8"),
  );
  assert.equal(campaign.id, report.campaignId);
  if (phase === "restore") {
    await call("roll_dice", {
      campaignId: campaign.id,
      requestId: randomUUID(),
      selections: [{ sides: 4, quantity: 1 }],
    });
    assert.equal((await all(campaign.id)).length, report.count + 1);
    await page
      .getByRole("button", { name: "Backup and restore", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Select backup", exact: true })
      .click();
    await page.getByRole("alertdialog").waitFor();
    await page
      .getByRole("button", { name: "Replace archive", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Restore completed", exact: true })
      .waitFor();
  }
  assert.equal((await all(campaign.id)).length, report.count);
  assert.equal((await all(report.otherId)).length, report.otherCount);
  const last = (await all(campaign.id)).find((r) => r.id === report.last.id);
  assert.deepEqual(last, report.last);
  await openDice();
  await expect(page.getByLabel(/^Tiro del/)).toHaveCount(
    Math.min(30, report.count),
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/native-${phase}.json`,
    JSON.stringify(
      { phase, count: report.count, id: report.last.id, result: "PASS" },
      null,
      2,
    ),
  );
  console.log(
    `PASS native ${phase}: history and results unchanged, ${report.count} campaign rolls.`,
  );
}
process.exit(0);
