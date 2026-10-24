import { iconPaths } from "../../components/Ornaments";
import type { ElementDefinition, StylesheetJson } from "cytoscape";
import { type GraphData } from "./api";
export function graphElements(data: GraphData): ElementDefinition[] {
  return [
    ...data.nodes.map((node) => {
      const kind =
        node.kind === "npc"
          ? "helmet"
          : node.kind === "place"
            ? "castle"
            : node.kind === "faction"
              ? "party"
              : node.kind === "session"
                ? "scroll"
                : "star";
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 32 32"><path d="${iconPaths[kind]}" fill="none" stroke="#cfb780" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      return {
        data: {
          ...node,
          label:
            node.kind === "session" ? node.title.split(":")[0] : node.title,
          size: node.kind === "faction" ? 110 : 85,
          icon: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        },
      };
    }),
    ...data.edges.map((edge) => ({
      data: {
        ...edge,
        displayLabel: edge.kind === "mention" ? "menziona" : edge.label,
      },
    })),
  ];
}
export const graphStyle: StylesheetJson = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "background-color": "#354b3e",
      color: "#30251d",
      "font-family": "Chronexus Text, Georgia, serif",
      "font-size": 21,
      "font-weight": 600,
      "text-valign": "bottom",
      "text-margin-y": 9,
      "text-background-color": "#eadcba",
      "text-background-opacity": 0,
      "text-background-padding": "2px",
      "text-wrap": "wrap",
      "text-max-width": "190px",
      width: "data(size)",
      height: "data(size)",
      "background-image": "data(icon)",
      "background-width": "76%",
      "background-height": "76%",
      "background-position-x": "50%",
      "background-position-y": "50%",
      "border-width": 5,
      "border-style": "double",
      "border-color": "#c4a96b",
    },
  },
  {
    selector: 'node[kind="session"]',
    style: { shape: "diamond", "background-color": "#817252" },
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
      opacity: 0.8,
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.8,
      label: "data(displayLabel)",
      "font-family": "Chronexus Text, Georgia, serif",
      "font-style": "italic",
      "font-size": 18,
      color: "#30251d",
      "text-background-color": "#e6d8b8",
      "text-background-opacity": 1,
      "text-background-padding": "3px",
      "text-rotation": "none",
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
      width: 1.4,
      "line-style": "solid",
      opacity: 0.85,
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
    style: { "background-color": "#354c3a", shape: "ellipse" },
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
      "font-size": 18,
      opacity: 1,
      width: 2.5,
      "z-index": 10,
    },
  },
);

graphStyle.push({
  selector: 'edge.emphasized[kind="mention"]',
  style: { label: "data(displayLabel)" },
});

/** Stable map: a real, highly connected node is central; remaining real nodes occupy rings. */
export function mapPositions(
  data: GraphData,
  focusId: string | null,
): Map<string, { x: number; y: number }> {
  const degree = new Map(data.nodes.map((n) => [n.id, 0]));
  for (const e of data.edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  const sorted = [...data.nodes].sort(
    (a, b) =>
      (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) ||
      a.title.localeCompare(b.title),
  );
  const center = sorted.find((n) => n.id === focusId) ?? sorted[0];
  const positions = new Map<string, { x: number; y: number }>();
  if (!center) return positions;
  positions.set(center.id, { x: 0, y: 0 });
  const outer = sorted.filter((n) => n.id !== center.id);
  if (outer.length <= 12) {
    const crossings = () => {
      const pos = new Map([
        [center.id, { x: 0, y: 0 }],
        ...outer.map(
          (n, i) =>
            [
              n.id,
              {
                x: Math.cos((i * 2 * Math.PI) / outer.length),
                y: Math.sin((i * 2 * Math.PI) / outer.length),
              },
            ] as const,
        ),
      ]);
      const turn = (
        a: { x: number; y: number },
        b: { x: number; y: number },
        c: { x: number; y: number },
      ) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      let score = 0;
      for (let i = 0; i < data.edges.length; i++)
        for (let j = i + 1; j < data.edges.length; j++) {
          const e = data.edges[i],
            f = data.edges[j];
          if (new Set([e.source, e.target, f.source, f.target]).size < 4)
            continue;
          const a = pos.get(e.source),
            b = pos.get(e.target),
            c = pos.get(f.source),
            d = pos.get(f.target);
          if (
            a &&
            b &&
            c &&
            d &&
            turn(a, b, c) * turn(a, b, d) < 0 &&
            turn(c, d, a) * turn(c, d, b) < 0
          )
            score++;
        }
      return score;
    };
    let best = crossings();
    for (let pass = 0; pass < 3; pass++)
      for (let a = 1; a < outer.length; a++)
        for (let b = a + 1; b < outer.length; b++) {
          [outer[a], outer[b]] = [outer[b], outer[a]];
          const next = crossings();
          if (next < best) best = next;
          else [outer[a], outer[b]] = [outer[b], outer[a]];
        }
  }
  for (let i = 0; i < outer.length; i++) {
    const ring = Math.floor(i / 10),
      count = Math.min(10, outer.length - ring * 10);
    const angle =
      -Math.PI / 2 + (2 * Math.PI * (i % 10)) / count + (ring % 2) * 0.25;
    const radius = 210 + ring * 210;
    positions.set(outer[i].id, {
      x: Math.cos(angle) * radius * 1.25,
      y: Math.sin(angle) * radius,
    });
  }
  return positions;
}
