import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Play, Settings2 } from 'lucide-react';
import { personalModel } from './personalDataset';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const median=a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
const quantile=(a,p)=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor((s.length-1)*p))]};
const sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))};
const money=n=>`${n<0?'-':''}$${Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:0})}`;
const percent=n=>`${Number(n||0).toFixed(1)}%`;

const conservativeWins=personalModel.winR.map(r=>1.1*Math.log1p(Math.max(0,r)));
const rawWins=personalModel.winR;

function histogram(values,bins=22){
  if(!values.length)return [];
  const lo=Math.min(...values),hi=Math.max(...values),w=(hi-lo||1)/bins;
  const out=Array.from({length:bins},(_,i)=>({x:lo+(i+.5)*w,count:0}));
  values.forEach(v=>{const i=clamp(Math.floor((v-lo)/w),0,bins-1);out[i].count+=1});
  return out;
}

function simulate(cfg,rawMode=false){
  const wins=rawMode?rawWins:conservativeWins;
  const sims=[];const terminals=[];const maxDds=[];const timesToFloor=[];const timesToTarget=[];const cross=[];const losing=[];
  const showPaths=Math.min(220,cfg.simulations);
  let floorHits=0,targetHits=0,neither=0;
  for(let s=0;s<cfg.simulations;s++){
    let equity=cfg.start,peak=cfg.start,maxDd=0,status='neither',floorStep=null,targetStep=null,losses=0,maxLosses=0;
    const path=[{step:0,equity:cfg.start}];
    for(let step=1;step<=cfg.steps;step++){
      const u=Math.random();let r=0;
      if(u<personalModel.winProbability)r=wins[Math.floor(Math.random()*wins.length)];
      else if(u<personalModel.winProbability+personalModel.lossProbability)r=personalModel.lossR[Math.floor(Math.random()*personalModel.lossR.length)];
      equity+=r*cfg.risk;
      if(r<0){losses+=1;maxLosses=Math.max(maxLosses,losses)}else if(r>0){losses=0}
      peak=Math.max(peak,equity);maxDd=Math.max(maxDd,peak-equity);
      if(s<showPaths&&(step===1||step%2===0||step===cfg.steps))path.push({step,equity});
      if(step===cfg.crossStep)cross.push((equity-cfg.start)/cfg.start*100);
      if(equity<=cfg.floor){status='floor';floorStep=step;break}
      if(equity>=cfg.target){status='target';targetStep=step;break}
    }
    if(status==='floor'){floorHits+=1;timesToFloor.push(floorStep)}
    else if(status==='target'){targetHits+=1;timesToTarget.push(targetStep)}
    else neither+=1;
    terminals.push(equity);maxDds.push(maxDd);losing.push(maxLosses);if(s<showPaths)sims.push(path);
  }
  const pnl=terminals.map(v=>v-cfg.start);const terminalReturns=pnl.map(v=>v/cfg.start*100);
  return {
    sims,terminals,pnl,maxDds,cross,timesToFloor,timesToTarget,losing,
    floorPct:floorHits/cfg.simulations*100,targetPct:targetHits/cfg.simulations*100,neitherPct:neither/cfg.simulations*100,
    meanPnl:mean(pnl),medianPnl:median(pnl),p5Pnl:quantile(pnl,.05),p95Pnl:quantile(pnl,.95),
    medianReturn:median(terminalReturns),mcSharpe:sd(terminalReturns)?mean(terminalReturns)/sd(terminalReturns):0,
    p95Dd:quantile(maxDds,.95),medianDd:median(maxDds),p95Losing:quantile(losing,.95),
  };
}

function Metric({label,value,sub,tone=''}){return <div className="qmcMetric"><span>{label}</span><b className={tone}>{value}</b>{sub&&<small>{sub}</small>}</div>}

function MiniHistogram({values,tone='violet'}){
  const data=histogram(values,16);
  const fill=tone==='bad'?'#d85b6b':tone==='green'?'#2bc99b':'#8067db';
  return <ResponsiveContainer width="100%" height={110}><BarChart data={data} margin={{top:4,right:0,left:0,bottom:0}}><XAxis dataKey="x" stroke="#4d535a" tick={{fontSize:8}} tickFormatter={v=>Math.round(v)}/><YAxis hide/><Bar dataKey="count" fill={fill}/></BarChart></ResponsiveContainer>;
}

