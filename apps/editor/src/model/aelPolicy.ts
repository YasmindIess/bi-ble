import type {
  CompilationIssue,
  FormulaIR,
  FormulaIRNode
} from "./compiler";

export interface AelPolicyEvaluation {
  checksPassed: number;
  checksTotal: number;
  obstructions: CompilationIssue[];
  warnings: CompilationIssue[];
}

function createIssue(
  code: string,
  message: string,
  subjectIds: string[]
): CompilationIssue {
  return {
    id:
      `ael-evidence-authority-${code}-` +
      subjectIds.join("-"),
    code,
    message,
    subjectIds
  };
}

function stringProperty(
  node: FormulaIRNode,
  key: string
): string {
  const value = node.properties[key];

  return typeof value === "string"
    ? value.trim()
    : "";
}

function numberProperty(
  node: FormulaIRNode,
  key: string
): number | null {
  const value = node.properties[key];

  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : null;
}

function booleanProperty(
  node: FormulaIRNode,
  key: string
): boolean {
  return node.properties[key] === true;
}

function incomingNodes(
  ir: FormulaIR,
  targetNodeId: string
): FormulaIRNode[] {
  return ir.edges
    .filter(
      (edge) =>
        edge.targetNodeId === targetNodeId
    )
    .flatMap((edge) => {
      const sourceNode = ir.nodes.find(
        (node) =>
          node.id === edge.sourceNodeId
      );

      return sourceNode === undefined
        ? []
        : [sourceNode];
    });
}

export function evaluateAelPropertyPolicy(
  ir: FormulaIR
): AelPolicyEvaluation {
  const obstructions: CompilationIssue[] = [];
  const warnings: CompilationIssue[] = [];

  let checksPassed = 0;
  let checksTotal = 0;

  const blockingCheck = (
    condition: boolean,
    code: string,
    message: string,
    subjectIds: string[]
  ) => {
    checksTotal += 1;

    if (condition) {
      checksPassed += 1;
      return;
    }

    obstructions.push(
      createIssue(
        code,
        message,
        subjectIds
      )
    );
  };

  const warningCheck = (
    condition: boolean,
    code: string,
    message: string,
    subjectIds: string[]
  ) => {
    checksTotal += 1;

    if (condition) {
      checksPassed += 1;
      return;
    }

    warnings.push(
      createIssue(
        code,
        message,
        subjectIds
      )
    );
  };

  const aelNodes = ir.nodes.filter(
    (node) => node.domain === "ael"
  );

  for (const node of aelNodes) {
    switch (node.kind) {
      case "repository-event": {
        blockingCheck(
          stringProperty(node, "repository") !== "",
          "repository_reference_missing",
          "Repository event requires a repository reference.",
          [node.id]
        );

        blockingCheck(
          stringProperty(node, "revision") !== "",
          "revision_reference_missing",
          "Repository event requires a commit or revision.",
          [node.id]
        );

        break;
      }

      case "evidence": {
        const sourceRef =
          stringProperty(node, "sourceRef");

        const verified =
          booleanProperty(node, "verified");

        blockingCheck(
          sourceRef !== "",
          "evidence_source_missing",
          "Evidence requires a reconstructible source reference.",
          [node.id]
        );

        warningCheck(
          verified,
          "evidence_not_verified",
          "Evidence exists but has not been marked verified.",
          [node.id]
        );

        break;
      }

      case "claim": {
        const claimClass =
          stringProperty(node, "claimClass");

        const statement =
          stringProperty(node, "statement");

        const confidence =
          numberProperty(node, "confidence");

        blockingCheck(
          claimClass !== "" &&
            claimClass !== "unclassified",
          "claim_class_missing",
          "Claim must be classified as fact, interpretation, or aspiration.",
          [node.id]
        );

        blockingCheck(
          statement !== "",
          "claim_statement_missing",
          "Claim requires a non-empty statement.",
          [node.id]
        );

        blockingCheck(
          confidence !== null &&
            confidence >= 0 &&
            confidence <= 100,
          "claim_confidence_out_of_range",
          "Claim confidence must be a number from 0 through 100.",
          [node.id]
        );

        if (claimClass === "fact") {
          const evidenceAncestors =
            incomingNodes(ir, node.id).filter(
              (sourceNode) =>
                sourceNode.domain === "ael" &&
                sourceNode.kind === "evidence"
            );

          const hasVerifiedEvidence =
            evidenceAncestors.some(
              (evidenceNode) =>
                booleanProperty(
                  evidenceNode,
                  "verified"
                ) &&
                stringProperty(
                  evidenceNode,
                  "sourceRef"
                ) !== ""
            );

          blockingCheck(
            hasVerifiedEvidence,
            "fact_without_verified_evidence",
            "A factual claim requires verified evidence ancestry.",
            [
              node.id,
              ...evidenceAncestors.map(
                (evidenceNode) =>
                  evidenceNode.id
              )
            ]
          );
        }

        break;
      }

      case "approval": {
        const decision =
          stringProperty(node, "decision");

        const reviewer =
          stringProperty(node, "reviewer");

        warningCheck(
          decision !== "pending",
          "approval_pending",
          "Approval remains pending.",
          [node.id]
        );

        if (
          decision === "approved" ||
          decision === "rejected"
        ) {
          blockingCheck(
            reviewer !== "",
            "approval_reviewer_missing",
            "A completed approval requires a reviewer.",
            [node.id]
          );
        }

        break;
      }

      case "effect": {
        const upstreamApprovals =
          incomingNodes(ir, node.id).filter(
            (sourceNode) =>
              sourceNode.domain === "ael" &&
              sourceNode.kind === "approval"
          );

        const hasApprovedAncestor =
          upstreamApprovals.some(
            (approvalNode) =>
              stringProperty(
                approvalNode,
                "decision"
              ) === "approved"
          );

        blockingCheck(
          hasApprovedAncestor,
          "effect_without_approved_approval",
          "Effect requires an approved upstream approval.",
          [
            node.id,
            ...upstreamApprovals.map(
              (approvalNode) =>
                approvalNode.id
            )
          ]
        );

        const locallyAuthorized =
          booleanProperty(
            node,
            "authorized"
          );

        blockingCheck(
          !locallyAuthorized ||
            ir.executionBoundary
              .externalExecutionAuthorized,
          "local_authority_exceeds_boundary",
          "A node cannot authorize external execution while the document boundary forbids it.",
          [node.id, ir.documentId]
        );

        break;
      }

      default:
        break;
    }
  }

  return {
    checksPassed,
    checksTotal,
    obstructions,
    warnings
  };
}
