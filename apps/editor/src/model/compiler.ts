import type {
  EditorDocument,
  FormulaNode,
  FormulaPort
} from "./document";

export interface FormulaIRPort {
  id: string;
  key: string;
  label: string;
  direction: "input" | "output";
  dataType: string;
}

export interface FormulaIRNode {
  id: string;
  domain: "core" | "gravity" | "ael";
  kind: string;
  label: string;
  inputs: FormulaIRPort[];
  outputs: FormulaIRPort[];
}

export interface FormulaIREdge {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  dataType: string;
}

export interface FormulaIR {
  schemaVersion: 1;
  documentId: string;
  nodes: FormulaIRNode[];
  edges: FormulaIREdge[];
  executionBoundary: {
    mode: "simulation_only";
    externalExecutionAuthorized: false;
    liveSigningEnabled: false;
  };
}

export interface CompilationIssue {
  id: string;
  code: string;
  message: string;
  subjectIds: string[];
}

export interface CompilationResult {
  generatedAt: string;
  sourceDocumentId: string;
  sourceUpdatedAt: string;
  decision: "admitted" | "blocked";
  sourceDigest: string;
  irDigest: string;
  ir: FormulaIR;
  obstructions: CompilationIssue[];
  warnings: CompilationIssue[];
}

function endpointKey(
  nodeId: string,
  portId: string
): string {
  return `${nodeId}:${portId}`;
}

function findPort(
  node: FormulaNode,
  portId: string
): FormulaPort | null {
  return (
    node.ports.find(
      (port) => port.id === portId
    ) ?? null
  );
}

function compatibleTypes(
  sourceType: string,
  targetType: string
): boolean {
  return (
    sourceType === targetType ||
    sourceType === "core:any" ||
    targetType === "core:any"
  );
}

function normalizePort(
  port: FormulaPort
): FormulaIRPort {
  return {
    id: port.id,
    key: port.key,
    label: port.label,
    direction: port.direction,
    dataType: port.dataType
  };
}

function createFormulaIR(
  document: EditorDocument
): FormulaIR {
  const nodes = [...document.nodes]
    .sort((left, right) =>
      left.id.localeCompare(right.id)
    )
    .map((node): FormulaIRNode => ({
      id: node.id,
      domain: node.domain,
      kind: node.kind,
      label: node.label,

      inputs: node.ports
        .filter(
          (port) => port.direction === "input"
        )
        .map(normalizePort)
        .sort((left, right) =>
          left.id.localeCompare(right.id)
        ),

      outputs: node.ports
        .filter(
          (port) => port.direction === "output"
        )
        .map(normalizePort)
        .sort((left, right) =>
          left.id.localeCompare(right.id)
        )
    }));

  const edges = [...document.edges]
    .sort((left, right) =>
      left.id.localeCompare(right.id)
    )
    .map((edge): FormulaIREdge => ({
      id: edge.id,
      sourceNodeId: edge.source.nodeId,
      sourcePortId: edge.source.portId,
      targetNodeId: edge.target.nodeId,
      targetPortId: edge.target.portId,
      dataType: edge.dataType
    }));

  return {
    schemaVersion: 1,
    documentId: document.documentId,
    nodes,
    edges,
    executionBoundary:
      document.executionBoundary
  };
}

