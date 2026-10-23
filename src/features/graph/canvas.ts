import type { ElementDefinition, StylesheetJson } from "cytoscape";
import { certainties, type GraphData } from "./api";
export function graphElements(data: GraphData): ElementDefinition[] {
  return [
    ...data.nodes.map((node) => ({ data: { ...node, label: node.title } })),
    ...data.edges.map((edge) => ({
      data: {
        ...edge,
        displayLabel:
          edge.kind === "mention"
            ? "menziona"
            : `${edge.label} (${certainties[edge.certainty!]})`,
      },
    })),
  ];
}
export const graphStyle: StylesheetJson = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "background-color": "#8d713a",
      color: "#30251d",
      "font-size": 15,
      "text-valign": "bottom",
      "text-margin-y": 9,
      "text-wrap": "wrap",
      "text-max-width": "140px",
      width: 38,
      height: 38,
      "border-width": 2,
      "border-color": "#f2e7ce",
    },
  },
  {
    selector: 'node[kind="session"]',
    style: { shape: "round-rectangle", "background-color": "#817252" },
  },
  {
    selector: 'node[kind="missing"]',
    style: { shape: "diamond", "background-color": "#b7797f" },
  },
  {
    selector: "edge",
    style: {
      width: 1.3,
      "curve-style": "bezier",
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.8,
      label: "",
      "font-size": 10,
      color: "#30251d",
      "text-background-color": "#e6d8b8",
      "text-background-opacity": 1,
      "text-background-padding": "3px",
      "text-rotation": "autorotate",
      "line-color": "#8c8068",
      "target-arrow-color": "#8c8068",
    },
  },
  {
    selector: 'edge[kind="mention"]',
    style: {
      "line-style": "dashed",
      "line-dash-pattern": [6, 5],
      "target-arrow-shape": "vee",
    },
  },
  {
    selector: 'edge[kind="assertion"]',
    style: {
      width: 3,
      "line-style": "solid",
      "line-color": "#8d713a",
      "target-arrow-color": "#8d713a",
    },
  },
  {
    selector: 'edge[certainty="disproven"]',
    style: { "line-color": "#ce8e98", "target-arrow-color": "#ce8e98" },
  },
  {
    selector: ":selected",
    style: {
      "overlay-color": "#f2dcae",
      "overlay-opacity": 0.2,
      "overlay-padding": 8,
    },
  },
];

export function readableGraph(
  data: GraphData,
  focusId: string | null,
  expanded: boolean,
): GraphData {
  if (expanded || data.nodes.length <= 18) return data;
  const degree = new Map(data.nodes.map((n) => [n.id, 0]));
  for (const e of data.edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  const ranked = [...data.nodes].sort(
    (a, b) =>
      degree.get(b.id)! - degree.get(a.id)! || a.title.localeCompare(b.title),
  );
  const ids = new Set<string>();
  const queue = [focusId && degree.has(focusId) ? focusId : ranked[0].id];
  while (queue.length && ids.size < 18) {
    const id = queue.shift()!;
    if (ids.has(id)) continue;
    ids.add(id);
    for (const e of data.edges)
      if (e.source === id || e.target === id) {
        const other = e.source === id ? e.target : e.source;
        if (degree.has(other) && !ids.has(other)) queue.push(other);
      }
  }
  for (const n of ranked) {
    if (ids.size >= 18) break;
    ids.add(n.id);
  }
  return {
    ...data,
    nodes: data.nodes.filter((n) => ids.has(n.id)),
    edges: data.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
  };
}
graphStyle.push(
  { selector: 'node[kind="npc"]', style: { "background-color": "#6e302b" } },
  {
    selector: 'node[kind="place"]',
    style: { "background-color": "#354c3a", shape: "hexagon" },
  },
  { selector: 'node[kind="item"]', style: { shape: "diamond" } },
  { selector: ".dimmed", style: { opacity: 0.15 } },
  {
    selector: "node:selected",
    style: {
      "border-width": 4,
      "border-color": "#6e302b",
      "font-weight": "bold",
    },
  },
  {
    selector: "edge:selected, edge.emphasized",
    style: {
      label: "data(displayLabel)",
      "font-size": 11,
      width: 2.5,
      "z-index": 10,
    },
  },
);
