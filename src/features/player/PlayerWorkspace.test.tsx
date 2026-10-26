import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import PlayerWorkspace from "./PlayerWorkspace";
import {
  emptyCharacter,
  emptyAsset,
  playerApi,
  type AbilityDetails,
  type Character,
  type Asset,
  type PlayerView,
} from "./api";
import type { SaveGuard } from "../journal/Editor";
import type { KnowledgePage } from "../knowledge/api";
import type { Session } from "../journal/api";
import { adapterFor } from "./rulesets";
vi.mock("../journal/api", async (original) => ({
  ...(await original<typeof import("../journal/api")>()),
  command: vi.fn(async (name: string) => {
    if (name === "list_images") return [];
    throw Error(`Unexpected command in player test: ${name}`);
  }),
}));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  playerApi: {
    character: vi.fn(),
    assets: vi.fn(),
    saveCharacter: vi.fn(),
    counter: vi.fn(),
    saveAsset: vi.fn(),
    deleteAsset: vi.fn(),
  },
}));
const character: Character = {
  id: "pc",
  campaignId: "a",
  revision: 0,
  data: {
    ...emptyCharacter(),
    name: "Neme",
    hpMaximum: 10,
    hpCurrent: 8,
    resources: [
      {
        id: "r1",
        label: "Concentration",
        kind: "resource",
        current: 1,
        maximum: 3,
      },
    ],
  },
};
const page: KnowledgePage = {
  id: "npc",
  campaignId: "a",
  title: "Varek",
  kind: "npc",
  status: "active",
  aliases: [],
  document: { version: 1, blocks: [] },
  revision: 0,
  updatedAt: "2026-10-23",
};
const session: Session = {
  id: "s1",
  campaignId: "a",
  sequence: 12,
  title: "The bridge",
  playedOn: null,
  document: {
    version: 1,
    blocks: [
      {
        id: "proof",
        type: "paragraph",
        props: {},
        children: [],
        content: [{ type: "text", text: "Varek gives me the key", styles: {} }],
      },
    ],
  },
  revision: 0,
  updatedAt: "2026-10-23",
};
const item: Asset = {
  id: "key",
  campaignId: "a",
  characterId: "pc",
  revision: 0,
  sourceAvailable: true,
  input: {
    ...emptyAsset("item", "generic"),
    details: {
      kind: "item",
      name: "Bridge key",
      quantity: 1,
      category: "Chiavi",
      description: "To keep",
      weight: null,
      value: "",
      equipped: false,
      consumable: false,
      notes: "",
    },
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(playerApi.character).mockResolvedValue(character);
  vi.mocked(playerApi.assets).mockResolvedValue([]);
});
function setup(view: PlayerView = "character") {
  let guard: SaveGuard | null = null;
  const register = vi.fn((value: SaveGuard | null) => {
    guard = value;
  });
  const onPage = vi.fn(),
    onSource = vi.fn();
  render(
    <PlayerWorkspace
      campaignId="a"
      view={view}
      pages={[page]}
      sessions={[session]}
      register={register}
      onPage={onPage}
      onSource={onSource}
    />,
  );
  return { user: userEvent.setup(), getGuard: () => guard, onPage, onSource };
}
test("creates a generic sheet with resources and guards a form that fails to save", async () => {
  vi.mocked(playerApi.character).mockResolvedValue(null);
  vi.mocked(playerApi.saveCharacter).mockRejectedValue(
    new Error("Disk unavailable. Try again."),
  );
  const { user, getGuard } = setup();
  await user.click(
    await screen.findByRole("button", { name: "Create character" }),
  );
  expect(screen.getByLabelText("Character name")).toHaveFocus();
  await user.type(screen.getByLabelText("Character name"), "Neme");
  await user.click(screen.getByRole("button", { name: "Add resource" }));
  await user.type(screen.getByLabelText("Resource 1: name"), "Slot personali");
  await user.selectOptions(screen.getByLabelText("Resource 1: type"), "slot");
  await user.clear(screen.getByLabelText("Resource 1: maximum"));
  await user.type(screen.getByLabelText("Resource 1: maximum"), "3");
  await user.click(screen.getByRole("button", { name: "Save character" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Disk unavailable",
  );
  expect(screen.getByLabelText("Character name")).toHaveValue("Neme");
  expect(playerApi.saveCharacter).toHaveBeenCalledWith(
    "a",
    null,
    expect.objectContaining({
      resources: [expect.objectContaining({ kind: "slot", maximum: 3 })],
    }),
  );
  await expect(getGuard()?.flush()).rejects.toThrow("Save or cancel");
  await user.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(getGuard()?.dirty()).toBe(false);
});
test("counters wait for persistence and preserve values when saving fails", async () => {
  const { user, getGuard } = setup();
  let resolve: (value: Character) => void = () => {};
  vi.mocked(playerApi.counter)
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockRejectedValueOnce(new Error("Contatore modificato altrove."));
  await user.click(
    await screen.findByRole("button", {
      name: "Decrease Hit points",
    }),
  );
  expect(
    screen.getByRole("button", { name: "Increase Concentration" }),
  ).toBeDisabled();
  await expect(getGuard()?.flush()).rejects.toThrow("Wait");
  resolve({
    ...character,
    revision: 1,
    data: { ...character.data, hpCurrent: 7 },
  });
  await waitFor(() =>
    expect(
      screen.getByLabelText("Hit points", { selector: "output" }),
    ).toHaveTextContent("7 / 10"),
  );
  await user.click(
    screen.getByRole("button", { name: "Increase Concentration" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "modificato altrove",
  );
  expect(
    screen.getByLabelText("Concentration", { selector: "output" }),
  ).toHaveTextContent("1 / 3");
});
test("saves an item with NPC, session and block and opens its links", async () => {
  vi.mocked(playerApi.saveAsset).mockImplementation(
    async (_c, _pc, _initial, input) => ({ ...item, input }),
  );
  const { user, onPage, onSource } = setup("inventory");
  await user.click(await screen.findByRole("button", { name: "Add item" }));
  await user.type(screen.getByLabelText("Entry name"), "Bridge key");
  await user.selectOptions(screen.getByLabelText("Linked NPC"), "npc");
  await user.selectOptions(screen.getByLabelText("Source session"), "s1");
  await user.selectOptions(screen.getByLabelText("Source block"), "proof");
  await user.click(screen.getByRole("button", { name: "Save entry" }));
  const detail = await screen.findByRole("article", { name: "Entry details" });
  expect(playerApi.saveAsset).toHaveBeenCalledWith(
    "a",
    "pc",
    null,
    expect.objectContaining({
      links: expect.objectContaining({
        npcId: "npc",
        sourceSessionId: "s1",
        sourceBlockId: "proof",
      }),
    }),
  );
  await user.click(within(detail).getByRole("button", { name: "NPC: Varek" }));
  expect(onPage).toHaveBeenCalledWith("npc", "Varek", "key", "inventory");
  await user.click(
    within(detail).getByRole("button", {
      name: "Open source session at block",
    }),
  );
  expect(onSource).toHaveBeenCalledWith(
    expect.objectContaining({ id: "s1", blockId: "proof" }),
    "key",
    "inventory",
  );
});
test("deletes only after confirmation, Escape cancels and the request uses the current revision", async () => {
  vi.mocked(playerApi.assets).mockResolvedValue([item]);
  vi.mocked(playerApi.deleteAsset).mockResolvedValue();
  const { user } = setup("inventory");
  await user.click(await screen.findByRole("button", { name: "Delete entry" }));
  const cancel = screen.getByRole("button", { name: "Cancel deletion" });
  expect(cancel).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(vi.mocked(playerApi.deleteAsset)).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Delete entry" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Delete entry" }));
  await user.click(screen.getByRole("button", { name: "Confirm deletion" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("article", { name: "Entry details" }),
    ).not.toBeInTheDocument(),
  );
  expect(playerApi.deleteAsset).toHaveBeenCalledWith(item);
});
test("filters manual abilities and flags do not change counters", async () => {
  const spell: Asset = {
    ...item,
    id: "light",
    input: emptyAsset("spell", "generic"),
  };
  spell.input.details.name = "Faint light";
  if (spell.input.details.kind !== "item") {
    spell.input.details.rank = "Primo cerchio";
    spell.input.details.prepared = true;
  }
  vi.mocked(playerApi.assets).mockResolvedValue([spell]);
  vi.mocked(playerApi.saveAsset).mockImplementation(
    async (_c, _pc, initial, input) => ({ ...initial!, input, revision: 1 }),
  );
  const { user } = setup("abilities");
  await screen.findByRole("article", { name: "Entry details" });
  await user.selectOptions(screen.getByLabelText("Status or type"), "known");
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Status or type"), "prepared");
  await user.type(screen.getByLabelText("Filter by level"), "Primo");
  await user.click(screen.getByRole("button", { name: "Toggle known" }));
  expect(await screen.findByText("Known · Prepared")).toBeInTheDocument();
  expect(playerApi.counter).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText("Search by name"), "Assente");
  expect(
    await screen.findByText("No entries match the filters."),
  ).toBeInTheDocument();
});
test("read errors do not show a fake empty sheet and allow retry", async () => {
  vi.mocked(playerApi.character)
    .mockRejectedValueOnce(new Error("Archivio occupato"))
    .mockResolvedValueOnce(character);
  const { user } = setup();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Archivio occupato",
  );
  expect(
    screen.queryByRole("button", { name: "Create character" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Reload sheet" }));
  expect(
    await screen.findByRole("heading", { name: "Neme" }),
  ).toBeInTheDocument();
});
test("generic and unknown adapters preserve manual statistics without derived values", () => {
  for (const system of ["generic", "D&D personale", "__proto__"]) {
    const adapter = adapterFor(system);
    expect(adapter.mode).toBe("manual");
    expect(adapter.derive(character.data)).toEqual([]);
  }
});
const wikiSpell = {
  ...(emptyAsset("spell", "dnd5e-2014").details as AbilityDetails),
  name: "Acid Splash",
  rank: "0",
  description: "Original English text.",
  catalogSource: {
    path: "spell:acid-splash",
    name: "Acid Splash",
    provider: "wikidot" as const,
  },
};
test("a Wikidot entry opens an editable form and saves only explicitly", async () => {
  vi.mocked(playerApi.character).mockResolvedValue(character);
  vi.mocked(playerApi.assets).mockResolvedValue([]);
  vi.mocked(playerApi.saveAsset).mockImplementation(
    async (_c, _pc, _initial, input) =>
      ({
        id: "new",
        campaignId: "a",
        characterId: "pc",
        input,
        revision: 0,
        sourceAvailable: true,
      }) as Asset,
  );
  const onDraftUsed = vi.fn();
  let guard: SaveGuard | null = null;
  render(
    <PlayerWorkspace
      campaignId="a"
      view="abilities"
      pages={[page]}
      sessions={[session]}
      initialDraft={wikiSpell}
      onDraftUsed={onDraftUsed}
      register={(g) => {
        guard = g;
      }}
      onPage={vi.fn()}
      onSource={vi.fn()}
    />,
  );
  const user = userEvent.setup();
  const name = await screen.findByLabelText("Entry name");
  expect(name).toHaveValue("Acid Splash");
  expect(
    screen.getByText("https://dnd5e.wikidot.com/spell:acid-splash"),
  ).toBeInTheDocument();
  await waitFor(() => expect(onDraftUsed).toHaveBeenCalledTimes(1));
  expect(playerApi.saveAsset).not.toHaveBeenCalled();
  expect(guard!.dirty()).toBe(true);
  await user.clear(name);
  await user.type(name, "Acid Splash personale");
  await user.click(screen.getByRole("button", { name: "Save entry" }));
  await waitFor(() => expect(playerApi.saveAsset).toHaveBeenCalledTimes(1));
  const saved = vi.mocked(playerApi.saveAsset).mock.calls[0][3];
  expect(saved.details).toMatchObject({
    name: "Acid Splash personale",
    catalogSource: { provider: "wikidot", path: "spell:acid-splash" },
  });
});
test("without a character wiki import is cancelled with a warning", async () => {
  vi.mocked(playerApi.character).mockResolvedValue(null);
  const onDraftUsed = vi.fn();
  render(
    <PlayerWorkspace
      campaignId="a"
      view="abilities"
      pages={[]}
      sessions={[]}
      initialDraft={wikiSpell}
      onDraftUsed={onDraftUsed}
      register={vi.fn()}
      onPage={vi.fn()}
      onSource={vi.fn()}
    />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Create the character first",
  );
  expect(onDraftUsed).toHaveBeenCalledTimes(1);
  expect(playerApi.saveAsset).not.toHaveBeenCalled();
});
