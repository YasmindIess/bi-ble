import type {
  EditorDocument,
  FormulaEdge,
  FormulaNode
} from "./document";

import type {
  FormulaProperties
} from "../domain/properties";

export interface IndexedFormulaEdge {
  edge: FormulaEdge;
  index: number;
}

export const EDITOR_GRID_SIZE = 16;

const MOVE_COLLISION_GAP = 16;
const CREATE_COLLISION_GAP = 32;
const PLACEMENT_SEARCH_RINGS = 12;

type PlacementMode =
  | "move"
  | "create";

interface NodePlacement {
  x: number;
  y: number;
}

interface PlacementCandidate
  extends NodePlacement {
  distanceSquared: number;
  manhattanDistance: number;
}

function snapCoordinate(
  value: number
): number {
  return Math.max(
    0,
    Math.round(value / EDITOR_GRID_SIZE) *
      EDITOR_GRID_SIZE
  );
}

export function snapNodePosition(
  position: NodePlacement
): NodePlacement {
  return {
    x: snapCoordinate(position.x),
    y: snapCoordinate(position.y)
  };
}

function placementsOverlap(
  candidate: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
  existing: FormulaNode,
  gap: number
): boolean {
  const separatedHorizontally =
    candidate.x +
      candidate.width +
      gap <=
      existing.x ||
    existing.x +
      existing.width +
      gap <=
      candidate.x;

  const separatedVertically =
    candidate.y +
      candidate.height +
      gap <=
      existing.y ||
    existing.y +
      existing.height +
      gap <=
      candidate.y;

  return !(
    separatedHorizontally ||
    separatedVertically
  );
}

