/** bi-ble portable projection of NICE-ROBIN task work: evidence display, never authority. */
const sha40=/^[0-9a-f]{40}$/;
const sha64=/^[0-9a-f]{64}$/;
const modes=new Set(["not_requested","local_static_check_passed",
 "local_static_check_blocked","unchanged_prior_local_result"]);
const taskStates=new Set(["ready","observed_local_check","observed_previous_local_check",
 "blocked_by_source_errors","needs_authorized_coding_agent","deferred_not_admitted"]);
const capabilities=new Set(["bounded_python_ast_parse","code_change_proposal_only","human_review_required"]);
function need(ok,why){if(!ok)throw Error("Agency projection held: "+why);}
function canonical(v){
 if(Array.isArray(v))return "["+v.map(canonical).join(",")+"]";
 if(v!==null&&typeof v==="object")return "{"+Object.keys(v).sort()
   .map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}";
 return JSON.stringify(v);
}
async function sha256(s){
 const data=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));
 return Array.from(new Uint8Array(data)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
export async function decodeAgencyProjection(jsonText){
 need(typeof jsonText==="string"&&jsonText.length<500000,"bounded JSON required");
 let value;try{value=JSON.parse(jsonText)}catch{throw Error("Agency projection held: invalid JSON")}
 need(value&&typeof value==="object"&&!Array.isArray(value),"object required");
 const {record_sha256,...body}=value;
 need(value.schema==="nice-robin-agency-projection-v1"&&sha64.test(record_sha256||""),
  "schema or content hash invalid");
 need(await sha256(canonical(body))===record_sha256,"content digest mismatch");
 const source=value.source||{};
 need(sha40.test(source.head||"")&&sha64.test(source.source_tree_sha256||"")&&
  source.checkout==="pinned_clean_tracked_git_state"&&
  source.authenticity==="local_checkout_unattested", "source attribution incomplete");
 need(Array.isArray(value.tasks)&&value.tasks.length>0&&value.tasks.length<=24,
  "task list invalid");
 const seen=new Set();
 for(const t of value.tasks){
  need(typeof t.id==="string"&&/^[a-z0-9-]{1,64}$/.test(t.id)&&!seen.has(t.id),
   "duplicate or invalid task");
  seen.add(t.id);
  need(typeof t.title==="string"&&t.title.length<=200&&
   Number.isInteger(t.priority)&&t.priority>=0&&t.priority<=100&&
   taskStates.has(t.status)&&capabilities.has(t.capability)&&
   t.execution_authorized===false&&Array.isArray(t.depends_on)&&
   t.depends_on.every(x=>typeof x==="string"),"task fields invalid");
 }
 need(value.tasks.every(t=>t.depends_on.every(id=>seen.has(id)&&id!==t.id)),
  "dependency references invalid");
 need(value.selected_task_id===null||
  (seen.has(value.selected_task_id)&&value.tasks.some(t=>t.id===value.selected_task_id&&t.status==="ready")),
  "selected task has no ready projection");
 const execution=value.execution||{};
 need(modes.has(execution.status)&&
  execution.source_tree_sha256===source.source_tree_sha256&&
  execution.scope==="local_static_parse_only"&&
  execution.no_repository_mutation===true&&
  execution.independent_witness===false&&
  execution.release_authorized===false,"execution scope malformed");
 if(execution.status==="local_static_check_passed"){
  need(value.tasks.some(t=>t.id==="python-ast-check"&&t.status==="observed_local_check")&&
   Number.isInteger(execution.files_parsed)&&execution.files_parsed>0&&
   Array.isArray(execution.failures)&&execution.failures.length===0,
   "passing source check missing bounded local evidence");
 }
 if(execution.status==="unchanged_prior_local_result"){
  need(value.tasks.some(t=>t.id==="python-ast-check"&&t.status==="observed_previous_local_check"),
   "previous check not identified");
 }
 need(value.choir_runtime_invoked===false&&value.coding_agent_invoked===false&&
  value.source_changes_performed===false&&value.external_execution_authorized===false&&
  value.publication_authorized===false&&value.independent_witness===false&&
  value.release_authorized===false,"unsupported authority elevation");
 return value;
}