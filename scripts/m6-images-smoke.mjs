import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
// Procedural test fixture only; no personal imagery is stored in the repository.
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type),
    size = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, crc]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(2);
header.writeUInt32BE(2, 4);
header[8] = 8;
header[9] = 2;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", header),
  chunk(
    "IDAT",
    deflateSync(
      Buffer.from([
        0, 30, 50, 70, 70, 90, 100, 0, 110, 120, 130, 160, 170, 180,
      ]),
    ),
  ),
  chunk("IEND", Buffer.alloc(0)),
]);
await writeFile(".tools/m6-image-fixture.png", png);
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
const b = await chromium.connectOverCDP("http://127.0.0.1:9223");
let p;
await expect
  .poll(
    () => {
      p = b
        .contexts()
        .flatMap((c) => c.pages())
        .find((p) => p.url().includes("1420"));
      return !!p;
    },
    { timeout: 20000 },
  )
  .toBe(true);
const invoke = (name, args) =>
  p.evaluate(
    ({ name, args }) => window.__TAURI_INTERNALS__.invoke(name, args),
    { name, args },
  );
const click = (name) => p.getByRole("button", { name, exact: true }).click();
try {
  assert.equal(
    (await invoke("list_campaigns")).length,
    0,
    "Use a fresh test profile",
  );
  const campaign = await invoke("create_campaign", {
    name: "M6 immagini e ricerca",
  });
  const page = await invoke("create_page", {
    campaignId: campaign.id,
    title: "Mappa della costa",
    kind: "place",
    status: "active",
    aliases: ["Costa"],
  });
  const session = await invoke("create_session", {
    campaignId: campaign.id,
    sequence: 12,
    title: "La costa",
    playedOn: null,
  });
  await invoke("save_document", {
    campaignId: campaign.id,
    id: session.id,
    revision: 0,
    document: {
      version: 1,
      blocks: [
        {
          id: "m6-source",
          type: "paragraph",
          props: {},
          content: [
            {
              type: "text",
              text: "La chiave corallina si trova sulla costa.",
              styles: {},
            },
          ],
          children: [],
        },
      ],
    },
  });
  await p.reload();
  await click(campaign.name);
  await click("Codex");
  await p
    .getByRole("navigation", { name: "Codex pages", exact: true })
    .getByRole("button", { name: /Mappa della costa/ })
    .click();
  await p.getByText("Immagini (0)", { exact: true }).click();
  await p.getByLabel("Image caption", { exact: true }).fill("Costa illustrata");
  await p.getByLabel("Image type", { exact: true }).selectOption("map");
  await p
    .getByLabel("Add image", { exact: true })
    .setInputFiles(".tools/m6-image-fixture.png");
  await expect(
    p.getByRole("button", {
      name: "Open image: Costa illustrata",
      exact: true,
    }),
  ).toBeVisible();
  const images = await invoke("list_images", {
    campaignId: campaign.id,
    target: { kind: "page", id: page.id },
  });
  assert.equal(images.length, 1);
  assert.equal(images[0].size, png.length);
  await p
    .getByRole("button", {
      name: "Open image: Costa illustrata",
      exact: true,
    })
    .click();
  await expect(p.getByRole("dialog")).toBeVisible();
  await p.getByLabel("Image zoom", { exact: true }).selectOption("200");
  await p.keyboard.press("Escape");
  await click("Search the campaign");
  await p.getByLabel("Text to search", { exact: true }).fill("corallina");
  await p
    .getByRole("dialog")
    .getByRole("button", { name: /La costa/ })
    .click();
  await expect(p.locator('[data-id="m6-source"]').first()).toBeVisible();
  await click("Backup and restore");
  await click("Create backup");
  await expect(
    p.getByRole("region", { name: "Backup created", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await p.screenshot({ path: ".tools/m6-images-backup.png", fullPage: true });
  await invoke("plugin:window|close", { label: "main" }).catch(() => {});
  console.log(
    "PASS real file input, Rust image copy/preview/zoom, exact search block and portable backup",
  );
} finally {
  await b.close();
}
