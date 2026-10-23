import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, vi, test, expect } from "vitest";
import { App } from "./App";
import { api, type Session } from "./features/journal/api";
import { knowledgeApi, type KnowledgePage } from "./features/knowledge/api";

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
    return <div>Editor di test</div>;
  }
  return { default: TestEditor };
});

const session: Session = {
  id: "s1",
  campaignId: "a",
  sequence: 1,
  title: "Il ponte",
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

test("crea una campagna dallo stato vuoto e ne modifica il nome", async () => {
  const user = userEvent.setup();
  vi.mocked(api.createCampaign).mockResolvedValue({
    id: "a",
    name: "Le ceneri",
  });
  vi.mocked(api.renameCampaign).mockResolvedValue({
    id: "a",
    name: "Le stelle",
  });
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "Crea campagna" }),
  );
  await user.type(screen.getByLabelText("Nome della campagna"), "Le ceneri");
  await user.click(screen.getByRole("button", { name: "Crea campagna" }));
  expect(
    await screen.findByRole("heading", { name: "Le ceneri" }),
  ).toBeInTheDocument();
  expect(api.createCampaign).toHaveBeenCalledWith("Le ceneri");
  await user.click(screen.getByRole("button", { name: "Rinomina campagna" }));
  await user.clear(screen.getByLabelText("Nome della campagna"));
  await user.type(screen.getByLabelText("Nome della campagna"), "Le stelle");
  await user.click(screen.getByRole("button", { name: "Salva nome" }));
  expect(
    await screen.findByRole("heading", { name: "Le stelle" }),
  ).toBeInTheDocument();
});

const knowledgePage: KnowledgePage = {
  id: "p1",
  campaignId: "a",
  title: "Varek",
  kind: "npc",
  status: "stub",
  aliases: ["Il mercante"],
  document: { version: 1, blocks: [] },
  revision: 0,
  updatedAt: "2026-10-23",
};

test("crea una pagina tipizzata e la rinomina conservando il Codex", async () => {
  const user = userEvent.setup();
  vi.mocked(api.campaigns).mockResolvedValue([{ id: "a", name: "Campagna" }]);
  vi.mocked(knowledgeApi.create).mockResolvedValue(knowledgePage);
  const updated = {
    ...knowledgePage,
    title: "Varek il grigio",
    status: "active" as const,
    aliases: ["Varek", "Il mercante"],
  };
  vi.mocked(knowledgeApi.update).mockResolvedValue(updated);
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "Codex" }));
  await user.click(await screen.findByRole("button", { name: "Nuova pagina" }));
  await user.type(screen.getByLabelText("Titolo della pagina"), "Varek");
  await user.selectOptions(screen.getByLabelText("Tipo"), "npc");
  await user.selectOptions(screen.getByLabelText("Stato"), "stub");
  await user.type(
    screen.getByLabelText("Alias (uno per riga, massimo 20)"),
    "Il mercante",
  );
  await user.click(screen.getByRole("button", { name: "Crea pagina" }));
  expect(
    await screen.findByRole("heading", { name: "Varek" }),
  ).toBeInTheDocument();
  expect(knowledgeApi.create).toHaveBeenCalledWith("a", {
    title: "Varek",
    kind: "npc",
    status: "stub",
    aliases: ["Il mercante"],
  });
  await user.click(screen.getByRole("button", { name: "Modifica pagina" }));
  await user.clear(screen.getByLabelText("Titolo della pagina"));
  await user.type(
    screen.getByLabelText("Titolo della pagina"),
    "Varek il grigio",
  );
  await user.selectOptions(screen.getByLabelText("Stato"), "active");
  await user.click(screen.getByRole("button", { name: "Salva pagina" }));
  expect(
    await screen.findByRole("heading", { name: "Varek il grigio" }),
  ).toBeInTheDocument();
});

test("un backlink apre la sessione sorgente dopo il salvataggio", async () => {
  const user = userEvent.setup();
  vi.mocked(api.campaigns).mockResolvedValue([{ id: "a", name: "Campagna" }]);
  vi.mocked(api.sessions).mockResolvedValue([session]);
  vi.mocked(knowledgeApi.pages).mockResolvedValue([knowledgePage]);
  vi.mocked(knowledgeApi.backlinks).mockResolvedValue([
    {
      sourceKind: "session",
      sourceId: "s1",
      sourceTitle: "Il ponte",
      sequence: 1,
      blockId: "b1",
      preview: "Ho incontrato Varek",
    },
  ]);
  render(<App />);
  await screen.findByText("Editor di test");
  await user.click(screen.getByRole("button", { name: "Codex" }));
  await user.click(
    await screen.findByRole("button", { name: /Ho incontrato Varek/ }),
  );
  expect(
    await screen.findByRole("heading", { name: "Il ponte" }),
  ).toBeInTheDocument();
  expect(flush).toHaveBeenCalled();
});

test("crea una sessione con numero titolo e data facoltativa", async () => {
  const user = userEvent.setup();
  vi.mocked(api.campaigns).mockResolvedValue([{ id: "a", name: "Campagna" }]);
  vi.mocked(api.createSession).mockResolvedValue(session);
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: /\+ Nuova sessione/ }),
  );
  await user.type(screen.getByLabelText("Titolo della sessione"), "Il ponte");
  await user.click(screen.getByRole("button", { name: "Crea sessione" }));
  expect(api.createSession).toHaveBeenCalledWith("a", 1, "Il ponte", null);
  expect(await screen.findByText("Editor di test")).toBeInTheDocument();
});

test("un errore di scrittura impedisce il cambio campagna e preserva la nota aperta", async () => {
  const user = userEvent.setup();
  vi.mocked(api.campaigns).mockResolvedValue([
    { id: "a", name: "Campagna A" },
    { id: "b", name: "Campagna B" },
  ]);
  vi.mocked(api.sessions).mockResolvedValue([session]);
  render(<App />);
  await screen.findByText("Editor di test");
  flush.mockRejectedValue(new Error("Disco pieno: riprova."));
  await user.click(screen.getByRole("button", { name: "Campagna B" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Disco pieno");
  expect(
    screen.getByRole("heading", { name: "Campagna A" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Il ponte" })).toBeInTheDocument();
  expect(api.sessions).toHaveBeenCalledTimes(1);
});

test("un errore iniziale spiega come riprovare senza mostrare dati fittizi", async () => {
  const user = userEvent.setup();
  vi.mocked(api.campaigns).mockRejectedValueOnce(
    new Error("Archivio non disponibile"),
  );
  render(<App />);
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Archivio non disponibile");
  await user.click(within(alert).getByRole("button", { name: "Riprova" }));
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
  expect(
    await screen.findByRole("button", { name: "Crea campagna" }),
  ).toBeInTheDocument();
});
