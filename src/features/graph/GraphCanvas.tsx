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
          "Campaign graph. The same information is available in the accessible list.",
        )}
        data-node-count={visible.nodes.length}
        data-edge-count={visible.edges.length}
      />
      <div className="graph-controls">
        <button
          type="button"
          onClick={() => cy.current?.zoom((cy.current?.zoom() ?? 1) * 1.2)}
          aria-label={tr("Zoom in graph")}
        >
          <Text source={"⌕ Zoom in"} />
        </button>
        <button
          type="button"
          onClick={() => cy.current?.zoom((cy.current?.zoom() ?? 1) / 1.2)}
          aria-label={tr("Zoom out graph")}
        >
          <Text source={"⌕ Zoom out"} />
        </button>
        <button type="button" onClick={() => cy.current?.fit(undefined, 30)}>
          <Text source={"⛶ Fit view"} />
        </button>
        <span className="graph-legend-inline">
          <span>
            <i className="person" />
            <Text source={"Characters"} />
          </span>
          <span>
            <i />
            <Text source={"Places"} />
          </span>
          <span>
            <i className="item" />
            <Text source={"Items"} />
          </span>
          <span>
            <Text source={"→ Relationships"} />
          </span>
        </span>
      </div>
      <details className="graph-view-options">
        <summary>
          <Text source={"Layout options"} />
        </summary>
        <div className="graph-view-toolbar">
          <label className="graph-arrangement">
            <Text source={"Layout"} />
            <select
              value={layoutMode}
              onChange={(e) => setLayoutMode(e.target.value as "grid" | "cose")}
            >
              <option value="grid">{tr("Readable map")}</option>
              <option value="cose">{tr("Organic")}</option>
            </select>
          </label>
          <span>
            {visible.nodes.length} <Text source={" di "} />
            {data.nodes.length} <Text source={" nodes · drag to pan"} />
          </span>
          {data.nodes.length > 18 ? (
            <button type="button" onClick={() => setExpanded((v) => !v)}>
              {expanded ? tr("Compact view") : tr("Show all nodes")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              cy.current?.elements().removeClass("dimmed emphasized");
              cy.current?.elements().unselect();
            }}
          >
            <Text source={"Remove highlight"} />
          </button>
        </div>
      </details>
    </div>
  );
}
