/** Browser and Node-safe export of a typed, admitted bi-ble continuity formula. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const KINDS = new Set(['ci', 'review', 'package', 'security', 'documentation']);
function check(ok, why) { if (!ok) throw Error('Continuity export blocked: ' + why); }
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v !== null && typeof v === 'object') return '{' +
    Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
function slug(v, why) { check(typeof v === 'string' && SLUG.test(v), why + ' must be an ASCII slug'); return v; }
function number(v, lo, hi, why) { check(Number.isInteger(v) && v >= lo && v <= hi, why + ' outside bound'); return v; }
function evidence(v) {
  check(typeof v === 'string', 'evidence not text');
  const a = v.split(',').map(x => x.trim()).sort();
  check(a.length > 0 && a.length <= 32 && a.every(x => KINDS.has(x)) && new Set(a).size === a.length,
    'invalid or duplicate evidence');
  return a;
}
const byId = (a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export async function exportContinuityHandoff(result, project) {
  slug(project, 'project');
  check(result?.decision === 'admitted' && Array.isArray(result.obstructions) &&
    result.obstructions.length === 0, 'compiler decision is not admitted');
  check(Array.isArray(result.tribunals) &&
    result.tribunals.some(t => t.id === 'structural_coherence' && t.decision === 'admitted') &&
    result.tribunals.every(t => ['admitted','not_applicable'].includes(t.decision)),
    'tribunal decision is not admitted');
  const ir = result.ir;
  check(ir?.executionBoundary?.mode === 'simulation_only' &&
    ir.executionBoundary.externalExecutionAuthorized === false &&
    ir.executionBoundary.liveSigningEnabled === false, 'authority boundary differs');
  check(Array.isArray(ir.nodes) && ir.nodes.length > 0 && ir.nodes.length <= 128 &&
    Array.isArray(ir.edges), 'graph outside bound');
  check(ir.nodes.every(n => n.domain === 'core' && n.kind === 'continuity-task'),
    'non-continuity semantics cannot be discarded');
  const source = new Map();
  const tasks = ir.nodes.map(n => {
    check(typeof n.id === 'string' && !source.has(n.id), 'duplicate graph node');
    const p = n.properties;
    check(p && typeof p === 'object', 'missing properties');
    const mode = p.mode;
    check(mode === 'read_only' || mode === 'proposal', 'mode not admissible');
    check(Array.isArray(n.inputs) && Array.isArray(n.outputs) &&
      n.inputs.length === 4 && n.outputs.length === 1 &&
      n.inputs.every(port => port.direction === 'input' &&
        port.dataType === 'core:continuity' && /^requires-[1-4]$/.test(port.key)) &&
      new Set(n.inputs.map(port => port.key)).size === 4 &&
      n.outputs[0].key === 'continuity-out' &&
      n.outputs[0].direction === 'output' && n.outputs[0].dataType === 'core:continuity',
      'continuity ports are invalid');
    const task = { id: slug(p.taskId, 'task ID'), depends_on: [],
      priority: number(p.priority, 0, 100, 'priority'),
      cost_units: number(p.costUnits, 1, 100, 'cost'), mode,
      evidence: evidence(p.evidence) };
    source.set(n.id, { n, task });
    return task;
  });
  check(new Set(tasks.map(t => t.id)).size === tasks.length, 'duplicate task slug');
  const occupied = new Set();
  for (const edge of ir.edges) {
    const from = source.get(edge.sourceNodeId), to = source.get(edge.targetNodeId);
    check(from && to && from !== to && edge.dataType === 'core:continuity', 'invalid edge');
    check(from.n.outputs.some(p => p.id === edge.sourcePortId) &&
      to.n.inputs.some(p => p.id === edge.targetPortId), 'edge ports invalid');
    const port = edge.targetNodeId + ':' + edge.targetPortId;
    check(!occupied.has(port), 'multiply occupied input');
    occupied.add(port);
    check(!to.task.depends_on.includes(from.task.id), 'duplicate predecessor');
    to.task.depends_on.push(from.task.id);
  }
  for (const task of tasks) task.depends_on.sort();
  tasks.sort(byId);
  const index = new Map(tasks.map(t => [t.id,t]));
  const active = new Set(), complete = new Set();
  function visit(id) {
    check(!active.has(id), 'cyclic dependencies');
    if (complete.has(id)) return;
    active.add(id);
    for (const dep of index.get(id).depends_on) visit(dep);
    active.delete(id);
    complete.add(id);
  }
  for (const task of tasks) visit(task.id);
  const plan = {
    schema: 'bi-ble-continuity-plan-v1', project,
    execution_boundary: { mode: 'simulation_only',
      external_execution_authorized: false, live_signing_enabled: false }, tasks
  };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(plan)));
  const plan_sha256 = [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return {
    schema: 'bi-ble-continuity-handoff-v1', plan, plan_sha256,
    ready_task_ids: tasks.filter(t => t.depends_on.length === 0)
      .sort((a,b) => b.priority - a.priority || byId(a,b)).map(t => t.id),
    blocked_task_ids: tasks.filter(t => t.depends_on.length > 0).map(t => t.id)
  };
}
