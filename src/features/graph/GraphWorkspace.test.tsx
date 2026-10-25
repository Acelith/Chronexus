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
  await user.click(screen.getByRole("button", { name: "New relationship" }));
  expect(screen.getByLabelText("Certainty")).toHaveValue("unknown");
  await user.type(screen.getByLabelText("Relationship label"), "accusa");
  await user.selectOptions(screen.getByLabelText("Certainty"), "suspected");
  await user.selectOptions(
    screen.getByLabelText("Source (optional)"),
    "session:s",
  );
  await user.selectOptions(screen.getByLabelText("Source block"), "b");
  await user.type(
    screen.getByLabelText("Evidence or quote"),
    "Una dichiarazione.",
  );
  await user.type(
    screen.getByLabelText("Relationship notes"),
    "Da verificare.",
  );
  await user.click(screen.getByRole("button", { name: "Save relationship" }));
  await screen.findByText("Relationship saved on the computer.");
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
  await user.click(screen.getByRole("button", { name: "Open source" }));
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
  await user.click(screen.getByText("Accessible list of nodes and links"));
  await user.click(screen.getByRole("button", { name: /Relationship: Varek/ }));
  await user.click(
    await screen.findByRole("button", { name: "Delete relationship" }),
  );
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(graphApi.remove).not.toHaveBeenCalled();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Delete relationship" }));
  vi.mocked(graphApi.graph).mockResolvedValue(data);
  await user.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Confirm deletion",
    }),
  );
  await screen.findByText("Relationship deleted. Mentions in notes are kept.");
  expect(graphApi.remove).toHaveBeenCalledExactlyOnceWith("a", record);
});

test("una relazione aperta blocca la navigazione e conserva il form dopo errore", async () => {
  const user = userEvent.setup();
  renderGraph();
  await screen.findByText("Canvas di test");
  await user.click(screen.getByRole("button", { name: "New relationship" }));
  await user.type(screen.getByLabelText("Relationship label"), "accusa");
  const guard = register.mock.calls.at(-1)![0] as SaveGuard;
  await expect(guard.flush()).rejects.toThrow("Save or cancel");
  vi.mocked(graphApi.save).mockRejectedValue(
    new Error("Archivio non scrivibile"),
  );
  await user.click(screen.getByRole("button", { name: "Save relationship" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Archivio non scrivibile",
  );
  expect(screen.getByLabelText("Relationship label")).toHaveValue("accusa");
  await user.click(screen.getByRole("button", { name: "Cancel relationship" }));
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
  expect(screen.getByText(/View limited to 150 nodes/)).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Links"), "assertions");
  await user.selectOptions(
    screen.getByLabelText("Relationship certainty"),
    "suspected",
  );
  await user.selectOptions(screen.getByLabelText("Central node"), "page:v");
  await user.selectOptions(screen.getByLabelText("Depth"), "2");
  expect(graphApi.graph).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Apply filters" }));
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
