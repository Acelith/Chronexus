// Multi-device sharing scenario through the real Tauri IPC of debug builds (docs/QA.md).
// Three roles run at the same time against one HTTPS test deployment:
//   owner  – creates the campaign, shares part of it, invites the player;
//   player – another account that joins and shares a page of its own;
//   owner2 – a second computer of the owner's account.
// Roles meet through the coordinator board (board.mjs). Synthetic data only, in an
// isolated NODEX_DEV_DATA_DIR profile.
import { api, type JournalDocument } from "../../../src/features/journal/api";
import {
  knowledgeApi,
  type KnowledgePage,
} from "../../../src/features/knowledge/api";
import { syncApi, type RemoteItem } from "../../../src/features/sync/api";

declare const __SYNC_ROLE__: "owner" | "player" | "owner2";
declare const __SYNC_SERVER__: string;
const role = __SYNC_ROLE__;
const server = __SYNC_SERVER__;
const password = "synthetic-sync-password-2026";

type Step = { step: string; ok: boolean; detail: string; ms: number };
const steps: Step[] = [];
const log = document.getElementById("log")!;
let failed = false;

async function check(step: string, run: () => Promise<string | void>) {
  if (failed) {
    steps.push({ step, ok: false, detail: "skipped after a failure", ms: 0 });
    return;
  }
  const start = performance.now();
  try {
    const detail = (await run()) ?? "";
    steps.push({ step, ok: true, detail, ms: performance.now() - start });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    steps.push({ step, ok: false, detail, ms: performance.now() - start });
    failed = true;
    await put(`${role}.failed`, { step, detail });
  }
  log.textContent = steps
    .map((s) => `${s.ok ? "PASS" : "FAIL"} ${s.step} ${s.detail}`)
    .join("\n");
  await report(false);
}
async function report(done: boolean) {
  await fetch(`/report/${role}`, {
    method: "POST",
    body: JSON.stringify(
      {
        role,
        userAgent: navigator.userAgent,
        done,
        failed: steps.filter((s) => !s.ok).length,
        steps,
      },
      null,
      2,
    ),
  });
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function put(key: string, value: unknown) {
  await fetch(`/board/${key}`, { method: "PUT", body: JSON.stringify(value) });
}
/** Waits for another role's step; a failure there stops this role too. */
async function wait<T>(key: string, timeoutMs = 240_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const response = await fetch(`/board/${key}?wait=20000`);
    if (response.status === 200) return (await response.json()) as T;
    for (const other of ["owner", "player", "owner2"]) {
      const broken = await fetch(`/board/${other}.failed`);
      if (broken.status === 200)
        throw Error(`${other} failed: ${JSON.stringify(await broken.json())}`);
    }
  }
  throw Error(`timed out waiting for ${key}`);
}
async function op(name: string): Promise<string> {
  const response = await fetch(`/op/${name}`, { method: "POST" });
  const value = (await response.json()) as { result?: string; error?: string };
  if (!response.ok) throw Error(`${name}: ${value.error}`);
  return value.result ?? "";
}
/** Polls until `test` passes, so asynchronous replication gets time to arrive. */
async function until<T>(
  what: string,
  probe: () => Promise<T>,
  test: (value: T) => boolean,
  timeoutMs = 60_000,
): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  let value = await probe();
  while (!test(value)) {
    if (performance.now() - start > timeoutMs)
      throw Error(`${what}: not reached in ${timeoutMs / 1000} s`);
    await sleep(250);
    value = await probe();
  }
  return { value, ms: Math.round(performance.now() - start) };
}

const doc = (marker: string) =>
  ({
    version: 1,
    blocks: [
      {
        id: `b-${marker}`,
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: marker, styles: {} }],
        children: [],
      },
    ],
  }) as unknown as JournalDocument;
const has = (value: unknown, marker: string) =>
  JSON.stringify(value).includes(marker);