async function digestValue(
  value: unknown
): Promise<string> {
  const bytes = new TextEncoder().encode(
    JSON.stringify(value)
  );

  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

function createSourceDigestPayload(
  document: EditorDocument
): unknown {
  return {
    schemaVersion: document.schemaVersion,
    documentId: document.documentId,
    title: document.title,
    nodes: document.nodes,
    edges: document.edges,
    viewport: document.viewport,
    executionBoundary:
      document.executionBoundary,
    createdAt: document.createdAt
  };
}

function containsDirectedCycle(
  document: EditorDocument
): boolean {
  const adjacency = new Map<string, string[]>();

  for (const node of document.nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of document.edges) {
    const targets = adjacency.get(
      edge.source.nodeId
    );

    if (targets !== undefined) {
      targets.push(edge.target.nodeId);
    }
  }

  const state = new Map<
    string,
    "visiting" | "visited"
  >();

  const visit = (nodeId: string): boolean => {
    const currentState = state.get(nodeId);

    if (currentState === "visiting") {
      return true;
    }

    if (currentState === "visited") {
      return false;
    }

    state.set(nodeId, "visiting");

    for (const targetId of
      adjacency.get(nodeId) ?? []) {
      if (visit(targetId)) {
        return true;
      }
    }

    state.set(nodeId, "visited");

    return false;
  };

  return document.nodes.some(
    (node) => visit(node.id)
  );
}

export async function compileFormula(
  document: EditorDocument
): Promise<CompilationResult> {
  const obstructions: CompilationIssue[] = [];
  const warnings: CompilationIssue[] = [];

  const nodeMap = new Map(
    document.nodes.map((node) => [
      node.id,
      node
    ])
  );

  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const occupiedInputs = new Set<string>();
  const connectedNodes = new Set<string>();

  if (document.nodes.length === 0) {
    obstructions.push({
      id: "obstruction-empty-document",
      code: "empty_document",
      message:
        "The document contains no semantic objects.",
      subjectIds: [document.documentId]
    });
  }

  for (const node of document.nodes) {
    if (nodeIds.has(node.id)) {
      obstructions.push({
        id: `obstruction-duplicate-node-${node.id}`,
        code: "duplicate_node_id",
        message:
          `Node identity ${node.id} is duplicated.`,
        subjectIds: [node.id]
      });
    }

    nodeIds.add(node.id);
  }

  for (const edge of document.edges) {
    if (edgeIds.has(edge.id)) {
      obstructions.push({
        id: `obstruction-duplicate-edge-${edge.id}`,
        code: "duplicate_edge_id",
        message:
          `Edge identity ${edge.id} is duplicated.`,
        subjectIds: [edge.id]
      });
    }

    edgeIds.add(edge.id);

    const sourceNode = nodeMap.get(
      edge.source.nodeId
    );

    const targetNode = nodeMap.get(
      edge.target.nodeId
    );

    if (
      sourceNode === undefined ||
      targetNode === undefined
    ) {
      obstructions.push({
        id: `obstruction-missing-endpoint-${edge.id}`,
        code: "missing_edge_endpoint",
        message:
          "A relationship references a missing node.",
        subjectIds: [
          edge.id,
          edge.source.nodeId,
          edge.target.nodeId
        ]
      });

      continue;
    }

    const sourcePort = findPort(
      sourceNode,
      edge.source.portId
    );

    const targetPort = findPort(
      targetNode,
      edge.target.portId
    );

    if (
      sourcePort === null ||
      targetPort === null
    ) {
      obstructions.push({
        id: `obstruction-missing-port-${edge.id}`,
        code: "missing_edge_port",
        message:
          "A relationship references a missing port.",
        subjectIds: [
          edge.id,
          edge.source.portId,
          edge.target.portId
        ]
      });

      continue;
    }

    if (
      sourcePort.direction !== "output" ||
      targetPort.direction !== "input"
    ) {
      obstructions.push({
        id: `obstruction-direction-${edge.id}`,
        code: "invalid_port_direction",
        message:
          "Relationships must travel from an output to an input.",
        subjectIds: [
          edge.id,
          sourcePort.id,
          targetPort.id
        ]
      });
    }

    if (
      !compatibleTypes(
        sourcePort.dataType,
        targetPort.dataType
      )
    ) {
      obstructions.push({
        id: `obstruction-type-${edge.id}`,
        code: "incompatible_port_types",
        message:
          `${sourcePort.dataType} cannot enter ` +
          `${targetPort.dataType}.`,
        subjectIds: [
          edge.id,
          sourcePort.id,
          targetPort.id
        ]
      });
    }

    const inputKey = endpointKey(
      targetNode.id,
      targetPort.id
    );

    if (occupiedInputs.has(inputKey)) {
      obstructions.push({
        id: `obstruction-occupied-${inputKey}`,
        code: "multiply_connected_input",
        message:
          `${targetNode.label}.${targetPort.label} ` +
          "has more than one incoming relationship.",
        subjectIds: [
          targetNode.id,
          targetPort.id
        ]
      });
    }

    occupiedInputs.add(inputKey);
    connectedNodes.add(sourceNode.id);
    connectedNodes.add(targetNode.id);
  }

  for (const node of document.nodes) {
    const inputPorts = node.ports.filter(
      (port) => port.direction === "input"
    );

    for (const port of inputPorts) {
      const inputKey = endpointKey(
        node.id,
        port.id
      );

      if (!occupiedInputs.has(inputKey)) {
        obstructions.push({
          id:
            `obstruction-required-input-` +
            `${node.id}-${port.id}`,

          code: "required_input_unconnected",

          message:
            `${node.label}.${port.label} requires ` +
            `${port.dataType}.`,

          subjectIds: [
            node.id,
            port.id
          ]
        });
      }
    }

    if (!connectedNodes.has(node.id)) {
      warnings.push({
        id: `warning-isolated-node-${node.id}`,
        code: "isolated_node",
        message:
          `${node.label} is not connected to another object.`,
        subjectIds: [node.id]
      });
    }

    const externalEffectKind =
      node.kind === "effect" ||
      node.kind === "transaction-preview";

    if (
      externalEffectKind &&
      !document.executionBoundary
        .externalExecutionAuthorized
    ) {
      warnings.push({
        id: `warning-authority-${node.id}`,
        code: "external_execution_not_authorized",
        message:
          `${node.label} remains simulation-only. ` +
          "No external execution is authorized.",
        subjectIds: [node.id]
      });
    }
  }

  if (containsDirectedCycle(document)) {
    obstructions.push({
      id: "obstruction-directed-cycle",
      code: "directed_cycle",
      message:
        "The current formula contains a directed cycle.",
      subjectIds: document.nodes.map(
        (node) => node.id
      )
    });
  }

  const ir = createFormulaIR(document);

  const [sourceDigest, irDigest] =
    await Promise.all([
      digestValue(
        createSourceDigestPayload(document)
      ),
      digestValue(ir)
    ]);

  return {
    generatedAt: new Date().toISOString(),
    sourceDocumentId: document.documentId,
    sourceUpdatedAt: document.updatedAt,
    decision:
      obstructions.length === 0
        ? "admitted"
        : "blocked",
    sourceDigest,
    irDigest,
    ir,
    obstructions,
    warnings
  };
}
