/** Offline reverse evidence adapter for NICE-ROBIN's bounded local worker.
 * Content integrity is not execution authenticity or independent witnessing.
 */
const BOUNDARY={mode:'simulation_only',external_execution_authorized:false,live_signing_enabled:false};
const RECEIPT=['schema','task_id','capability','plan_sha256','proposal_sha256','authorization_record','evidence_scope','outcome','preflight_report','external_execution','independent_verification','publication_authorized','receipt_sha256'];
const REPORT=['schema','scope','source_tree_sha256','package_version','requested_version','file_count','checks','blocked_check_ids','status','ci_execution','independent_security_assessment','publication_authorized','external_r3_independence','report_sha256'];
const PROPOSAL=['schema','project','plan_sha256','boundary','claimed_completed_unverified','budget_units','remaining_units','proposed_task_ids','withheld','execution','independent_verification','proposal_sha256'];
const HEX=/^[a-f0-9]{64}$/;
const SLUG=/^[a-z0-9][a-z0-9-]{0,63}$/;
const VERSION=/^\d+\.\d+\.\d+(?:(?:a|b|rc)\d+)?$/;
const EVIDENCE=new Set(['ci','review','package','security','documentation']);
const fail=(why)=>{throw Error('Receipt reconciliation blocked: '+why);};
const demand=(ok,why)=>{if(!ok)fail(why);};
const obj=v=>v!==null && typeof v==='object' && !Array.isArray(v);
const exact=(v,fields,where)=>demand(obj(v)&&Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k)),where+' schema/fields changed');
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':obj(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
const same=(a,b,where)=>demand(stable(a)===stable(b),where+' differs from independent recomputation');
const sha=async v=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable(v))))].map(x=>x.toString(16).padStart(2,'0')).join('');
const hash=(v,name)=>demand(typeof v==='string'&&HEX.test(v),name+' digest invalid');
const slug=(v,name)=>demand(typeof v==='string'&&SLUG.test(v),name+' invalid');
const strings=(a,name,max=32)=>demand(Array.isArray(a)&&a.length<=max&&a.every(x=>typeof x==='string')&&new Set(a).size===a.length,name+' invalid or duplicated');

/** Accept the canonical bytes NICE-ROBIN actually emits; reject duplicated JSON keys,
 * lossy normalization, noncanonical numbers, and ambiguous encodings.
 */
