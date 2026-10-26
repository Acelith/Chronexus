import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { command } from "../journal/api";
import WikiWorkspace from "./WikiWorkspace";
import type { Entry, SearchResult } from "./wikidot";
vi.mock("../journal/api", async (original) => ({
  ...(await original<typeof import("../journal/api")>()),
  command: vi.fn(),
}));
const fetchMock = vi.fn();
const result: SearchResult = {
  category: "spells",
  url: "https://dnd5e.wikidot.com/spells",
  fetchedAt: "2026-10-25T10:00:00Z",
  cached: false,
  warning: null,
  indexSize: 2,
  total: 1,
  rows: [
    {
      page: "spell:test-light",
      name: "Test Light",
      group: "1st Level",
      details: ["Evocation"],
      origin: "published",
    },
  ],
};
const entry: Entry = {
  page: "spell:test-light",
  url: "https://dnd5e.wikidot.com/spell:test-light",
  category: "spells",
  title: "Test Light",
  source: "Synthetic Handbook",
  origin: "published",
  edition: "5e-2014",
  license: "Licensed under a test license",
  blocks: [{ kind: "paragraph", text: "A synthetic light." }],
  spell: {
    level: "1",
    school: "Evocation",
    levelLine: "1st-level evocation",
    castingTime: "1 action",
    range: "30 feet",
    components: "V, S",
    duration: "1 minute",
    higherLevels: null,
    classes: "Wizard",
    description: "A synthetic light.",
    ritual: false,
    concentration: false,
  },
  missing: [],
  truncated: false,
};
let handlers: Record<string, (args?: unknown) => unknown>;
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  handlers = {
    get_wiki_provider: () => ({ provider: "wikidot", explicit: false }),
    cancel_wikidot: () => undefined,
  };
  vi.mocked(command).mockReset();
  vi.mocked(command).mockImplementation(
    async (name: string, args?: unknown) => {
      const handler = handlers[name];
      if (!handler) throw Error(`Unexpected command: ${name}`);
      return handler(args) as never;
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
const calls = (name: string) =>
  vi.mocked(command).mock.calls.filter(([n]) => n === name);

test("Wikidot is the default, makes no network request on opening and imports only on action", async () => {
  const user = userEvent.setup();
  handlers.wikidot_search = () => result;
  handlers.wikidot_entry = () => ({
    payload: entry,
    fetchedAt: "2026-10-25T10:00:00Z",
    cached: true,
    warning: null,
  });
  const onImport = vi.fn();
  render(<WikiWorkspace onImportSpell={onImport} />);
  expect(
    await screen.findByText(/Active source: Wikidot D&D 5e/),
  ).toBeVisible();
  expect(calls("wikidot_search")).toHaveLength(0);
  await user.type(screen.getByLabelText("Name in the wiki"), "light");
  await user.click(screen.getByRole("button", { name: "Search Wikidot" }));
  expect(calls("wikidot_search")[0][1]).toEqual({
    category: "spells",
    query: "light",
    refresh: false,
  });
  await user.click(await screen.findByRole("button", { name: /Test Light/ }));
  expect(await screen.findByText("A synthetic light.")).toBeVisible();
  expect(screen.getByText(/Declared source: Synthetic Handbook/)).toBeVisible();
  expect(onImport).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Prepare import into the sheet" }),
  );
  expect(onImport.mock.calls[0][0]).toMatchObject({
    name: "Test Light",
    rank: "1",
    school: "Evocation",
    catalogSource: { provider: "wikidot", path: "spell:test-light" },
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

test("declining an unavailable Wikidot result keeps Wikidot without contacting Open5e", async () => {
  const user = userEvent.setup();
  handlers.wikidot_search = () => {
    throw Error("Wikidot not reachable. Check the connection and try again.");
  };
  render(<WikiWorkspace />);
  await user.type(await screen.findByLabelText("Name in the wiki"), "magic");
  await user.click(screen.getByRole("button", { name: "Search Wikidot" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveTextContent(
    "Wikidot did not provide the information. Do you want to use Open5e?",
  );
  expect(dialog).toHaveTextContent("Wikidot not reachable");
  expect(
    screen.getByRole("button", { name: "Use Open5e and save the choice" }),
  ).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Stay on Wikidot" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(calls("save_wiki_provider")).toHaveLength(0);
  expect(calls("read_wiki_cache")).toHaveLength(0);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByText(/Active source: Wikidot/)).toBeVisible();
  // Escape is a refusal too, and a retry stays on Wikidot.
  await user.click(screen.getByRole("button", { name: "Search Wikidot" }));
  await screen.findByRole("alertdialog");
  await user.click(screen.getByRole("button", { name: "Try Wikidot again" }));
  await screen.findByRole("alertdialog");
  expect(calls("wikidot_search")).toHaveLength(3);
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(calls("save_wiki_provider")).toHaveLength(0);
});

test("accepting saves Open5e and repeats the search once without repeated prompts", async () => {
  const user = userEvent.setup();
  handlers.wikidot_search = () => ({ ...result, total: 0, rows: [] });
  handlers.save_wiki_provider = (args) => ({
    provider: (args as { provider: string }).provider,
    explicit: true,
  });
  handlers.read_wiki_cache = () => null;
  handlers.wiki_cache_epoch = () => 3;
  fetchMock.mockRejectedValue(Error("offline"));
  render(<WikiWorkspace />);
  await user.type(
    await screen.findByLabelText("Name in the wiki"),
    "zzz unknown",
  );
  await user.click(screen.getByRole("button", { name: "Search Wikidot" }));
  expect(await screen.findByRole("alertdialog")).toHaveTextContent(
    "No entry matches",
  );
  await user.click(
    screen.getByRole("button", { name: "Use Open5e and save the choice" }),
  );
  expect(calls("save_wiki_provider")[0][1]).toEqual({ provider: "open5e" });
  expect(await screen.findByText(/Active source: Open5e/)).toBeVisible();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(String(fetchMock.mock.calls[0][0])).toContain("query=zzz%20unknown");
  // Open5e failing too shows an error, never another provider proposal.
  expect(await screen.findByRole("alert")).toHaveTextContent("offline");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});
