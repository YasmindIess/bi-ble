import type {
  CompilationIssue,
  FormulaIR,
  FormulaIREdge,
  FormulaIRNode
} from "./compiler";

import {
  evaluateAelPropertyPolicy
} from "./aelPolicy";

export type TribunalDecision =
  | "admitted"
  | "blocked"
  | "not_applicable";

export interface TribunalFacts {
  nodeCount: number;
  edgeCount: number;
  checksPassed: number;
  checksTotal: number;
}

export interface TribunalReport {
  id:
    | "structural_coherence"
    | "ael_evidence_authority"
    | "gravity_route_boundary";

  label: string;
  domain:
    | "structural"
    | "ael"
    | "gravity";

  decision: TribunalDecision;
  score: number | null;
  facts: TribunalFacts;
  obstructions: CompilationIssue[];
  warnings: CompilationIssue[];
}

interface StructuralEvaluation {
  decision: "admitted" | "blocked";
  obstructions: CompilationIssue[];
  warnings: CompilationIssue[];
}

interface StageDefinition {
  kind: string;
  label: string;
}

interface TransitionDefinition {
  sourceKind: string;
  targetKind: string;
  dataType: string;
}

interface LinearTribunalDefinition {
  id:
    | "ael_evidence_authority"
    | "gravity_route_boundary";

  label: string;
  domain: "ael" | "gravity";
  stages: StageDefinition[];
  transitions: TransitionDefinition[];
}

const aelDefinition: LinearTribunalDefinition = {
  id: "ael_evidence_authority",
  label: "AEL evidence authority",
  domain: "ael",

  stages: [
    {
      kind: "repository-event",
      label: "Repository event"
    },
    {
      kind: "evidence",
      label: "Evidence"
    },
    {
      kind: "claim",
      label: "Claim"
    },
    {
      kind: "approval",
      label: "Approval"
    },
    {
      kind: "effect",
      label: "Effect"
    }
  ],

  transitions: [
    {
      sourceKind: "repository-event",
      targetKind: "evidence",
      dataType: "ael:event"
    },
    {
      sourceKind: "evidence",
      targetKind: "claim",
      dataType: "ael:evidence"
    },
    {
      sourceKind: "claim",
      targetKind: "approval",
      dataType: "ael:claim"
    },
    {
      sourceKind: "approval",
      targetKind: "effect",
      dataType: "ael:authorized"
    }
  ]
};

const gravityDefinition: LinearTribunalDefinition = {
  id: "gravity_route_boundary",
  label: "Gravity route boundary",
  domain: "gravity",

  stages: [
    {
      kind: "network",
      label: "Network"
    },
    {
      kind: "asset",
      label: "Asset"
    },
    {
      kind: "route",
      label: "Route"
    },
    {
      kind: "environment-boundary",
      label: "Environment boundary"
    },
    {
      kind: "transaction-preview",
      label: "Transaction preview"
    }
  ],

  transitions: [
    {
      sourceKind: "network",
      targetKind: "asset",
      dataType: "gravity:network"
    },
    {
      sourceKind: "asset",
      targetKind: "route",
      dataType: "gravity:asset"
    },
    {
      sourceKind: "route",
      targetKind: "environment-boundary",
      dataType: "gravity:route"
    },
    {
      sourceKind: "environment-boundary",
      targetKind: "transaction-preview",
      dataType: "gravity:environment"
    }
  ]
};

function issue(
  tribunalId: string,
  code: string,
  message: string,
  subjectIds: string[]
): CompilationIssue {
  return {
    id:
      `${tribunalId}-${code}-` +
      subjectIds.join("-"),

    code,
    message,
    subjectIds
  };
}

function incomingEdges(
  ir: FormulaIR,
  nodeId: string
): FormulaIREdge[] {
  return ir.edges.filter(
    (edge) => edge.targetNodeId === nodeId
  );
}