const titled = (items: RemoteItem[], title: string) =>
  items.find((i) => i.kind === "page" && i.payload?.title === title);
async function page(campaignId: string, title: string): Promise<KnowledgePage> {
  const found = (await knowledgeApi.pages(campaignId)).find(
    (p) => p.title === title,
  );
  assert(found, `page ${title} missing`);
  return found;
}
async function write(campaignId: string, title: string, marker: string) {
  const current = await page(campaignId, title);
  await knowledgeApi.save(current, current.revision, doc(marker));
}

async function connect(device: string) {
  await check("empty isolated profile", async () => {
    assert((await api.campaigns()).length === 0, "use a new profile folder");
  });
  await check("HTTPS test server accepted", async () => {
    const account = await syncApi.setServer(server);
    assert(account.server === new URL(server).origin, account.server ?? "");
    return account.server!;
  });
  return device;
}

async function owner() {
  const device = await connect("owner-mac");
  let campaignId = "";
  let remoteId = "";
  await check("account from a server invitation", async () => {
    const code = await op("server-invite");
    const account = await syncApi.redeem(
      code,
      "owner-qa",
      "Owner QA",
      password,
      device,
    );
    assert(account.signedIn && account.username === "owner-qa", "signed in");
    await put("owner.credentials", { username: "owner-qa", password });
  });
  await check("campaign with shared, private and local pages", async () => {
    campaignId = (await api.createCampaign("Sync QA")).id;
    await api.createSession(campaignId, 1, "Arrival", null);
    for (const [title, marker] of [
      ["Shared Tower", "tower-v1"],
      ["Private Diary", "diary-v1"],
      ["Local Only", "local-v1"],
    ]) {
      const created = await knowledgeApi.create(campaignId, {
        title,
        kind: "place",
        status: "active",
        aliases: [],
      });
      await knowledgeApi.save(created, created.revision, doc(marker));
    }
  });
  await check("connect creates the server campaign", async () => {
    const link = await syncApi.connect(campaignId, null);
    assert(link.role === "owner", link.role);
    remoteId = link.remoteId;
  });
  await check("choose per-item scope and synchronize", async () => {
    const pages = await knowledgeApi.pages(campaignId);
    const id = (title: string) => pages.find((p) => p.title === title)!.id;
    await syncApi.setScope(campaignId, "page", id("Shared Tower"), "shared");
    await syncApi.setScope(campaignId, "page", id("Private Diary"), "private");
    await syncApi.setScope(campaignId, "page", id("Local Only"), "none");
    const report = await syncApi.now(campaignId);
    assert(report.pushed >= 2, `pushed ${report.pushed}`);
    const items = await syncApi.items(campaignId);
    const status = (title: string) =>
      items.find((i) => i.kind === "page" && i.title === title)?.status;
    assert(
      status("Shared Tower") === "synced",
      `shared ${status("Shared Tower")}`,
    );
    assert(
      status("Private Diary") === "synced",
      `private ${status("Private Diary")}`,
    );
    assert(status("Local Only") === "private", `local ${status("Local Only")}`);
    return JSON.stringify(report);
  });
  await check("invite the player", async () => {
    const invite = await syncApi.invite(campaignId, "player");
    await put("campaign.invite", { code: invite.code, remoteId });
  });
  await check("continuous synchronization on", async () => {
    const link = await syncApi.setAuto(campaignId, true, false);
    assert(link.auto && !link.paused, "auto");
  });
  await check("player's shared page arrives, attributed", async () => {
    await wait("player.shared");
    const { value, ms } = await until(
      "player page",
      () => syncApi.remote(campaignId),
      (items) => !!titled(items, "Player Clue"),
    );
    const item = titled(value, "Player Clue")!;
    assert(!item.mine && item.authorName === "Player QA", item.authorName);
    const local = await knowledgeApi.pages(campaignId);
    assert(!local.some((p) => p.title === "Player Clue"), "never a local page");
    return `${ms} ms`;
  });
  await check("edit of a shared page reaches the player", async () => {
    await write(campaignId, "Shared Tower", "tower-v2");
    await put("owner.edited", { at: Date.now() });
    const seen = await wait<{ ms: number }>("player.sawEdit");
    return `player saw it ${seen.ms} ms after the save`;
  });
  await check("second device of the same account", async () => {
    await wait("owner2.attached");
  });
  await check("concurrent edit: this device saves first", async () => {
    await wait("owner2.editedOffline");
    await write(campaignId, "Private Diary", "diary-owner");
    const report = await syncApi.now(campaignId);
    assert(report.conflicts === 0, `conflicts ${report.conflicts}`);
    await put("owner.pushedDiary", true);
  });
  await check("conflict resolved on the other device arrives", async () => {
    await wait("owner2.resolved");
    const { ms } = await until(
      "resolved diary",
      async () => {
        await syncApi.now(campaignId).catch(() => null);
        return page(campaignId, "Private Diary");
      },
      (p) => has(p.document, "diary-owner2"),
    );
    return `${ms} ms`;
  });
  await check("stop sharing a page (revocation)", async () => {
    const id = (await page(campaignId, "Shared Tower")).id;
    await syncApi.setScope(campaignId, "page", id, "private");
    await syncApi.now(campaignId);
    await put("owner.unshared", true);
    await wait("player.revoked");
  });
  await check(
    "offline edit stays local and is sent after reconnection",
    async () => {
      await syncApi.setAuto(campaignId, true, true);
      await op("proxy-stop");
      try {
        await write(campaignId, "Private Diary", "diary-offline");
        const failure = await syncApi
          .now(campaignId)
          .then(() => "")
          .catch((e: unknown) => String(e));
        assert(failure, "a pass without the server must fail");
        const status = await syncApi.status(campaignId);
        assert(status.pending >= 1, `pending ${status.pending}`);
        assert(
          has(await page(campaignId, "Private Diary"), "diary-offline"),
          "local save kept",
        );
      } finally {
        await op("proxy-start");
      }
      await syncApi.setAuto(campaignId, true, false);
      const { value, ms } = await until(
        "realigned",
        () => syncApi.status(campaignId),
        (s) => s.state === "saved" && s.pending === 0,
        90_000,
      );
      await put("owner.offlineSent", true);
      return `${value.state} after ${ms} ms`;
    },
  );
  await check("second device receives the offline edit", async () => {
    await wait("owner2.sawOffline");
  });
  const player = async () => {
    const members = await syncApi.members(campaignId);
    const found = members.find((m) => m.displayName === "Player QA");
    assert(found, `members ${JSON.stringify(members)}`);
    return found;
  };
  await check("member list and role change reach the player", async () => {
    const members = await syncApi.members(campaignId);
    assert(members.length === 2, `members ${members.length}`);
    const before = await player();
    assert(before.role === "player", before.role);
    await syncApi.changeMember(
      campaignId,
      before.accountId,
      "reader",
      before.revision,
    );
    await put("owner.reader", true);
    await wait("player.readerOk");
    const reader = await player();
    await syncApi.changeMember(
      campaignId,
      reader.accountId,
      "player",
      reader.revision,
    );
    await put("owner.player", true);
    await wait("player.writerOk");
  });
  await check("player leaves; its shared page is withdrawn here", async () => {
    await wait("player.left");
    const { ms } = await until(
      "withdrawn",
      async () => {
        await syncApi.now(campaignId);
        return syncApi.remote(campaignId);
      },
      (items) => !titled(items, "Player Clue"),
    );
    assert((await syncApi.members(campaignId)).length === 1, "left");
    return `${ms} ms`;
  });
  await check("owner removes the re-invited player", async () => {
    const invite = await syncApi.invite(campaignId, "player");
    await put("campaign.invite2", { code: invite.code });
    await wait("player.rejoined");
    const again = await player();
    const left = await syncApi.removeMember(
      campaignId,
      again.accountId,
      again.revision,
    );
    assert(left.length === 1, `members ${left.length}`);
    await put("owner.removed", true);
    await wait("player.lostAccess");
  });
}

