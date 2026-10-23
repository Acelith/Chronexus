import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import GraphWorkspace from "./GraphWorkspace";
import {
  defaultQuery,
  graphApi,
  type GraphData,
  type Relationship,
} from "./api";
import type { KnowledgePage } from "../knowledge/api";
import type { Session } from "../journal/api";
import type { SaveGuard } from "../journal/Editor";
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  graphApi: {
    graph: vi.fn(),
    relationship: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock("./GraphCanvas", () => ({ default: () => <div>Canvas di test</div> }));
const pages = [
  {
    id: "v",
    campaignId: "a",
    title: "Varek",
    kind: "npc",
    status: "active",
    aliases: [],
    revision: 0,
    updatedAt: "",
    document: { version: 1, blocks: [] },
  },
  {
    id: "g",
    campaignId: "a",
    title: "Gilda",
    kind: "faction",
    status: "active",
    aliases: [],
    revision: 0,
    updatedAt: "",
    document: { version: 1, blocks: [] },
  },
] as KnowledgePage[];
const sessions = [
  {
    id: "s",
    campaignId: "a",
    sequence: 12,
    title: "L'accusa",
    playedOn: null,
    revision: 0,
    updatedAt: "",
    document: {
      version: 1,
      blocks: [
        {
          id: "b",
          type: "paragraph",
          props: {},
          children: [],
          content: [
            { type: "text", text: "Varek accusa la Gilda.", styles: {} },
          ],
        },
      ],
    },
  },
] as Session[];
const data: GraphData = {
  nodes: [
    {
      id: "page:v",
      entityId: "v",
      title: "Varek",
      kind: "npc",
      missing: false,
    },
    {
      id: "page:g",
      entityId: "g",
      title: "Gilda",
      kind: "faction",
      missing: false,
    },
  ],
  edges: [],
  truncated: false,
  totalNodes: 2,
  totalEdges: 0,
};
const record: Relationship = {
  id: "r",
  campaignId: "a",
  revision: 0,
  sourceAvailable: true,
  fromPageId: "v",
  toPageId: "g",
  label: "accusa",
  certainty: "suspected",
  sourceKind: "session",
  sourceId: "s",
  sourceBlockId: "b",
  evidence: "Una dichiarazione.",
  notes: "Da verificare.",
};
const register = vi.fn();
const onNode = vi.fn();
const onSource = vi.fn();
function renderGraph() {
  render(
    <GraphWorkspace
      campaignId="a"
      pages={pages}
      sessions={sessions}
      register={register}
      onNode={onNode}
      onSource={onSource}
    />,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(graphApi.graph).mockResolvedValue(data);
  vi.mocked(graphApi.save).mockResolvedValue(record);
  vi.mocked(graphApi.relationship).mockResolvedValue(record);
  vi.mocked(graphApi.remove).mockResolvedValue(undefined);
});

test("crea una relazione con certezza e blocco fonte senza trasformare menzioni", async () => {
  const user = userEvent.setup();
  renderGraph();
  await screen.findByText("Canvas di test");
  await user.click(screen.getByRole("button", { name: "Nuova relazione" }));
  expect(screen.getByLabelText("Certezza")).toHaveValue("unknown");
  await user.type(screen.getByLabelText("Etichetta della relazione"), "accusa");
  await user.selectOptions(screen.getByLabelText("Certezza"), "suspected");
  await user.selectOptions(
    screen.getByLabelText("Fonte (facoltativa)"),
    "session:s",
  );
  await user.selectOptions(screen.getByLabelText("Blocco della fonte"), "b");
  await user.type(
    screen.getByLabelText("Evidenza o citazione"),
    "Una dichiarazione.",
  );
  await user.type(
    screen.getByLabelText("Note sulla relazione"),
    "Da verificare.",
  );
  await user.click(screen.getByRole("button", { name: "Salva relazione" }));
  await screen.findByText("Relazione salvata sul computer.");
  expect(graphApi.save).toHaveBeenCalledWith(
    "a",
    {
      fromPageId: "v",
      toPageId: "g",
      label: "accusa",
      certainty: "suspected",
      sourceKind: "session",
      sourceId: "s",
      sourceBlockId: "b",
      evidence: "Una dichiarazione.",
      notes: "Da verificare.",
    },
    undefined,
  );
  await user.click(screen.getByRole("button", { name: "Apri fonte" }));
  expect(onSource).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "session", id: "s", blockId: "b" }),
  );
});

test("l'eliminazione richiede conferma e usa la revisione corrente", async () => {
  const user = userEvent.setup();
  const graph = {
    ...data,
    edges: [
      {
        id: "relationship:r",
        source: "page:v",
        target: "page:g",
        kind: "assertion" as const,
        label: "accusa",
        certainty: "suspected" as const,
        relationshipId: "r",
        provenance: null,
        preview: "",
      },
    ],
  };
  vi.mocked(graphApi.graph).mockResolvedValue(graph);
  renderGraph();
  await screen.findByText("Canvas di test");
  await user.click(
    screen.getByText("Elenco accessibile di nodi e collegamenti"),
  );
  await user.click(screen.getByRole("button", { name: /Relazione: Varek/ }));
  await user.click(
    await screen.findByRole("button", { name: "Elimina relazione" }),
  );
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(graphApi.remove).not.toHaveBeenCalled();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Elimina relazione" }));
  vi.mocked(graphApi.graph).mockResolvedValue(data);
  await user.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Conferma eliminazione",
    }),
  );
  await screen.findByText(
    "Relazione eliminata. Le menzioni negli appunti sono conservate.",
  );
  expect(graphApi.remove).toHaveBeenCalledExactlyOnceWith("a", record);
});

test("una relazione aperta blocca la navigazione e conserva il form dopo errore", async () => {
  const user = userEvent.setup();
  renderGraph();
  await screen.findByText("Canvas di test");
  await user.click(screen.getByRole("button", { name: "Nuova relazione" }));
  await user.type(screen.getByLabelText("Etichetta della relazione"), "accusa");
  const guard = register.mock.calls.at(-1)![0] as SaveGuard;
  await expect(guard.flush()).rejects.toThrow("Salva o annulla");
  vi.mocked(graphApi.save).mockRejectedValue(
    new Error("Archivio non scrivibile"),
  );
  await user.click(screen.getByRole("button", { name: "Salva relazione" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Archivio non scrivibile",
  );
  expect(screen.getByLabelText("Etichetta della relazione")).toHaveValue(
    "accusa",
  );
  await user.click(screen.getByRole("button", { name: "Annulla relazione" }));
  await expect(guard.flush()).resolves.toBeUndefined();
});

test("applica filtri e vicinato solo alla conferma e segnala la vista limitata", async () => {
  const user = userEvent.setup();
  vi.mocked(graphApi.graph).mockResolvedValue({
    ...data,
    truncated: true,
    totalNodes: 300,
    totalEdges: 800,
  });
  renderGraph();
  await screen.findByText("Canvas di test");
  expect(screen.getByText(/Vista limitata a 150 nodi/)).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Collegamenti"), "assertions");
  await user.selectOptions(
    screen.getByLabelText("Certezza delle relazioni"),
    "suspected",
  );
  await user.selectOptions(screen.getByLabelText("Nodo centrale"), "page:v");
  await user.selectOptions(screen.getByLabelText("Profondità"), "2");
  expect(graphApi.graph).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Applica filtri" }));
  await waitFor(() =>
    expect(graphApi.graph).toHaveBeenLastCalledWith("a", {
      ...defaultQuery,
      edgeKind: "assertions",
      certainty: "suspected",
      focusId: "page:v",
      depth: 2,
    }),
  );
});