function outgoingEdges(
  ir: FormulaIR,
  nodeId: string
): FormulaIREdge[] {
  return ir.edges.filter(
    (edge) => edge.sourceNodeId === nodeId
  );
}

function nodeById(
  ir: FormulaIR,
  nodeId: string
): FormulaIRNode | null {
  return (
    ir.nodes.find(
      (node) => node.id === nodeId
    ) ?? null
  );
}

function validTransitionEdge(
  ir: FormulaIR,
  edge: FormulaIREdge,
  definition: TransitionDefinition,
  domain: "ael" | "gravity"
): boolean {
  const sourceNode = nodeById(
    ir,
    edge.sourceNodeId
  );

  const targetNode = nodeById(
    ir,
    edge.targetNodeId
  );

  return (
    sourceNode !== null &&
    targetNode !== null &&
    sourceNode.domain === domain &&
    targetNode.domain === domain &&
    sourceNode.kind === definition.sourceKind &&
    targetNode.kind === definition.targetKind &&
    edge.dataType === definition.dataType
  );
}

function expectedIncomingTransition(
  definition: LinearTribunalDefinition,
  targetKind: string
): TransitionDefinition | null {
  return (
    definition.transitions.find(
      (transition) =>
        transition.targetKind === targetKind
    ) ?? null
  );
}

function expectedOutgoingTransition(
  definition: LinearTribunalDefinition,
  sourceKind: string
): TransitionDefinition | null {
  return (
    definition.transitions.find(
      (transition) =>
        transition.sourceKind === sourceKind
    ) ?? null
  );
}

