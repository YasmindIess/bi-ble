import { useState, type ChangeEvent } from "react";
import type { ContinuityHandoff } from "../model/continuity-export.mjs";
import type { ReceiptObservation } from "../model/receipt-reconcile.mjs";

interface ContinuityPanelProps {
  hasContinuityTasks: boolean;
  generating: boolean;
  handoff: ContinuityHandoff | null;
  error: string | null;
  selectedTaskId: string | null;
  taskStates: Record<string, string>;
  observations: ReceiptObservation[];
  storedCount: number;
  onGenerate: (project: string) => Promise<void>;
  onImportReceipt: (receiptText: string, proposalText: string | null) => Promise<void>;
}
const labels: Record<string,string> = {
  planned:"Planned", eligible:"Eligible (structural)", blocked:"Blocked",
  observed_locally:"Observed locally (unattested)",
  content_integrity_verified:"Content integrity verified",
  independently_witnessed:"Independently witnessed", unresolved:"Unresolved"
};
export function ContinuityPanel({
  hasContinuityTasks,generating,handoff,error,selectedTaskId,taskStates,
  observations,storedCount,onGenerate,onImportReceipt
}: ContinuityPanelProps) {
  const [project,setProject]=useState("nice-robin");
  const [copied,setCopied]=useState(false);
  const [proposalFile,setProposalFile]=useState<File|null>(null);
  const [importing,setImporting]=useState(false);
  const [importError,setImportError]=useState<string|null>(null);
  const [importDone,setImportDone]=useState(false);
  const current=handoff?.plan.project===project?handoff:null;
  const exportJson=current===null?"":JSON.stringify(current,null,2)+"\n";
  const selectedStatus=selectedTaskId===null?"":taskStates[selectedTaskId]??"planned";
  const related=observations.filter(o=>o.task_id===selectedTaskId&&
    o.plan_sha256===current?.plan_sha256);

  async function copy(){
    if(current===null)return;
    try{await navigator.clipboard.writeText(exportJson);setCopied(true);}
    catch{setCopied(false);}
  }
  function save(){
    if(current===null)return;
    const url=URL.createObjectURL(new Blob([exportJson],{type:"application/json"}));
    const link=document.createElement("a");link.href=url;
    link.download="bi-ble-"+current.plan.project+"-handoff.json";link.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),0);
  }
  async function importFile(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];event.target.value="";
    if(!file)return;
    setImportError(null);setImportDone(false);setImporting(true);
    try{
      if(file.size>2_000_000||file.size===0)throw Error("Receipt JSON exceeds 2 MB or is empty.");
      if(proposalFile && (proposalFile.size>2_000_000||proposalFile.size===0))
        throw Error("Proposal JSON exceeds 2 MB or is empty.");
      await onImportReceipt(await file.text(),proposalFile?await proposalFile.text():null);
      setImportDone(true);
    }catch(e){setImportError(e instanceof Error?e.message:"Evidence import blocked");}
    finally{setImporting(false);}
  }

  return (
    <section className="continuity-card" aria-label="NICE-ROBIN continuity reconciliation">
      <div className="compiler-card-heading">
        <span className="eyebrow">Continuity · NICE-ROBIN</span>
        <span className="compiler-state">Simulation only</span>
      </div>
      <p>Compile admitted Continuity tasks into a development handoff; no task is executed.</p>
      <label htmlFor="continuity-project">Project slug</label>
      <input id="continuity-project" value={project} spellCheck={false}
        onChange={e=>{setProject(e.target.value);setCopied(false);}}/>
      <button type="button" disabled={!hasContinuityTasks||generating}
        onClick={()=>{setCopied(false);void onGenerate(project);}}>
        {generating?"Checking formula…":"Prepare handoff"}
      </button>
      {!hasContinuityTasks&&<small>Add Continuity task objects from Core first.</small>}
      {error&&<p role="alert" className="continuity-error">{error}</p>}
      {current!==null&&(
        <div className="continuity-report" role="status">
          <div><strong>{current.plan.tasks.length} tasks</strong>
            <span>{current.ready_task_ids.length} roots · {current.blocked_task_ids.length} dependent</span>
          </div>
          <code title={current.plan_sha256}>{current.plan_sha256}</code>
          <div className="continuity-actions">
            <button type="button" onClick={()=>{void copy();}}>{copied?"Copied":"Copy JSON"}</button>
            <button type="button" onClick={save}>Save JSON</button>
          </div>
        </div>
      )}
      {selectedTaskId!==null&&(
        <div className="continuity-evidence-summary" role="status">
          <strong>{selectedTaskId}</strong>
          <span>{labels[selectedStatus]??selectedStatus}</span>
          {related.map(o=>(
            <div className="continuity-evidence-item" key={o.receipt_sha256}>
              <code title={o.receipt_sha256}>Receipt {o.receipt_sha256.slice(0,16)}…</code>
              <small>{labels[o.status]??o.status} · {o.capability} · {o.evidence_scope}</small>
              <small>Outcome: {o.outcome}; report {o.report_sha256.slice(0,16)}…</small>
              {o.blockers.length>0&&<small>Failed checks: {o.blockers.join(", ")}</small>}
              {o.missing.length>0&&<small>Still required: {o.missing.join(", ")}</small>}
            </div>
          ))}
          {current?.plan.tasks.some(t=>t.id===selectedTaskId&&t.depends_on.length>0)&&
            <small>Predecessor receipts never automatically satisfy independent-witness or execution authority.</small>}
        </div>
      )}
      <details className="continuity-import">
        <summary>Reconcile local worker evidence ({storedCount})</summary>
        <p>Import original canonical worker JSON and its proposal. Files stay local; no permission or execution is inferred.</p>
        <label htmlFor="continuity-proposal-file">NICE-ROBIN proposal (optional; required for complete verification)</label>
        <input id="continuity-proposal-file" type="file" accept=".json,application/json"
          onChange={e=>{setProposalFile(e.target.files?.[0]??null);setImportDone(false);}}/>
        <label htmlFor="continuity-receipt-file">Worker receipt JSON</label>
        <input id="continuity-receipt-file" type="file" accept=".json,application/json"
          disabled={importing} onChange={e=>{void importFile(e);}}/>
        {importing&&<small role="status">Verifying receipt…</small>}
        {importError&&<p role="alert" className="continuity-error">{importError}</p>}
        {importDone&&<small role="status">Receipt preserved separately; see graph evidence indicator and selected task.</small>}
        <small>Hash match ≠ witness, authentic execution, approval, or permission to publish. A missing handoff/proposal stays unresolved.</small>
      </details>
    </section>
  );
}
