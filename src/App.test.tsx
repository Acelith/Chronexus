import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, vi, test, expect } from "vitest";
import { App } from "./App";
import { api, type Session } from "./features/journal/api";
import { knowledgeApi, type KnowledgePage } from "./features/knowledge/api";
import { backupApi } from "./features/backup/api";

vi.mock("./features/backup/api", () => ({
  backupApi: {
    create: vi.fn(),
    inspect: vi.fn(),
    restore: vi.fn(),
    cancel: vi.fn(),
  },
  BACKUP_STATUS_EVENT: "chronexus:backup-status",
  backupFolderApi: {
    list: vi.fn(async () => ({ folders: [], backups: [], truncated: false })),
    tick: vi.fn(),
  },
}));

vi.mock("./features/journal/api", async (original) => ({
  ...(await original<typeof import("./features/journal/api")>()),
  api: {
    campaigns: vi.fn(),
    sessions: vi.fn(),
    createCampaign: vi.fn(),
    renameCampaign: vi.fn(),
    createSession: vi.fn(),
    save: vi.fn(),
  },
}));
const flush = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("./features/knowledge/api", async (original) => ({
  ...(await original<typeof import("./features/knowledge/api")>()),
  knowledgeApi: {
    pages: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    save: vi.fn(),
    backlinks: vi.fn(),
    recover: vi.fn(),
  },
}));
vi.mock("./features/journal/Editor", async () => {
  const { useEffect } = await import("react");
  function TestEditor({ register }: { register: (guard: unknown) => void }) {
    useEffect(() => {
      register({ flush, dirty: () => true });
      return () => register(null);
    }, [register]);
    return <div>Test editor</div>;
  }
  return { default: TestEditor };
});

const session: Session = {
  id: "s1",
  campaignId: "a",
  sequence: 1,
  title: "The bridge",
  playedOn: null,
  document: { version: 1, blocks: [] },
  revision: 0,
  updatedAt: "2026-10-23",
};

beforeEach(() => {
  vi.clearAllMocks();
  flush.mockResolvedValue(undefined);
  vi.mocked(api.campaigns).mockResolvedValue([]);
  vi.mocked(api.sessions).mockResolvedValue([]);
  vi.mocked(knowledgeApi.pages).mockResolvedValue([]);
  vi.mocked(knowledgeApi.backlinks).mockResolvedValue([]);
});

test("creates a campaign from the empty state and renames it", async () => {
  const user = userEvent.setup();
  vi.mocked(api.createCampaign).mockResolvedValue({
    id: "a",
    name: "The ashes",
  });
  vi.mocked(api.renameCampaign).mockResolvedValue({
    id: "a",
    name: "The stars",
  });
  render(<App />);
  expect(
    screen.getByRole("heading", { name: "Chronexus" }),
  ).toBeInTheDocument();
  await user.click(
    await screen.findByRole("button", { name: "Create campaign" }),
  );
  await user.type(screen.getByLabelText("Campaign name"), "The ashes");
  await user.click(screen.getByRole("button", { name: "Create campaign" }));
  expect(
    await screen.findByRole("heading", { name: "The ashes" }),
  ).toBeInTheDocument();
  expect(api.createCampaign).toHaveBeenCalledWith("The ashes");
  await user.click(screen.getByRole("button", { name: "Rename campaign" }));
  await user.clear(screen.getByLabelText("Campaign name"));
  await user.type(screen.getByLabelText("Campaign name"), "The stars");
  await user.click(screen.getByRole("button", { name: "Save name" }));
  expect(
    await screen.findByRole("heading", { name: "The stars" }),
  ).toBeInTheDocument();
});

const knowledgePage: KnowledgePage = {
  id: "p1",
  campaignId: "a",
  title: "Varek",
  kind: "npc",
  status: "stub",
  aliases: ["The merchant"],
  document: { version: 1, blocks: [] },
  revision: 0,
  updatedAt: "2026-10-23",
};

