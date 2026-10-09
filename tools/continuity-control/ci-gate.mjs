#!/usr/bin/env node
/**
 * Read-only, fail-closed evidence of local source heads versus GitHub Actions.
 * Never fetches/merges code, executes a build, pushes, or authorizes release.
 * Run: node tools/continuity-control/ci-gate.mjs
 * Requires an authenticated local `gh` CLI for private NICE-ROBIN.
 */
import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {existsSync} from 'node:fs';

const env=process.env;
const projects=[
 {key:'bible',repo:'YasmindIess/bi-ble',dir:env.BIBLE_REPO_DIR||join(homedir(),'bi-ble-cinema'),branch:env.BIBLE_EXPECTED_BRANCH||'feat/continuity-handoff-v1'},
 {key:'robin',repo:'YasmindIess/nice-robin',dir:env.ROBIN_REPO_DIR||join(homedir(),'nice-robin-cinema'),branch:env.ROBIN_EXPECTED_BRANCH||'feat/continuity-bounded-local-worker-v1'}
];
function cmd(command,args,cwd){
 return execFileSync(command,args,{cwd,encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']}).trim();
}
function inspectLocal(p){
 if(!existsSync(join(p.dir,'.git')))throw Error('checkout missing');
 const branch=cmd('git',['branch','--show-current'],p.dir);
 const head=cmd('git',['rev-parse','HEAD'],p.dir);
 const dirty=cmd('git',['status','--porcelain','--untracked-files=normal'],p.dir);
 if(branch!==p.branch)throw Error('unapproved branch '+branch);
 if(dirty!=='')throw Error('dirty checkout (user changes preserved)');
 return {head,branch};
}
function inspectCI(p,sha){
 const url='/repos/'+p.repo+'/actions/runs?head_sha='+encodeURIComponent(sha)+'&per_page=30';
 const data=JSON.parse(cmd('gh',['api',url],p.dir));
 const runs=(data.workflow_runs||[]).filter(r=>r.head_sha===sha&&['pull_request','push','workflow_dispatch'].includes(r.event));
 if(!runs.length)return {gate:'held',reason:'no exact-head CI runs',runs:[]};
 const latestByWorkflow=new Map();
 for(const run of runs){
  const name=run.workflow_id||run.name;
  if(!latestByWorkflow.has(name))latestByWorkflow.set(name,run);
 }
 const checked=[...latestByWorkflow.values()].map(r=>({id:r.id,name:r.name,status:r.status,conclusion:r.conclusion,url:r.html_url}));
 const green=checked.every(r=>r.status==='completed'&&r.conclusion==='success');
 return {gate:green?'green':'held',reason:green?'exact-head GitHub Actions passed':'pending, failed, or cancelled GitHub Actions',runs:checked};
}
const rows=projects.map(p=>{
 try{
  const local=inspectLocal(p);
  try{return {key:p.key,repo:p.repo,...local,...inspectCI(p,local.head)}}
  catch(e){return {key:p.key,repo:p.repo,...local,gate:'unverified',reason:'GitHub Actions access unavailable: '+e.message.slice(0,150)}}
 }catch(e){return {key:p.key,repo:p.repo,gate:'held',reason:e.message.slice(0,180)}}
});
const allGreen=rows.every(r=>r.gate==='green');
const report={schema:'continuity-local-ci-gate-v1',checked_at:new Date().toISOString(),gate:allGreen?'green':'held',projects:rows,
 source_mutation:false,release_authorized:false,independent_witness:false};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
if(!process.argv.includes('--report-only')&&!allGreen)process.exitCode=2;
