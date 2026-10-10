/** Compare two independently integrity-checked NICE-ROBIN projections.
 * A changed content-addressed report is not proof of task completion or execution.
 * Call decodeAgencyProjection on BOTH inputs before passing them here.
 */
const fail=(reason)=>{throw Error("Agency transition held: "+reason)};
export function compareAgencyProjections(previous,current){
 if(!previous||!current||
  previous.schema!=="nice-robin-agency-projection-v1"||
  current.schema!=="nice-robin-agency-projection-v1"||
  typeof previous.record_sha256!=="string"||
  typeof current.record_sha256!=="string")fail("two decoded projections are required");
 const a=previous.source||{},b=current.source||{};
 if(!/^[a-f0-9]{40}$/.test(a.head||"")||!/^[a-f0-9]{40}$/.test(b.head||""))
  fail("both source revisions must be pinned");
 if(a.head===b.head&&a.source_tree_sha256!==b.source_tree_sha256)
  fail("same source revision has conflicting observed source bytes");
 const known=new Map(previous.tasks.map(t=>[t.id,t]));
 const after=new Map(current.tasks.map(t=>[t.id,t]));
 const retired=[...known.values()].filter(t=>!after.has(t.id))
  .map(t=>({task_id:t.id,title:t.title,prior_status:t.status,
   meaning:"not_projected_at_later_revision_not_independently_proven_complete"}));
 const introduced=[...after.values()].filter(t=>!known.has(t.id))
  .map(t=>({task_id:t.id,title:t.title,status:t.status}));
 const changed=[...after.values()].filter(t=>known.has(t.id)&&
  known.get(t.id).status!==t.status)
  .map(t=>({task_id:t.id,previous_status:known.get(t.id).status,
   current_status:t.status}));
 const sourceRevisionChanged=a.head!==b.head;
 return {
  schema:"bi-ble-agency-source-transition-v1",
  state:sourceRevisionChanged?"different_reported_source_revision":
   "same_revision_observation_only",
  old_source_head:a.head,new_source_head:b.head,
  old_report_sha256:previous.record_sha256,new_report_sha256:current.record_sha256,
  old_source_tree_sha256:a.source_tree_sha256,
  new_source_tree_sha256:b.source_tree_sha256,
  prior_next_development_task_id:previous.next_development_task_id??null,
  current_next_development_task_id:current.next_development_task_id??null,
  retired_task_candidates:retired,
  introduced_task_candidates:introduced,
  changed_task_statuses:changed,
  claimed_task_completion:false,
  source_execution_attested:false,
  CI_rechecked_for_new_head:false,
  independent_witness:false,
  release_authorized:false,
  evidence_scope:"comparison_of_two_unattested_content_addressed_reports",
 };
}