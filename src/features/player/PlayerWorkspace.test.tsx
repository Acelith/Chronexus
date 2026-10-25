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
    throw Error(`Comando non previsto nel test player: ${name}`);
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
        label: "Concentrazione",
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
  title: "Il ponte",
  playedOn: null,
  document: {
    version: 1,
    blocks: [
      {
        id: "proof",
        type: "paragraph",
        props: {},
        children: [],
        content: [{ type: "text", text: "Varek mi dà la chiave", styles: {} }],
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
      name: "Chiave del ponte",
      quantity: 1,
      category: "Chiavi",
      description: "Da conservare",
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
test("crea una scheda generica con risorse e protegge un modulo che non si salva", async () => {
  vi.mocked(playerApi.character).mockResolvedValue(null);
  vi.mocked(playerApi.saveCharacter).mockRejectedValue(
    new Error("Disco non disponibile. Riprova."),
  );
  const { user, getGuard } = setup();
  await user.click(
    await screen.findByRole("button", { name: "Crea personaggio" }),
  );
  expect(screen.getByLabelText("Nome del personaggio")).toHaveFocus();
  await user.type(screen.getByLabelText("Nome del personaggio"), "Neme");
  await user.click(screen.getByRole("button", { name: "Aggiungi risorsa" }));
  await user.type(screen.getByLabelText("Risorsa 1: nome"), "Slot personali");
  await user.selectOptions(screen.getByLabelText("Risorsa 1: tipo"), "slot");
  await user.clear(screen.getByLabelText("Risorsa 1: massimo"));
  await user.type(screen.getByLabelText("Risorsa 1: massimo"), "3");
  await user.click(screen.getByRole("button", { name: "Salva personaggio" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Disco non disponibile",
  );
  expect(screen.getByLabelText("Nome del personaggio")).toHaveValue("Neme");
  expect(playerApi.saveCharacter).toHaveBeenCalledWith(
    "a",
    null,
    expect.objectContaining({
      resources: [expect.objectContaining({ kind: "slot", maximum: 3 })],
    }),
  );
  await expect(getGuard()?.flush()).rejects.toThrow("Salva o annulla");
  await user.click(screen.getByRole("button", { name: "Annulla modifiche" }));
  expect(getGuard()?.dirty()).toBe(false);
});
test("contatori attendono la persistenza e mantengono il valore quando il salvataggio fallisce", async () => {
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
      name: "Riduci Punti vita",
    }),
  );
  expect(
    screen.getByRole("button", { name: "Aumenta Concentrazione" }),
  ).toBeDisabled();
  await expect(getGuard()?.flush()).rejects.toThrow("Attendi");
  resolve({
    ...character,
    revision: 1,
    data: { ...character.data, hpCurrent: 7 },
  });
  await waitFor(() =>
    expect(
      screen.getByLabelText("Punti vita", { selector: "output" }),
    ).toHaveTextContent("7 / 10"),
  );
  await user.click(
    screen.getByRole("button", { name: "Aumenta Concentrazione" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "modificato altrove",
  );
  expect(
    screen.getByLabelText("Concentrazione", { selector: "output" }),
  ).toHaveTextContent("1 / 3");
});
test("salva oggetto con PNG, sessione e blocco e apre i collegamenti della voce", async () => {
  vi.mocked(playerApi.saveAsset).mockImplementation(
    async (_c, _pc, _initial, input) => ({ ...item, input }),
  );
  const { user, onPage, onSource } = setup("inventory");
  await user.click(
    await screen.findByRole("button", { name: "Aggiungi oggetto" }),
  );
  await user.type(screen.getByLabelText("Nome della voce"), "Chiave del ponte");
  await user.selectOptions(screen.getByLabelText("PNG collegato"), "npc");
  await user.selectOptions(screen.getByLabelText("Sessione fonte"), "s1");
  await user.selectOptions(screen.getByLabelText("Blocco fonte"), "proof");
  await user.click(screen.getByRole("button", { name: "Salva voce" }));
  const detail = await screen.findByRole("article", { name: "Dettaglio voce" });
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
  await user.click(within(detail).getByRole("button", { name: "PNG: Varek" }));
  expect(onPage).toHaveBeenCalledWith("npc", "Varek", "key", "inventory");
  await user.click(
    within(detail).getByRole("button", {
      name: "Apri sessione fonte al blocco",
    }),
  );
  expect(onSource).toHaveBeenCalledWith(
    expect.objectContaining({ id: "s1", blockId: "proof" }),
    "key",
    "inventory",
  );
});
test("elimina solo dopo conferma, Escape annulla e la richiesta usa la revisione corrente", async () => {
  vi.mocked(playerApi.assets).mockResolvedValue([item]);
  vi.mocked(playerApi.deleteAsset).mockResolvedValue();
  const { user } = setup("inventory");
  await user.click(await screen.findByRole("button", { name: "Elimina voce" }));
  const cancel = screen.getByRole("button", { name: "Annulla eliminazione" });
  expect(cancel).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(vi.mocked(playerApi.deleteAsset)).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Elimina voce" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Elimina voce" }));
  await user.click(
    screen.getByRole("button", { name: "Conferma eliminazione" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("article", { name: "Dettaglio voce" }),
    ).not.toBeInTheDocument(),
  );
  expect(playerApi.deleteAsset).toHaveBeenCalledWith(item);
});
test("filtra capacità manuali e i marcatori non cambiano i contatori", async () => {
  const spell: Asset = {
    ...item,
    id: "light",
    input: emptyAsset("spell", "generic"),
  };
  spell.input.details.name = "Luce tenue";
  if (spell.input.details.kind !== "item") {
    spell.input.details.rank = "Primo cerchio";
    spell.input.details.prepared = true;
  }
  vi.mocked(playerApi.assets).mockResolvedValue([spell]);
  vi.mocked(playerApi.saveAsset).mockImplementation(
    async (_c, _pc, initial, input) => ({ ...initial!, input, revision: 1 }),
  );
  const { user } = setup("abilities");
  await screen.findByRole("article", { name: "Dettaglio voce" });
  await user.selectOptions(screen.getByLabelText("Stato o tipo"), "known");
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Stato o tipo"), "prepared");
  await user.type(screen.getByLabelText("Filtra per rango"), "Primo");
  await user.click(screen.getByRole("button", { name: "Cambia conosciuta" }));
  expect(await screen.findByText("Conosciuta · Preparata")).toBeInTheDocument();
  expect(playerApi.counter).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText("Cerca per nome"), "Assente");
  expect(
    await screen.findByText("Nessuna voce corrisponde ai filtri."),
  ).toBeInTheDocument();
});
test("errore lettura non mostra una falsa scheda vuota e consente riprova", async () => {
  vi.mocked(playerApi.character)
    .mockRejectedValueOnce(new Error("Archivio occupato"))
    .mockResolvedValueOnce(character);
  const { user } = setup();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Archivio occupato",
  );
  expect(
    screen.queryByRole("button", { name: "Crea personaggio" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Ricarica scheda" }));
  expect(
    await screen.findByRole("heading", { name: "Neme" }),
  ).toBeInTheDocument();
});
test("adattatori generico e sconosciuto preservano statistiche manuali senza derivazioni", () => {
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
test("una voce Wikidot apre un modulo modificabile e si salva solo esplicitamente", async () => {
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
  const name = await screen.findByLabelText("Nome della voce");
  expect(name).toHaveValue("Acid Splash");
  expect(
    screen.getByText("https://dnd5e.wikidot.com/spell:acid-splash"),
  ).toBeInTheDocument();
  await waitFor(() => expect(onDraftUsed).toHaveBeenCalledTimes(1));
  expect(playerApi.saveAsset).not.toHaveBeenCalled();
  expect(guard!.dirty()).toBe(true);
  await user.clear(name);
  await user.type(name, "Acid Splash personale");
  await user.click(screen.getByRole("button", { name: "Salva voce" }));
  await waitFor(() => expect(playerApi.saveAsset).toHaveBeenCalledTimes(1));
  const saved = vi.mocked(playerApi.saveAsset).mock.calls[0][3];
  expect(saved.details).toMatchObject({
    name: "Acid Splash personale",
    catalogSource: { provider: "wikidot", path: "spell:acid-splash" },
  });
});
test("senza personaggio l’importazione dalla wiki viene annullata con un avviso", async () => {
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
    "Crea prima il personaggio",
  );
  expect(onDraftUsed).toHaveBeenCalledTimes(1);
  expect(playerApi.saveAsset).not.toHaveBeenCalled();
});