async function player() {
  const device = await connect("player-linux");
  let campaignId = "";
  await check("account from a server invitation", async () => {
    const code = await op("server-invite");
    const account = await syncApi.redeem(
      code,
      "player-qa",
      "Player QA",
      password,
      device,
    );
    assert(account.signedIn, "signed in");
  });
  await check("join with the campaign invitation", async () => {
    const invite = await wait<{ code: string }>("campaign.invite");
    campaignId = (await api.createCampaign("Joined QA")).id;
    const link = await syncApi.connect(campaignId, invite.code);
    assert(link.role === "player", link.role);
  });
  await check("only the shared page is visible", async () => {
    await syncApi.now(campaignId);
    const items = await syncApi.remote(campaignId);
    const tower = titled(items, "Shared Tower");
    assert(
      tower && !tower.mine && tower.authorName === "Owner QA",
      "shared page",
    );
    assert(has(tower.payload, "tower-v1"), "shared text");
    assert(!titled(items, "Private Diary"), "private page leaked");
    assert(!titled(items, "Local Only"), "local page leaked");
    assert(
      !has(items, "diary-v1") && !has(items, "local-v1"),
      "private text leaked",
    );
    return `${items.length} visible item(s)`;
  });
  await check("share a page of its own", async () => {
    const created = await knowledgeApi.create(campaignId, {
      title: "Player Clue",
      kind: "lore",
      status: "active",
      aliases: [],
    });
    await knowledgeApi.save(created, created.revision, doc("clue-v1"));
    await syncApi.setScope(campaignId, "page", created.id, "shared");
    const report = await syncApi.now(campaignId);
    assert(report.pushed >= 1, `pushed ${report.pushed}`);
    await put("player.shared", true);
  });
  await check(
    "continuous synchronization receives the owner's edit",
    async () => {
      await syncApi.setAuto(campaignId, true, false);
      const edited = await wait<{ at: number }>("owner.edited");
      await until(
        "tower-v2",
        () => syncApi.remote(campaignId),
        (items) => has(titled(items, "Shared Tower")?.payload, "tower-v2"),
      );
      const ms = Date.now() - edited.at;
      await put("player.sawEdit", { ms });
      return `${ms} ms after the owner's save`;
    },
  );
  await check("unshared page disappears", async () => {
    await wait("owner.unshared");
    const { ms } = await until(
      "revoked",
      () => syncApi.remote(campaignId),
      (items) => !titled(items, "Shared Tower"),
    );
    await put("player.revoked", true);
    return `${ms} ms`;
  });
  await check(
    "demoted to reader: role learnt, edits wait locally",
    async () => {
      await wait("owner.reader");
      await syncApi.setAuto(campaignId, false, false);
      await write(campaignId, "Player Clue", "clue-reader");
      const report = await syncApi.now(campaignId);
      assert(report.pushed === 0, `pushed ${report.pushed}`);
      const link = await syncApi.link(campaignId);
      assert(link?.role === "reader", `role ${link?.role}`);
      const status = await syncApi.status(campaignId);
      assert(status.pending >= 1, `pending ${status.pending}`);
      await put("player.readerOk", true);
    },
  );
  await check("promoted again: the waiting edit is sent", async () => {
    await wait("owner.player");
    const report = await syncApi.now(campaignId);
    assert(report.pushed >= 1, `pushed ${report.pushed}`);
    assert((await syncApi.link(campaignId))?.role === "player", "player again");
    await put("player.writerOk", true);
  });
  await check("leave the campaign", async () => {
    const link = await syncApi.leave(campaignId);
    assert(link.accessLost && !link.auto, JSON.stringify(link));
    assert(
      (await syncApi.remote(campaignId)).length === 0,
      "received copies cleared",
    );
    assert(
      has(await page(campaignId, "Player Clue"), "clue-reader"),
      "own page kept",
    );
    await put("player.left", true);
  });
  await check("join again, then removed by the owner", async () => {
    const invite = await wait<{ code: string }>("campaign.invite2");
    await syncApi.unlink(campaignId);
    await syncApi.connect(campaignId, invite.code);
    await syncApi.now(campaignId);
    assert(
      titled(await syncApi.remote(campaignId), "Shared Tower") === undefined,
      "still private",
    );
    await put("player.rejoined", true);
    await wait("owner.removed");
    const failure = await syncApi
      .now(campaignId)
      .then(() => "")
      .catch((e: unknown) => String(e));
    assert(failure.includes("no longer have access"), failure);
    const link = await syncApi.link(campaignId);
    assert(link?.accessLost, "access lost shown");
    assert(
      has(await page(campaignId, "Player Clue"), "clue-reader"),
      "own page kept",
    );
    await put("player.lostAccess", true);
  });
}

