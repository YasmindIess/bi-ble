import type { CompilationResult } from "./compiler";
export interface ContinuityTask {
  id: string; depends_on: string[]; priority: number; cost_units: number;
  mode: "read_only" | "proposal"; evidence: string[];
}
export interface ContinuityHandoff {
  schema: "bi-ble-continuity-handoff-v1";
  plan: { schema: "bi-ble-continuity-plan-v1"; project: string;
    execution_boundary: { mode: "simulation_only"; external_execution_authorized: false; live_signing_enabled: false };
    tasks: ContinuityTask[] };
  plan_sha256: string; ready_task_ids: string[]; blocked_task_ids: string[];
}
export declare function exportContinuityHandoff(result: CompilationResult, project: string): Promise<ContinuityHandoff>;
