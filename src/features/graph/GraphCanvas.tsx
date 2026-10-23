import { useEffect, useRef } from "react";
import cytoscape, { type Core } from "cytoscape";
import type { GraphData, GraphEdge, GraphNode } from "./api";
import { graphElements, graphStyle } from "./canvas";
export default function GraphCanvas({
  data,
  onNode,
  onEdge,
}: {
  data: GraphData;
  onNode: (node: GraphNode) => void;
  onEdge: (edge: GraphEdge) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const handlers = useRef({ onNode, onEdge });
  useEffect(() => {
    handlers.current = { onNode, onEdge };
  }, [onNode, onEdge]);
  useEffect(() => {
    if (!container.current) return;
    const instance = cytoscape({
      container: container.current,
      elements: graphElements(data),
      style: graphStyle,
      layout: {
        name: "circle",
        animate: false,
        radius: Math.max(150, data.nodes.length * 14),
        avoidOverlap: true,
        padding: 65,
      },
      minZoom: 0.02,
      maxZoom: 1.4,
      wheelSensitivity: 0.2,
    });
    cy.current = instance;
    instance.on("tap", "node", (event) => {
      const node = data.nodes.find((node) => node.id === event.target.id());
      if (node) handlers.current.onNode(node);
    });
    instance.on("tap", "edge", (event) => {
      const edge = data.edges.find((edge) => edge.id === event.target.id());
      if (edge) handlers.current.onEdge(edge);
    });
    const observer = new ResizeObserver(() => {
      instance.resize();
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.destroy();
      cy.current = null;
    };
  }, [data]);
  return (
    <div className="graph-visual">
      <div
        className="graph-canvas"
        ref={container}
        role="img"
        aria-label="Grafo della campagna. Le stesse informazioni sono disponibili nell'elenco accessibile."
        data-node-count={data.nodes.length}
        data-edge-count={data.edges.length}
      />
      <div className="graph-controls">
        <button
          type="button"
          onClick={() => cy.current?.zoom((cy.current?.zoom() ?? 1) * 1.2)}
          aria-label="Ingrandisci grafo"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => cy.current?.zoom((cy.current?.zoom() ?? 1) / 1.2)}
          aria-label="Riduci grafo"
        >
          −
        </button>
        <button type="button" onClick={() => cy.current?.fit(undefined, 45)}>
          Adatta vista
        </button>
      </div>
    </div>
  );
}