function PathChart({result,cfg}){
  const data=useMemo(()=>{const rows={};result.sims.forEach((p,pi)=>p.forEach(pt=>{rows[pt.step]??={step:pt.step};rows[pt.step][`p${pi}`]=pt.equity}));return Object.values(rows).sort((a,b)=>a.step-b.step)},[result]);
  const palette=['#8a72ef','#4d8de8','#2fc59a','#d1a347','#d86172'];
  return <ResponsiveContainer width="100%" height={350}><LineChart data={data} margin={{top:6,right:10,left:4,bottom:0}}><CartesianGrid stroke="#171a1e" vertical={false}/><XAxis dataKey="step" stroke="#4d535a" tick={{fontSize:8}}/><YAxis stroke="#4d535a" tick={{fontSize:8}} tickFormatter={v=>`$${Math.round(v/1000)}k`}/><ReferenceLine y={cfg.start} stroke="#373b41"/><Tooltip contentStyle={{background:'#080a0c',border:'1px solid #292d33',fontSize:9}} formatter={v=>money(v)}/>{Array.from({length:Math.min(220,result.sims.length)},(_,i)=><Line key={i} dataKey={`p${i}`} dot={false} isAnimationActive={false} stroke={palette[i%palette.length]} strokeWidth={.55} opacity={.24}/>)}</LineChart></ResponsiveContainer>;
}

function Settings({cfg,set,rawMode,setRawMode}){
  return <div className="qmcSettings"><label>Simulations<input value={cfg.simulations} onChange={e=>set('simulations',e.target.value)}/></label><label>Horizon<input value={cfg.steps} onChange={e=>set('steps',e.target.value)}/></label><label>Start<input value={cfg.start} onChange={e=>set('start',e.target.value)}/></label><label>Risk / trade<input value={cfg.risk} onChange={e=>set('risk',e.target.value)}/></label><label>Calibration<select value={rawMode?'raw':'conservative'} onChange={e=>setRawMode(e.target.value==='raw')}><option value="conservative">Conservative</option><option value="raw">Raw empirical</option></select></label></div>;
}

function CrossSection({cfg,set,result}){
  const data=histogram(result.cross,26);const med=median(result.cross),under=result.cross.length?result.cross.filter(x=>x<0).length/result.cross.length*100:0;
  return <div className="qmcCrossSection"><div className="qmcCrossHead"><span>Trading day <b>{cfg.crossStep}</b> / {cfg.steps}</span><span>Median {med>=0?'+':''}{med.toFixed(1)}%</span></div><input type="range" min="1" max={cfg.steps} value={cfg.crossStep} onChange={e=>set('crossStep',e.target.value)}/><div className="qmcCrossStats"><b>Median {med>=0?'+':''}{med.toFixed(1)}%</b><span>p5–p95 {quantile(result.cross,.05).toFixed(1)}% to {quantile(result.cross,.95).toFixed(1)}%</span><span>{under.toFixed(0)}% underwater</span></div><ResponsiveContainer width="100%" height={95}><BarChart data={data}><XAxis dataKey="x" stroke="#4d535a" tick={{fontSize:7}} tickFormatter={v=>`${v.toFixed(0)}%`}/><YAxis hide/><Bar dataKey="count" fill="#765fce"/></BarChart></ResponsiveContainer></div>;
}

