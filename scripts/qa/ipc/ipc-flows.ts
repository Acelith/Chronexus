// Main desktop flows through the real Tauri IPC of a debug build. It uses the
// app's own API modules, so argument shapes match the shipped frontend.
// Only a synthetic campaign in an isolated NODEX_DEV_DATA_DIR profile is used.
import { invoke } from "@tauri-apps/api/core";
import { api, type JournalDocument } from "../../../src/features/journal/api";
import { knowledgeApi } from "../../../src/features/knowledge/api";
import { defaultQuery, graphApi } from "../../../src/features/graph/api";
import {
  emptyAsset,
  emptyCharacter,
  playerApi,
} from "../../../src/features/player/api";
import { backupApi } from "../../../src/features/backup/api";
import { diceApi } from "../../../src/features/dice/api";

type Step = { step: string; ok: boolean; detail: string; ms: number };
const steps: Step[] = [];
const log = document.getElementById("log")!;

async function check(step: string, run: () => Promise<string | void>) {
  const start = performance.now();
  try {
    const detail = (await run()) ?? "";
    steps.push({ step, ok: true, detail, ms: performance.now() - start });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    steps.push({ step, ok: false, detail, ms: performance.now() - start });
  }
  log.textContent = steps
    .map((s) => `${s.ok ? "PASS" : "FAIL"} ${s.step} ${s.detail}`)
    .join("\n");
  await report(false);
}
/** Posted after every step, so a hang still shows how far the flows got. */
async function report(done: boolean) {
  const failed = steps.filter((s) => !s.ok).length;
  await fetch("/report", {
    method: "POST",
    body: JSON.stringify(
      { userAgent: navigator.userAgent, done, failed, steps },
      null,
      2,
    ),
  });
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}
const block = (id: string, content: unknown[]) => ({
  id,
  type: "paragraph",
  props: {},
  content,
  children: [],
});
const text = (value: string) => ({ type: "text", text: value, styles: {} });

/** Large incompressible PNG so a backup holds the Store lock measurably long. */
async function noisePng(size: number): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  const pixels = context.createImageData(size, size);
  crypto.getRandomValues(pixels.data.subarray(0, 65536));
  for (let i = 65536; i < pixels.data.length; i += 65536)
    crypto.getRandomValues(
      pixels.data.subarray(i, Math.min(i + 65536, pixels.data.length)),
    );
  for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = 255;
  context.putImageData(pixels, 0, 0);
  const blob = await new Promise<Blob>((done) =>
    canvas.toBlob((b) => done(b!), "image/png"),
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}

