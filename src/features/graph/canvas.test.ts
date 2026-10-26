import { expect, test } from "vitest";
import { readableGraph, mapPositions } from "./canvas";
import type { GraphData } from "./api";
test("compact view keeps the requested center, bounded neighbors and no dangling or invented edges", () => {
  const nodes = Array.from({ length: 75 }, (_, i) => ({
    id: `p${i}`,
    entityId: `${i}`,
    title: `Voce ${i}`,
    kind: "npc" as const,
    missing: false,
  }));
  const edges = nodes.slice(1).map((n) => ({
    id: `e${n.id}`,
    source: "p0",
    target: n.id,
    kind: "mention" as const,
    label: "",
    certainty: null,
    relationshipId: null,
    provenance: null,
    preview: "",
  }));
  const data: GraphData = {
    nodes,
    edges,
    truncated: false,
    totalNodes: 75,
    totalEdges: 74,
  };
  const view = readableGraph(data, "p70", false);
  expect(view.nodes).toHaveLength(18);
  expect(view.nodes.some((n) => n.id === "p70")).toBe(true);
  const ids = new Set(view.nodes.map((n) => n.id));
  expect(
    view.edges.every(
      (e) =>
        ids.has(e.source) &&
        ids.has(e.target) &&
        edges.some((original) => original.id === e.id),
    ),
  ).toBe(true);
  expect(readableGraph(data, null, true)).toBe(data);
  expect(data.nodes).toHaveLength(75);
});

test("deterministic layout preserves data and the requested center", () => {
  const data: GraphData = {
    nodes: ["a", "b", "c"].map((id) => ({
      id,
      entityId: id,
      title: id,
      kind: "npc",
      missing: false,
    })),
    edges: [],
    truncated: false,
    totalNodes: 3,
    totalEdges: 0,
  };
  const before = JSON.stringify(data);
  const a = mapPositions(data, "b");
  expect(a.get("b")).toEqual({ x: 0, y: 0 });
  expect([...a.keys()].sort()).toEqual(["a", "b", "c"]);
  expect(mapPositions(data, "b")).toEqual(a);
  expect(JSON.stringify(data)).toBe(before);
  expect(mapPositions({ ...data, nodes: [] }, null).size).toBe(0);
});