function PropView({cfg,set,result,seed,setSeed,settings,setSettings,rawMode,setRawMode}){
  const [phase,setPhase]=useState('Challenge');
  const changePhase=(next)=>{
    setPhase(next);
    if(next==='Challenge'){set('start',50000);set('target',53000);set('floor',47500);set('steps',39);set('crossStep',1)}
    else{set('start',50000);set('target',52500);set('floor',48000);set('steps',20);set('crossStep',1)}
    setSeed(x=>x+1);
  };
  return <div className="qmcPage qmcPropPage">
    <div className="qmcPropHeader"><div><span>PROP FIRM</span><h1>50K challenge model</h1><p>Research simulation using your personal return model; rules are adjustable and not tied to a specific firm.</p></div><div className="qmcToolbarRight"><button onClick={()=>setSettings(v=>!v)}><Settings2 size={12}/> Settings</button><button className="qmcRun" onClick={()=>setSeed(seed+1)}><Play size={12}/> Run</button></div></div>
    <div className="qmcPhaseTabs"><button className={phase==='Challenge'?'active':''} onClick={()=>changePhase('Challenge')}>Challenge</button><button className={phase==='Funded'?'active':''} onClick={()=>changePhase('Funded')}>Funded</button></div>
    {settings&&<Settings cfg={cfg} set={set} rawMode={rawMode} setRawMode={setRawMode}/>} 
    <div className="qmcModelNote"><b>PERSONAL MODEL</b><span>39.3% win · 53.6% loss · 7.1% breakeven · tilt day excluded</span><em>{rawMode?'RAW PAYOFF TAIL':'CONSERVATIVE PAYOFF CALIBRATION'}</em></div>
    <div className="qmcPropMetrics"><Metric label="NET EV (MEAN)" value={money(result.meanPnl)} tone={result.meanPnl>=0?'good':'bad'}/><Metric label="TARGET PROBABILITY" value={percent(result.targetPct)} tone="good"/><Metric label="MEDIAN P&L" value={money(result.medianPnl)}/><Metric label="DAYS TO TARGET" value={result.timesToTarget.length?`${mean(result.timesToTarget).toFixed(1)} days`:'—'}/><Metric label="NET EV, 5TH PCT" value={money(result.p5Pnl)} tone="bad"/><Metric label="NET EV, 95TH PCT" value={money(result.p95Pnl)} tone="good"/></div>
    <section className="qmcChartBlock qmcPropChart"><div className="qmcChartHead"><div><b>{phase} equity paths</b><small>All paths ({cfg.simulations.toLocaleString()})</small></div><span>Median terminal {money(cfg.start+result.medianPnl)}</span></div><PathChart result={result} cfg={cfg}/><CrossSection cfg={cfg} set={set} result={result}/></section>
  </div>;
}

