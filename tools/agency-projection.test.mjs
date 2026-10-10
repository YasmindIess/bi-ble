import test from "node:test";
import assert from "node:assert/strict";
import {decodeAgencyProjection} from "../apps/editor/src/model/agency-projection.mjs";

const canonical=v=>Array.isArray(v)?"["+v.map(canonical).join(",")+"]":
 v!==null&&typeof v==="object"?"{"+Object.keys(v).sort()
  .map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}":JSON.stringify(v);
async function digest(value){
 const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonical(value)));
 return Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
function fixture(){
 return {
  schema:"nice-robin-agency-projection-v1",
  source:{
   head:"a".repeat(40),source_tree_sha256:"b".repeat(64),
   checkout:"pinned_clean_tracked_git_state",
   authenticity:"local_checkout_unattested",tracked_file_count:2,
   python_file_count:1,release_input_gaps:["SECURITY.md"]
  },
  tasks:[
   {id:"python-ast-check",title:"Parse pinned Python source",priority:100,
    cost_units:1,depends_on:[],capability:"bounded_python_ast_parse",
    status:"observed_local_check",evidence_requirement:"local_source_ast_receipt",
    execution_authorized:false},
   {id:"restore-release-input-1",title:"Restore SECURITY.md",priority:80,
    cost_units:2,depends_on:[],capability:"code_change_proposal_only",
    status:"needs_authorized_coding_agent",evidence_requirement:"reviewed_source_diff_and_ci",
    execution_authorized:false}
  ],
  selected_task_id:null,
  next_development_task_id:"restore-release-input-1",
  execution:{task_id:"python-ast-check",status:"local_static_check_passed",
   source_tree_sha256:"b".repeat(64),scope:"local_static_parse_only",
   no_repository_mutation:true,independent_witness:false,release_authorized:false,
   files_parsed:1,failures:[]},
  choir_runtime_invoked:false,coding_agent_invoked:false,
  source_changes_performed:false,external_execution_authorized:false,
  publication_authorized:false,independent_witness:false,release_authorized:false
 };
}
async function encode(value){return JSON.stringify({...value,record_sha256:await digest(value)})}
test("locally produced task data can be projected only with exact content digest",async()=>{
 const sample=fixture();
 const decoded=await decodeAgencyProjection(await encode(sample));
 assert.equal(decoded.execution.status,"local_static_check_passed");
 assert.equal(decoded.tasks[1].status,"needs_authorized_coding_agent");
 assert.equal(decoded.independent_witness,false);
});
test("tampered receipt or authority claims fail closed",async()=>{
 const sample=fixture();
 const raw=await encode(sample);
 await assert.rejects(()=>decodeAgencyProjection(raw.replace("observed_local_check","ready")),/digest mismatch/);
 await assert.rejects(asyncasync()=>decodeAgencyProjection(await encode({...sample,release_authorized:true})),/authority elevation/);
 await assert.rejects(asyncasync()=>decodeAgencyProjection(await encode({...sample,coding_agent_invoked:true})),/authority elevation/);
 await assert.rejects(asyncasync()=>decodeAgencyProjection(await encode({
  ...sample,tasks:[sample.tasks[0],{...sample.tasks[0]}]
 })),/duplicate or invalid task/);
});
test("non-executed and previously checked revisions retain distinct statuses",async()=>{
 const sample=fixture();
 const previous={...sample,tasks:[{...sample.tasks[0],status:"observed_previous_local_check"},sample.tasks[1]],
  execution:{...sample.execution,status:"unchanged_prior_local_result"}};
 const output=await decodeAgencyProjection(await encode(previous));
 assert.equal(output.execution.status,"unchanged_prior_local_result");
 const forged={...previous,selected_task_id:"restore-release-input-1"};
 await assert.rejects(asyncasync()=>decodeAgencyProjection(await encode(forged)),/selected task/);
});

test("next coding candidate is provenance-bound and never an execution permission",async()=>{
 const sample=fixture();
 const value=await decodeAgencyProjection(await encode(sample));
 assert.equal(value.next_development_task_id,"restore-release-input-1");
 await assert.rejects(async()=>decodeAgencyProjection(await encode({
  ...sample,next_development_task_id:"python-ast-check"
 })),/next development task/);
 await assert.rejects(async()=>decodeAgencyProjection(await encode({
  ...sample,next_development_task_id:null
 })),/next development task/);
 const none={...sample,next_development_task_id:null,
  tasks:sample.tasks.filter(t=>t.id!=="restore-release-input-1")};
 assert.equal((await decodeAgencyProjection(await encode(none))).next_development_task_id,null);
});
