import type {
  EditorDocument,
  FormulaEdge,
  FormulaNode
} from "./document";

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
      connectedEdges: FormulaEdge[];
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

      return {
        ...document,
        nodes: insertAt(
          document.nodes,
          operation.node,
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
                x: operation.to.x,
                y: operation.to.y
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
        type: "node.add",
        node: operation.node,
        index: operation.index
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
  }
}
