import type { EditorDocument } from "./document";

import {
  applyEditorOperation,
  invertEditorOperation,
  type EditorOperation
} from "./operations";

export interface OperationRecord {
  id: string;
  label: string;
  createdAt: string;
  forward: EditorOperation;
  inverse: EditorOperation;
  beforeDigest: string;
  afterDigest: string;
}

export interface HistoryState {
  entries: OperationRecord[];
  cursor: number;
}

export interface EditorSession {
  document: EditorDocument;
  history: HistoryState;
}

export function createHistoryState(): HistoryState {
  return {
    entries: [],
    cursor: 0
  };
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function canonicalDocumentPayload(
  document: EditorDocument
): string {
  return JSON.stringify({
    schemaVersion: document.schemaVersion,
    documentId: document.documentId,
    title: document.title,
    nodes: document.nodes,
    edges: document.edges,
    viewport: document.viewport,
    executionBoundary:
      document.executionBoundary,
    createdAt: document.createdAt
  });
}

async function digestDocument(
  document: EditorDocument
): Promise<string> {
  const bytes = new TextEncoder().encode(
    canonicalDocumentPayload(document)
  );

  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function commitEditorOperation(
  session: EditorSession,
  forward: EditorOperation,
  label: string
): Promise<EditorSession> {
  const beforeDocument = session.document;
  const afterDocument = applyEditorOperation(
    beforeDocument,
    forward
  );

  const [beforeDigest, afterDigest] =
    await Promise.all([
      digestDocument(beforeDocument),
      digestDocument(afterDocument)
    ]);

  const retainedEntries =
    session.history.entries.slice(
      0,
      session.history.cursor
    );

  const record: OperationRecord = {
    id: createId("operation"),
    label,
    createdAt: new Date().toISOString(),
    forward,
    inverse: invertEditorOperation(forward),
    beforeDigest,
    afterDigest
  };

  return {
    document: afterDocument,
    history: {
      entries: [...retainedEntries, record],
      cursor: retainedEntries.length + 1
    }
  };
}

export function canUndo(
  history: HistoryState
): boolean {
  return history.cursor > 0;
}

export function canRedo(
  history: HistoryState
): boolean {
  return history.cursor < history.entries.length;
}

export function undoEditorSession(
  session: EditorSession
): EditorSession {
  if (!canUndo(session.history)) {
    return session;
  }

  const record =
    session.history.entries[
      session.history.cursor - 1
    ];

  return {
    document: applyEditorOperation(
      session.document,
      record.inverse
    ),
    history: {
      ...session.history,
      cursor: session.history.cursor - 1
    }
  };
}

export function redoEditorSession(
  session: EditorSession
): EditorSession {
  if (!canRedo(session.history)) {
    return session;
  }

  const record =
    session.history.entries[
      session.history.cursor
    ];

  return {
    document: applyEditorOperation(
      session.document,
      record.forward
    ),
    history: {
      ...session.history,
      cursor: session.history.cursor + 1
    }
  };
}