export default function MonteCarloResearch({propMode=false}){
  const [cfg,setCfg]=useState(propMode?{simulations:4000,steps:39,start:50000,risk:150,target:53000,floor:47500,crossStep:1}:{simulations:4000,steps:109,start:100000,risk:500,target:116165,floor:95000,crossStep:44});
  const [seed,setSeed]=useState(0);const [settings,setSettings]=useState(false);const [rawMode,setRawMode]=useState(false);const [section,setSection]=useState('Simulation');
  const set=(k,v)=>setCfg(c=>({...c,[k]:Number(v)}));
  const result=useMemo(()=>simulate(cfg,rawMode),[cfg,seed,rawMode]);
  if(propMode)return <PropView cfg={cfg} set={set} result={result} seed={seed} setSeed={setSeed} settings={settings} setSettings={setSettings} rawMode={rawMode} setRawMode={setRawMode}/>;
  const terminalData=histogram(result.pnl,28);const ddData=histogram(result.maxDds,24);
  return <div className="qmcPage">
    <div className="qmcToolbar"><div className="qmcSectionTabs">{['Simulation','Outcome distributions','Tail risk'].map(t=><button key={t} className={section===t?'active':''} onClick={()=>setSection(t)}>{t}</button>)}</div><div className="qmcToolbarRight"><button onClick={()=>setSettings(v=>!v)}><Settings2 size={12}/> Simulation settings</button><button className="qmcRun" onClick={()=>setSeed(x=>x+1)}><Play size={12}/> Run</button></div></div>
    {settings&&<Settings cfg={cfg} set={set} rawMode={rawMode} setRawMode={setRawMode}/>} 
    <div className="qmcModelNote"><b>PERSONAL MODEL</b><span>39.3% win · 53.6% loss · 7.1% breakeven · 11 eval + 28 vetted practice winners · eval losses only</span><em>{rawMode?'RAW PAYOFF TAIL':'CONSERVATIVE CALIBRATION'}</em></div>
    <div className="qmcMetrics"><Metric label="P(RUIN)" value={percent(result.floorPct)} sub={`Floor ${money(cfg.floor)}`} tone="bad"/><Metric label="P(PROFIT TARGET)" value={percent(result.targetPct)} tone="good"/><Metric label="MEDIAN RETURN" value={percent(result.medianReturn)} tone={result.medianReturn>=0?'good':'bad'}/><Metric label="MC SHARPE" value={result.mcSharpe.toFixed(2)}/><Metric label="MEDIAN MAX DD" value={money(result.medianDd)} tone="warn"/><Metric label="95% LOSING STREAK" value={`${Math.round(result.p95Losing)} trades`} tone="bad"/></div>
    {section==='Simulation'&&<><section className="qmcChartBlock"><div className="qmcChartHead"><div><b>Monte Carlo equity paths</b><small>{cfg.simulations.toLocaleString()} paths · {cfg.steps}-trade horizon</small></div><span>Median {money(cfg.start+result.medianPnl)}</span></div><PathChart result={result} cfg={cfg}/><CrossSection cfg={cfg} set={set} result={result}/></section><section className="qmcSolver"><div className="qmcSolverHead"><b>Boundary & goal solver</b><button onClick={()=>setSeed(x=>x+1)}><Play size={11}/> Run solver</button></div><div className="qmcBoundaryInputs"><div><span className="ruinDot"/> RUIN FLOOR<label><input value={cfg.floor} onChange={e=>set('floor',e.target.value)}/><small>{percent((cfg.floor-cfg.start)/cfg.start*100)}</small></label><div className="chips">{[-1000,-2000,-3000,-5000].map(v=><button key={v} onClick={()=>set('floor',cfg.start+v)}>{v}</button>)}</div></div><div><span className="targetDot"/> PROFIT TARGET<label><input value={cfg.target} onChange={e=>set('target',e.target.value)}/><small>+{percent((cfg.target-cfg.start)/cfg.start*100)}</small></label><div className="chips">{[2500,5000,10000,16165].map(v=><button key={v} onClick={()=>set('target',cfg.start+v)}>+{v}</button>)}</div></div></div><div className="qmcRaceTitle"><span>Race to the boundary</span><small>{cfg.simulations.toLocaleString()} paths</small></div><div className="qmcRace"><span style={{width:`${result.floorPct}%`}} className="ruinSeg">{Math.round(result.floorPct)}%</span><span style={{width:`${result.neitherPct}%`}} className="neutralSeg">{Math.round(result.neitherPct)}%</span><span style={{width:`${result.targetPct}%`}} className="targetSeg">{Math.round(result.targetPct)}%</span></div><div className="qmcRaceLegend"><span className="bad">● Hit ruin {percent(result.floorPct)}</span><span>● Neither {percent(result.neitherPct)}</span><span className="good">● Hit target {percent(result.targetPct)}</span></div><div className="qmcBoundaryCards"><article><div><span>RISK OF RUIN</span><b className="bad">{percent(result.floorPct)}</b><small>{money(cfg.floor)}</small></div><p>Paths that touch the loss floor first</p><div className="qmcTimes"><span>MEDIAN TIME<b>{result.timesToFloor.length?`${Math.round(median(result.timesToFloor))} trades`:'—'}</b></span><span>EXPECTED TIME<b>{result.timesToFloor.length?`${mean(result.timesToFloor).toFixed(1)} trades`:'—'}</b></span></div><MiniHistogram values={result.timesToFloor} tone="bad"/></article><article><div><span>REACHING TARGET</span><b className="good">{percent(result.targetPct)}</b><small>{money(cfg.target)}</small></div><p>Paths that touch the target first</p><div className="qmcTimes"><span>MEDIAN TIME<b>{result.timesToTarget.length?`${Math.round(median(result.timesToTarget))} trades`:'—'}</b></span><span>EXPECTED TIME<b>{result.timesToTarget.length?`${mean(result.timesToTarget).toFixed(1)} trades`:'—'}</b></span></div><MiniHistogram values={result.timesToTarget} tone="green"/></article></div></section></>}
    {section==='Outcome distributions'&&<section className="qmcAltGrid"><article><h3>Terminal P&L distribution</h3><ResponsiveContainer width="100%" height={260}><BarChart data={terminalData}><XAxis dataKey="x" stroke="#4d535a" tick={{fontSize:8}} tickFormatter={v=>money(v)}/><YAxis hide/><Bar dataKey="count" fill="#7861d0"/></BarChart></ResponsiveContainer></article><article><h3>Max drawdown distribution</h3><ResponsiveContainer width="100%" height={260}><BarChart data={ddData}><XAxis dataKey="x" stroke="#4d535a" tick={{fontSize:8}} tickFormatter={v=>money(v)}/><YAxis hide/><Bar dataKey="count" fill="#d85b6b"/></BarChart></ResponsiveContainer></article></section>}
    {section==='Tail risk'&&<section className="qmcTail"><Metric label="95% MAX DD" value={money(result.p95Dd)} tone="bad"/><Metric label="P(RUIN)" value={percent(result.floorPct)} tone="bad"/><Metric label="P5 TERMINAL P&L" value={money(result.p5Pnl)} tone="bad"/><p>The default calibration compresses the extreme winner tail because the export does not contain planned stop distance, so raw payoff ratios are not treated as true R-multiples.</p></section>}
  </div>;
}