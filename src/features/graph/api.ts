import { command } from "../journal/api";
import type { PageKind } from "../knowledge/api";
export const certainties = {
  confirmed: "Confermata",
  suspected: "Sospetta",
  disproven: "Smentita",
  unknown: "Sconosciuta",
} as const;
export type Certainty = keyof typeof certainties;
export interface SourceRef {
  kind: "session" | "page";
  id: string;
  title: string;
  blockId: string | null;
}
export interface GraphNode {
  id: string;
  entityId: string;
  title: string;
  kind: PageKind | "session" | "missing";
  missing: boolean;
}
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: "mention" | "assertion";
  label: string;
  certainty: Certainty | null;
  relationshipId: string | null;
  provenance: SourceRef | null;
  preview: string;
}
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  totalNodes: number;
  totalEdges: number;
}
export interface GraphQuery {
  kind: GraphNode["kind"] | null;
  edgeKind: "all" | "mentions" | "assertions";
  certainty: Certainty | null;
  focusId: string | null;
  depth: 1 | 2;
  sessionId: string | null;
  search: string;
}
export const defaultQuery: GraphQuery = {
  kind: null,
  edgeKind: "all",
  certainty: null,
  focusId: null,
  depth: 1,
  sessionId: null,
  search: "",
};
export interface RelationshipInput {
  fromPageId: string;
  toPageId: string;
  label: string;
  certainty: Certainty;
  sourceKind: "session" | "page" | null;
  sourceId: string | null;
  sourceBlockId: string | null;
  evidence: string;
  notes: string;
}
export interface Relationship extends RelationshipInput {
  id: string;
  campaignId: string;
  revision: number;
  sourceAvailable: boolean;
}
export const graphApi = {
  graph: (campaignId: string, query: GraphQuery) =>
    command<GraphData>("get_graph", { campaignId, query }),
  relationship: (campaignId: string, id: string) =>
    command<Relationship>("get_relationship", { campaignId, id }),
  save: (campaignId: string, input: RelationshipInput, record?: Relationship) =>
    command<Relationship>("save_relationship", {
      campaignId,
      input,
      id: record?.id ?? null,
      revision: record?.revision ?? null,
    }),
  remove: (campaignId: string, record: Relationship) =>
    command<void>("delete_relationship", {
      campaignId,
      id: record.id,
      revision: record.revision,
    }),
};
