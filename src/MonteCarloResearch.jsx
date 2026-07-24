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
import { Play, RotateCcw, Settings2 } from 'lucide-react';
import { personalModel } from './personalDataset';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const median=a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
const pct=(a,p)=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor((s.length-1)*p))]};
const sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))};
const money=n=>`${n<0?'-':''}$${Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:0})}`;
const percent=n=>`${n.toFixed(1)}%`;

// The raw trade export does not contain each trade's planned stop distance, so raw
// P&L divided by a median loss is NOT true R. Default calibration compresses the
// extreme positive tail while leaving the eval loss library untouched.
const calibratedWins=personalModel.winR.map(r=>1.1*Math.log1p(Math.max(0,r)));
const rawWins=personalModel.winR;

function histogram(values,bins=20){
  if(!values.length)return [];
  const lo=Math.min(...values), hi=Math.max(...values), w=(hi-lo||1)/bins;
  const out=Array.from({length:bins},(_,i)=>({x:lo+(i+.5)*w,count:0}));
  values.forEach(v=>{const i=clamp(Math.floor((v-lo)/w),0,bins-1);out[i].count+=1});
  return out;
}

function simulate(cfg,rawMode=false){
  const wins=rawMode?rawWins:calibratedWins;
  const sims=[]; const terminals=[]; const maxDds=[]; const timesToRuin=[]; const timesToTarget=[];
  const cross=[]; const showPaths=Math.min(180,cfg.simulations);
  let ruined=0,passed=0,neither=0;
  for(let s=0;s<cfg.simulations;s++){
    let equity=cfg.start,peak=cfg.start,maxDd=0,status='neither',ruinStep=null,targetStep=null;
    const path=[{step:0,equity:cfg.start}];
    for(let step=1;step<=cfg.steps;step++){
      const u=Math.random(); let r=0;
      if(u<personalModel.winProbability) r=wins[Math.floor(Math.random()*wins.length)];
      else if(u<personalModel.winProbability+personalModel.lossProbability) r=personalModel.lossR[Math.floor(Math.random()*personalModel.lossR.length)];
      equity+=r*cfg.risk;
      peak=Math.max(peak,equity); maxDd=Math.max(maxDd,peak-equity);
      if(s<showPaths && (step===1 || step%2===0 || step===cfg.steps)) path.push({step,equity});
      if(step===cfg.crossStep) cross.push((equity-cfg.start)/cfg.start*100);
      if(equity<=cfg.floor){status='ruin';ruinStep=step;break}
      if(equity>=cfg.target){status='target';targetStep=step;break}
    }
    if(status==='ruin'){ruined++;timesToRuin.push(ruinStep)}
    else if(status==='target'){passed++;timesToTarget.push(targetStep)}
    else neither++;
    terminals.push(equity);maxDds.push(maxDd);if(s<showPaths)sims.push(path);
  }
  const terminalReturns=terminals.map(v=>(v-cfg.start)/cfg.start*100);
  const mcSharpe=sd(terminalReturns)?mean(terminalReturns)/sd(terminalReturns):0;
  return {sims,terminals,maxDds,cross,timesToRuin,timesToTarget,ruined,passed,neither,
    ruinPct:ruined/cfg.simulations*100,passPct:passed/cfg.simulations*100,neitherPct:neither/cfg.simulations*100,
    medReturn:median(terminalReturns),mcSharpe,medTerminal:median(terminals),maxDd:pct(maxDds,.95),
  };
}

function Metric({label,value,sub,tone}){
  return <div className="qmcMetric"><span>{label}</span><b className={tone||''}>{value}</b>{sub&&<small>{sub}</small>}</div>
}

function MiniHistogram({values,tone='target'}){
  const data=histogram(values,12);
  return <ResponsiveContainer width="100%" height={115}><BarChart data={data} margin={{top:6,right:2,bottom:0,left:0}}>
    <XAxis dataKey="x" tick={{fontSize:8}} stroke="#50555c" tickFormatter={v=>Math.round(v)}/><YAxis hide/>
    <Bar dataKey="count" fill={tone==='ruin'?'#d85a6a':'#28c99a'} radius={[1,1,0,0]}/>
  </BarChart></ResponsiveContainer>
}

