import type {
  EditorOperation
} from "./operations";

export interface PointerGestureFacts {
  kind: "pointer_drag";
  durationMs: number;
  pointerTravel: number;
  finalDisplacement: number;
  deltaX: number;
  deltaY: number;
  efficiencyRatio: number;
}

export interface OperationAuditContext {
  pointerGesture?: Omit<
    PointerGestureFacts,
    "efficiencyRatio"
  >;
}

export interface AuditInterpretation {
  kind: "movement_efficiency";
  authority: "heuristic";
  status: "candidate";
  statement: string;
  basis: string[];
}

export interface AuditReceipt {
  id: string;
  operationId: string;
  operationLabel: string;
  operationType: EditorOperation["type"];
  subjectIds: string[];
  decision: "admitted";
  recordedAt: string;
  facts: {
    beforeDigest: string;
    afterDigest: string;
    pointerGesture?: PointerGestureFacts;
  };
  interpretations: AuditInterpretation[];
}

export interface AuditState {
  receipts: AuditReceipt[];
}

interface CreateAuditReceiptInput {
  operationId: string;
  operationLabel: string;
  operation: EditorOperation;
  recordedAt: string;
  beforeDigest: string;
  afterDigest: string;
  context?: OperationAuditContext;
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function subjectIdsForOperation(
  operation: EditorOperation
): string[] {
  switch (operation.type) {
    case "node.add":
      return [operation.node.id];

    case "node.remove":
    case "node.restore":
      return [
        operation.node.id,
        ...operation.connectedEdges.map(
          ({ edge }) => edge.id
        )
      ];

    case "node.move":
      return [operation.nodeId];

    case "edge.add":
    case "edge.remove":
      return [
        operation.edge.id,
        operation.edge.source.nodeId,
        operation.edge.target.nodeId
      ];
  }
}

export function createAuditState(): AuditState {
  return {
    receipts: []
  };
}

export function createAuditReceipt(
  input: CreateAuditReceiptInput
): AuditReceipt {
  const interpretations: AuditInterpretation[] = [];

  let pointerGesture: PointerGestureFacts | undefined;

  if (input.context?.pointerGesture !== undefined) {
    const gesture = input.context.pointerGesture;

    const efficiencyRatio =
      gesture.pointerTravel <= 0
        ? 1
        : Math.min(
            1,
            gesture.finalDisplacement /
              gesture.pointerTravel
          );

    pointerGesture = {
      ...gesture,
      durationMs: Math.round(gesture.durationMs),
      pointerTravel: roundMetric(
        gesture.pointerTravel
      ),
      finalDisplacement: roundMetric(
        gesture.finalDisplacement
      ),
      deltaX: roundMetric(gesture.deltaX),
      deltaY: roundMetric(gesture.deltaY),
      efficiencyRatio: roundMetric(
        efficiencyRatio
      )
    };

    const possibleExcessTravel =
      pointerGesture.pointerTravel >= 24 &&
      pointerGesture.efficiencyRatio < 0.45;

    interpretations.push({
      kind: "movement_efficiency",
      authority: "heuristic",
      status: "candidate",
      statement: possibleExcessTravel
        ? "The gesture may contain excess pointer travel."
        : "No excess pointer-travel signal was detected.",
      basis: [
        "facts.pointerGesture.pointerTravel",
        "facts.pointerGesture.finalDisplacement",
        "facts.pointerGesture.efficiencyRatio"
      ]
    });
  }

  return {
    id: createId("audit"),
    operationId: input.operationId,
    operationLabel: input.operationLabel,
    operationType: input.operation.type,
    subjectIds: subjectIdsForOperation(
      input.operation
    ),
    decision: "admitted",
    recordedAt: input.recordedAt,
    facts: {
      beforeDigest: input.beforeDigest,
      afterDigest: input.afterDigest,
      ...(pointerGesture === undefined
        ? {}
        : {
            pointerGesture
          })
    },
    interpretations
  };
}

export function appendAuditReceipt(
  audit: AuditState,
  receipt: AuditReceipt
): AuditState {
  return {
    receipts: [...audit.receipts, receipt]
  };
}

export function isAuditState(
  value: unknown
): value is AuditState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<AuditState>;

  if (!Array.isArray(candidate.receipts)) {
    return false;
  }

  return candidate.receipts.every((valueReceipt) => {
    if (
      typeof valueReceipt !== "object" ||
      valueReceipt === null
    ) {
      return false;
    }

    const receipt = valueReceipt as Partial<AuditReceipt>;

    return (
      typeof receipt.id === "string" &&
      typeof receipt.operationId === "string" &&
      typeof receipt.operationLabel === "string" &&
      typeof receipt.operationType === "string" &&
      Array.isArray(receipt.subjectIds) &&
      receipt.subjectIds.every(
        (subjectId) => typeof subjectId === "string"
      ) &&
      receipt.decision === "admitted" &&
      typeof receipt.recordedAt === "string" &&
      typeof receipt.facts === "object" &&
      receipt.facts !== null &&
      Array.isArray(receipt.interpretations)
    );
  });
}