test("opening backup waits for notes and stays in the editor if saving fails", async () => {
  const user = userEvent.setup();
  vi.mocked(api.campaigns).mockResolvedValue([{ id: "a", name: "Campagna" }]);
  vi.mocked(api.sessions).mockResolvedValue([session]);
  render(<App />);
  await screen.findByText("Test editor");
  flush.mockRejectedValueOnce(new Error("Unsaved notes"));
  await user.click(screen.getByRole("button", { name: "Backup and restore" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unsaved notes");
  expect(screen.getByText("Test editor")).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Backup and restore" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Backup and restore" }));
  expect(
    await screen.findByRole("heading", { name: "Backup and restore" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Test editor")).not.toBeInTheDocument();
});

test("restoring into an empty archive updates the campaign bar and opens restored documents", async () => {
  const user = userEvent.setup();
  const counts = {
    campaigns: 1,
    sessions: 1,
    pages: 0,
    mentions: 0,
    relationships: 0,
    attachments: 0,
  };
  vi.mocked(backupApi.inspect).mockResolvedValue({
    token: "verified",
    fileName: "recupero.nodex",
    manifest: {
      format_version: 1,
      app_version: "0.1.0",
      created_at: "2026-10-23T10:00:00Z",
      schema_version: 4,
      scope: "all_campaigns",
      counts,
    },
  });
  vi.mocked(backupApi.restore).mockImplementation(async () => {
    vi.mocked(api.campaigns).mockResolvedValue([
      { id: "a", name: "Campagna recuperata" },
    ]);
    vi.mocked(api.sessions).mockResolvedValue([session]);
    return { safetyPath: "C:/backup/before.nodex", counts, warning: null };
  });
  render(<App />);
  await screen.findByRole("button", { name: "Create campaign" });
  await user.click(screen.getByRole("button", { name: "Backup and restore" }));
  await user.click(
    await screen.findByRole("button", {
      name: "Select backup",
    }),
  );
  await screen.findByRole("alertdialog");
  await user.click(screen.getByRole("button", { name: "New campaign" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Confirm or cancel",
  );
  await user.click(
    await screen.findByRole("button", {
      name: "Replace archive",
    }),
  );
  await screen.findByRole("region", { name: "Restore completed" });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Current campaign" }),
    "a",
  );
  expect(await screen.findByText("Test editor")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "The bridge" })).toBeInTheDocument();
});

test("creates a typed page and renames it while keeping the Codex open", async () => {
  const user = userEvent.setup();
  vi.mocked(api.campaigns).mockResolvedValue([{ id: "a", name: "Campagna" }]);
  vi.mocked(knowledgeApi.create).mockResolvedValue(knowledgePage);
  const updated = {
    ...knowledgePage,
    title: "Varek the Grey",
    status: "active" as const,
    aliases: ["Varek", "The merchant"],
  };
  vi.mocked(knowledgeApi.update).mockResolvedValue(updated);
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "Codex" }));
  await user.click(await screen.findByRole("button", { name: "New page" }));
  await user.type(screen.getByLabelText("Page title"), "Varek");
  await user.selectOptions(screen.getByLabelText("Type"), "npc");
  await user.selectOptions(screen.getByLabelText("Status"), "stub");
  await user.type(
    screen.getByLabelText("Aliases (one per line, up to 20)"),
    "The merchant",
  );
  await user.click(screen.getByRole("button", { name: "Create page" }));
  expect(
    await screen.findByRole("heading", { name: "Varek" }),
  ).toBeInTheDocument();
  expect(knowledgeApi.create).toHaveBeenCalledWith("a", {
    title: "Varek",
    kind: "npc",
    status: "stub",
    aliases: ["The merchant"],
  });
  await user.click(screen.getByRole("button", { name: "Edit page" }));
  await user.clear(screen.getByLabelText("Page title"));
  await user.type(screen.getByLabelText("Page title"), "Varek the Grey");
  await user.selectOptions(screen.getByLabelText("Status"), "active");
  await user.click(screen.getByRole("button", { name: "Save page" }));
  expect(
    await screen.findByRole("heading", { name: "Varek the Grey" }),
  ).toBeInTheDocument();
});

test("a backlink opens the source session after saving", async () => {
  const user = userEvent.setup();
  vi.mocked(api.campaigns).mockResolvedValue([{ id: "a", name: "Campagna" }]);
  vi.mocked(api.sessions).mockResolvedValue([session]);
  vi.mocked(knowledgeApi.pages).mockResolvedValue([knowledgePage]);
  vi.mocked(knowledgeApi.backlinks).mockResolvedValue([
    {
      sourceKind: "session",
      sourceId: "s1",
      sourceTitle: "The bridge",
      sequence: 1,
      blockId: "b1",
      preview: "I met Varek",
    },
  ]);
  render(<App />);
  await screen.findByText("Test editor");
  await user.click(screen.getByRole("button", { name: "Codex" }));
  await user.click(
    await screen.findByRole("button", { name: /I met Varek/ }),
  );
  expect(
    await screen.findByRole("heading", { name: "The bridge" }),
  ).toBeInTheDocument();
  expect(flush).toHaveBeenCalled();
});

test("creates a session with a number, title and optional date", async () => {
  const user = userEvent.setup();
  vi.mocked(api.campaigns).mockResolvedValue([{ id: "a", name: "Campagna" }]);
  vi.mocked(api.createSession).mockResolvedValue(session);
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: /\+ New session/ }),
  );
  await user.type(screen.getByLabelText("Session title"), "The bridge");
  await user.click(screen.getByRole("button", { name: "Create session" }));
  expect(api.createSession).toHaveBeenCalledWith("a", 1, "The bridge", null);
  expect(await screen.findByText("Test editor")).toBeInTheDocument();
});

test("a write error blocks switching campaigns and preserves the open note", async () => {
  const user = userEvent.setup();
  vi.mocked(api.campaigns).mockResolvedValue([
    { id: "a", name: "Campagna A" },
    { id: "b", name: "Campagna B" },
  ]);
  vi.mocked(api.sessions).mockResolvedValue([session]);
  render(<App />);
  await screen.findByText("Test editor");
  flush.mockRejectedValue(new Error("Disk full: riprova."));
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Current campaign" }),
    "b",
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Disk full");
  expect(
    screen.getByRole("heading", { name: "Campagna A" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "The bridge" })).toBeInTheDocument();
  expect(api.sessions).toHaveBeenCalledTimes(1);
});

test("a startup error explains how to retry without showing fake data", async () => {
  const user = userEvent.setup();
  vi.mocked(api.campaigns).mockRejectedValueOnce(
    new Error("Archive unavailable"),
  );
  render(<App />);
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Archive unavailable");
  await user.click(within(alert).getByRole("button", { name: "Try again" }));
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
  expect(
    await screen.findByRole("button", { name: "Create campaign" }),
  ).toBeInTheDocument();
});
