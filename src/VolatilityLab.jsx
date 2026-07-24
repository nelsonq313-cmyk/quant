import React, { useEffect, useMemo, useState } from 'react';
import './volatility.css';
import { Activity, Braces, Database, FileCode2, Folder, Play, RefreshCw, Search, Waves } from 'lucide-react';
import InteractiveSurface3D from './InteractiveSurface3D.jsx';

const DTE_BUCKETS=[7,30,60,90];
const MONEYNESS_LEVELS=[-0.15,-0.10,-0.05,0,0.05,0.10,0.15];

function demoPayload(symbol='AAPL'){
  const underlyingPrice=225;const contracts=[];
  DTE_BUCKETS.forEach((dte,di)=>MONEYNESS_LEVELS.forEach((m,mi)=>{
    const strike=Math.round((underlyingPrice*(1+m))/2.5)*2.5;
    const smile=.205+Math.abs(m)*.43+Math.max(-m,0)*.17;
    const term=di*.012;const wave=Math.sin((mi+1)*.9+di*.7)*.008;
    ['call','put'].forEach(side=>contracts.push({symbol,side,strike,dte,expiration:Date.now()/1000+dte*86400,iv:Math.max(.12,smile+term+wave+(side==='put'?Math.max(-m,0)*.03:0)),delta:side==='call'?Math.max(.08,.5-m*2.5):Math.min(-.08,-.5-m*2.5)}));
  }));
  return {symbol,underlyingPrice,source:'Demo surface',delayed:true,updated:new Date().toISOString(),contracts,demo:true};
}

function nearestContract(contracts,targetStrike,side){
  const filtered=contracts.filter(c=>(side==='blend'||c.side===side)&&Number.isFinite(c.iv));
  if(!filtered.length)return null;
  if(side==='blend'){
    const calls=filtered.filter(c=>c.side==='call').sort((a,b)=>Math.abs(a.strike-targetStrike)-Math.abs(b.strike-targetStrike));
    const puts=filtered.filter(c=>c.side==='put').sort((a,b)=>Math.abs(a.strike-targetStrike)-Math.abs(b.strike-targetStrike));
    const call=calls[0],put=puts[0];if(call&&put)return {...call,iv:(call.iv+put.iv)/2};return call||put||null;
  }
  return filtered.sort((a,b)=>Math.abs(a.strike-targetStrike)-Math.abs(b.strike-targetStrike))[0];
}

function buildSurface(payload,side){
  const contracts=(payload.contracts||[]).filter(c=>c.iv>.02&&c.iv<5&&c.dte>=0);
  const spot=payload.underlyingPrice||1;
  const dtes=[...new Set(contracts.map(c=>c.dte))].sort((a,b)=>a-b).slice(0,7);
  const chosen=dtes.length?dtes:DTE_BUCKETS;
  const rows=chosen.map(dte=>{const bucket=contracts.filter(c=>c.dte===dte);return MONEYNESS_LEVELS.map(m=>{const target=spot*(1+m);const c=nearestContract(bucket,target,side);return {dte,moneyness:m,strike:c?.strike??target,iv:c?.iv??0};});});
  return {rows,dtes:chosen,spot};
}

function metricSummary(surface){
  if(!surface.rows.length)return {atm:0,skew:0,term:0,min:0,max:0};
  const atmIndex=MONEYNESS_LEVELS.indexOf(0);const atmValues=surface.rows.map(r=>r[atmIndex]?.iv||0).filter(Boolean);const first=surface.rows[0];const putWing=first?.[1]?.iv||0;const callWing=first?.[5]?.iv||0;const values=surface.rows.flat().map(p=>p.iv).filter(Boolean);
  return {atm:atmValues[0]||0,skew:putWing-callWing,term:(atmValues.at(-1)||0)-(atmValues[0]||0),min:Math.min(...values,0),max:Math.max(...values,0)};
}

