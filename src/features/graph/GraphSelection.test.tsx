import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import GraphWorkspace from "./GraphWorkspace";
import { graphApi, type GraphEdge, type Relationship } from "./api";
import type { KnowledgePage } from "../knowledge/api";

vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  graphApi: { graph: vi.fn(), relationship: vi.fn() },
}));
vi.mock("./GraphCanvas", () => ({
  default: ({
    data,
    onEdge,
  }: {
    data: { edges: GraphEdge[] };
    onEdge: (edge: GraphEdge) => void;
  }) => (
    <>
      <button onClick={() => onEdge(data.edges[0])}>Canvas assertion</button>
      <button onClick={() => onEdge(data.edges[1])}>Canvas mention</button>
    </>
  ),
}));

test("selecting a mention while a relationship loads clears the loading state", async () => {
  const user = userEvent.setup();
  const node = {
    id: "page:p",
    entityId: "p",
    title: "Synthetic page",
    kind: "note" as const,
    missing: false,
  };
  const edge = {
    id: "assertion",
    source: node.id,
    target: node.id,
    kind: "assertion" as const,
    label: "knows",
    certainty: "confirmed" as const,
    relationshipId: "r",
    provenance: null,
    preview: "",
  };
  vi.mocked(graphApi.graph).mockResolvedValue({
    nodes: [node],
    edges: [
      edge,
      { ...edge, id: "mention", kind: "mention", relationshipId: null },
    ],
    totalNodes: 1,
    totalEdges: 2,
    truncated: false,
  });
  let resolve!: (value: Relationship) => void;
  vi.mocked(graphApi.relationship).mockImplementation(
    () =>
      new Promise((complete) => {
        resolve = complete;
      }),
  );
  render(
    <GraphWorkspace
      campaignId="a"
      pages={[{ id: "p", title: "Synthetic page" } as KnowledgePage]}
      sessions={[]}
      busy={false}
      register={vi.fn()}
      onNode={vi.fn()}
      onSource={vi.fn()}
    />,
  );
  await user.click(
    await screen.findByRole("button", { name: "Canvas assertion" }),
  );
  expect(screen.getByText("Opening relationship…")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Canvas mention" }));
  expect(screen.queryByText("Opening relationship…")).not.toBeInTheDocument();
  await act(async () => {
    resolve({ id: "r" } as Relationship);
  });
  expect(screen.queryByText("Opening relationship…")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "New relationship" }),
  ).toBeEnabled();
});
