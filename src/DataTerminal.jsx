import React, { useMemo, useState } from 'react';
import { CheckCircle2, Database, FileSpreadsheet, Search, Trash2, Upload } from 'lucide-react';
import { personalModel } from './personalDataset';

const fmtPct=n=>`${Number(n).toFixed(1)}%`;
const requiredFields=['timestamp','pnl','side','symbol','entry','exit','size'];

function parseCsv(text){
  const lines=String(text||'').split(/\r?\n/).filter(line=>line.trim().length);if(!lines.length)return {headers:[],rows:[],totalRows:0};
  const split=line=>{const out=[];let cur='',quote=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quote&&line[i+1]==='"'){cur+='"';i+=1}else quote=!quote}else if(ch===','&&!quote){out.push(cur.trim());cur=''}else cur+=ch}out.push(cur.trim());return out};
  const headers=split(lines[0]);const rows=lines.slice(1,501).map(line=>{const values=split(line);return Object.fromEntries(headers.map((h,i)=>[h,values[i]??'']))});return {headers,rows,totalRows:Math.max(0,lines.length-1)};
}

function inferQuality(dataset,mapping){
  if(!dataset)return null;const rows=dataset.rows||[],cells=Math.max(1,rows.length*dataset.headers.length),missingCells=rows.reduce((sum,row)=>sum+dataset.headers.filter(h=>String(row[h]??'').trim()==='').length,0),missingPct=missingCells/cells*100;
  const symbols=mapping.symbol?[...new Set(rows.map(r=>String(r[mapping.symbol]||'').trim()).filter(Boolean))].slice(0,8):[];
  const timestampValues=mapping.timestamp?rows.map(r=>Date.parse(r[mapping.timestamp])).filter(Number.isFinite).sort((a,b)=>a-b):[];
  const pnlValues=mapping.pnl?rows.map(r=>Number(String(r[mapping.pnl]).replace(/[$,]/g,''))).filter(Number.isFinite):[];
  const duplicateRows=rows.length-new Set(rows.map(r=>JSON.stringify(r))).size;
  const score=Math.max(0,100-missingPct*2-Math.min(25,duplicateRows/(rows.length||1)*100)-Math.min(30,requiredFields.filter(f=>!mapping[f]).length*4));
  return {missingPct,duplicateRows,symbols,dateMin:timestampValues[0]||null,dateMax:timestampValues.at(-1)||null,numericPnl:pnlValues.length,previewRows:rows.length,score};
}

