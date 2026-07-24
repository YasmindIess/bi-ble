import type {
  FormulaDomain,
  PaletteItem
} from "../domain/palette";

export interface FormulaNode {
  id: string;
  label: string;
  kind: string;
  domain: FormulaDomain;
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: string;
}

export interface FormulaEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface EditorViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface ExecutionBoundary {
  mode: "simulation_only";
  externalExecutionAuthorized: false;
  liveSigningEnabled: false;
}

export interface EditorDocument {
  schemaVersion: 1;
  documentId: string;
  title: string;
  nodes: FormulaNode[];
  edges: FormulaEdge[];
  viewport: EditorViewport;
  executionBoundary: ExecutionBoundary;
  createdAt: string;
  updatedAt: string;
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createEditorDocument(): EditorDocument {
  const timestamp = new Date().toISOString();

  return {
    schemaVersion: 1,
    documentId: createId("document"),
    title: "Untitled formula",
    nodes: [],
    edges: [],
    viewport: {
      x: 0,
      y: 0,
      zoom: 1
    },
    executionBoundary: {
      mode: "simulation_only",
      externalExecutionAuthorized: false,
      liveSigningEnabled: false
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function createFormulaNode(
  item: PaletteItem,
  existingNodeCount: number
): FormulaNode {
  const columns = 3;
  const column = existingNodeCount % columns;
  const row = Math.floor(existingNodeCount / columns);

  return {
    id: createId("node"),
    label: item.label,
    kind: item.kind,
    domain: item.domain,
    x: 120 + column * 260,
    y: 110 + row * 145,
    width: 200,
    height: 92,
    createdAt: new Date().toISOString()
  };
}
