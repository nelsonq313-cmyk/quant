import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Play, Settings2 } from 'lucide-react';
import { personalModel } from './personalDataset';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const median=a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
const quantileSorted=(s,p)=>s[Math.min(s.length-1,Math.max(0,Math.floor((s.length-1)*p)))]||0;
const quantile=(a,p)=>{if(!a.length)return 0;return quantileSorted([...a].sort((x,y)=>x-y),p)};
const sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))};
const money=n=>`${n<0?'-':''}$${Math.abs(Number(n)||0).toLocaleString(undefined,{maximumFractionDigits:0})}`;
const money1=n=>`${n<0?'-':''}$${(Math.abs(Number(n)||0)/1000).toFixed(1)}K`;
const percent=n=>`${Number(n||0).toFixed(1)}%`;

const conservativeWins=personalModel.winR.map(r=>1.1*Math.log1p(Math.max(0,r)));
const rawWins=personalModel.winR;

function rng(seed){
  let a=seed>>>0;
  return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296};
}

function histogram(values,bins=24){
  if(!values.length)return [];
  const lo=Math.min(...values),hi=Math.max(...values),w=(hi-lo||1)/bins;
  const out=Array.from({length:bins},(_,i)=>({x:lo+(i+.5)*w,count:0}));
  values.forEach(v=>{out[clamp(Math.floor((v-lo)/w),0,bins-1)].count+=1});
  return out;
}

function buildBands(paths,steps,start){
  const bands=[];
  for(let step=0;step<=steps;step++){
    const values=new Array(paths.length);
    let below=0;
    for(let i=0;i<paths.length;i++){
      const v=paths[i][step];values[i]=v;if(v<start)below+=1;
    }
    values.sort((a,b)=>a-b);
    bands.push({step,p05:quantileSorted(values,.05),p10:quantileSorted(values,.10),p25:quantileSorted(values,.25),p50:quantileSorted(values,.50),p75:quantileSorted(values,.75),p90:quantileSorted(values,.90),p95:quantileSorted(values,.95),belowPct:below/paths.length*100});
  }
  return bands;
}

function simulate(cfg,rawMode=false,seed=1){
  const wins=rawMode?rawWins:conservativeWins;
  const random=rng(7331+seed*7919);
  const paths=Array.from({length:cfg.simulations},()=>new Float32Array(cfg.steps+1));
  const terminals=new Array(cfg.simulations),maxDds=new Array(cfg.simulations),losing=new Array(cfg.simulations),timesToFloor=[],timesToTarget=[];
  let floorHits=0,targetHits=0,neither=0,profitCount=0;

  for(let s=0;s<cfg.simulations;s++){
    let equity=cfg.start,peak=cfg.start,maxDd=0,lossStreak=0,maxLossStreak=0,firstBoundary=null;
    paths[s][0]=equity;
    for(let step=1;step<=cfg.steps;step++){
      const u=random();let r=0;
      if(u<personalModel.winProbability)r=wins[Math.floor(random()*wins.length)]||0;
      else if(u<personalModel.winProbability+personalModel.lossProbability)r=personalModel.lossR[Math.floor(random()*personalModel.lossR.length)]||0;
      equity+=r*cfg.risk;
      paths[s][step]=equity;
      if(r<0){lossStreak+=1;maxLossStreak=Math.max(maxLossStreak,lossStreak)}else if(r>0){lossStreak=0}
      peak=Math.max(peak,equity);maxDd=Math.max(maxDd,peak-equity);
      if(!firstBoundary&&equity<=cfg.floor){firstBoundary='floor';floorHits+=1;timesToFloor.push(step)}
      else if(!firstBoundary&&equity>=cfg.target){firstBoundary='target';targetHits+=1;timesToTarget.push(step)}
    }
    if(!firstBoundary)neither+=1;
    terminals[s]=equity;maxDds[s]=maxDd;losing[s]=maxLossStreak;if(equity>cfg.start)profitCount+=1;
  }

  const pnl=terminals.map(v=>v-cfg.start),terminalReturns=pnl.map(v=>v/cfg.start*100);
  const downside=terminalReturns.filter(v=>v<0);const downsideDev=Math.sqrt(mean(downside.map(v=>v*v)));
  const bands=buildBands(paths,cfg.steps,cfg.start);
  const lossBudget=Math.max(1,cfg.start-cfg.floor);
  const p95Dd=quantile(maxDds,.95);
  const ruinPct=floorHits/cfg.simulations*100;
  const riskScore=clamp(Math.round(ruinPct*1.35+clamp(p95Dd/lossBudget,0,2)*22+clamp(quantile(losing,.95)/12,0,1)*18),0,100);

  return {
    paths,bands,terminals,pnl,terminalReturns,maxDds,losing,timesToFloor,timesToTarget,
    ruinPct,targetPct:targetHits/cfg.simulations*100,neitherPct:neither/cfg.simulations*100,profitPct:profitCount/cfg.simulations*100,
    meanPnl:mean(pnl),medianPnl:median(pnl),p5Pnl:quantile(pnl,.05),p95Pnl:quantile(pnl,.95),medianReturn:median(terminalReturns),
    mcSharpe:sd(terminalReturns)?mean(terminalReturns)/sd(terminalReturns):0,sortino:downsideDev?mean(terminalReturns)/downsideDev:0,
    p95Dd,medianDd:median(maxDds),p25Dd:quantile(maxDds,.25),p75Dd:quantile(maxDds,.75),p95Losing:quantile(losing,.95),riskScore,
  };
}

