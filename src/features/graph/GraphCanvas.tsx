import { tr } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core } from "cytoscape";
import type { GraphData, GraphEdge, GraphNode } from "./api";
import {
  graphElements,
  graphStyle,
  readableGraph,
  mapPositions,
} from "./canvas";
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
  const [layoutMode, setLayoutMode] = useState<"grid" | "cose">("grid");
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
    const elements = graphElements(visible);
    const positions = mapPositions(visible, focusId);
    elements.slice(0, visible.nodes.length).forEach((node) => {
      node.position = positions.get(String(node.data.id));
    });
    const instance = cytoscape({
      container: container.current,
      elements,
      style: graphStyle,
      layout:
        layoutMode === "grid"
          ? { name: "preset", fit: true, padding: 30 }
          : {
              name: "cose",
              randomize: false,
              nodeDimensionsIncludeLabels: true,
              nodeRepulsion: () => 140000,
              idealEdgeLength: () => 160,
              nodeOverlap: 80,
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
      instance.fit(undefined, 30);
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.destroy();
      cy.current = null;
    };
  }, [visible, layoutMode, focusId]);
  return (
    <div className="graph-visual">
      <div
        className="graph-canvas"
        ref={container}
        role="img"
        aria-label={tr(
          "Grafo della campagna. Le stesse informazioni sono disponibili nell’elenco accessibile.",
        )}
        data-node-count={visible.nodes.length}
        data-edge-count={visible.edges.length}
      />
      <div className="graph-controls">
        <button
          type="button"
          onClick={() => cy.current?.zoom((cy.current?.zoom() ?? 1) * 1.2)}
          aria-label={tr("Ingrandisci grafo")}
        >
          <Text source={"⌕ Ingrandisci"} />
        </button>
        <button
          type="button"
          onClick={() => cy.current?.zoom((cy.current?.zoom() ?? 1) / 1.2)}
          aria-label={tr("Riduci grafo")}
        >
          <Text source={"⌕ Riduci"} />
        </button>
        <button type="button" onClick={() => cy.current?.fit(undefined, 30)}>
          <Text source={"⛶ Adatta vista"} />
        </button>
        <span className="graph-legend-inline">
          <span>
            <i className="person" />
            <Text source={"Personaggi"} />
          </span>
          <span>
            <i />
            <Text source={"Luoghi"} />
          </span>
          <span>
            <i className="item" />
            <Text source={"Oggetti"} />
          </span>
          <span>
            <Text source={"→ Relazioni"} />
          </span>
        </span>
      </div>
      <details className="graph-view-options">
        <summary>
          <Text source={"Opzioni di disposizione"} />
        </summary>
        <div className="graph-view-toolbar">
          <label className="graph-arrangement">
            <Text source={"Disposizione"} />
            <select
              value={layoutMode}
              onChange={(e) => setLayoutMode(e.target.value as "grid" | "cose")}
            >
              <option value="grid">{tr("Mappa leggibile")}</option>
              <option value="cose">{tr("Organica")}</option>
            </select>
          </label>
          <span>
            {visible.nodes.length} <Text source={" di "} />
            {data.nodes.length}{" "}
            <Text source={" nodi · trascina per spostarti"} />
          </span>
          {data.nodes.length > 18 ? (
            <button type="button" onClick={() => setExpanded((v) => !v)}>
              {expanded ? tr("Vista compatta") : tr("Mostra tutti i nodi")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              cy.current?.elements().removeClass("dimmed emphasized");
              cy.current?.elements().unselect();
            }}
          >
            <Text source={"Togli evidenza"} />
          </button>
        </div>
      </details>
    </div>
  );
}