export default function VolatilityLab(){
  const [symbol,setSymbol]=useState('AAPL');const [query,setQuery]=useState('AAPL');const [side,setSide]=useState('blend');const [payload,setPayload]=useState(()=>demoPayload('AAPL'));const [loading,setLoading]=useState(false);const [message,setMessage]=useState('Demo surface loaded. Connect the delayed-data token to replace it.');
  const load=async(requested=query)=>{
    const clean=String(requested||'AAPL').trim().toUpperCase();setLoading(true);setMessage('Loading delayed option-chain snapshots…');
    try{const res=await fetch(`/api/options-chain?symbol=${encodeURIComponent(clean)}`);const data=await res.json();if(!res.ok||!Array.isArray(data.contracts)||!data.contracts.length)throw new Error(data.error||'No option data returned');setPayload(data);setQuery(clean);setSymbol(clean);setMessage(`${data.source||'Options API'} • ${data.delayed?'delayed data':'live data'}`);try{const key=`qnt.iv.archive.${clean}`;const prior=JSON.parse(localStorage.getItem(key)||'[]');localStorage.setItem(key,JSON.stringify([...prior,{updated:data.updated,underlyingPrice:data.underlyingPrice,contracts:data.contracts}].slice(-30)));}catch{}}
    catch(error){setPayload(demoPayload(clean));setQuery(clean);setSymbol(clean);setMessage(`${error.message}. Showing a clearly labeled demo surface instead.`);}finally{setLoading(false)}
  };
  useEffect(()=>{load('AAPL');},[]);
  const surface=useMemo(()=>buildSurface(payload,side),[payload,side]);const metrics=useMemo(()=>metricSummary(surface),[surface]);const updated=payload.updated?new Date(payload.updated).toLocaleString():'—';
  return <div className="volLabGrid">
    <aside className="volWorkspace panel"><div className="paneTitle">RESEARCH WORKSPACE <Search size={13}/></div><div className="treeItem active"><FileCode2 size={15}/>{symbol.toLowerCase()}_iv_surface.qnt</div><div className="treeItem"><Folder size={15}/> Volatility</div><div className="treeChild"><FileCode2 size={14}/> iv_surface.qnt</div><div className="treeChild"><FileCode2 size={14}/> skew_scan.qnt</div><div className="treeChild"><FileCode2 size={14}/> term_structure.qnt</div><div className="treeItem"><Database size={15}/> Snapshots</div><div className="terminalFacts"><span>Underlying</span><b>{symbol}</b><span>Spot</span><b>${Number(payload.underlyingPrice||0).toFixed(2)}</b><span>Source</span><b>{payload.demo?'DEMO':'DELAYED API'}</b><span>Updated</span><b>{updated}</b></div></aside>
    <section className="volEditor panel"><div className="editorTop"><span><Braces size={14}/>{symbol.toLowerCase()}_iv_surface.qnt</span><button onClick={()=>load(query)} disabled={loading}><Play size={13}/>{loading?'Running…':'Run'}</button></div><div className="volSymbolBar"><input value={query} onChange={e=>setQuery(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&load(query)} aria-label="Ticker symbol"/><button onClick={()=>load(query)} disabled={loading}><RefreshCw size={13}/> Refresh</button></div><pre className="code volCode"># IV surface research\nchain = options.chain("{symbol}")\nsurface = iv.surface(chain, axes=["moneyness", "dte", "iv"])\nrender3d(surface)</pre><div className="volResearchNote"><div className="eyebrow">DATA MODE</div><p>{message}</p><small>Snapshots are cached so normal screen refreshes do not repeatedly consume the options-data allowance.</small></div><div className="editorFooter"><span>IV Surface Runtime</span><span>{payload.demo?'DEMO':'DELAYED'} • Ready</span></div></section>
    <section className="volResults panel"><div className="volResultsTop"><div><div className="eyebrow">VOLATILITY RESEARCH</div><h1>{symbol} implied volatility surface</h1></div><div className="volStatus"><span className={payload.demo?'statusDot demoDot':'statusDot'}/>{payload.demo?'DEMO':'DELAYED'}</div></div><div className="volControls">{['blend','call','put'].map(value=><button key={value} className={side===value?'active':''} onClick={()=>setSide(value)}>{value==='blend'?'Call + Put':`${value[0].toUpperCase()}${value.slice(1)}s`}</button>)}</div><div className="volMetrics"><div><span>ATM IV</span><b>{(metrics.atm*100).toFixed(1)}%</b></div><div><span>PUT/CALL SKEW</span><b className={metrics.skew>=0?'violet':''}>{(metrics.skew*100).toFixed(1)} vol</b></div><div><span>TERM SLOPE</span><b>{metrics.term>=0?'+':''}{(metrics.term*100).toFixed(1)} vol</b></div><div><span>SURFACE RANGE</span><b>{(metrics.min*100).toFixed(0)}–{(metrics.max*100).toFixed(0)}%</b></div></div><div className="surfaceCard"><div className="surfaceCardHead"><span><Waves size={14}/> Interactive 3D IV surface</span><small>DTE × moneyness × implied volatility</small></div><InteractiveSurface3D surface={surface} moneynessLevels={MONEYNESS_LEVELS}/></div><div className="volInsight"><Activity size={17}/><div><b>QNT interpretation</b><p>{metrics.skew>.015?'Downside options carry a visible volatility premium.':'The displayed smile is relatively balanced.'} {metrics.term>.01?'Longer-dated volatility is richer than the front end.':metrics.term<-.01?'Front-end volatility is richer than longer-dated contracts.':'The term structure is fairly flat.'}</p></div></div><div className="askBox">Drag the surface to rotate it and use the wheel to zoom. <span>↗</span></div></section>
  </div>;
}