function evaluateLinearTribunal(
  ir: FormulaIR,
  definition: LinearTribunalDefinition,
  structural: StructuralEvaluation
): TribunalReport {
  const domainNodes = ir.nodes.filter(
    (node) => node.domain === definition.domain
  );

  const domainNodeIds = new Set(
    domainNodes.map((node) => node.id)
  );

  const domainEdges = ir.edges.filter(
    (edge) =>
      domainNodeIds.has(edge.sourceNodeId) ||
      domainNodeIds.has(edge.targetNodeId)
  );

  if (domainNodes.length === 0) {
    return {
      id: definition.id,
      label: definition.label,
      domain: definition.domain,
      decision: "not_applicable",
      score: null,

      facts: {
        nodeCount: 0,
        edgeCount: 0,
        checksPassed: 0,
        checksTotal: 0
      },

      obstructions: [],
      warnings: []
    };
  }

  const obstructions: CompilationIssue[] = [];
  const warnings: CompilationIssue[] = [];

  let checksPassed = 0;
  let checksTotal = 0;

  for (const stage of definition.stages) {
    checksTotal += 1;

    const stageNodes = domainNodes.filter(
      (node) => node.kind === stage.kind
    );

    if (stageNodes.length === 0) {
      obstructions.push(
        issue(
          definition.id,
          "required_stage_missing",
          `${stage.label} is required by the ` +
            `${definition.label} tribunal.`,
          [definition.domain, stage.kind]
        )
      );
    } else {
      checksPassed += 1;
    }
  }

  for (const node of domainNodes) {
    const expectedIncoming =
      expectedIncomingTransition(
        definition,
        node.kind
      );

    if (expectedIncoming !== null) {
      checksTotal += 1;

      const incoming = incomingEdges(
        ir,
        node.id
      );

      const validIncoming = incoming.some(
        (edge) =>
          validTransitionEdge(
            ir,
            edge,
            expectedIncoming,
            definition.domain
          )
      );

      if (validIncoming) {
        checksPassed += 1;
      } else {
        const crossDomainIncoming =
          incoming.find((edge) => {
            const sourceNode = nodeById(
              ir,
              edge.sourceNodeId
            );

            return (
              sourceNode !== null &&
              sourceNode.domain !==
                definition.domain
            );
          });

        if (crossDomainIncoming !== undefined) {
          obstructions.push(
            issue(
              definition.id,
              "cross_domain_input_unadapted",
              `${node.label} receives an input from ` +
                "another domain without an explicit adapter.",
              [
                node.id,
                crossDomainIncoming.id,
                crossDomainIncoming.sourceNodeId
              ]
            )
          );
        } else {
          obstructions.push(
            issue(
              definition.id,
              "expected_predecessor_missing",
              `${node.label} requires a ` +
                `${expectedIncoming.sourceKind} ` +
                `predecessor carrying ` +
                `${expectedIncoming.dataType}.`,
              [node.id]
            )
          );
        }
      }
    }

    const expectedOutgoing =
      expectedOutgoingTransition(
        definition,
        node.kind
      );

    if (expectedOutgoing !== null) {
      const hasValidOutgoing =
        outgoingEdges(ir, node.id).some(
          (edge) =>
            validTransitionEdge(
              ir,
              edge,
              expectedOutgoing,
              definition.domain
            )
        );

      if (!hasValidOutgoing) {
        warnings.push(
          issue(
            definition.id,
            "stage_not_forwarded",
            `${node.label} does not currently forward ` +
              `into ${expectedOutgoing.targetKind}.`,
            [node.id]
          )
        );
      }
    }
  }

  if (definition.domain === "ael") {
    const propertyEvaluation =
      evaluateAelPropertyPolicy(ir);

    checksPassed +=
      propertyEvaluation.checksPassed;

    checksTotal +=
      propertyEvaluation.checksTotal;

    obstructions.push(
      ...propertyEvaluation.obstructions
    );

    warnings.push(
      ...propertyEvaluation.warnings
    );
  }

  if (structural.decision === "blocked") {
    obstructions.unshift(
      issue(
        definition.id,
        "structural_gate_blocked",
        "The structural coherence tribunal blocked " +
          "the source graph before domain admission.",
        [ir.documentId]
      )
    );
  }

  if (definition.domain === "gravity") {
    warnings.push(
      issue(
        definition.id,
        "network_metadata_not_bound",
        "Gravity topology is being evaluated, but " +
          "network IDs, environment classes, asset " +
          "value status, and route metadata are not " +
          "bound yet.",
        domainNodes.map((node) => node.id)
      )
    );
  }

  const score =
    checksTotal === 0
      ? null
      : Math.round(
          (checksPassed / checksTotal) * 100
        );

  return {
    id: definition.id,
    label: definition.label,
    domain: definition.domain,

    decision:
      obstructions.length === 0
        ? "admitted"
        : "blocked",

    score,

    facts: {
      nodeCount: domainNodes.length,
      edgeCount: domainEdges.length,
      checksPassed,
      checksTotal
    },

    obstructions,
    warnings
  };
}

export function evaluateTribunals(
  ir: FormulaIR,
  structural: StructuralEvaluation
): TribunalReport[] {
  const structuralChecksTotal =
    ir.nodes.length + ir.edges.length;

  const structuralChecksPassed =
    structural.decision === "admitted"
      ? structuralChecksTotal
      : Math.max(
          0,
          structuralChecksTotal -
            structural.obstructions.length
        );

  const structuralReport: TribunalReport = {
    id: "structural_coherence",
    label: "Structural coherence",
    domain: "structural",
    decision: structural.decision,

    score:
      structuralChecksTotal === 0
        ? 0
        : Math.round(
            (
              structuralChecksPassed /
              structuralChecksTotal
            ) * 100
          ),

    facts: {
      nodeCount: ir.nodes.length,
      edgeCount: ir.edges.length,
      checksPassed: structuralChecksPassed,
      checksTotal: structuralChecksTotal
    },

    obstructions: structural.obstructions,
    warnings: structural.warnings
  };

  return [
    structuralReport,

    evaluateLinearTribunal(
      ir,
      aelDefinition,
      structural
    ),

    evaluateLinearTribunal(
      ir,
      gravityDefinition,
      structural
    )
  ];
}
