export interface AgencyTransition {
 schema:"bi-ble-agency-source-transition-v1";
 state:"different_reported_source_revision"|"same_revision_observation_only";
 old_source_head:string;
 new_source_head:string;
 old_report_sha256:string;
 new_report_sha256:string;
 prior_next_development_task_id:string|null;
 current_next_development_task_id:string|null;
 retired_task_candidates:Array<{task_id:string;title:string;prior_status:string;meaning:string}>;
 introduced_task_candidates:Array<{task_id:string;title:string;status:string}>;
 changed_task_statuses:Array<{task_id:string;previous_status:string;current_status:string}>;
 claimed_task_completion:false;
 source_execution_attested:false;
 CI_rechecked_for_new_head:false;
 independent_witness:false;
 release_authorized:false;
}
export declare function compareAgencyProjections(previous:unknown,current:unknown):AgencyTransition;
