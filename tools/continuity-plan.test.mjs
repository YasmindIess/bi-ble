import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileHandoff, normalizePlan, verifyHandoff } from './continuity-plan.mjs';
const plan = JSON.parse(await readFile(new URL('../examples/nice-robin-continuity-plan.json', import.meta.url)));

test('stable, verified, reproducible handoff', () => {
  const a = compileHandoff(plan);
  assert.deepEqual(a, compileHandoff({ ...plan, tasks: [...plan.tasks].reverse() }));
  assert.deepEqual(verifyHandoff(a), a);
  assert.deepEqual(a.ready_task_ids, ['review-ci-baseline']);
  assert.equal(a.blocked_task_ids.length, 3);
  assert.equal(a.plan_sha256, '76f4c66126a7d9ad15287cfe6d732643cf9f82a8a09098bc40646b3e1499bdcc');
});
test('deny privilege escalation and undeclared fields', () => {
  assert.throws(() => normalizePlan({ ...plan, execution_boundary: { ...plan.execution_boundary, live_signing_enabled: true }}));
  assert.throws(() => normalizePlan({ ...plan, tasks: [{ ...plan.tasks[0], execute: 'shell' }, ...plan.tasks.slice(1)] }));
  assert.throws(() => normalizePlan({ ...plan, tasks: [{ ...plan.tasks[0], evidence: ['self-certified'] }, ...plan.tasks.slice(1)] }));
});
test('deny dependency cycles and unknown predecessors', () => {
  assert.throws(() => compileHandoff({ ...plan, tasks: [{ ...plan.tasks[0], depends_on: ['prepare-release-report'] }, ...plan.tasks.slice(1)] }), /cycle/);
  assert.throws(() => compileHandoff({ ...plan, tasks: [{ ...plan.tasks[0], depends_on: ['missing-task'] }, ...plan.tasks.slice(1)] }), /unknown dependency/);
});
test('fail closed on handoff manipulation', () => {
  const a = compileHandoff(plan);
  assert.throws(() => verifyHandoff({ ...a, plan_sha256: '0'.repeat(64) }), /recomputation/);
  assert.throws(() => verifyHandoff({ ...a, ready_task_ids: ['prepare-release-report'] }), /recomputation/);
});
