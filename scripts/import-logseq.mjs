// Operator-only preparation against an isolated debug profile. No direct SQL.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import {
  readFile,
  readdir,
  lstat,
  realpath,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { metadata, references, normalizeName, convert } from "./logseq.mjs";
const [sourceArgument, campaignName, characterFile] = process.argv.slice(2);
assert(
  sourceArgument && campaignName,
  "Usage: node scripts/import-logseq.mjs source-folder campaign-name [private-character.json]",
);
const source = await realpath(sourceArgument),
  workspace = await realpath(".tools");
assert(
  source.startsWith(workspace + path.sep),
  "Use an extracted source folder inside .tools",
);
async function files(directory) {
  const out = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const file = path.join(directory, entry.name);
    const info = await lstat(file);
    assert(!info.isSymbolicLink(), "No source symlinks");
    if (entry.isDirectory()) out.push(...(await files(file)));
    else if (entry.isFile()) out.push(file);
  }
  return out;
}
const sourceFiles = [];
for (const folder of ["pages", "journals"]) {
  try {
    sourceFiles.push(
      ...(await files(path.join(source, folder))).filter((p) =>
        p.endsWith(".md"),
      ),
    );
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
assert(sourceFiles.length > 0 && sourceFiles.length <= 2000);
const records = [];
for (const file of sourceFiles.sort()) {
  const originalBytes = await readFile(file);
  const raw = originalBytes.toString("utf8");
  assert(
    Buffer.from(raw, "utf8").equals(originalBytes),
    "Source Markdown must be valid UTF-8",
  );
  assert(Buffer.byteLength(raw) <= 2_000_000);
  records.push({
    file,
    name: path.relative(source, file).split(path.sep).join("/"),
    raw,
    meta: metadata(raw, path.basename(file, ".md")),
  });
}
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
let page;
await expect
  .poll(
    () => {
      page = browser
        .contexts()
        .flatMap((c) => c.pages())
        .find((p) => p.url().includes("127.0.0.1:1420"));
      return !!page;
    },
    { timeout: 20000 },
  )
  .toBe(true);
const invoke = (name, args) =>
  page.evaluate(
    ({ name, args }) => window.__TAURI_INTERNALS__.invoke(name, args),
    { name, args },
  );
const report = {
  formatVersion: 1,
  pages: 0,
  sessions: 0,
  stubPages: 0,
  images: 0,
  originalSources: 0,
  character: false,
  assets: 0,
  warnings: [],
  sourceFiles: [],
};
const mentions = new Map(),
  aliases = new Map(),
  imageJobs = [];
const sourceIds = {};
try {
  assert.deepEqual(
    await invoke("list_campaigns"),
    [],
    "Use a fresh isolated test profile, never the personal archive",
  );
  const campaign = await invoke("create_campaign", { name: campaignName });
  report.campaignId = campaign.id;
  for (const record of records) {
    assert(record.meta.title.length <= 200);
    const p = await invoke("create_page", {
      campaignId: campaign.id,
      title: record.meta.title,
      kind: record.meta.kind,
      status: "active",
      aliases: [],
    });
    record.page = p;
    mentions.set(normalizeName(p.title), p.id);
    sourceIds[record.name] = p.id;
    report.pages++;
  }
  for (const record of records) {
    const accepted = [];
    for (const alias of record.meta.aliases) {
      if (alias.length > 200) continue;
      const key = normalizeName(alias);
      if (mentions.has(key) && mentions.get(key) !== record.page.id) {
        report.warnings.push(
          `Alias preserved in text but not registered because it matches a title: ${alias}`,
        );
        continue;
      }
      const matches = aliases.get(key) ?? new Set();
      matches.add(record.page.id);
      aliases.set(key, matches);
      accepted.push(alias);
    }
    if (accepted.length) {
      record.page = await invoke("update_page", {
        campaignId: campaign.id,
        id: record.page.id,
        title: record.page.title,
        kind: record.page.kind,
        status: "active",
        aliases: accepted.slice(0, 20),
      });
    }
  }
  function resolve(name) {
    const key = normalizeName(name);
    if (mentions.has(key)) return mentions.get(key);
    const matches = aliases.get(key);
    return matches?.size === 1 ? [...matches][0] : null;
  }
  for (const record of records) {
    for (const name of references(record.raw)) {
      if (resolve(name)) continue;
      const candidates = aliases.get(normalizeName(name));
      if (candidates?.size > 1) {
        report.warnings.push(`Ambiguous reference preserved as text: ${name}`);
        continue;
      }
      if (!name || name.length > 200) {
        report.warnings.push(
          "Reference with an oversized title preserved as text.",
        );
        continue;
      }
      const p = await invoke("create_page", {
        campaignId: campaign.id,
        title: name,
        kind: "note",
        status: "stub",
        aliases: [],
      });
      mentions.set(normalizeName(name), p.id);
      report.stubPages++;
    }
  }
  for (const record of records) {
    const parsed = convert(record.raw, resolve);
    report.warnings.push(...parsed.warnings.map((w) => `${record.name}: ${w}`));
    const match = record.meta.title.match(/^Sessione\s+(\d+)\b/i);
    let target = { kind: "page", id: record.page.id };
    if (match) {
      const number = Number(match[1]);
      assert(number >= 1 && number <= 999999);
      const date =
        record.raw.match(/^date::\s*(\d{4}-\d{2}-\d{2})\s*$/m)?.[1] ?? null;
      const session = await invoke("create_session", {
        campaignId: campaign.id,
        sequence: number,
        title: record.meta.title,
        playedOn: date,
      });
      parsed.document.blocks.unshift({
        id: randomUUID(),
        type: "paragraph",
        props: {},
        children: [],
        content: [
          { type: "text", text: "Session index: ", styles: {} },
          {
            type: "pageMention",
            props: { pageId: record.page.id, label: record.page.title },
          },
        ],
      });
      await invoke("save_document", {
        campaignId: campaign.id,
        id: session.id,
        revision: 0,
        document: parsed.document,
      });
      target = { kind: "session", id: session.id };
      report.sessions++;
      const hub = {
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
                text: "The original notes for this session are in the Journal. Open the session backlink below to reach them. This page preserves title-based Logseq links.",
                styles: {},
              },
            ],
          },
        ],
      };
      await invoke("save_page_document", {
        campaignId: campaign.id,
        id: record.page.id,
        revision: 0,
        document: hub,
      });
    } else {
      await invoke("save_page_document", {
        campaignId: campaign.id,
        id: record.page.id,
        revision: 0,
        document: parsed.document,
      });
    }
    await invoke("add_import_source", {
      campaignId: campaign.id,
      kind: target.kind,
      id: target.id,
      name: record.name,
      content: record.raw,
    });
    report.originalSources++;
    report.sourceFiles.push({
      name: record.name,
      sourceId: target.id,
      sourceKind: target.kind,
      sha256: createHash("sha256").update(record.raw).digest("hex"),
    });
    for (const ref of parsed.imageRefs) {
      try {
        const url = decodeURIComponent(ref.url.trim().replace(/^<|>$/g, ""));
        if (/^[a-z]+:/i.test(url))
          throw Error("Remote image was not downloaded");
        const file = path.resolve(path.dirname(record.file), url);
        const actual = await realpath(file);
        assert(actual.startsWith(path.join(source, "assets") + path.sep));
        imageJobs.push({
          file: actual,
          target: { kind: "page", id: record.page.id },
          caption: ref.caption || path.basename(actual),
          role:
            record.meta.kind === "npc"
              ? "portrait"
              : record.meta.kind === "place"
                ? "map"
                : "image",
        });
      } catch (e) {
        report.warnings.push(
          `${record.name}: unresolved image (${ref.url}): ${e.message}`,
        );
      }
    }
  }
  const allAssets = await files(path.join(source, "assets"));
  const used = new Set(imageJobs.map((j) => j.file));
  const unused = allAssets.filter(
    (f) => /\.(png|jpe?g|webp)$/i.test(f) && !used.has(f),
  );
  if (unused.length) {
    const p = await invoke("create_page", {
      campaignId: campaign.id,
      title: "Imported image archive",
      kind: "note",
      status: "active",
      aliases: [],
    });
    for (const file of unused)
      imageJobs.push({
        file,
        target: { kind: "page", id: p.id },
        caption: path.basename(file),
        role: "reference",
      });
    report.pages++;
  }
  if (characterFile) {
    const seed = JSON.parse(await readFile(characterFile, "utf8"));
    const input = {
      ...seed.character,
      stats: (seed.character.stats ?? []).map((s) => ({
        ...s,
        id: s.id ?? randomUUID(),
      })),
      resources: (seed.character.resources ?? []).map((r) => ({
        ...r,
        id: r.id ?? randomUUID(),
      })),
    };
    if (input.sheet?.attacks)
      input.sheet.attacks = input.sheet.attacks.map((a) => ({
        ...a,
        id: a.id ?? randomUUID(),
      }));
    const pc = await invoke("save_character", {
      campaignId: campaign.id,
      id: null,
      revision: null,
      input,
    });
    report.character = true;
    for (const entry of seed.assets ?? []) {
      const pageId = entry.pageTitle ? resolve(entry.pageTitle) : null;
      await invoke("save_player_asset", {
        campaignId: campaign.id,
        characterId: pc.id,
        id: null,
        revision: null,
        input: {
          details: entry.details,
          links: {
            pageId,
            sourceSessionId: null,
            sourceBlockId: null,
            npcId: null,
            placeId: null,
            questId: null,
            provenanceNotes:
              entry.provenanceNotes ??
              "Transcribed from the sheet provided by the user.",
          },
        },
      });
      report.assets++;
    }
    for (const photo of seed.photos ?? [])
      imageJobs.push({
        file: path.resolve(photo.path),
        target: { kind: "character", id: pc.id },
        caption: photo.caption,
        role: "reference",
      });
  }
  for (const job of imageJobs) {
    const data = await readFile(job.file);
    assert(data.length <= 20 * 1024 * 1024);
    await invoke("add_image", {
      campaignId: campaign.id,
      target: job.target,
      caption: job.caption.slice(0, 200),
      role: job.role,
      dataBase64: data.toString("base64"),
    });
    report.images++;
  }
  report.warnings = [...new Set(report.warnings)];
  const summary = await invoke("create_page", {
    campaignId: campaign.id,
    title: "Logseq import report",
    kind: "note",
    status: "active",
    aliases: [],
  });
  const text = `Imported ${report.pages} pages, ${report.sessions} sessions, ${report.stubPages} drafts and ${report.images} images. ${report.originalSources} original Markdown files preserved as read-only with SHA-256. Session index pages open the Journal through backlinks; no factual relationship was inferred.\n\n${report.warnings.length ? report.warnings.join("\n") : "No conversion warnings."}\n\nThe photographed sheet is a partial manual transcription: unclear or missing values are not reconstructed using formulas. Always consult the original photos attached to the sheet.`;
  await invoke("save_page_document", {
    campaignId: campaign.id,
    id: summary.id,
    revision: 0,
    document: {
      version: 1,
      blocks: [
        {
          id: randomUUID(),
          type: "paragraph",
          props: {},
          children: [],
          content: [{ type: "text", text, styles: {} }],
        },
      ],
    },
  });
  await invoke("rebuild_search_index");
  await writeFile(
    ".tools/speratia-import-report.json",
    JSON.stringify(report, null, 2),
  );
  await page.reload();
  console.log(
    JSON.stringify({
      pages: report.pages + report.stubPages + 1,
      sessions: report.sessions,
      images: report.images,
      originalSources: report.originalSources,
      assets: report.assets,
      warnings: report.warnings.length,
    }),
  );
} finally {
  await browser.close();
}
