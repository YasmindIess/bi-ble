import { useState } from "react";
import type { ContinuityHandoff } from "../model/continuity-export.mjs";

interface ContinuityPanelProps {
  hasContinuityTasks: boolean;
  generating: boolean;
  handoff: ContinuityHandoff | null;
  error: string | null;
  onGenerate: (project: string) => Promise<void>;
}
export function ContinuityPanel({
  hasContinuityTasks, generating, handoff, error, onGenerate
}: ContinuityPanelProps) {
  const [project, setProject] = useState("nice-robin");
  const [copied, setCopied] = useState(false);
  const current = handoff?.plan.project === project ? handoff : null;
  const exportJson = current === null ? "" : JSON.stringify(current, null, 2) + "\n";

  async function copy() {
    if (current === null) return;
    try { await navigator.clipboard.writeText(exportJson); setCopied(true); }
    catch { setCopied(false); }
  }
  function save() {
    if (current === null) return;
    const url = URL.createObjectURL(new Blob([exportJson], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "bi-ble-" + current.plan.project + "-handoff.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <section className="continuity-card" aria-label="NICE-ROBIN continuity handoff">
      <div className="compiler-card-heading">
        <span className="eyebrow">Continuity · NICE-ROBIN</span>
        <span className="compiler-state">Simulation only</span>
      </div>
      <p>Compile typed Continuity tasks into a verifiable development plan. No tasks are executed.</p>
      <label htmlFor="continuity-project">Project slug</label>
      <input id="continuity-project" value={project} spellCheck={false}
        onChange={event => { setProject(event.target.value); setCopied(false); }} />
      <button type="button" disabled={!hasContinuityTasks || generating}
        onClick={() => { setCopied(false); void onGenerate(project); }}>
        {generating ? "Checking formula…" : "Prepare handoff"}
      </button>
      {!hasContinuityTasks && <small>Add Continuity task objects from Core first.</small>}
      {error && <p role="alert" className="continuity-error">{error}</p>}
      {current !== null && (
        <div className="continuity-report" role="status">
          <div><strong>{current.plan.tasks.length} tasks</strong>
            <span>{current.ready_task_ids.length} ready · {current.blocked_task_ids.length} dependent</span>
          </div>
          <code title={current.plan_sha256}>{current.plan_sha256}</code>
          <div className="continuity-actions">
            <button type="button" onClick={() => { void copy(); }}>{copied ? "Copied" : "Copy JSON"}</button>
            <button type="button" onClick={save}>Save JSON</button>
          </div>
          <small>Readiness does not prove execution or authorize external effects.</small>
        </div>
      )}
    </section>
  );
}
