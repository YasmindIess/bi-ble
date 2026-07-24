import type {
  EditorDocument,
  FormulaNode
} from "./document";

const STORAGE_KEY = "bi-ble.editor.document.v1";

function isFormulaNode(value: unknown): value is FormulaNode {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<FormulaNode>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.kind === "string" &&
    typeof candidate.domain === "string" &&
    typeof candidate.x === "number" &&
    typeof candidate.y === "number" &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number"
  );
}

function isEditorDocument(value: unknown): value is EditorDocument {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<EditorDocument>;

  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.documentId === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.nodes) &&
    candidate.nodes.every(isFormulaNode) &&
    Array.isArray(candidate.edges) &&
    typeof candidate.viewport === "object" &&
    candidate.viewport !== null &&
    typeof candidate.executionBoundary === "object" &&
    candidate.executionBoundary !== null
  );
}

export function loadEditorDocument(): EditorDocument | null {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);

    if (serialized === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(serialized);

    return isEditorDocument(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveEditorDocument(document: EditorDocument): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(document)
  );
}