async function main() {
  let campaignId = "";
  let sessionId = "";
  let pageId = "";
  let otherPageId = "";
  await check("empty isolated profile", async () => {
    const campaigns = await api.campaigns();
    assert(campaigns.length === 0, "profile is not empty: use a new folder");
  });
  await check("create and rename campaign", async () => {
    const campaign = await api.createCampaign("IPC synthetic campaign");
    campaignId = campaign.id;
    const renamed = await api.renameCampaign(campaignId, "IPC campaign");
    assert(renamed.name === "IPC campaign", "rename not applied");
  });
  await check("sessions keep order and reject duplicates", async () => {
    await api.createSession(campaignId, 2, "Second", null);
    const first = await api.createSession(campaignId, 1, "First", "2026-10-26");
    sessionId = first.id;
    const sessions = await api.sessions(campaignId);
    assert(sessions.map((s) => s.sequence).join() === "1,2", "order");
    const duplicate = await api
      .createSession(campaignId, 1, "Again", null)
      .then(() => "")
      .catch((e: Error) => e.message);
    assert(duplicate.includes("session number"), `duplicate: ${duplicate}`);
  });
  await check("pages, rename alias and mention backlinks", async () => {
    const page = await knowledgeApi.create(campaignId, {
      title: "Varek",
      kind: "npc",
      status: "active",
      aliases: ["Keeper"],
    });
    pageId = page.id;
    const other = await knowledgeApi.create(campaignId, {
      title: "Guild",
      kind: "faction",
      status: "stub",
      aliases: [],
    });
    otherPageId = other.id;
    const meta = {
      title: page.title,
      kind: page.kind,
      status: page.status,
      aliases: page.aliases,
    };
    const renamed = await knowledgeApi.update(
      campaignId,
      pageId,
      { ...meta, title: "Varek the Old" },
      meta,
    );
    assert(renamed.aliases.includes("Varek"), "old title kept as alias");
    const session = (await api.sessions(campaignId)).find(
      (s) => s.id === sessionId,
    )!;
    const document = {
      version: 1,
      blocks: [
        block("b1", [
          text("Claims "),
          {
            type: "pageMention",
            props: { pageId, label: "Varek the Old" },
          },
          text(" knows the guild."),
        ]),
      ],
    } as unknown as JournalDocument;
    const saved = await api.save(session, session.revision, document);
    assert(saved.revision === session.revision + 1, "revision");
    const stale = await api
      .save(session, session.revision, document)
      .then(() => "")
      .catch((e: Error) => e.message);
    assert(stale.includes("changed elsewhere"), `stale save: ${stale}`);
    const backlinks = await knowledgeApi.backlinks(campaignId, pageId);
    assert(backlinks.length === 1 && backlinks[0].blockId === "b1", "backlink");
    const pages = await knowledgeApi.pages(campaignId);
    assert(pages.length === 2, "pages listed");
  });
  await check("search finds note text and renamed page", async () => {
    const hits = await invoke<{ kind: string }[]>("search_campaign", {
      campaignId,
      query: "guild",
      kind: null,
      sort: "relevance",
    });
    assert(
      hits.some((h) => h.kind === "session"),
      "session hit",
    );
    const alias = await invoke<{ kind: string }[]>("search_campaign", {
      campaignId,
      query: "Keeper",
      kind: "page",
      sort: "recent",
    });
    assert(alias.length >= 1, "alias hit");
    const rebuilt = await invoke<number>("rebuild_search_index");
    assert(rebuilt > 0, "rebuild");
  });
  await check("relationship with source and graph edges", async () => {
    const relationship = await graphApi.save(campaignId, {
      fromPageId: pageId,
      toPageId: otherPageId,
      label: "claims membership",
      certainty: "suspected",
      sourceKind: "session",
      sourceId: sessionId,
      sourceBlockId: "b1",
      evidence: "He says so.",
      notes: "",
    });
    assert(relationship.sourceAvailable, "source available");
    const graph = await graphApi.graph(campaignId, defaultQuery);
    const kinds = new Set(graph.edges.map((e) => e.kind));
    assert(kinds.has("assertion") && kinds.has("mention"), "edge kinds");
    await graphApi.remove(campaignId, relationship);
  });
  let characterId = "";
  await check("character sheet, counter and assets", async () => {
    const input = emptyCharacter();
    input.name = "Oran";
    const character = await playerApi.saveCharacter(campaignId, null, input);
    characterId = character.id;
    const item = emptyAsset("item", input.systemId);
    if (item.details.kind === "item") item.details.name = "Brass key";
    const asset = await playerApi.saveAsset(
      campaignId,
      characterId,
      null,
      item,
    );
    const assets = await playerApi.assets(campaignId, characterId);
    assert(assets.length === 1, "asset listed");
    await playerApi.deleteAsset(asset);
  });
  await check("party member keeps the Codex page", async () => {
    const member = await invoke<{ page: { id: string } }>("save_party_member", {
      campaignId,
      input: {
        pageId: null,
        name: "Mirna",
        playerName: "",
        role: "Bard",
        status: "active",
        revision: null,
      },
    });
    const members = await invoke<unknown[]>("list_party", { campaignId });
    assert(members.length === 1 && member.page.id, "member");
  });
  await check("dice roll and history", async () => {
    const roll = await diceApi.roll(campaignId, crypto.randomUUID(), [
      { sides: 20, quantity: 2 },
    ]);
    const history = await diceApi.history(campaignId);
    assert(
      history.rolls.some((r) => r.id === roll.id),
      "history",
    );
  });
  await check("interface preferences and wiki provider", async () => {
    const preferences = await invoke<Record<string, unknown>>(
      "get_interface_preferences",
    );
    const saved = await invoke<Record<string, unknown>>(
      "save_interface_preferences",
      { preferences: { ...preferences, locale: "it" } },
    );
    assert(saved.locale === "it", "locale saved");
    await invoke("save_interface_preferences", { preferences });
    const provider = await invoke<{ provider: string }>("get_wiki_provider");
    assert(["wikidot", "open5e"].includes(provider.provider), "provider");
  });
  await check("sharing stays local until explicitly configured", async () => {
    const account = await invoke<{ server: string | null; signedIn: boolean }>(
      "sync_account",
    );
    assert(!account.server && !account.signedIn, "no server by default");
    assert((await invoke("sync_link", { campaignId })) === null, "unlinked");
    const http = await invoke("sync_set_server", {
      server: "http://example.org",
    })
      .then(() => "")
      .catch((e: unknown) => String(e));
    assert(http.includes("HTTPS"), `plain HTTP refused: ${http}`);
    const connect = await invoke("sync_connect_campaign", {
      campaignId,
      inviteCode: null,
    })
      .then(() => "")
      .catch((e: unknown) => String(e));
    assert(connect.includes("server first"), `needs a server: ${connect}`);
  });
  let images = 0;
  await check("images: import, list, thumbnail", async () => {
    for (let i = 0; i < 3; i++) {
      await invoke("add_image", {
        campaignId,
        target: { kind: "page", id: pageId },
        caption: `Noise ${i}`,
        role: "image",
        dataBase64: await noisePng(1400),
      });
    }
    const list = await invoke<{ id: string }[]>("list_images", {
      campaignId,
      target: { kind: "page", id: pageId },
    });
    images = list.length;
    const thumb = await invoke<string>("read_image", {
      campaignId,
      id: list[0].id,
      thumbnail: true,
    });
    assert(thumb.startsWith("data:image/png;base64,"), "thumbnail");
    return `${images} images`;
  });
  await check("UI thread stays responsive during a backup", async () => {
    // While the backup holds the Store lock, a command that needs no lock must
    // still answer quickly; archive commands queue on the blocking pool.
    const started = performance.now();
    const backup = backupApi.create();
    await new Promise((done) => setTimeout(done, 30));
    const listing = invoke("list_campaigns");
    const latencies: number[] = [];
    let finished = false;
    void backup.finally(() => (finished = true));
    while (!finished) {
      const t = performance.now();
      await invoke("wiki_cache_epoch");
      latencies.push(performance.now() - t);
      await new Promise((done) => setTimeout(done, 20));
    }
    const receipt = await backup;
    await listing;
    assert(receipt, "backup written");
    const worst = Math.max(0, ...latencies);
    // Before async archive commands the main thread waited for the whole backup.
    assert(worst < 250, `main thread blocked for ${worst.toFixed(0)} ms`);
    const total = performance.now() - started;
    return `backup ${total.toFixed(0)} ms; ${latencies.length} pings; worst ${worst.toFixed(0)} ms`;
  });
  await check("export campaign", async () => {
    const receipt = await invoke<{ path: string } | null>("export_campaign", {
      campaignId,
    });
    assert(receipt?.path, "export written");
  });
  await check("restore backup into a new generation", async () => {
    const preview = await backupApi.inspect();
    assert(preview, "preview");
    assert(preview.manifest.counts.attachments === images, "attachments");
    const receipt = await backupApi.restore(preview.token);
    assert(receipt.safetyPath, "safety copy");
    const campaigns = await api.campaigns();
    assert(campaigns.length === 1, "campaign restored");
    const backlinks = await knowledgeApi.backlinks(campaignId, pageId);
    assert(backlinks.length === 1, "backlinks after restore");
  });
  await check("concurrent commands all settle", async () => {
    const calls = Array.from({ length: 40 }, (_, i) =>
      i % 2
        ? knowledgeApi.pages(campaignId)
        : invoke("search_campaign", {
            campaignId,
            query: "Varek",
            kind: null,
            sort: "relevance",
          }),
    );
    const results = await Promise.allSettled(calls);
    assert(
      results.every((r) => r.status === "fulfilled"),
      "a concurrent command failed",
    );
  });
  await report(true);
  log.textContent += "\nDONE";
}
void main();
