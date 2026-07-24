import type {
  FormulaDomain,
  PaletteItem
} from "../domain/palette";

import {
  getPortTemplates,
  type PortDirection
} from "../domain/definitions";

export interface FormulaPort {
  id: string;
  key: string;
  label: string;
  direction: PortDirection;
  dataType: string;
}

export interface FormulaNode {
  id: string;
  label: string;
  kind: string;
  domain: FormulaDomain;
  x: number;
  y: number;
  width: number;
  height: number;
  ports: FormulaPort[];
  createdAt: string;
}

export interface FormulaEndpoint {
  nodeId: string;
  portId: string;
}

export interface FormulaEdge {
  id: string;
  source: FormulaEndpoint;
  target: FormulaEndpoint;
  dataType: string;
  createdAt: string;
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
  schemaVersion: 2;
  documentId: string;
  title: string;
  nodes: FormulaNode[];
  edges: FormulaEdge[];
  viewport: EditorViewport;
  executionBoundary: ExecutionBoundary;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createPorts(
  domain: FormulaDomain,
  kind: string
): FormulaPort[] {
  return getPortTemplates(domain, kind).map(
    (template) => ({
      id: createId("port"),
      ...template
    })
  );
}

export function createEditorDocument(): EditorDocument {
  const timestamp = new Date().toISOString();

  return {
    schemaVersion: 2,
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
  const ports = createPorts(item.domain, item.kind);

  const inputCount = ports.filter(
    (port) => port.direction === "input"
  ).length;

  const outputCount = ports.filter(
    (port) => port.direction === "output"
  ).length;

  const maximumPortCount = Math.max(
    inputCount,
    outputCount,
    1
  );

  return {
    id: createId("node"),
    label: item.label,
    kind: item.kind,
    domain: item.domain,
    x: 120 + column * 260,
    y: 110 + row * 145,
    width: 200,
    height: Math.max(92, 64 + maximumPortCount * 22),
    ports,
    createdAt: new Date().toISOString()
  };
}

export function createFormulaEdge(
  source: FormulaEndpoint,
  target: FormulaEndpoint,
  dataType: string
): FormulaEdge {
  return {
    id: createId("edge"),
    source,
    target,
    dataType,
    createdAt: new Date().toISOString()
  };
}

export function getPortPosition(
  node: FormulaNode,
  portId: string
): CanvasPoint | null {
  const port = node.ports.find(
    (candidate) => candidate.id === portId
  );

  if (port === undefined) {
    return null;
  }

  const siblingPorts = node.ports.filter(
    (candidate) =>
      candidate.direction === port.direction
  );

  const portIndex = siblingPorts.findIndex(
    (candidate) => candidate.id === portId
  );

  if (portIndex < 0) {
    return null;
  }

  return {
    x:
      node.x +
      (port.direction === "input" ? 0 : node.width),
    y: node.y + 51 + portIndex * 22
  };
}
