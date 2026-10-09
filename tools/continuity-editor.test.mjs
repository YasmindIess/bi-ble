import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { exportContinuityHandoff } from '../apps/editor/src/model/continuity-export.mjs';
import { compileHandoff } from './continuity-plan.mjs';
globalThis.crypto ??= webcrypto;
const tasks = [
  ['n1', 'review-ci-baseline', 90, 1, 'read_only', 'ci'],
  ['n2', 'audit-public-subtree', 80, 2, 'proposal', 'package,security'],
  ['n3', 'verify-public-wheel', 70, 2, 'proposal', 'ci,package'],
  ['n4', 'prepare-release-report', 60, 1, 'proposal', 'documentation,review']
];
function mock() {
  const nodes = tasks.map(([id,taskId,priority,costUnits,mode,evidence]) => ({
    id, domain:'core', kind:'continuity-task',
    properties:{taskId,priority,costUnits,mode,evidence},
    inputs:[1,2,3,4].map(x=>({id:id+'i'+x,key:'requires-'+x,direction:'input',dataType:'core:continuity'})),
    outputs:[{id:id+'out',key:'continuity-out',direction:'output',dataType:'core:continuity'}]
  }));
  const edges = [[0,1],[1,2],[2,3]].map(([a,b])=>({
    sourceNodeId:nodes[a].id,sourcePortId:nodes[a].outputs[0].id,
    targetNodeId:nodes[b].id,targetPortId:nodes[b].inputs[0].id,dataType:'core:continuity'
  }));
  return {
    decision:'admitted',obstructions:[],
    tribunals:[{id:'structural_coherence',decision:'admitted'},
      {id:'ael_evidence_authority',decision:'not_applicable'},
      {id:'gravity_route_boundary',decision:'not_applicable'}],
    ir:{nodes,edges,executionBoundary:{
      mode:'simulation_only',externalExecutionAuthorized:false,liveSigningEnabled:false}}
  };
}
test('visual four-node reference matches NICE-ROBIN independent SHA-256 vector', async()=>{
  const output=await exportContinuityHandoff(mock(),'nice-robin');
  assert.deepEqual(output,compileHandoff(output.plan));
  assert.equal(output.plan_sha256,'76f4c66126a7d9ad15287cfe6d732643cf9f82a8a09098bc40646b3e1499bdcc');
  assert.deepEqual(output.ready_task_ids,['review-ci-baseline']);
});
test('blocked compilation, tribunals, and mixed semantics reject export',async()=>{
  let x=mock();x.decision='blocked';
  await assert.rejects(exportContinuityHandoff(x,'nice-robin'),/compiler/);
  x=mock();x.tribunals[1].decision='blocked';
  await assert.rejects(exportContinuityHandoff(x,'nice-robin'),/tribunal/);
  x=mock();x.ir.nodes[0].domain='ael';
  await assert.rejects(exportContinuityHandoff(x,'nice-robin'),/non-continuity/);
});
test('never elevate external authority or permit invalid bounds',async()=>{
  let x=mock();x.ir.executionBoundary.liveSigningEnabled=true;
  await assert.rejects(exportContinuityHandoff(x,'nice-robin'),/authority/);
  x=mock();x.ir.nodes[0].properties.priority=101;
  await assert.rejects(exportContinuityHandoff(x,'nice-robin'),/priority/);
  x=mock();x.ir.nodes[0].properties.evidence='ci,ci';
  await assert.rejects(exportContinuityHandoff(x,'nice-robin'),/evidence/);
  await assert.rejects(exportContinuityHandoff(mock(),'private/repo'),/project/);
});
test('strictly reverify edge type, ports, occupancy and acyclicity',async()=>{
  let x=mock();x.ir.edges[0].dataType='core:any';
  await assert.rejects(exportContinuityHandoff(x,'nice-robin'),/edge/);
  x=mock();x.ir.edges[0].targetPortId='forged';
  await assert.rejects(exportContinuityHandoff(x,'nice-robin'),/ports/);
  x=mock();x.ir.edges.push({...x.ir.edges[0],sourceNodeId:'n3',sourcePortId:'n3out'});
  await assert.rejects(exportContinuityHandoff(x,'nice-robin'),/multiply occupied/);
  x=mock();x.ir.edges.push({sourceNodeId:'n4',sourcePortId:'n4out',
    targetNodeId:'n1',targetPortId:'n1i1',dataType:'core:continuity'});
  await assert.rejects(exportContinuityHandoff(x,'nice-robin'),/cyclic/);
});
test('support two predecessors using separately typed optional inputs',async()=>{
  const x=mock();
  x.ir.edges.push({sourceNodeId:'n1',sourcePortId:'n1out',
    targetNodeId:'n4',targetPortId:'n4i2',dataType:'core:continuity'});
  const r=await exportContinuityHandoff(x,'nice-robin');
  assert.deepEqual(r.plan.tasks.find(t=>t.id==='prepare-release-report').depends_on,
    ['review-ci-baseline','verify-public-wheel']);
});
