/** bi-ble continuity v1: a pure, simulation-only development handoff. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const PLAN = 'bi-ble-continuity-plan-v1';
const HANDOFF = 'bi-ble-continuity-handoff-v1';
const BOUNDARY = Object.freeze({
  mode: 'simulation_only', external_execution_authorized: false, live_signing_enabled: false,
});
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const EVIDENCE = new Set(['ci', 'review', 'package', 'security', 'documentation']);

function demand(ok, why) { if (!ok) throw new Error('continuity blocked: ' + why); }
function exact(v, fields, what) {
  demand(v !== null && typeof v === 'object' && !Array.isArray(v), what + ' must be object');
  demand(Object.keys(v).length === fields.length && fields.every(k => Object.hasOwn(v, k)), what + ' fields changed');
}
function asc(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v !== null && typeof v === 'object') return '{' +
    Object.keys(v).sort(asc).map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
const sha = v => createHash('sha256').update(stable(v), 'utf8').digest('hex');
function sortedSlugs(v, what) {
  demand(Array.isArray(v) && v.length <= 32, what + ' list invalid');
  demand(v.every(s => typeof s === 'string' && SLUG.test(s)), what + ' invalid slug');
  demand(new Set(v).size === v.length, what + ' duplicates');
  return [...v].sort(asc);
}

export function normalizePlan(plan) {
  exact(plan, ['schema', 'project', 'execution_boundary', 'tasks'], 'plan');
  demand(plan.schema === PLAN, 'wrong plan schema');
  demand(typeof plan.project === 'string' && SLUG.test(plan.project), 'project invalid');
  exact(plan.execution_boundary, Object.keys(BOUNDARY), 'boundary');
  for (const [k, v] of Object.entries(BOUNDARY)) demand(plan.execution_boundary[k] === v, 'unauthorized execution boundary');
  demand(Array.isArray(plan.tasks) && plan.tasks.length > 0 && plan.tasks.length <= 128, 'task count invalid');
  const tasks = plan.tasks.map(t => {
    exact(t, ['id', 'depends_on', 'priority', 'cost_units', 'mode', 'evidence'], 'task');
    demand(typeof t.id === 'string' && SLUG.test(t.id), 'invalid task ID');
    demand(Number.isInteger(t.priority) && t.priority >= 0 && t.priority <= 100, 'priority invalid');
    demand(Number.isInteger(t.cost_units) && t.cost_units >= 1 && t.cost_units <= 100, 'cost invalid');
    demand(t.mode === 'read_only' || t.mode === 'proposal', 'mode forbidden');
    const depends_on = sortedSlugs(t.depends_on, 'dependency');
    const evidence = sortedSlugs(t.evidence, 'evidence');
    demand(evidence.length > 0 && evidence.every(e => EVIDENCE.has(e)), 'unknown evidence kind');
    demand(!depends_on.includes(t.id), 'self dependency');
    return { id: t.id, depends_on, priority: t.priority, cost_units: t.cost_units, mode: t.mode, evidence };
  }).sort((a, b) => asc(a.id, b.id));
  const byId = new Map(tasks.map(t => [t.id, t]));
  demand(byId.size === tasks.length, 'duplicate task ID');
  const seen = new Set(), active = new Set();
  function visit(id) {
    demand(!active.has(id), 'dependency cycle');
    if (seen.has(id)) return;
    active.add(id);
    for (const dep of byId.get(id).depends_on) {
      demand(byId.has(dep), 'unknown dependency');
      visit(dep);
    }
    active.delete(id);
    seen.add(id);
  }
  for (const t of tasks) visit(t.id);
  return { schema: PLAN, project: plan.project, execution_boundary: { ...BOUNDARY }, tasks };
}
export function compileHandoff(plan) {
  const normalized = normalizePlan(plan);
  return {
    schema: HANDOFF, plan: normalized, plan_sha256: sha(normalized),
    ready_task_ids: normalized.tasks.filter(t => t.depends_on.length === 0)
      .sort((a, b) => b.priority - a.priority || asc(a.id, b.id)).map(t => t.id),
    blocked_task_ids: normalized.tasks.filter(t => t.depends_on.length !== 0).map(t => t.id),
  };
}
export function verifyHandoff(value) {
  exact(value, ['schema', 'plan', 'plan_sha256', 'ready_task_ids', 'blocked_task_ids'], 'handoff');
  demand(value.schema === HANDOFF, 'unsupported handoff');
  const expected = compileHandoff(value.plan);
  demand(stable(value) === stable(expected), 'handoff differs from recomputation');
  return expected;
}
async function main(argv) {
  demand(argv.length === 1 || (argv.length === 3 && argv[1] === '--output'),
    'usage: node tools/continuity-plan.mjs PLAN.json [--output HANDOFF.json]');
  const bytes = await readFile(argv[0]);
  demand(bytes.length > 0 && bytes.length <= 131072, 'plan size outside bound');
  const handoff = compileHandoff(JSON.parse(bytes.toString('utf8')));
  const encoded = stable(handoff) + '\n';
  if (argv.length === 1) process.stdout.write(encoded);
  else await writeFile(argv[2], encoded, { flag: 'wx', mode: 0o600 });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exitCode = 2; });
}
