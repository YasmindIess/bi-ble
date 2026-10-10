import {useState, type ChangeEvent} from "react";
import {decodeAgencyProjection} from "../model/agency-projection.mjs";

type AgencyTask = {
  id:string;title:string;status:string;priority:number;cost_units:number;
  depends_on:string[];capability:string;evidence_requirement:string
};
type AgencyReport = {
  schema:string;record_sha256:string;
  source:{head:string;source_tree_sha256:string;release_input_gaps:string[];tracked_file_count:number};
  selected_task_id:string|null;
  tasks:AgencyTask[];
  execution:{status:string;files_parsed?:number;failures?:Array<{path:string;reason:string}>};
  choir_runtime_invoked:false;coding_agent_invoked:false;
  independent_witness:false;release_authorized:false;
};
const statuses:Record<string,string>={
 ready:"Ready for bounded check",
 observed_local_check:"Local static check passed",
 observed_previous_local_check:"Prior local check — unchanged source",
 blocked_by_source_errors:"Local static check blocked",
 needs_authorized_coding_agent:"Proposed — needs authorized coding agent",
 deferred_not_admitted:"Deferred — review required"
};
export function AgencyWorkPanel(){
 const [report,setReport]=useState<AgencyReport|null>(null);
 const [error,setError]=useState<string|null>(null);
 async function onChoose(event:ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];event.target.value="";
  if(!file)return;
  setReport(null);setError(null);
  try{
   if(file.size===0||file.size>500000)throw Error("Agency evidence must be within 500 kB.");
   const decoded=await decodeAgencyProjection(await file.text());
   setReport(decoded as AgencyReport);
  }catch(e){setError(e instanceof Error?e.message:"Agency evidence import held");}
 }
 return (
  <section className="continuity-card agency-work" aria-label="NICE-ROBIN agency task projection">
   <div className="compiler-card-heading">
    <span className="eyebrow">Agency · Intelligence → Projection → Execution</span>
    <span className="compiler-state">Local evidence only</span>
   </div>
   <p>Inspect one source-derived NICE-ROBIN task plan and bounded execution result.
      This view never dispatches agents or changes the editor graph.</p>
   <label htmlFor="agency-projection-file">Import NICE-ROBIN agency JSON</label>
   <input id="agency-projection-file" type="file" accept=".json,application/json" onChange={e=>{void onChoose(e)}}/>
   {error&&<p className="continuity-error" role="alert">{error}</p>}
   {report&&(
    <div className="agency-work-body">
     <div className="agency-work-meta">
      <strong>{report.tasks.length} source-derived tasks</strong>
      <small>Head {report.source.head.slice(0,12)} · {report.source.tracked_file_count} files indexed</small>
      <small>Execution: {report.execution.status.replaceAll("_"," ")}</small>
      <small>Choir: not invoked · Coding agent: not invoked · Witness: not established</small>
     </div>
     <ol className="agency-work-tasks" aria-label="Source-derived task sequence">
      {report.tasks.map(task=><li key={task.id} className={"agency-task agency-"+task.status}>
       <strong>{task.title}</strong>
       <small>{statuses[task.status]??task.status} · priority {task.priority} · cost {task.cost_units}</small>
       <small>{task.capability.replaceAll("_"," ")} · requires {task.evidence_requirement.replaceAll("_"," ")}</small>
       {task.depends_on.length>0&&<small>Blocked on: {task.depends_on.join(", ")}</small>}
      </li>)}
     </ol>
     <small>Next local candidate: {report.selected_task_id??"None admitted; inspect deferred tasks or changed source"}</small>
     <code title={report.record_sha256}>Report {report.record_sha256.slice(0,18)}…</code>
     <small>Local source and reported checks are unattested. No independent execution, merge, release or publication permission.</small>
    </div>
   )}
  </section>
 );
}