function createNearbyCandidates(
  requestedPosition: NodePlacement
): PlacementCandidate[] {
  const snapped =
    snapNodePosition(requestedPosition);

  const candidates:
    PlacementCandidate[] = [];

  const seen = new Set<string>();

  for (
    let horizontal = -PLACEMENT_SEARCH_RINGS;
    horizontal <= PLACEMENT_SEARCH_RINGS;
    horizontal += 1
  ) {
    for (
      let vertical = -PLACEMENT_SEARCH_RINGS;
      vertical <= PLACEMENT_SEARCH_RINGS;
      vertical += 1
    ) {
      const x = Math.max(
        0,
        snapped.x +
          horizontal * EDITOR_GRID_SIZE
      );

      const y = Math.max(
        0,
        snapped.y +
          vertical * EDITOR_GRID_SIZE
      );

      const key = `${x}:${y}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);

      const deltaX =
        x - requestedPosition.x;

      const deltaY =
        y - requestedPosition.y;

      candidates.push({
        x,
        y,

        distanceSquared:
          deltaX * deltaX +
          deltaY * deltaY,

        manhattanDistance:
          Math.abs(deltaX) +
          Math.abs(deltaY)
      });
    }
  }

  return candidates.sort(
    (left, right) =>
      left.distanceSquared -
        right.distanceSquared ||
      left.manhattanDistance -
        right.manhattanDistance ||
      left.y - right.y ||
      left.x - right.x
  );
}

export function resolveResponsiblePlacement(
  document: EditorDocument,

  subject: {
    id: string;
    width: number;
    height: number;
  },

  requestedPosition: NodePlacement,

  mode: PlacementMode
): NodePlacement {
  const otherNodes =
    document.nodes.filter(
      (node) => node.id !== subject.id
    );

  const gap =
    mode === "create"
      ? CREATE_COLLISION_GAP
      : MOVE_COLLISION_GAP;

  const candidates =
    createNearbyCandidates(
      requestedPosition
    );

  for (const candidate of candidates) {
    const placement = {
      x: candidate.x,
      y: candidate.y,
      width: subject.width,
      height: subject.height
    };

    const available =
      otherNodes.every(
        (node) =>
          !placementsOverlap(
            placement,
            node,
            gap
          )
      );

    if (available) {
      return {
        x: candidate.x,
        y: candidate.y
      };
    }
  }

  return snapNodePosition(
    requestedPosition
  );
}

export type EditorOperation =
  | {
      type: "node.add";
      node: FormulaNode;
      index: number;
    }
  | {
      type: "node.remove";
      node: FormulaNode;
      index: number;
      connectedEdges: IndexedFormulaEdge[];
    }
  | {
      type: "node.restore";
      node: FormulaNode;
      index: number;
      connectedEdges: IndexedFormulaEdge[];
    }
  | {
      type: "edge.add";
      edge: FormulaEdge;
      index: number;
    }
  | {
      type: "edge.remove";
      edge: FormulaEdge;
      index: number;
    }
  | {
      type: "node.move";
      nodeId: string;
      from: {
        x: number;
        y: number;
      };
      to: {
        x: number;
        y: number;
      };
    }
  | {
      type: "node.properties.update";
      nodeId: string;
      from: FormulaProperties;
      to: FormulaProperties;
    };

function insertAt<T>(
  values: T[],
  value: T,
  index: number
): T[] {
  const nextValues = [...values];

  const safeIndex = Math.max(
    0,
    Math.min(index, nextValues.length)
  );

  nextValues.splice(safeIndex, 0, value);

  return nextValues;
}

function restoreConnectedEdges(
  existingEdges: FormulaEdge[],
  connectedEdges: IndexedFormulaEdge[]
): FormulaEdge[] {
  return [...connectedEdges]
    .sort((left, right) => left.index - right.index)
    .reduce(
      (edges, indexedEdge) => {
        const alreadyExists = edges.some(
          (edge) => edge.id === indexedEdge.edge.id
        );

        if (alreadyExists) {
          return edges;
        }

        return insertAt(
          edges,
          indexedEdge.edge,
          indexedEdge.index
        );
      },
      [...existingEdges]
    );
}

export function applyEditorOperation(
  document: EditorDocument,
  operation: EditorOperation
): EditorDocument {
  const updatedAt = new Date().toISOString();

  switch (operation.type) {
    case "node.add": {
      const alreadyExists = document.nodes.some(
        (node) => node.id === operation.node.id
      );

      if (alreadyExists) {
        return document;
      }

      const position =
        resolveResponsiblePlacement(
          document,
          operation.node,
          {
            x: operation.node.x,
            y: operation.node.y
          },
          "create"
        );

      const positionedNode: FormulaNode = {
        ...operation.node,
        x: position.x,
        y: position.y
      };

      return {
        ...document,

        nodes: insertAt(
          document.nodes,
          positionedNode,
          operation.index
        ),

        updatedAt
      };
    }

    case "node.remove": {
      return {
        ...document,

        nodes: document.nodes.filter(
          (node) => node.id !== operation.node.id
        ),

        edges: document.edges.filter(
          (edge) =>
            edge.source.nodeId !== operation.node.id &&
            edge.target.nodeId !== operation.node.id
        ),

        updatedAt
      };
    }

    case "node.restore": {
      const nodeAlreadyExists = document.nodes.some(
        (node) => node.id === operation.node.id
      );

      const nodes = nodeAlreadyExists
        ? document.nodes
        : insertAt(
            document.nodes,
            operation.node,
            operation.index
          );

      return {
        ...document,

        nodes,

        edges: restoreConnectedEdges(
          document.edges,
          operation.connectedEdges
        ),

        updatedAt
      };
    }

    case "edge.add": {
      const alreadyExists = document.edges.some(
        (edge) => edge.id === operation.edge.id
      );

      if (alreadyExists) {
        return document;
      }

      return {
        ...document,

        edges: insertAt(
          document.edges,
          operation.edge,
          operation.index
        ),

        updatedAt
      };
    }

    case "edge.remove": {
      return {
        ...document,

        edges: document.edges.filter(
          (edge) => edge.id !== operation.edge.id
        ),

        updatedAt
      };
    }

    case "node.move": {
      const movingNode =
        document.nodes.find(
          (node) =>
            node.id === operation.nodeId
        );

      if (movingNode === undefined) {
        return document;
      }

      const position =
        resolveResponsiblePlacement(
          document,
          movingNode,
          operation.to,
          "move"
        );

      return {
        ...document,

        nodes: document.nodes.map((node) =>
          node.id === operation.nodeId
            ? {
                ...node,
                x: position.x,
                y: position.y
              }
            : node
        ),

        updatedAt
      };
    }

    case "node.properties.update": {
      const nodeExists = document.nodes.some(
        (node) => node.id === operation.nodeId
      );

      if (!nodeExists) {
        return document;
      }

      return {
        ...document,

        nodes: document.nodes.map((node) =>
          node.id === operation.nodeId
            ? {
                ...node,
                properties: {
                  ...operation.to
                }
              }
            : node
        ),

        updatedAt
      };
    }
  }
}

export function invertEditorOperation(
  operation: EditorOperation
): EditorOperation {
  switch (operation.type) {
    case "node.add":
      return {
        type: "node.remove",
        node: operation.node,
        index: operation.index,
        connectedEdges: []
      };

    case "node.remove":
      return {
        type: "node.restore",
        node: operation.node,
        index: operation.index,
        connectedEdges: operation.connectedEdges
      };

    case "node.restore":
      return {
        type: "node.remove",
        node: operation.node,
        index: operation.index,
        connectedEdges: operation.connectedEdges
      };

    case "edge.add":
      return {
        type: "edge.remove",
        edge: operation.edge,
        index: operation.index
      };

    case "edge.remove":
      return {
        type: "edge.add",
        edge: operation.edge,
        index: operation.index
      };

    case "node.move":
      return {
        type: "node.move",
        nodeId: operation.nodeId,
        from: operation.to,
        to: operation.from
      };

    case "node.properties.update":
      return {
        type: "node.properties.update",
        nodeId: operation.nodeId,
        from: operation.to,
        to: operation.from
      };
  }
}
