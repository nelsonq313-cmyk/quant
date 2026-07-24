import React, { useMemo, useState } from 'react';
import { CheckCircle2, Database, FileSpreadsheet, Upload } from 'lucide-react';
import { personalModel } from './personalDataset';

const fmtPct=n=>`${Number(n).toFixed(1)}%`;
const requiredFields=['timestamp','pnl','side','symbol','entry','exit','size'];

function parseCsv(text){
  const rows=String(text||'').split(/\r?\n/).filter(Boolean);if(!rows.length)return {headers:[],rows:[]};
  const split=line=>{const out=[];let cur='',quote=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quote&&line[i+1]==='"'){cur+='"';i+=1}else quote=!quote}else if(ch===','&&!quote){out.push(cur.trim());cur=''}else cur+=ch}out.push(cur.trim());return out};
  const headers=split(rows[0]);const data=rows.slice(1,101).map(line=>{const values=split(line);return Object.fromEntries(headers.map((h,i)=>[h,values[i]??'']))});return {headers,rows:data,totalRows:Math.max(0,rows.length-1)};
}

export default function DataTerminal(){
  const [dataset,setDataset]=useState(null),[mapping,setMapping]=useState({}),[saved,setSaved]=useState(()=>{try{return JSON.parse(localStorage.getItem('qnt.datasets')||'[]')}catch{return []}});
  const importFile=e=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{const parsed=parseCsv(reader.result);setDataset({name:file.name,size:file.size,updated:new Date().toISOString(),...parsed});const auto={};for(const field of requiredFields){const hit=parsed.headers.find(h=>h.toLowerCase().replace(/[^a-z]/g,'').includes(field.replace(/[^a-z]/g,'')));if(hit)auto[field]=hit}setMapping(auto)};reader.readAsText(file)};
  const missing=useMemo(()=>requiredFields.filter(x=>!mapping[x]),[mapping]);
  const saveDataset=()=>{if(!dataset)return;const meta={id:Date.now(),name:dataset.name,rows:dataset.totalRows,headers:dataset.headers,mapping,updated:dataset.updated,status:missing.length?'mapped-partial':'mapped'};const next=[meta,...saved].slice(0,12);setSaved(next);localStorage.setItem('qnt.datasets',JSON.stringify(next))};

  return <div className="qpToolPage qtDataTerminal"><div className="qpToolTitle"><span>DATA TERMINAL</span><h1>Research datasets</h1><p>Inspect provenance, preview CSV files, map fields and save dataset metadata without silently mutating the statistical model.</p></div><div className="qpDataMetrics"><div className="qpStat"><span>CURATED EVAL IDEAS</span><b>{personalModel.evalPositionIdeas}</b></div><div className="qpStat"><span>OBSERVED WIN</span><b>{fmtPct(personalModel.winProbability*100)}</b></div><div className="qpStat"><span>WIN PAYOFF LIBRARY</span><b>{personalModel.winR.length}</b></div><div className="qpStat"><span>LOSS PAYOFF LIBRARY</span><b>{personalModel.lossR.length}</b></div><div className="qpStat"><span>SAVED DATASETS</span><b>{saved.length}</b></div></div>

    <div className="qtDatasetGrid"><section className="qtDatasetPanel"><div className="qtDatasetHead"><FileSpreadsheet size={14}/><b>IMPORT / PREVIEW</b></div><label className="qpUpload"><Upload size={13}/> Select CSV<input type="file" accept=".csv,.txt" onChange={importFile}/></label>{!dataset?<div className="qtDatasetEmpty"><Database size={22}/><b>No import staged</b><span>Choose a CSV to preview up to 100 rows and map research fields.</span></div>:<><div className="qtDatasetMeta"><b>{dataset.name}</b><span>{dataset.totalRows.toLocaleString()} rows · {dataset.headers.length} fields · {(dataset.size/1024).toFixed(1)} KB</span></div><div className="qtPreviewTable"><div className="qtPreviewRow head">{dataset.headers.slice(0,6).map(h=><span key={h}>{h}</span>)}</div>{dataset.rows.slice(0,8).map((row,i)=><div className="qtPreviewRow" key={i}>{dataset.headers.slice(0,6).map(h=><span key={h}>{row[h]||'—'}</span>)}</div>)}</div></>}</section>

      <section className="qtDatasetPanel"><div className="qtDatasetHead"><Database size={14}/><b>FIELD MAPPING</b></div>{!dataset?<div className="qtDatasetEmpty"><b>Mapping waits for a file</b><span>QNT will not guess a dataset schema without seeing the headers.</span></div>:<><div className="qtMapping">{requiredFields.map(field=><label key={field}><span>{field.toUpperCase()}</span><select value={mapping[field]||''} onChange={e=>setMapping(m=>({...m,[field]:e.target.value}))}><option value="">not mapped</option>{dataset.headers.map(h=><option key={h} value={h}>{h}</option>)}</select></label>)}</div><div className={`qtMapStatus ${missing.length?'warn':'ok'}`}>{missing.length?`${missing.length} optional/research fields remain unmapped`:'Core research mapping complete'}</div><button className="qpsPrimary qtSaveDataset" onClick={saveDataset}><CheckCircle2 size={13}/> Save dataset metadata</button></>}</section>
    </div>

    <section className="qtSavedDatasets"><div className="qtDatasetHead"><Database size={14}/><b>DATASET REGISTRY</b></div>{saved.length?saved.map(x=><div className="qtSavedRow" key={x.id}><b>{x.name}</b><span>{x.rows.toLocaleString()} rows</span><span>{Object.keys(x.mapping||{}).length} mapped fields</span><em>{x.status}</em><small>{new Date(x.updated).toLocaleString()}</small></div>):<div className="qtDatasetEmpty"><span>No imported dataset metadata saved yet.</span></div>}</section>
    <p className="qtDatasetFoot">Personal-model provenance: {personalModel.curationNote} Current R values remain normalized payoff units rather than true stop-defined risk multiples.</p>
  </div>;
}