export default function DataTerminal(){
  const [dataset,setDataset]=useState(null),[mapping,setMapping]=useState({}),[query,setQuery]=useState(''),[saved,setSaved]=useState(()=>{try{return JSON.parse(localStorage.getItem('qnt.datasets')||'[]')}catch{return []}});
  const importFile=e=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{const parsed=parseCsv(reader.result),staged={name:file.name,size:file.size,updated:new Date().toISOString(),source:'local CSV import',...parsed};setDataset(staged);const auto={};for(const field of requiredFields){const normalized=field.replace(/[^a-z]/g,'');const hit=parsed.headers.find(h=>h.toLowerCase().replace(/[^a-z]/g,'').includes(normalized));if(hit)auto[field]=hit}setMapping(auto)};reader.readAsText(file)};
  const missing=useMemo(()=>requiredFields.filter(x=>!mapping[x]),[mapping]),quality=useMemo(()=>inferQuality(dataset,mapping),[dataset,mapping]);
  const saveDataset=()=>{if(!dataset)return;const meta={id:Date.now(),name:dataset.name,rows:dataset.totalRows,headers:dataset.headers,mapping,updated:dataset.updated,source:dataset.source,status:missing.length?'mapped-partial':'mapped',quality:quality?.score??0,missingPct:quality?.missingPct??0,symbols:quality?.symbols??[],dateMin:quality?.dateMin??null,dateMax:quality?.dateMax??null};const next=[meta,...saved].slice(0,20);setSaved(next);localStorage.setItem('qnt.datasets',JSON.stringify(next))};
  const removeSaved=id=>{const next=saved.filter(x=>x.id!==id);setSaved(next);localStorage.setItem('qnt.datasets',JSON.stringify(next))};
  const visible=saved.filter(x=>`${x.name} ${(x.symbols||[]).join(' ')} ${x.source||''}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="qpToolPage qtDataTerminal"><div className="qpToolTitle"><span>DATA TERMINAL</span><h1>Research datasets</h1><p>Inspect provenance, preview CSV files, map fields, score basic data quality and save dataset metadata without silently changing the statistical model.</p></div><div className="qpDataMetrics"><div className="qpStat"><span>CURATED EVAL IDEAS</span><b>{personalModel.evalPositionIdeas}</b></div><div className="qpStat"><span>OBSERVED WIN</span><b>{fmtPct(personalModel.winProbability*100)}</b></div><div className="qpStat"><span>WIN PAYOFF LIBRARY</span><b>{personalModel.winR.length}</b></div><div className="qpStat"><span>LOSS PAYOFF LIBRARY</span><b>{personalModel.lossR.length}</b></div><div className="qpStat"><span>SAVED DATASETS</span><b>{saved.length}</b></div></div>

    <div className="qtDatasetGrid"><section className="qtDatasetPanel"><div className="qtDatasetHead"><FileSpreadsheet size={14}/><b>IMPORT / PREVIEW</b></div><label className="qpUpload"><Upload size={13}/> Select CSV<input type="file" accept=".csv,.txt" onChange={importFile}/></label>{!dataset?<div className="qtDatasetEmpty"><Database size={22}/><b>No import staged</b><span>Choose a CSV to preview up to 500 rows and map research fields.</span></div>:<><div className="qtDatasetMeta"><b>{dataset.name}</b><span>{dataset.totalRows.toLocaleString()} rows · {dataset.headers.length} fields · {(dataset.size/1024).toFixed(1)} KB</span></div><div className="qtQualityStrip"><div><span>QUALITY</span><b>{quality?.score.toFixed(0)}/100</b></div><div><span>MISSING</span><b>{quality?.missingPct.toFixed(1)}%</b></div><div><span>DUPLICATES*</span><b>{quality?.duplicateRows}</b></div><div><span>SYMBOLS</span><b>{quality?.symbols.join(', ')||'—'}</b></div><div><span>DATE RANGE</span><b>{quality?.dateMin?`${new Date(quality.dateMin).toLocaleDateString()} – ${new Date(quality.dateMax).toLocaleDateString()}`:'—'}</b></div></div><div className="qtPreviewTable"><div className="qtPreviewRow head">{dataset.headers.slice(0,6).map(h=><span key={h}>{h}</span>)}</div>{dataset.rows.slice(0,8).map((row,i)=><div className="qtPreviewRow" key={i}>{dataset.headers.slice(0,6).map(h=><span key={h}>{row[h]||'—'}</span>)}</div>)}</div><small className="qtQualityNote">*Duplicate count and missing-value rate use the preview sample, not unseen rows beyond the first 500.</small></>}</section>

      <section className="qtDatasetPanel"><div className="qtDatasetHead"><Database size={14}/><b>FIELD MAPPING</b></div>{!dataset?<div className="qtDatasetEmpty"><b>Mapping waits for a file</b><span>QNT will not guess a dataset schema without seeing the headers.</span></div>:<><div className="qtMapping">{requiredFields.map(field=><label key={field}><span>{field.toUpperCase()}</span><select value={mapping[field]||''} onChange={e=>setMapping(m=>({...m,[field]:e.target.value}))}><option value="">not mapped</option>{dataset.headers.map(h=><option key={h} value={h}>{h}</option>)}</select></label>)}</div><div className={`qtMapStatus ${missing.length?'warn':'ok'}`}>{missing.length?`${missing.length} research fields remain unmapped`:'Core research mapping complete'}</div><button className="qpsPrimary qtSaveDataset" onClick={saveDataset}><CheckCircle2 size={13}/> Save dataset metadata</button></>}</section>
    </div>

    <section className="qtSavedDatasets"><div className="qtDatasetHead"><Database size={14}/><b>DATASET REGISTRY</b><div className="qtRegistrySearch"><Search size={11}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="filter registry"/></div></div>{visible.length?visible.map(x=><div className="qtSavedRow" key={x.id}><b>{x.name}</b><span>{x.rows.toLocaleString()} rows</span><span>{x.symbols?.join(', ')||'unlabeled'}</span><em>{x.status} · Q{x.quality?.toFixed?.(0)??'—'}</em><small>{x.dateMin?`${new Date(x.dateMin).toLocaleDateString()} – ${new Date(x.dateMax).toLocaleDateString()}`:new Date(x.updated).toLocaleString()}</small><button title="Remove registry entry" onClick={()=>removeSaved(x.id)}><Trash2 size={11}/></button></div>):<div className="qtDatasetEmpty"><span>No matching imported dataset metadata saved yet.</span></div>}</section>
    <p className="qtDatasetFoot">Personal-model provenance: {personalModel.curationNote} Current R values remain normalized payoff units rather than true stop-defined risk multiples.</p>
  </div>;
}
