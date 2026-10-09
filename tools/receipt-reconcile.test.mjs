import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto,createHash } from 'node:crypto';
import { compileHandoff } from './continuity-plan.mjs';
import { decodeWorkerArtifact,recomputeProposal,verifyReceipt,reconcileTaskStates } from '../apps/editor/src/model/receipt-reconcile.mjs';
globalThis.crypto ??= webcrypto;
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
const hash=v=>createHash('sha256').update(stable(v)).digest('hex');
const clone=v=>JSON.parse(JSON.stringify(v));
const rehash=(v,k)=>{const body=clone(v);delete body[k];v[k]=hash(body);};
async function fixture(blocked=false){
  const handoff=compileHandoff({schema:'bi-ble-continuity-plan-v1',project:'nice-robin',
    execution_boundary:{mode:'simulation_only',external_execution_authorized:false,live_signing_enabled:false},
    tasks:[{id:'audit-public-subtree',depends_on:[],priority:90,cost_units:2,mode:'read_only',evidence:['package','security']},
      {id:'prepare-release-report',depends_on:['audit-public-subtree'],priority:60,cost_units:1,mode:'proposal',evidence:['documentation','review']}]});
  const proposal=await recomputeProposal(handoff,2);
  const check={id:'required:README.md',status:blocked?'blocked':'pass',reason:'required source'};
  const report={schema:'nice-robin-publication-preflight-v1',scope:'local_subtree_source_only',
    source_tree_sha256:'1'.repeat(64),package_version:'0.2.0',requested_version:'0.2.0',file_count:9,
    checks:[check],blocked_check_ids:blocked?[check.id]:[],
    status:blocked?'blocked':'local_source_preflight_passed',
    ci_execution:'not_verified_by_local_preflight',independent_security_assessment:'not_established',
    publication_authorized:false,external_r3_independence:'not_established'};
  report.report_sha256=hash(report);
  const receipt={schema:'nice-robin-local-worker-receipt-v1',task_id:'audit-public-subtree',
    capability:'publication_source_preflight_only',plan_sha256:handoff.plan_sha256,
    proposal_sha256:proposal.proposal_sha256,
    authorization_record:'explicit_local_read_flag_not_cryptographic_authorization',
    evidence_scope:'local_source_snapshot_unattested',outcome:blocked?'local_check_blocked':'local_check_passed',
    preflight_report:report,external_execution:'not_performed',independent_verification:'not_established',
    publication_authorized:false};
  receipt.receipt_sha256=hash(receipt);return {handoff,proposal,receipt};
}
test('cross-language canonical receipt/proposal verification preserves non-witness status',async()=>{
  const {handoff,proposal,receipt}=await fixture();
  const v=await verifyReceipt(decodeWorkerArtifact(stable(receipt)+'\n'),handoff,proposal);
  assert.equal(v.status,'content_integrity_verified');assert.equal(v.witnessed,false);
  assert.equal(reconcileTaskStates(handoff,[v])['prepare-release-report'],'blocked');
});
test('missing plan/proposal leave incomplete verification',async()=>{
  const {handoff,proposal,receipt}=await fixture();
  assert.equal((await verifyReceipt(receipt)).status,'unresolved');
  assert.equal((await verifyReceipt(receipt,handoff)).status,'unresolved');
  assert.equal((await verifyReceipt(receipt,null,proposal)).status,'unresolved');
});
test('reject duplicated-key, formatted and malformed imported bytes',async()=>{
  const {receipt}=await fixture();
  assert.throws(()=>decodeWorkerArtifact('{"a":1,"a":2}'),/canonical/);
  assert.throws(()=>decodeWorkerArtifact(JSON.stringify(receipt,null,2)),/canonical/);
  assert.throws(()=>decodeWorkerArtifact('broken'),/malformed/);
});
test('tampering, authority elevation, extra fields and false outcome are refused',async()=>{
  const {handoff,proposal,receipt}=await fixture();
  for(const f of [
    x=>x.receipt_sha256='0'.repeat(64),
    x=>x.preflight_report.report_sha256='0'.repeat(64),
    x=>x.publication_authorized=true,
    x=>x.independent_verification='established',
    x=>x.outcome='local_check_blocked',
    x=>x.preflight_report.external_r3_independence='established',
    x=>x.preflight_report.checks.push(clone(x.preflight_report.checks[0])),
    x=>x.other='wrong'
  ]){const r=clone(receipt);f(r);await assert.rejects(verifyReceipt(r,handoff,proposal));}
});
test('reject mismatched plans, changed proposals and claimed prerequisites',async()=>{
  const {handoff,proposal,receipt}=await fixture();
  let h=clone(handoff);h.plan.tasks[0].priority=1;
  await assert.rejects(verifyReceipt(receipt,h,proposal));
  let p=clone(proposal);p.budget_units=3;
  await assert.rejects(verifyReceipt(receipt,handoff,p));
  p=clone(proposal);p.claimed_completed_unverified=['audit-public-subtree'];
  await assert.rejects(verifyReceipt(receipt,handoff,p));
});
test('content-verified blocked publication check remains blocked',async()=>{
  const {handoff,proposal,receipt}=await fixture(true);
  const v=await verifyReceipt(receipt,handoff,proposal);
  assert.equal(v.status,'blocked');assert.deepEqual(v.blockers,['required:README.md']);
});
test('repeated receipt does not add witness; conflicting local observations remain unresolved',async()=>{
  const {handoff,proposal,receipt}=await fixture();
  const a=await verifyReceipt(receipt,handoff,proposal);
  assert.equal(reconcileTaskStates(handoff,[a,a])['audit-public-subtree'],'content_integrity_verified');
  const changed=clone(receipt);changed.preflight_report.source_tree_sha256='2'.repeat(64);
  rehash(changed.preflight_report,'report_sha256');rehash(changed,'receipt_sha256');
  const b=await verifyReceipt(changed,handoff,proposal);
  assert.equal(reconcileTaskStates(handoff,[a,b])['audit-public-subtree'],'unresolved');
});