function Metric({label,value,sub,tone=''}){return <div className="qmcMetric"><span>{label}</span><b className={tone}>{value}</b>{sub&&<small>{sub}</small>}</div>}

function CanvasPaths({result,cfg,cursorStep,setCursorStep}){
  const ref=useRef(null);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    const w=rect.width,h=rect.height,pad={l:48,r:10,t:12,b:24};
    const band=result.bands;
    const lo=Math.min(cfg.floor,...band.map(x=>x.p05)),hi=Math.max(cfg.target,...band.map(x=>x.p95));
    const yPad=Math.max(600,(hi-lo)*.08),minY=lo-yPad,maxY=hi+yPad;
    const xOf=s=>pad.l+(s/cfg.steps)*(w-pad.l-pad.r);const yOf=v=>pad.t+(maxY-v)/(maxY-minY)*(h-pad.t-pad.b);
    ctx.fillStyle='#050607';ctx.fillRect(0,0,w,h);
    ctx.font='8px ui-monospace, monospace';ctx.textAlign='right';ctx.textBaseline='middle';
    for(let i=0;i<5;i++){
      const v=minY+(maxY-minY)*(i/4),y=yOf(v);ctx.strokeStyle='rgba(109,116,126,.16)';ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillStyle='#596069';ctx.fillText(money1(v),pad.l-7,y);
    }
    ctx.textAlign='center';ctx.textBaseline='top';
    for(let s=0;s<=cfg.steps;s+=Math.max(1,Math.round(cfg.steps/5))){const x=xOf(s);ctx.fillStyle='#555c64';ctx.fillText(String(s),x,h-pad.b+6)}
    const stride=Math.max(1,Math.floor(result.paths.length/650));
    const palette=['rgba(138,114,239,.22)','rgba(55,154,220,.17)','rgba(43,201,155,.15)','rgba(213,161,71,.13)','rgba(216,91,107,.12)'];
    for(let p=0,draw=0;p<result.paths.length;p+=stride,draw++){
      const path=result.paths[p];ctx.strokeStyle=palette[draw%palette.length];ctx.lineWidth=.55;ctx.beginPath();
      for(let s=0;s<=cfg.steps;s++){const x=xOf(s),y=yOf(path[s]);if(s===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();
    }
    ctx.strokeStyle='rgba(202,196,255,.82)';ctx.lineWidth=1.35;ctx.beginPath();band.forEach((b,i)=>{const x=xOf(b.step),y=yOf(b.p50);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke();
    ctx.strokeStyle='rgba(138,114,239,.32)';ctx.lineWidth=.9;for(const key of ['p10','p90']){ctx.beginPath();band.forEach((b,i)=>{const x=xOf(b.step),y=yOf(b[key]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke()}
    const cx=xOf(cursorStep);ctx.strokeStyle='rgba(236,238,241,.68)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx,pad.t);ctx.lineTo(cx,h-pad.b);ctx.stroke();
  },[result,cfg,cursorStep]);

  const move=e=>{const r=e.currentTarget.getBoundingClientRect();const x=clamp(e.clientX-r.left,48,r.width-10);setCursorStep(clamp(Math.round(((x-48)/(r.width-58))*cfg.steps),0,cfg.steps))};
  const b=result.bands[cursorStep]||result.bands.at(-1);
  return <div className="qmcCanvasWrap"><canvas ref={ref} className="qmcCanvas" onPointerMove={move}/><div className="qmcCursorBox"><span>DAY {cursorStep}</span><b>{money1(b.p50)}</b><small>p10 {money1(b.p10)} · p90 {money1(b.p90)}</small><small>{b.belowPct.toFixed(0)}% below start · {(100-b.belowPct).toFixed(0)}% above</small></div></div>;
}

function MiniHistogram({values,tone='violet'}){
  const data=histogram(values,16),fill=tone==='bad'?'#d85b6b':tone==='green'?'#2bc99b':'#8067db';
  return <ResponsiveContainer width="100%" height={96}><BarChart data={data}><XAxis dataKey="x" stroke="#4d535a" tick={{fontSize:7}} tickFormatter={v=>Math.round(v)}/><YAxis hide/><Bar dataKey="count" fill={fill}/></BarChart></ResponsiveContainer>;
}

function Settings({draft,setDraft,rawDraft,setRawDraft}){
  const set=(k,v)=>setDraft(c=>({...c,[k]:Number(v)}));
  return <div className="qmcSettings"><label>Simulations<input value={draft.simulations} onChange={e=>set('simulations',e.target.value)}/></label><label>Horizon<input value={draft.steps} onChange={e=>set('steps',e.target.value)}/></label><label>Start<input value={draft.start} onChange={e=>set('start',e.target.value)}/></label><label>Risk / trade<input value={draft.risk} onChange={e=>set('risk',e.target.value)}/></label><label>Calibration<select value={rawDraft?'raw':'conservative'} onChange={e=>setRawDraft(e.target.value==='raw')}><option value="conservative">Conservative</option><option value="raw">Raw empirical</option></select></label></div>;
}

function CrossSection({result,cfg,crossStep,setCrossStep}){
  const values=useMemo(()=>result.paths.map(p=>(p[crossStep]-cfg.start)/cfg.start*100),[result,cfg.start,crossStep]);
  const data=useMemo(()=>histogram(values,30),[values]);const med=median(values),under=values.length?values.filter(x=>x<0).length/values.length*100:0;
  return <div className="qmcCrossSection"><div className="qmcCrossHead"><span>Trading day <b>{crossStep}</b> / {cfg.steps}</span><span>Median {med>=0?'+':''}{med.toFixed(1)}%</span></div><input type="range" min="1" max={cfg.steps} value={crossStep} onChange={e=>setCrossStep(Number(e.target.value))}/><div className="qmcCrossStats"><b>Median {med>=0?'+':''}{med.toFixed(1)}%</b><span>p5–p95 {quantile(values,.05).toFixed(1)}% to {quantile(values,.95).toFixed(1)}%</span><span>{under.toFixed(0)}% underwater</span></div><ResponsiveContainer width="100%" height={78}><BarChart data={data}><XAxis dataKey="x" stroke="#4d535a" tick={{fontSize:7}} tickFormatter={v=>`${v.toFixed(0)}%`}/><YAxis hide/><Bar dataKey="count" fill="#765fce"/></BarChart></ResponsiveContainer></div>;
}

function PropView({active,draft,setDraft,result,run,settings,setSettings,rawDraft,setRawDraft,crossStep,setCrossStep,cursorStep,setCursorStep}){
  const [phase,setPhase]=useState('Challenge');
  const changePhase=next=>{const nextCfg=next==='Challenge'?{simulations:4000,steps:39,start:50000,risk:150,target:53000,floor:47500}:{simulations:4000,steps:20,start:50000,risk:150,target:52500,floor:48000};setPhase(next);setDraft(nextCfg);run(nextCfg,rawDraft);setCrossStep(1)};
  return <div className="qmcPage qmcPropPage"><div className="qmcPropHeader"><div><span>PROP FIRM</span><h1>50K challenge model</h1><p>Personal-model research simulation with editable rules.</p></div><div className="qmcToolbarRight"><button onClick={()=>setSettings(v=>!v)}><Settings2 size={12}/> Settings</button><button className="qmcRun" onClick={()=>run()}><Play size={12}/> Run</button></div></div><div className="qmcPhaseTabs"><button className={phase==='Challenge'?'active':''} onClick={()=>changePhase('Challenge')}>Challenge</button><button className={phase==='Funded'?'active':''} onClick={()=>changePhase('Funded')}>Funded</button></div>{settings&&<Settings draft={draft} setDraft={setDraft} rawDraft={rawDraft} setRawDraft={setRawDraft}/>}<div className="qmcModelNote"><b>PERSONAL MODEL</b><span>39.3% win · 53.6% loss · 7.1% breakeven · tilt day excluded</span><em>SIMULATION RUNS ON COMMAND</em></div><div className="qmcPropMetrics"><Metric label="NET EV (MEAN)" value={money(result.meanPnl)} tone={result.meanPnl>=0?'good':'bad'}/><Metric label="P(PROFIT)" value={percent(result.profitPct)} tone="good"/><Metric label="TARGET PROBABILITY" value={percent(result.targetPct)} tone="good"/><Metric label="MEDIAN P&L" value={money(result.medianPnl)}/><Metric label="MC SHARPE" value={result.mcSharpe.toFixed(2)}/><Metric label="MAX DD P95" value={money(result.p95Dd)} tone="warn"/></div><section className="qmcChartBlock"><div className="qmcChartHead"><div><b>{phase} equity paths</b><small>{active.simulations.toLocaleString()} simulations</small></div><span>Median terminal {money(active.start+result.medianPnl)}</span></div><CanvasPaths result={result} cfg={active} cursorStep={cursorStep} setCursorStep={setCursorStep}/><CrossSection result={result} cfg={active} crossStep={crossStep} setCrossStep={setCrossStep}/></section></div>;
}

export default function MonteCarloResearch({propMode=false}){
  const defaults=propMode?{simulations:4000,steps:39,start:50000,risk:150,target:53000,floor:47500}:{simulations:4000,steps:109,start:100000,risk:500,target:116165,floor:95000};
  const [active,setActive]=useState(defaults),[draft,setDraft]=useState(defaults),[rawMode,setRawMode]=useState(false),[rawDraft,setRawDraft]=useState(false),[seed,setSeed]=useState(1),[settings,setSettings]=useState(false),[section,setSection]=useState('Simulation'),[crossStep,setCrossStep]=useState(Math.min(44,defaults.steps)),[cursorStep,setCursorStep]=useState(defaults.steps);
  const result=useMemo(()=>simulate(active,rawMode,seed),[active,rawMode,seed]);
  const run=(override=null,overrideRaw=null)=>{const next=override||draft;setActive({...next});setRawMode(overrideRaw??rawDraft);setCrossStep(v=>clamp(v,1,next.steps));setCursorStep(next.steps);setSeed(s=>s+1)};
  if(propMode)return <PropView active={active} draft={draft} setDraft={setDraft} result={result} run={run} settings={settings} setSettings={setSettings} rawDraft={rawDraft} setRawDraft={setRawDraft} crossStep={crossStep} setCrossStep={setCrossStep} cursorStep={cursorStep} setCursorStep={setCursorStep}/>;
  const terminalData=histogram(result.pnl,28),ddData=histogram(result.maxDds,24);
  const setBoundary=(k,v)=>setDraft(c=>({...c,[k]:Number(v)}));
  return <div className="qmcPage"><div className="qmcToolbar"><div className="qmcSectionTabs">{['Simulation','Outcome distributions','Tail risk'].map(t=><button key={t} className={section===t?'active':''} onClick={()=>setSection(t)}>{t}</button>)}</div><div className="qmcToolbarRight"><button onClick={()=>setSettings(v=>!v)}><Settings2 size={12}/> Simulation settings</button><button className="qmcRun" onClick={()=>run()}><Play size={12}/> Run</button></div></div>{settings&&<Settings draft={draft} setDraft={setDraft} rawDraft={rawDraft} setRawDraft={setRawDraft}/>}<div className="qmcModelNote"><b>PERSONAL MODEL</b><span>39.3% win · 53.6% loss · 7.1% breakeven · eval probability model · vetted winner library</span><em>{rawMode?'RAW PAYOFF TAIL':'CONSERVATIVE CALIBRATION'}</em></div><div className="qmcMetrics qmcMetrics7"><Metric label="RISK SCORE" value={result.riskScore} sub="0 low · 100 extreme"/><Metric label="P(RUIN)" value={percent(result.ruinPct)} sub={`Floor ${money1(active.floor)}`} tone="bad"/><Metric label="P(PROFIT)" value={percent(result.profitPct)} sub="Terminal > start" tone="good"/><Metric label="MEDIAN RETURN" value={percent(result.medianReturn)} tone={result.medianReturn>=0?'good':'bad'}/><Metric label="MC SHARPE" value={result.mcSharpe.toFixed(2)} sub={`Sortino ${result.sortino.toFixed(2)}`}/><Metric label="MAX DRAWDOWN" value={money1(result.p95Dd)} tone="warn" sub={`${money1(result.p25Dd)} – ${money1(result.p75Dd)} IQR`}/><Metric label="95% LOSING STREAK" value={`${Math.round(result.p95Losing)} trades`} tone="bad"/></div>
  {section==='Simulation'&&<><section className="qmcChartBlock"><div className="qmcChartHead"><div><b>Monte Carlo Equity Paths</b><small>{active.simulations.toLocaleString()} simulations · {active.steps} trades</small></div><span>Day {cursorStep} / {active.steps} · Median {money1(result.bands[cursorStep]?.p50||0)}</span></div><CanvasPaths result={result} cfg={active} cursorStep={cursorStep} setCursorStep={setCursorStep}/><CrossSection result={result} cfg={active} crossStep={crossStep} setCrossStep={setCrossStep}/></section><section className="qmcSolver"><div className="qmcSolverHead"><b>Boundary & goal solver</b><button onClick={()=>run()}><Play size={11}/> Run solver</button></div><div className="qmcBoundaryInputs"><div><span className="ruinDot"/> RUIN FLOOR<label><input value={draft.floor} onChange={e=>setBoundary('floor',e.target.value)}/><small>{percent((draft.floor-draft.start)/draft.start*100)}</small></label><div className="chips">{[-1000,-2000,-3000,-5000].map(v=><button key={v} onClick={()=>setBoundary('floor',draft.start+v)}>{v}</button>)}</div></div><div><span className="targetDot"/> PROFIT TARGET<label><input value={draft.target} onChange={e=>setBoundary('target',e.target.value)}/><small>+{percent((draft.target-draft.start)/draft.start*100)}</small></label><div className="chips">{[2500,5000,10000,16165].map(v=><button key={v} onClick={()=>setBoundary('target',draft.start+v)}>+{v}</button>)}</div></div></div><div className="qmcRaceTitle"><span>Race to the boundary</span><small>{active.simulations.toLocaleString()} paths · first hit only</small></div><div className="qmcRace"><span style={{width:`${result.ruinPct}%`}} className="ruinSeg">{Math.round(result.ruinPct)}%</span><span style={{width:`${result.neitherPct}%`}} className="neutralSeg">{Math.round(result.neitherPct)}%</span><span style={{width:`${result.targetPct}%`}} className="targetSeg">{Math.round(result.targetPct)}%</span></div><div className="qmcRaceLegend"><span className="bad">● Hit ruin {percent(result.ruinPct)}</span><span>● Neither {percent(result.neitherPct)}</span><span className="good">● Hit target {percent(result.targetPct)}</span></div><div className="qmcBoundaryCards"><article><div><span>RISK OF RUIN</span><b className="bad">{percent(result.ruinPct)}</b><small>{money(active.floor)}</small></div><p>First boundary touched was the loss floor.</p><div className="qmcTimes"><span>MEDIAN TIME<b>{result.timesToFloor.length?`${Math.round(median(result.timesToFloor))} trades`:'—'}</b></span><span>EXPECTED TIME<b>{result.timesToFloor.length?`${mean(result.timesToFloor).toFixed(1)} trades`:'—'}</b></span></div><MiniHistogram values={result.timesToFloor} tone="bad"/></article><article><div><span>REACHING TARGET</span><b className="good">{percent(result.targetPct)}</b><small>{money(active.target)}</small></div><p>First boundary touched was the profit target.</p><div className="qmcTimes"><span>MEDIAN TIME<b>{result.timesToTarget.length?`${Math.round(median(result.timesToTarget))} trades`:'—'}</b></span><span>EXPECTED TIME<b>{result.timesToTarget.length?`${mean(result.timesToTarget).toFixed(1)} trades`:'—'}</b></span></div><MiniHistogram values={result.timesToTarget} tone="green"/></article></div></section></>}
  {section==='Outcome distributions'&&<section className="qmcAltGrid"><article><h3>Terminal P&L distribution</h3><ResponsiveContainer width="100%" height={250}><BarChart data={terminalData}><XAxis dataKey="x" stroke="#4d535a" tick={{fontSize:8}} tickFormatter={v=>money1(v)}/><YAxis hide/><Bar dataKey="count" fill="#7861d0"/></BarChart></ResponsiveContainer></article><article><h3>Max drawdown distribution</h3><ResponsiveContainer width="100%" height={250}><BarChart data={ddData}><XAxis dataKey="x" stroke="#4d535a" tick={{fontSize:8}} tickFormatter={v=>money1(v)}/><YAxis hide/><Bar dataKey="count" fill="#d85b6b"/></BarChart></ResponsiveContainer></article></section>}
  {section==='Tail risk'&&<section className="qmcTail"><Metric label="95% MAX DD" value={money(result.p95Dd)} tone="bad"/><Metric label="P(RUIN)" value={percent(result.ruinPct)} tone="bad"/><Metric label="P5 TERMINAL P&L" value={money(result.p5Pnl)} tone="bad"/><p>Boundary hits are recorded separately while every path continues through the full horizon, so later cross-sections and terminal statistics still include the complete simulation population.</p></section>}</div>;
}