export function decodeWorkerArtifact(text){
  demand(typeof text==='string'&&text.length>0&&text.length<=2_000_000,'file size outside bound');
  let data;try{data=JSON.parse(text);}catch{fail('malformed JSON');}
  demand(obj(data)&&text.trim()===stable(data),'original canonical JSON required; ambiguous, duplicated, or reformatted input');
  return data;
}
export async function verifyHandoff(h){
  exact(h,['schema','plan','plan_sha256','ready_task_ids','blocked_task_ids'],'handoff');
  demand(h.schema==='bi-ble-continuity-handoff-v1','handoff schema invalid');
  const p=h.plan;exact(p,['schema','project','execution_boundary','tasks'],'plan');
  demand(p.schema==='bi-ble-continuity-plan-v1','plan schema invalid');slug(p.project,'project');
  same(p.execution_boundary,BOUNDARY,'simulation boundary');
  demand(Array.isArray(p.tasks)&&p.tasks.length>0&&p.tasks.length<=128,'task count');
  const tasks=p.tasks.map(t=>{
    exact(t,['id','depends_on','priority','cost_units','mode','evidence'],'task');
    slug(t.id,'task id');strings(t.depends_on,'dependencies');strings(t.evidence,'evidence');
    t.depends_on.forEach(d=>slug(d,'dependency'));
    demand(Number.isInteger(t.priority)&&t.priority>=0&&t.priority<=100,'priority invalid');
    demand(Number.isInteger(t.cost_units)&&t.cost_units>=1&&t.cost_units<=100,'cost invalid');
    demand(t.mode==='read_only'||t.mode==='proposal','mode invalid');
    demand(t.evidence.length>0&&t.evidence.every(e=>EVIDENCE.has(e)),'evidence kinds invalid');
    demand(!t.depends_on.includes(t.id),'self dependency');
    return {...t,depends_on:[...t.depends_on].sort(),evidence:[...t.evidence].sort()};
  }).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const map=new Map(tasks.map(t=>[t.id,t]));
  demand(map.size===tasks.length,'duplicate tasks');
  const open=new Set(),closed=new Set();
  function visit(id){demand(!open.has(id),'dependency cycle');if(closed.has(id))return;
    open.add(id);for(const dep of map.get(id).depends_on){demand(map.has(dep),'unknown dependency');visit(dep);}
    open.delete(id);closed.add(id);}
  tasks.forEach(t=>visit(t.id));
  const normalized={schema:p.schema,project:p.project,execution_boundary:{...BOUNDARY},tasks};
  same(p,normalized,'normalized plan');hash(h.plan_sha256,'plan');
  demand(await sha(normalized)===h.plan_sha256,'plan digest mismatch');
  const ready=tasks.filter(t=>!t.depends_on.length).sort((a,b)=>b.priority-a.priority||(a.id<b.id?-1:1)).map(t=>t.id);
  same(h.ready_task_ids,ready,'ready ordering');
  same(h.blocked_task_ids,tasks.filter(t=>t.depends_on.length).map(t=>t.id),'blocked ordering');
  return normalized;
}
export async function recomputeProposal(h,budget){
  const p=await verifyHandoff(h);demand(Number.isInteger(budget)&&budget>=0&&budget<=10000,'budget invalid');
  let remaining=budget;const proposed_task_ids=[],withheld=[];
  for(const t of [...p.tasks].sort((a,b)=>b.priority-a.priority||(a.id<b.id?-1:1))){
    if(t.depends_on.length)withheld.push({id:t.id,reason:'prerequisite_not_evidenced'});
    else if(t.cost_units>remaining)withheld.push({id:t.id,reason:'budget_exhausted'});
    else{proposed_task_ids.push(t.id);remaining-=t.cost_units;}
  }
  const result={schema:'nice-robin-continuity-proposal-v1',project:p.project,plan_sha256:h.plan_sha256,
    boundary:{...BOUNDARY},claimed_completed_unverified:[],budget_units:budget,remaining_units:remaining,
    proposed_task_ids,withheld,execution:'never_performed',independent_verification:'not_established'};
  result.proposal_sha256=await sha(result);return result;
}
async function verifyReport(r){
  exact(r,REPORT,'preflight report');
  demand(r.schema==='nice-robin-publication-preflight-v1'&&r.scope==='local_subtree_source_only','report schema/scope');
  hash(r.source_tree_sha256,'source tree');hash(r.report_sha256,'report');
  demand([r.package_version,r.requested_version].every(v=>v===null||typeof v==='string'&&VERSION.test(v)),'package version');
  demand(Number.isInteger(r.file_count)&&r.file_count>=0&&r.file_count<=2000,'file count');
  demand(Array.isArray(r.checks)&&r.checks.length>0&&r.checks.length<=2020,'checks outside bound');
  for(const c of r.checks){
    exact(c,['id','status','reason'],'check');
    demand(typeof c.id==='string'&&/^[A-Za-z0-9_.:/-]{1,180}$/.test(c.id)&&
      ['pass','blocked'].includes(c.status)&&typeof c.reason==='string'&&c.reason.length<=2048,'check invalid');
  }
  strings(r.blocked_check_ids,'blocked checks',2020);
  demand(new Set(r.checks.map(c=>c.id)).size===r.checks.length,'duplicate checks');
  same(r.blocked_check_ids,r.checks.filter(c=>c.status==='blocked').map(c=>c.id),'blocked check identities');
  demand(r.status===(r.blocked_check_ids.length?'blocked':'local_source_preflight_passed'),'check status contradictory');
  demand(r.ci_execution==='not_verified_by_local_preflight'&&
    r.independent_security_assessment==='not_established'&&r.publication_authorized===false&&
    r.external_r3_independence==='not_established','fabricated report authority');
  const {report_sha256,...body}=r;demand(await sha(body)===report_sha256,'report digest mismatch');
}
export async function verifyReceipt(r,h=null,p=null){
  exact(r,RECEIPT,'receipt');
  demand(r.schema==='nice-robin-local-worker-receipt-v1'&&r.task_id==='audit-public-subtree'&&
    r.capability==='publication_source_preflight_only','unsupported capability');
  hash(r.plan_sha256,'plan');hash(r.proposal_sha256,'proposal');hash(r.receipt_sha256,'receipt');
  demand(r.authorization_record==='explicit_local_read_flag_not_cryptographic_authorization'&&
    r.evidence_scope==='local_source_snapshot_unattested'&&r.external_execution==='not_performed'&&
    r.independent_verification==='not_established'&&r.publication_authorized===false,'fabricated authority or witness');
  await verifyReport(r.preflight_report);
  demand(r.outcome===(r.preflight_report.blocked_check_ids.length?'local_check_blocked':'local_check_passed'),
    'outcome contradicts checks');
  const {receipt_sha256,...body}=r;demand(await sha(body)===receipt_sha256,'receipt digest mismatch');
  const missing=[];
  if(h===null)missing.push('admitted matching handoff');
  else{
    const plan=await verifyHandoff(h);
    demand(plan.project==='nice-robin'&&h.plan_sha256===r.plan_sha256,'plan binding mismatch');
    const t=plan.tasks.find(t=>t.id===r.task_id);
    demand(t&&t.mode==='read_only'&&t.depends_on.length===0&&stable(t.evidence)===stable(['package','security']),
      'worker task authority/scope incompatible');
  }
  if(p===null)missing.push('NICE-ROBIN proposal');
  else{
    exact(p,PROPOSAL,'proposal');hash(p.proposal_sha256,'proposal');
    demand(p.schema==='nice-robin-continuity-proposal-v1'&&
      p.plan_sha256===r.plan_sha256&&p.proposal_sha256===r.proposal_sha256&&
      p.project==='nice-robin','proposal binding mismatch');
    demand(Array.isArray(p.claimed_completed_unverified)&&!p.claimed_completed_unverified.length,
      'claimed completion not authorized');
    if(h!==null){
      same(p,await recomputeProposal(h,p.budget_units),'proposal recomputation');
      same(p.proposed_task_ids,['audit-public-subtree'],'fixed worker selection');
    }else missing.push('handoff for proposal recomputation');
  }
  return {status:missing.length?'unresolved':r.outcome==='local_check_blocked'?'blocked':'content_integrity_verified',
    content_integrity:true,binding_complete:missing.length===0,missing,
    task_id:r.task_id,plan_sha256:r.plan_sha256,receipt_sha256,report_sha256:r.preflight_report.report_sha256,
    capability:r.capability,evidence_scope:r.evidence_scope,outcome:r.outcome,
    blockers:[...r.preflight_report.blocked_check_ids],witnessed:false,authentic_execution:false};
}
export function reconcileTaskStates(h,observations=[]){
  if(!h)return {};
  const states={};
  for(const t of h.plan.tasks){
    const matches=observations.filter(o=>o.task_id===t.id&&o.plan_sha256===h.plan_sha256);
    const unique=new Set(matches.map(o=>o.receipt_sha256));
    if(unique.size>1||matches.some(o=>o.status==='unresolved'))states[t.id]='unresolved';
    else if(matches.some(o=>o.status==='blocked'))states[t.id]='blocked';
    else if(matches.some(o=>o.status==='content_integrity_verified'))states[t.id]='content_integrity_verified';
    else if(matches.some(o=>o.content_integrity))states[t.id]='observed_locally';
    else states[t.id]=t.depends_on.length?'blocked':'eligible';
  }
  return states;
}