export default function MonteCarloResearch({propMode=false}){
  const [cfg,setCfg]=useState({simulations:4000,steps:109,start:100000,risk:500,target:116165,floor:95000,crossStep:44});
  const [seed,setSeed]=useState(0); const [settings,setSettings]=useState(false); const [rawMode,setRawMode]=useState(false);
  const [section,setSection]=useState('Simulation');
  const result=useMemo(()=>simulate(cfg,rawMode),[cfg,seed,rawMode]);
  const set=(k,v)=>setCfg(c=>({...c,[k]:Number(v)}));
  const pathData=useMemo(()=>{const rows={};result.sims.forEach((p,pi)=>p.forEach(pt=>{rows[pt.step]??={step:pt.step};rows[pt.step][`p${pi}`]=pt.equity}));return Object.values(rows).sort((a,b)=>a.step-b.step)},[result]);
  const crossData=useMemo(()=>histogram(result.cross,26),[result]);
  const riskScore=Math.round(clamp(result.ruinPct*2+result.maxDd/cfg.start*100,0,100));
  const ruinMed=median(result.timesToRuin),targetMed=median(result.timesToTarget);
  const ruinMean=mean(result.timesToRuin),targetMean=mean(result.timesToTarget);
  const palette=['#1ec4dc','#23c88e','#3f77df','#d5b52d','#d86168'];

  return <div className="qmcPage">
    <div className="qmcToolbar">
      <div className="qmcSectionTabs">{['Simulation','Outcome distributions','Tail risk'].map(t=><button key={t} className={section===t?'active':''} onClick={()=>setSection(t)}>{t}</button>)}</div>
      <div className="qmcToolbarRight"><button onClick={()=>setSettings(v=>!v)}><Settings2 size={12}/> Simulation settings⌄</button><button className="qmcRun" onClick={()=>setSeed(x=>x+1)}><Play size={12}/> Run</button></div>
    </div>

    {settings&&<div className="qmcSettings">
      <label>Simulations<input value={cfg.simulations} onChange={e=>set('simulations',e.target.value)}/></label>
      <label>Horizon<input value={cfg.steps} onChange={e=>set('steps',e.target.value)}/></label>
      <label>Start<input value={cfg.start} onChange={e=>set('start',e.target.value)}/></label>
      <label>Risk / trade<input value={cfg.risk} onChange={e=>set('risk',e.target.value)}/></label>
      <label>Calibration<select value={rawMode?'raw':'conservative'} onChange={e=>setRawMode(e.target.value==='raw')}><option value="conservative">Conservative tail-shrink</option><option value="raw">Raw empirical</option></select></label>
    </div>}

    <div className="qmcModelNote"><b>PERSONAL MODEL</b><span>39.3% win · 53.6% loss · 7.1% breakeven · eval losses only · 11 eval + 28 vetted practice winners · tilt day excluded</span><em>{rawMode?'RAW PAYOFF TAIL':'CONSERVATIVE CALIBRATION'}</em></div>

    <div className="qmcMetrics">
      <Metric label="RISK SCORE" value={riskScore} sub={`0 low · 100 extreme`} />
      <Metric label="P(RUIN)" value={percent(result.ruinPct)} sub={`Floor ${money(cfg.floor)}`} tone="bad"/>
      <Metric label="P(PROFIT)" value={percent(result.passPct)} sub="Terminal / first" tone="good"/>
      <Metric label="MEDIAN RETURN" value={percent(result.medReturn)} tone="good"/>
      <Metric label="MC SHARPE" value={result.mcSharpe.toFixed(2)} sub={`Sample-aware`} />
      <Metric label="MAX DRAWDOWN" value={money(result.maxDd)} sub={`${percent(result.maxDd/cfg.start*100)} · 95th`} tone="warn"/>
    </div>

    {section==='Simulation'&&<>
      <section className="qmcChartBlock">
        <div className="qmcChartHead"><b>Monte Carlo Equity Paths</b><span>Day <strong>{cfg.crossStep}</strong> / {cfg.steps} · Median {money(result.medTerminal)}</span></div>
        <ResponsiveContainer width="100%" height={360}><LineChart data={pathData} margin={{top:8,right:12,bottom:0,left:6}}>
          <CartesianGrid stroke="#16191d" vertical={false}/><XAxis dataKey="step" stroke="#4f545b" tick={{fontSize:9}}/><YAxis stroke="#4f545b" tick={{fontSize:9}} tickFormatter={v=>`$${Math.round(v/1000)}k`}/>
          <ReferenceLine y={cfg.start} stroke="#30343a"/><Tooltip contentStyle={{background:'#08090a',border:'1px solid #30343a',fontSize:10}} formatter={v=>money(v)}/>
          {Array.from({length:Math.min(180,result.sims.length)},(_,i)=><Line key={i} dataKey={`p${i}`} dot={false} isAnimationActive={false} stroke={palette[i%palette.length]} strokeWidth={.55} opacity={.32}/>) }
        </LineChart></ResponsiveContainer>
        <div className="qmcCrossControl"><span>Cross-section at day {cfg.crossStep}/{cfg.steps}</span><input type="range" min="1" max={cfg.steps} value={cfg.crossStep} onChange={e=>set('crossStep',e.target.value)}/></div>
        <div className="qmcCrossStats"><b>MEDIAN <i className={median(result.cross)>=0?'good':'bad'}>{median(result.cross)>=0?'+':''}{median(result.cross).toFixed(1)}%</i></b><span>P5 {pct(result.cross,.05).toFixed(1)}% → {pct(result.cross,.95).toFixed(1)}%</span><span>{result.cross.filter(x=>x<0).length/result.cross.length*100||0.toFixed?.(0)}% underwater</span></div>
        <ResponsiveContainer width="100%" height={115}><BarChart data={crossData}><XAxis dataKey="x" stroke="#4c5158" tick={{fontSize:8}} tickFormatter={v=>`${v.toFixed(0)}%`}/><YAxis hide/><Bar dataKey="count" fill="#4659c8"/></BarChart></ResponsiveContainer>
      </section>

      <section className="qmcSolver">
        <div className="qmcSolverHead"><b>Boundary & goal solver ⓘ</b><button onClick={()=>setSeed(x=>x+1)}><Play size={11}/> Run solver</button></div>
        <div className="qmcBoundaryInputs">
          <div><span className="ruinDot"/> RUIN FLOOR<label><input value={cfg.floor} onChange={e=>set('floor',e.target.value)}/><small>{percent((cfg.floor-cfg.start)/cfg.start*100)}</small></label><div className="chips">{[-1000,-2000,-3000,-5000].map(v=><button key={v} onClick={()=>set('floor',cfg.start+v)}>{v}</button>)}</div></div>
          <div><span className="targetDot"/> PROFIT TARGET<label><input value={cfg.target} onChange={e=>set('target',e.target.value)}/><small>+{percent((cfg.target-cfg.start)/cfg.start*100)}</small></label><div className="chips">{[2500,5000,10000,16165].map(v=><button key={v} onClick={()=>set('target',cfg.start+v)}>+{v}</button>)}</div></div>
        </div>
        <div className="qmcRaceTitle"><span>Race to the boundary</span><small>{cfg.simulations.toLocaleString()} paths · {cfg.steps}-step horizon</small></div>
        <div className="qmcRace"><span style={{width:`${result.ruinPct}%`}} className="ruinSeg">{Math.round(result.ruinPct)}%</span><span style={{width:`${result.neitherPct}%`}} className="neutralSeg">{Math.round(result.neitherPct)}%</span><span style={{width:`${result.passPct}%`}} className="targetSeg">{Math.round(result.passPct)}%</span></div>
        <div className="qmcRaceLegend"><span className="bad">● Hit ruin {percent(result.ruinPct)}</span><span>● Neither {percent(result.neitherPct)}</span><span className="good">● Hit target {percent(result.passPct)}</span></div>
        <div className="qmcBoundaryCards">
          <article><div><span>RISK OF RUIN</span><b className="bad">{percent(result.ruinPct)}</b><small>{money(cfg.floor)} · {percent((cfg.floor-cfg.start)/cfg.start*100)}</small></div><p>Paths that hit the floor first</p><div className="qmcTimes"><span>MEDIAN TIME<b>{ruinMed?`${Math.round(ruinMed)} steps`:'—'}</b></span><span>EXPECTED TIME<b>{ruinMean?`${Math.round(ruinMean)} steps`:'—'}</b></span></div><MiniHistogram values={result.timesToRuin} tone="ruin"/></article>
          <article><div><span>REACHING TARGET</span><b className="good">{percent(result.passPct)}</b><small>{money(cfg.target)} · +{percent((cfg.target-cfg.start)/cfg.start*100)}</small></div><p>Paths that hit the goal first</p><div className="qmcTimes"><span>MEDIAN TIME<b>{targetMed?`${Math.round(targetMed)} steps`:'—'}</b></span><span>EXPECTED TIME<b>{targetMean?`${Math.round(targetMean)} steps`:'—'}</b></span></div><MiniHistogram values={result.timesToTarget}/></article>
        </div>
      </section>
    </>}

    {section==='Outcome distributions'&&<section className="qmcAltGrid"><article><h3>Terminal return distribution</h3><MiniHistogram values={result.terminals.map(v=>(v-cfg.start)/cfg.start*100)}/></article><article><h3>Drawdown distribution</h3><MiniHistogram values={result.maxDds} tone="ruin"/></article></section>}
    {section==='Tail risk'&&<section className="qmcTail"><Metric label="95% MAX DD" value={money(result.maxDd)} tone="bad"/><Metric label="P(RUIN)" value={percent(result.ruinPct)} tone="bad"/><Metric label="P5 CROSS-SECTION" value={`${pct(result.cross,.05).toFixed(1)}%`} tone="bad"/><p>Default calibration shrinks the extreme winner tail because the export does not contain planned stop distance, so the raw payoff ratios are not true R-multiples.</p></section>}
  </div>
}