async function owner2() {
  const device = await connect("owner-linux");
  let campaignId = "";
  await check("sign in to the same account", async () => {
    const credentials = await wait<{ username: string; password: string }>(
      "owner.credentials",
    );
    const account = await syncApi.signIn(
      credentials.username,
      credentials.password,
      device,
    );
    assert(account.signedIn, "signed in");
  });
  await check("attach the server campaign", async () => {
    await wait("campaign.invite");
    const remote = await syncApi.remoteCampaigns();
    const found = remote.find((c) => c.name === "Sync QA");
    assert(found, `campaign list: ${JSON.stringify(remote)}`);
    campaignId = (await syncApi.attach(found.id)).id;
    await syncApi.now(campaignId);
    const titles = (await knowledgeApi.pages(campaignId)).map((p) => p.title);
    assert(titles.includes("Shared Tower"), `pages ${titles}`);
    assert(titles.includes("Private Diary"), `private copy: ${titles}`);
    assert(!titles.includes("Local Only"), "a never-synchronized page arrived");
    assert(
      !titles.includes("Player Clue"),
      "another member's page became local",
    );
    assert(has(await page(campaignId, "Private Diary"), "diary-v1"), "text");
    await put("owner2.attached", true);
  });
  await check("conflict shown with both versions and resolved", async () => {
    await write(campaignId, "Private Diary", "diary-owner2");
    await put("owner2.editedOffline", true);
    await wait("owner.pushedDiary");
    const report = await syncApi.now(campaignId);
    assert(report.conflicts >= 1, `conflicts ${JSON.stringify(report)}`);
    const conflicts = await syncApi.conflicts(campaignId);
    const diary = conflicts.find((c) => c.title === "Private Diary");
    assert(diary, `conflicts ${JSON.stringify(conflicts)}`);
    assert(
      has(diary.local, "diary-owner2") && has(diary.remote, "diary-owner"),
      "both",
    );
    const left = await syncApi.resolve(
      campaignId,
      "page",
      diary.itemId,
      "local",
    );
    assert(left.length === 0, "resolved");
    const after = await syncApi.now(campaignId);
    assert(after.conflicts === 0, `after ${JSON.stringify(after)}`);
    await put("owner2.resolved", true);
  });
  await check("offline edit of the other device arrives", async () => {
    await wait("owner.offlineSent");
    await syncApi.setAuto(campaignId, true, false);
    const { ms } = await until(
      "diary-offline",
      () => page(campaignId, "Private Diary"),
      (p) => has(p.document, "diary-offline"),
    );
    await put("owner2.sawOffline", true);
    return `${ms} ms`;
  });
}

(async () => {
  await (role === "owner" ? owner() : role === "player" ? player() : owner2());
  await report(true);
  log.textContent += "\nDONE";
})();
