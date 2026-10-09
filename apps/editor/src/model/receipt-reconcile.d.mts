export interface WorkerReceipt {
  schema: string; task_id: string; capability: string; plan_sha256: string;
  proposal_sha256: string; receipt_sha256: string; outcome: string; evidence_scope: string;
  preflight_report: { source_tree_sha256: string; report_sha256: string; blocked_check_ids: string[]; [key: string]: unknown };
  [key: string]: unknown;
}
export interface ReceiptObservation {
  status: string; content_integrity: boolean; binding_complete: boolean; missing: string[];
  task_id: string; plan_sha256: string; receipt_sha256: string; report_sha256: string;
  capability: string; evidence_scope: string; outcome: string; blockers: string[];
  witnessed: boolean; authentic_execution: boolean;
}
import type { ContinuityHandoff } from "./continuity-export.mjs";
export declare function decodeWorkerArtifact(raw: string): Record<string, unknown>;
export declare function verifyHandoff(handoff: ContinuityHandoff): Promise<unknown>;
export declare function recomputeProposal(handoff: ContinuityHandoff,budget: number): Promise<Record<string, unknown>>;
export declare function verifyReceipt(receipt: WorkerReceipt,handoff?: ContinuityHandoff|null,proposal?: Record<string, unknown>|null): Promise<ReceiptObservation>;
export declare function reconcileTaskStates(handoff: ContinuityHandoff|null,observations?: ReceiptObservation[]): Record<string,string>;
