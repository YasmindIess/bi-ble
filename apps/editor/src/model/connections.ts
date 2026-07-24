import type {
  EditorDocument,
  FormulaEndpoint,
  FormulaPort
} from "./document";

export type ConnectionDecision =
  | {
      admitted: true;
      dataType: string;
    }
  | {
      admitted: false;
      reason: string;
    };

function findPort(
  document: EditorDocument,
  endpoint: FormulaEndpoint
): FormulaPort | null {
  const node = document.nodes.find(
    (candidate) => candidate.id === endpoint.nodeId
  );

  if (node === undefined) {
    return null;
  }

  return (
    node.ports.find(
      (candidate) => candidate.id === endpoint.portId
    ) ?? null
  );
}

export function validateConnection(
  document: EditorDocument,
  source: FormulaEndpoint,
  target: FormulaEndpoint
): ConnectionDecision {
  if (source.nodeId === target.nodeId) {
    return {
      admitted: false,
      reason: "A node cannot connect directly to itself."
    };
  }

  const sourcePort = findPort(document, source);
  const targetPort = findPort(document, target);

  if (sourcePort === null || targetPort === null) {
    return {
      admitted: false,
      reason: "One of the selected ports no longer exists."
    };
  }

  if (sourcePort.direction !== "output") {
    return {
      admitted: false,
      reason: "The connection must begin at an output port."
    };
  }

  if (targetPort.direction !== "input") {
    return {
      admitted: false,
      reason: "The connection must end at an input port."
    };
  }

  const compatible =
    sourcePort.dataType === targetPort.dataType ||
    sourcePort.dataType === "core:any" ||
    targetPort.dataType === "core:any";

  if (!compatible) {
    return {
      admitted: false,
      reason:
        `${sourcePort.dataType} cannot enter ` +
        `${targetPort.dataType}.`
    };
  }

  const duplicate = document.edges.some(
    (edge) =>
      edge.source.nodeId === source.nodeId &&
      edge.source.portId === source.portId &&
      edge.target.nodeId === target.nodeId &&
      edge.target.portId === target.portId
  );

  if (duplicate) {
    return {
      admitted: false,
      reason: "This relationship already exists."
    };
  }

  const occupiedTarget = document.edges.some(
    (edge) =>
      edge.target.nodeId === target.nodeId &&
      edge.target.portId === target.portId
  );

  if (occupiedTarget) {
    return {
      admitted: false,
      reason:
        "This input already has an incoming relationship."
    };
  }

  return {
    admitted: true,
    dataType: sourcePort.dataType
  };
}
