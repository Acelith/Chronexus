import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core } from "cytoscape";
import type { GraphData, GraphEdge, GraphNode } from "./api";
import { graphElements, graphStyle, readableGraph } from "./canvas";
export default function GraphCanvas({
  data,
  onNode,
  onEdge,
  focusId = null,
}: {
  data: GraphData;
  focusId?: string | null;
  onNode: (node: GraphNode) => void;
  onEdge: (edge: GraphEdge) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = useMemo(
    () => readableGraph(data, focusId, expanded),
    [data, focusId, expanded],
  );
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
      elements: graphElements(visible),
      style: graphStyle,
      layout: {
        name: "cose",
        randomize: false,
        nodeRepulsion: () => 140000,
        idealEdgeLength: () => 160,
        nodeOverlap: 30,
        componentSpacing: 120,
        numIter: 700,
        animate: false,
        padding: 65,
      },
      minZoom: 0.02,
      maxZoom: 2.5,
      wheelSensitivity: 0.2,
    });
    cy.current = instance;
    instance.on("tap", "node", (event) => {
      const node = visible.nodes.find((node) => node.id === event.target.id());
      instance.elements().removeClass("dimmed emphasized");
      instance
        .elements()
        .difference(event.target.closedNeighborhood())
        .addClass("dimmed");
      event.target.connectedEdges().addClass("emphasized");
      if (node) handlers.current.onNode(node);
    });
    instance.on("tap", "edge", (event) => {
      const edge = visible.edges.find((edge) => edge.id === event.target.id());
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
  }, [visible]);
  return (
    <div className="graph-visual">
      <div className="graph-view-toolbar">
        <span>
          {visible.nodes.length} di {data.nodes.length} nodi disponibili ·
          trascina per spostarti, seleziona per leggere
        </span>
        {data.nodes.length > 18 ? (
          <button onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Vista compatta" : "Mostra tutti i nodi"}
          </button>
        ) : null}
        <button
          onClick={() => {
            cy.current?.elements().removeClass("dimmed emphasized");
            cy.current?.elements().unselect();
          }}
        >
          Togli evidenza
        </button>
      </div>
      <div
        className="graph-canvas"
        ref={container}
        role="img"
        aria-label="Grafo della campagna. Le stesse informazioni sono disponibili nell'elenco accessibile."
        data-node-count={visible.nodes.length}
        data-edge-count={visible.edges.length}
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
