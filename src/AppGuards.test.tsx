import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { App } from "./App";
import { api, type Session } from "./features/journal/api";
import { knowledgeApi } from "./features/knowledge/api";

const external = vi.hoisted(() => ({
  refresh: undefined as undefined | (() => Promise<boolean>),
}));
vi.mock("./features/journal/useExternalUpdates", () => ({
  useExternalUpdates: (
    _id: unknown,
    _can: unknown,
    refresh: () => Promise<boolean>,
  ) => {
    external.refresh = refresh;
  },
}));
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
      register({ flush: async () => undefined, dirty: () => false });
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
  vi.mocked(api.campaigns).mockResolvedValue([]);
  vi.mocked(api.sessions).mockResolvedValue([]);
  vi.mocked(knowledgeApi.pages).mockResolvedValue([]);
  vi.mocked(knowledgeApi.backlinks).mockResolvedValue([]);
});

test("a late refresh of the previous campaign never replaces the new campaign's lists", async () => {
  const user = userEvent.setup();
  vi.mocked(api.campaigns).mockResolvedValue([
    { id: "a", name: "Campaign A" },
    { id: "b", name: "Campaign B" },
  ]);
  const noteA = { ...session, id: "a-note", title: "A original" };
  const noteB = {
    ...session,
    id: "b-note",
    campaignId: "b",
    title: "B legitimate",
  };
  let resolveOld!: (value: Session[]) => void;
  vi.mocked(api.sessions).mockResolvedValueOnce([noteA]);
  render(<App />);
  await screen.findByRole("heading", { name: "A original" });
  vi.mocked(api.sessions).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  const pending = external.refresh!();
  vi.mocked(api.sessions).mockResolvedValueOnce([noteB]);
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Current campaign" }),
    "b",
  );
  await screen.findByRole("heading", { name: "B legitimate" });
  await act(async () => {
    resolveOld([{ ...noteA, title: "A stale refresh" }]);
    await pending;
  });
  expect(
    screen.getByRole("heading", { name: "B legitimate" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("A stale refresh")).not.toBeInTheDocument();
});

test("an unsaved new Codex page blocks leaving the Codex and keeps the draft", async () => {
  const user = userEvent.setup();
  vi.mocked(api.campaigns).mockResolvedValue([{ id: "a", name: "Campaign A" }]);
  vi.mocked(api.sessions).mockResolvedValue([session]);
  render(<App />);
  await screen.findByText("Test editor");
  await user.click(screen.getByRole("button", { name: "Codex" }));
  await user.click(await screen.findByRole("button", { name: "New page" }));
  await user.type(screen.getByLabelText("Page title"), "Unsaved page draft");
  await user.click(screen.getByRole("button", { name: "Journal" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Save or cancel the open changes",
  );
  expect(screen.getByLabelText("Page title")).toHaveValue("Unsaved page draft");
  // Cancelling the form releases the guard.
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Journal" }));
  expect(await screen.findByText("Test editor")).toBeInTheDocument();
  expect(knowledgeApi.create).not.toHaveBeenCalled();
});

test("global shortcuts do nothing behind an open native modal", async () => {
  vi.mocked(api.campaigns).mockResolvedValue([{ id: "a", name: "Campaign A" }]);
  vi.mocked(api.sessions).mockResolvedValue([session]);
  render(<App />);
  await screen.findByText("Test editor");
  const modal = document.createElement("dialog");
  modal.setAttribute("aria-label", "Synthetic native modal");
  document.body.append(modal);
  modal.showModal();
  fireEvent.keyDown(modal, { key: "N", ctrlKey: true, shiftKey: true });
  // Let any shortcut action (and its guard flush) run before checking.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  expect(
    screen.queryByRole("form", { name: "New session" }),
  ).not.toBeInTheDocument();
  modal.close();
  modal.remove();
  fireEvent.keyDown(document.body, { key: "N", ctrlKey: true, shiftKey: true });
  expect(
    await screen.findByRole("form", { name: "New session" }),
  ).toBeInTheDocument();
});
