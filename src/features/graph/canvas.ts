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
      "background-color": "#d7b978",
      color: "#e7e8ed",
      "font-size": 12,
      "text-valign": "bottom",
      "text-margin-y": 9,
      "text-wrap": "wrap",
      "text-max-width": "140px",
      width: 30,
      height: 30,
      "border-width": 2,
      "border-color": "#161c28",
    },
  },
  {
    selector: 'node[kind="session"]',
    style: { shape: "round-rectangle", "background-color": "#9fb9dc" },
  },
  {
    selector: 'node[kind="missing"]',
    style: { shape: "diamond", "background-color": "#b7797f" },
  },
  {
    selector: "edge",
    style: {
      width: 2,
      "curve-style": "bezier",
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.8,
      label: "data(displayLabel)",
      "font-size": 10,
      color: "#dce3ef",
      "text-background-color": "#161c28",
      "text-background-opacity": 1,
      "text-background-padding": "3px",
      "text-rotation": "autorotate",
      "line-color": "#8b9aaf",
      "target-arrow-color": "#8b9aaf",
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
      "line-color": "#d7b978",
      "target-arrow-color": "#d7b978",
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
