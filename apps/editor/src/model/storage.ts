import type { FormulaDomain } from "../domain/palette";

import {
  createPorts,
  type EditorDocument,
  type FormulaEdge,
  type FormulaNode,
  type FormulaPort
} from "./document";

const STORAGE_KEY = "bi-ble.editor.document.v1";

function isFormulaDomain(
  value: unknown
): value is FormulaDomain {
  return (
    value === "core" ||
    value === "gravity" ||
    value === "ael"
  );
}

function isFormulaPort(
  value: unknown
): value is FormulaPort {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<FormulaPort>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.key === "string" &&
    typeof candidate.label === "string" &&
    (
      candidate.direction === "input" ||
      candidate.direction === "output"
    ) &&
    typeof candidate.dataType === "string"
  );
}

function isFormulaNodeV2(
  value: unknown
): value is FormulaNode {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<FormulaNode>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.kind === "string" &&
    isFormulaDomain(candidate.domain) &&
    typeof candidate.x === "number" &&
    typeof candidate.y === "number" &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number" &&
    Array.isArray(candidate.ports) &&
    candidate.ports.every(isFormulaPort) &&
    typeof candidate.createdAt === "string"
  );
}

function isFormulaEdgeV2(
  value: unknown
): value is FormulaEdge {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<FormulaEdge>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.source === "object" &&
    candidate.source !== null &&
    typeof candidate.source.nodeId === "string" &&
    typeof candidate.source.portId === "string" &&
    typeof candidate.target === "object" &&
    candidate.target !== null &&
    typeof candidate.target.nodeId === "string" &&
    typeof candidate.target.portId === "string" &&
    typeof candidate.dataType === "string" &&
    typeof candidate.createdAt === "string"
  );
}

function isEditorDocumentV2(
  value: unknown
): value is EditorDocument {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<EditorDocument>;

  return (
    candidate.schemaVersion === 2 &&
    typeof candidate.documentId === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.nodes) &&
    candidate.nodes.every(isFormulaNodeV2) &&
    Array.isArray(candidate.edges) &&
    candidate.edges.every(isFormulaEdgeV2) &&
    typeof candidate.viewport === "object" &&
    candidate.viewport !== null &&
    typeof candidate.executionBoundary === "object" &&
    candidate.executionBoundary !== null &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

function migrateVersionOne(
  value: unknown
): EditorDocument | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as {
    schemaVersion?: unknown;
    documentId?: unknown;
    title?: unknown;
    nodes?: unknown;
    viewport?: unknown;
    executionBoundary?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
  };

  if (
    candidate.schemaVersion !== 1 ||
    typeof candidate.documentId !== "string" ||
    typeof candidate.title !== "string" ||
    !Array.isArray(candidate.nodes) ||
    typeof candidate.viewport !== "object" ||
    candidate.viewport === null ||
    typeof candidate.executionBoundary !== "object" ||
    candidate.executionBoundary === null ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.updatedAt !== "string"
  ) {
    return null;
  }

  const migratedNodes: FormulaNode[] = [];

  for (const valueNode of candidate.nodes) {
    if (
      typeof valueNode !== "object" ||
      valueNode === null
    ) {
      return null;
    }

    const node = valueNode as Omit<
      FormulaNode,
      "ports"
    > & {
      domain?: unknown;
    };

    if (
      typeof node.id !== "string" ||
      typeof node.label !== "string" ||
      typeof node.kind !== "string" ||
      !isFormulaDomain(node.domain) ||
      typeof node.x !== "number" ||
      typeof node.y !== "number" ||
      typeof node.width !== "number" ||
      typeof node.height !== "number" ||
      typeof node.createdAt !== "string"
    ) {
      return null;
    }

    migratedNodes.push({
      ...node,
      domain: node.domain,
      ports: createPorts(node.domain, node.kind)
    });
  }

  return {
    schemaVersion: 2,
    documentId: candidate.documentId,
    title: candidate.title,
    nodes: migratedNodes,
    edges: [],
    viewport:
      candidate.viewport as EditorDocument["viewport"],
    executionBoundary:
      candidate.executionBoundary as EditorDocument[
        "executionBoundary"
      ],
    createdAt: candidate.createdAt,
    updatedAt: new Date().toISOString()
  };
}

export function loadEditorDocument(): EditorDocument | null {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);

    if (serialized === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(serialized);

    if (isEditorDocumentV2(parsed)) {
      return parsed;
    }

    return migrateVersionOne(parsed);
  } catch {
    return null;
  }
}

export function saveEditorDocument(
  document: EditorDocument
): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(document)
  );
}
