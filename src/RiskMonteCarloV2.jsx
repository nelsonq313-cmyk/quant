import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Play, RefreshCw, Settings2, X } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { personalModel } from './personalDataset';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const median=a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
const quantileSorted=(s,p)=>s[Math.min(s.length-1,Math.max(0,Math.floor((s.length-1)*p))]||0;
const quantile=(a,p)=>a.length?quantileSorted([...a].sort((x,y)=>x-y),p):0;
const money=n=>`${n<0?'-':''}$${Math.abs(Number(n)||0).toLocaleString(undefined,{maximumFractionDigits:0})}`;
const money1=n=>`${n<0?'-':''}$${(Math.abs(Number(n)||0)/1000).toFixed(1)}K`;
const percent=n=>`${Number(n||0).toFixed(1)}%`;
const rangePct=a=>a?.length===2?`${a[0].toFixed(1)}–${a[1].toFixed(1)}%`:'—';

const conservativeWins=personalModel.winR.map(r=>1.1*Math.log1p(Math.max(0,r)));
const rawWins=personalModel.winR;

function rng(seed){
  let a=seed>>>0;
  return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296};
}

function normal01(random){
  const u1=Math.max(1e-12,random()),u2=Math.max(1e-12,random());
  return Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
}

function gammaSample(random,shape){
  if(shape<=0)return 0;
  if(shape<1)return gammaSample(random,shape+1)*Math.pow(Math.max(random(),1e-12),1/shape);
  const d=shape-1/3,c=1/Math.sqrt(9*d);
  for(let i=0;i<64;i++){
    const x=normal01(random),v0=1+c*x;
    if(v0<=0)continue;
    const v=v0*v0*v0,u=random();
    if(u<1-.0331*x*x*x*x)return d*v;
    if(Math.log(Math.max(u,1e-12))<.5*x*x+d*(1-v+Math.log(v)))return d*v;
  }
  return shape;
}

function sampleProbabilities(random){
  const aW=personalModel.evalWins+.5,aL=personalModel.evalLosses+.5,aB=personalModel.evalBreakevens+.5;
  const w=gammaSample(random,aW),l=gammaSample(random,aL),b=gammaSample(random,aB),sum=w+l+b||1;
  return {win:w/sum,loss:l/sum,breakeven:b/sum};
}

function drawR(random,wins,probs){
  const u=random();
  if(u<probs.win)return wins[Math.floor(random()*wins.length)]||0;
  if(u<probs.win+probs.loss)return personalModel.lossR[Math.floor(random()*personalModel.lossR.length)]||0;
  return 0;
}

function histogram(values,bins=26){
  if(!values.length)return [];
  const lo=Math.min(...values),hi=Math.max(...values),width=(hi-lo||1)/bins;
  const out=Array.from({length:bins},(_,i)=>({x:lo+(i+.5)*width,count:0}));
  for(const value of values)out[clamp(Math.floor((value-lo)/width),0,bins-1)].count+=1;
  return out;
}

function buildBands(paths,steps,start){
  const bands=[];
  for(let step=0;step<=steps;step++){
    const values=new Array(paths.length);let below=0;
    for(let i=0;i<paths.length;i++){
      const value=paths[i][step];values[i]=value;if(value<start)below+=1;
    }
    values.sort((a,b)=>a-b);
    bands.push({
      step,
      p05:quantileSorted(values,.05),p10:quantileSorted(values,.10),p25:quantileSorted(values,.25),
      p50:quantileSorted(values,.50),p75:quantileSorted(values,.75),p90:quantileSorted(values,.90),p95:quantileSorted(values,.95),
      belowPct:below/paths.length*100,
    });
  }
  return bands;
}

function tradeRatios(moment){
  const n=moment.n||1,avg=moment.sum/n,variance=Math.max(0,moment.sumSq/n-avg*avg),stdev=Math.sqrt(variance),downside=Math.sqrt(moment.downsideSq/n);
  return {tradeSharpe:stdev?avg/stdev:0,sortino:downside?avg/downside:null};
}

function validateConfig(cfg){
  const errors=[],warnings=[];
  if(!(cfg.start>0))errors.push('Starting balance must be above $0.');
  if(!(cfg.risk>0))errors.push('Risk per trade must be above $0.');
  if(!(cfg.floor<cfg.start))errors.push('Ruin floor must be below the starting balance.');
  if(!(cfg.target>cfg.start))errors.push('Profit target must be above the starting balance.');
  const riskPct=cfg.start>0?cfg.risk/cfg.start*100:0;
  const budget=Math.max(0,cfg.start-cfg.floor),budgetPct=budget?cfg.risk/budget*100:0;
  if(riskPct>=10)warnings.push(`Risk / trade is ${riskPct.toFixed(1)}% of starting equity. Outcomes can become extremely wide.`);
  else if(riskPct>=5)warnings.push(`Risk / trade is ${riskPct.toFixed(1)}% of starting equity, which materially amplifies drawdowns and dispersion.`);
  if(budgetPct>=25)warnings.push(`One modeled 1R is ${budgetPct.toFixed(0)}% of the distance to the ruin floor.`);
  if(cfg.steps>300)warnings.push('Long horizons magnify model error. Read terminal returns as stress-test output, not a forecast.');
  return {errors,warnings};
}

function simulate(cfg,rawMode,seed){
  const wins=rawMode?rawWins:conservativeWins,random=rng(seed),blockSize=50;
  const paths=Array.from({length:cfg.simulations},()=>new Float32Array(cfg.steps+1));
  const tradeRs=Array.from({length:cfg.simulations},()=>new Float32Array(cfg.steps+1));
  const meta=new Array(cfg.simulations),terminals=new Array(cfg.simulations),maxDds=new Array(cfg.simulations),losing=new Array(cfg.simulations),underwater=new Array(cfg.simulations),recoveries=[];
  const timesToFloor=[],timesToTarget=[],scenarioRuin=[],scenarioProfit=[],scenarioTarget=[],sampledWinRates=[];
  const moment={n:0,sum:0,sumSq:0,downsideSq:0};
  let floorHits=0,targetFirst=0,neither=0,profitAndSurvive=0;

  for(let base=0;base<cfg.simulations;base+=blockSize){
    const probs=sampleProbabilities(random),end=Math.min(cfg.simulations,base+blockSize),count=end-base;
    sampledWinRates.push(probs.win*100);
    let localRuin=0,localProfit=0,localTarget=0;

    for(let s=base;s<end;s++){
      let equity=cfg.start,peak=cfg.start,maxDd=0,lossStreak=0,maxLossStreak=0;
      let ruinStep=null,targetStep=null,firstBoundary=null,currentUnderwater=0,maxUnderwater=0;
      paths[s][0]=equity;

      for(let step=1;step<=cfg.steps;step++){
        const r=drawR(random,wins,probs),delta=r*cfg.risk,tradeRet=delta/cfg.start;
        equity+=delta;paths[s][step]=equity;tradeRs[s][step]=r;
        moment.n+=1;moment.sum+=tradeRet;moment.sumSq+=tradeRet*tradeRet;if(tradeRet<0)moment.downsideSq+=tradeRet*tradeRet;

        if(r<0){lossStreak+=1;maxLossStreak=Math.max(maxLossStreak,lossStreak)}else if(r>0){lossStreak=0}
        const priorPeak=peak;peak=Math.max(peak,equity);maxDd=Math.max(maxDd,peak-equity);
        if(equity<peak){currentUnderwater+=1;maxUnderwater=Math.max(maxUnderwater,currentUnderwater)}
        else if(currentUnderwater>0){recoveries.push(currentUnderwater);currentUnderwater=0}

        if(!firstBoundary&&equity<=cfg.floor){
          firstBoundary='ruin';ruinStep=step;floorHits+=1;localRuin+=1;timesToFloor.push(step);
          break;
        }
        if(!firstBoundary&&equity>=cfg.target){
          firstBoundary='target';targetStep=step;targetFirst+=1;localTarget+=1;timesToTarget.push(step);
        }
        if(priorPeak===peak&&equity===peak&&currentUnderwater>0){recoveries.push(currentUnderwater);currentUnderwater=0}
      }

      const endStep=ruinStep??cfg.steps;
      if(ruinStep!=null){
        for(let step=ruinStep+1;step<=cfg.steps;step++)paths[s][step]=equity;
      }else if(equity>cfg.start){profitAndSurvive+=1;localProfit+=1}
      if(firstBoundary==null)neither+=1;

      terminals[s]=equity;maxDds[s]=maxDd;losing[s]=maxLossStreak;underwater[s]=maxUnderwater;
      meta[s]={
        status:ruinStep!=null?'ruined':targetStep!=null?'target':'survived',
        endStep,ruinStep,targetStep,
        reason:ruinStep!=null?`Ruin floor crossed on trade ${ruinStep}`:targetStep!=null?`Target reached before ruin on trade ${targetStep}`:'Survived full horizon',
        finalEquity:equity,
        sampledWinRate:probs.win*100,
      };
    }

    scenarioRuin.push(localRuin/count*100);scenarioProfit.push(localProfit/count*100);scenarioTarget.push(localTarget/count*100);
  }

  const bands=buildBands(paths,cfg.steps,cfg.start),pnl=terminals.map(v=>v-cfg.start),returns=pnl.map(v=>v/cfg.start*100),p95Dd=quantile(maxDds,.95),ruinPct=floorHits/cfg.simulations*100;
  const p5Pnl=quantile(pnl,.05),tailLossFrac=Math.max(0,-p5Pnl)/cfg.start,ratios=tradeRatios(moment);
  const riskIndex=clamp(Math.round(45*Math.sqrt(ruinPct/100)+35*clamp((p95Dd/cfg.start)/.5,0,1)+20*clamp(tailLossFrac/.5,0,1)),0,100);

  return {
    paths,tradeRs,meta,bands,terminals,pnl,returns,maxDds,losing,underwater,timesToFloor,timesToTarget,
    ruinPct,survivePct:100-ruinPct,profitPct:profitAndSurvive/cfg.simulations*100,targetPct:targetFirst/cfg.simulations*100,neitherPct:neither/cfg.simulations*100,
    meanPnl:mean(pnl),medianPnl:median(pnl),p5Pnl,p95Pnl:quantile(pnl,.95),medianReturn:median(returns),
    p95Dd,medianDd:median(maxDds),p25Dd:quantile(maxDds,.25),p75Dd:quantile(maxDds,.75),p95Losing:quantile(losing,.95),p95Underwater:quantile(underwater,.95),medianRecovery:median(recoveries),
    riskScore:riskIndex,tradeSharpe:ratios.tradeSharpe,sortino:ratios.sortino,
    ruinCI:[quantile(scenarioRuin,.05),quantile(scenarioRuin,.95)],profitCI:[quantile(scenarioProfit,.05),quantile(scenarioProfit,.95)],targetCI:[quantile(scenarioTarget,.05),quantile(scenarioTarget,.95)],modelWinCI:[quantile(sampledWinRates,.05),quantile(sampledWinRates,.95)],
  };
}

function Metric({label,value,sub,tone=''}){return <div className="qmcMetric"><span>{label}</span><b className={tone}>{value}</b>{sub&&<small>{sub}</small>}</div>}

function CanvasPaths({result,cfg,cursorStep,setCursorStep,onSelectPath}){
  const baseRef=useRef(null),overlayRef=useRef(null),scaleRef=useRef(null);
  const [hover,setHover]=useState({path:null,x:100,y:80,step:cursorStep});

  useEffect(()=>{
    const canvas=baseRef.current,overlay=overlayRef.current;if(!canvas||!overlay)return;
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    for(const c of [canvas,overlay]){c.width=Math.round(rect.width*dpr);c.height=Math.round(rect.height*dpr)}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    const w=rect.width,h=rect.height,pad={l:48,r:10,t:12,b:24},band=result.bands;
    const lo=Math.min(cfg.floor,...band.map(x=>x.p05)),hi=Math.max(cfg.target,...band.map(x=>x.p95));
    const yPad=Math.max(300,(hi-lo)*.08),minY=lo-yPad,maxY=hi+yPad;
    const xOf=s=>pad.l+(s/cfg.steps)*(w-pad.l-pad.r),yOf=v=>pad.t+(maxY-v)/(maxY-minY)*(h-pad.t-pad.b);

    ctx.fillStyle='#050607';ctx.fillRect(0,0,w,h);
    ctx.font='8px ui-monospace, monospace';ctx.textAlign='right';ctx.textBaseline='middle';
    for(let i=0;i<5;i++){
      const value=minY+(maxY-minY)*(i/4),y=yOf(value);ctx.strokeStyle='rgba(109,116,126,.16)';ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillStyle='#596069';ctx.fillText(money1(value),pad.l-7,y);
    }
    ctx.textAlign='center';ctx.textBaseline='top';
    for(let step=0;step<=cfg.steps;step+=Math.max(1,Math.round(cfg.steps/5))){ctx.fillStyle='#555c64';ctx.fillText(String(step),xOf(step),h-pad.b+6)}

    for(const [value,color,label] of [[cfg.target,'#2ad4a1','Target'],[cfg.floor,'#ef6670','Ruin floor']]){
      const y=yOf(value);ctx.strokeStyle=color;ctx.globalAlpha=.48;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;ctx.textAlign='right';ctx.textBaseline='bottom';ctx.fillStyle=color;ctx.fillText(label,w-pad.r-4,y-3);
    }

    const maxVisible=700,stride=Math.max(1,Math.ceil(result.paths.length/maxVisible)),drawIndices=[];
    const palette=['rgba(138,114,239,.18)','rgba(55,154,220,.14)','rgba(43,201,155,.13)','rgba(213,161,71,.11)'];
    for(let p=0,draw=0;p<result.paths.length;p+=stride,draw++){
      drawIndices.push(p);const path=result.paths[p],meta=result.meta[p],end=meta.endStep;
      ctx.strokeStyle=meta.status==='ruined'?'rgba(239,102,112,.22)':palette[draw%palette.length];ctx.lineWidth=.55;ctx.beginPath();
      for(let step=0;step<=end;step++){const x=xOf(step),y=yOf(path[step]);if(step===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();
    }

    ctx.strokeStyle='rgba(225,220,255,.88)';ctx.lineWidth=1.3;ctx.beginPath();band.forEach((b,i)=>{const x=xOf(b.step),y=yOf(b.p50);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke();
    ctx.strokeStyle='rgba(138,114,239,.28)';ctx.lineWidth=.8;for(const key of ['p10','p90']){ctx.beginPath();band.forEach((b,i)=>{const x=xOf(b.step),y=yOf(b[key]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke()}
    scaleRef.current={w,h,pad,xOf,yOf,drawIndices};
  },[result,cfg]);

  useEffect(()=>{
    const canvas=overlayRef.current,scale=scaleRef.current;if(!canvas||!scale)return;
    const dpr=Math.min(window.devicePixelRatio||1,2),ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,scale.w,scale.h);
    const step=hover.step??cursorStep,cx=scale.xOf(step);ctx.strokeStyle='rgba(236,238,241,.5)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx,scale.pad.t);ctx.lineTo(cx,scale.h-scale.pad.b);ctx.stroke();
    if(hover.path!=null){
      const path=result.paths[hover.path],meta=result.meta[hover.path],end=meta.endStep;ctx.strokeStyle=meta.status==='ruined'?'#ef6670':'#f2efff';ctx.lineWidth=2;ctx.beginPath();
      for(let s=0;s<=end;s++){const x=scale.xOf(s),y=scale.yOf(path[s]);if(s===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();
      const dotStep=Math.min(step,end);ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.arc(scale.xOf(dotStep),scale.yOf(path[dotStep]),3,0,Math.PI*2);ctx.fill();
    }
  },[hover,result,cursorStep]);

  const move=e=>{
    const scale=scaleRef.current;if(!scale)return;
    const rect=e.currentTarget.getBoundingClientRect(),x=clamp(e.clientX-rect.left,scale.pad.l,rect.width-scale.pad.r),y=e.clientY-rect.top;
    const step=clamp(Math.round(((x-scale.pad.l)/(rect.width-scale.pad.l-scale.pad.r))*cfg.steps),0,cfg.steps);
    let nearest=null,best=Infinity;
    for(const p of scale.drawIndices){const end=result.meta[p].endStep;if(step>end)continue;const dy=Math.abs(scale.yOf(result.paths[p][step])-y);if(dy<best){best=dy;nearest=p}}
    setCursorStep(step);setHover({path:best<=7?nearest:null,x:e.clientX-rect.left,y,step});
  };

  const b=result.bands[hover.step]||result.bands.at(-1),path=hover.path!=null?result.paths[hover.path]:null,meta=hover.path!=null?result.meta[hover.path]:null;
  const boxLeft=clamp(hover.x+14,8,(scaleRef.current?.w||400)-218),boxTop=clamp(hover.y-58,8,(scaleRef.current?.h||300)-92);
  return <div className="qmcCanvasWrap">
    <canvas ref={baseRef} className="qmcCanvas qmcBaseCanvas"/>
    <canvas ref={overlayRef} className="qmcCanvas qmcOverlayCanvas" onPointerMove={move} onPointerLeave={()=>setHover(h=>({...h,path:null}))} onClick={()=>hover.path!=null&&onSelectPath(hover.path)}/>
    <div className={`qmcCursorBox ${hover.path!=null?'pathHit':''}`} style={{left:boxLeft,top:boxTop,right:'auto'}}>
      {hover.path!=null?<><span>PATH #{hover.path+1} · TRADE {Math.min(hover.step,meta.endStep)}</span><b>{money1(path[Math.min(hover.step,meta.endStep)])}</b><small>{meta.status.toUpperCase()} · {meta.reason}</small><small>click for path log</small></>:<><span>TRADE {hover.step}</span><b>{money1(b.p50)}</b><small>p10 {money1(b.p10)} · p90 {money1(b.p90)}</small><small>{b.belowPct.toFixed(0)}% below start · {(100-b.belowPct).toFixed(0)}% above</small></>}
    </div>
  </div>;
}

function PathDrawer({index,result,cfg,onClose}){
  if(index==null)return null;
  const path=result.paths[index],rs=result.tradeRs[index],meta=result.meta[index],rows=[];
  for(let step=1;step<=meta.endStep;step++)rows.push({step,r:rs[step],delta:path[step]-path[step-1],equity:path[step]});
  return <aside className="qmcPathDrawer">
    <div className="qmcDrawerHead"><div><span className={`qmcStatusPill ${meta.status==='ruined'?'bad':meta.status==='target'?'good':'warn'}`}>{meta.status.toUpperCase()}</span><b>Path #{index+1} · {meta.endStep} trades</b><small>{meta.reason} · Final {money(meta.finalEquity)} · sampled WR {meta.sampledWinRate.toFixed(1)}%</small></div><button onClick={onClose}><X size={15}/></button></div>
    <div className="qmcDrawerResult"><b>{meta.status==='ruined'?'Account stopped at ruin':meta.status==='target'?'Target was reached':'Full horizon survived'}</b><span>Once a path hits ruin, no later trades are generated for that account.</span></div>
    <div className="qmcTradeLogHead"><span>TRADE</span><span>R*</span><span>P&L</span><span>EQUITY</span></div>
    <div className="qmcTradeLog">{rows.map(row=><div className="qmcTradeRow qmcTradeRow4" key={row.step}><span>{row.step}</span><span className={row.r>=0?'good':'bad'}>{row.r>=0?'+':''}{row.r.toFixed(2)}</span><span className={row.delta>=0?'good':'bad'}>{row.delta>=0?'+':''}{money(row.delta)}</span><span>{money(row.equity)}</span></div>)}</div>
  </aside>;
}

function Validation({validation}){
  if(!validation.errors.length&&!validation.warnings.length)return null;
  return <div className={`qmcValidation ${validation.errors.length?'error':'warn'}`}><AlertTriangle size={13}/><div>{validation.errors.map(x=><b key={x}>{x}</b>)}{validation.warnings.map(x=><span key={x}>{x}</span>)}</div></div>;
}

function Settings({draft,setDraft,rawDraft,setRawDraft}){
  const set=(key,value)=>setDraft(cur=>({...cur,[key]:Number(value)}));
  return <div className="qmcSettings qmcRiskV2Settings">
    <label>Simulations<input value={draft.simulations} onChange={e=>set('simulations',e.target.value)}/></label>
    <label>Horizon<input value={draft.steps} onChange={e=>set('steps',e.target.value)}/></label>
    <label>Start<input value={draft.start} onChange={e=>set('start',e.target.value)}/></label>
    <label>Risk / trade<input value={draft.risk} onChange={e=>set('risk',e.target.value)}/></label>
    <label>Ruin floor<input value={draft.floor} onChange={e=>set('floor',e.target.value)}/></label>
    <label>Profit target<input value={draft.target} onChange={e=>set('target',e.target.value)}/></label>
    <label>Calibration<select value={rawDraft?'raw':'conservative'} onChange={e=>setRawDraft(e.target.value==='raw')}><option value="conservative">Conservative + uncertainty</option><option value="raw">Raw empirical + uncertainty</option></select></label>
  </div>;
}

function CrossSection({result,cfg,crossStep,setCrossStep}){
  const values=useMemo(()=>result.paths.map(p=>(p[crossStep]-cfg.start)/cfg.start*100),[result,cfg.start,crossStep]);
  const data=useMemo(()=>histogram(values,30),[values]),med=median(values),under=values.filter(x=>x<0).length/(values.length||1)*100;
  return <div className="qmcCrossSection"><div className="qmcCrossHead"><span>Trading step <b>{crossStep}</b> / {cfg.steps}</span><span>Median {med>=0?'+':''}{med.toFixed(1)}%</span></div><input type="range" min="1" max={cfg.steps} value={crossStep} onChange={e=>setCrossStep(Number(e.target.value))}/><div className="qmcCrossStats"><b>Median {med>=0?'+':''}{med.toFixed(1)}%</b><span>p5–p95 {quantile(values,.05).toFixed(1)}% to {quantile(values,.95).toFixed(1)}%</span><span>{under.toFixed(0)}% underwater</span></div><ResponsiveContainer width="100%" height={78}><BarChart data={data}><XAxis dataKey="x" stroke="#4d535a" tick={{fontSize:7}} tickFormatter={v=>`${v.toFixed(0)}%`}/><YAxis hide/><Bar dataKey="count" fill="#765fce"/></BarChart></ResponsiveContainer></div>;
}

function Sensitivity({cfg,rawMode,seed}){
  const rows=useMemo(()=>{
    const wins=rawMode?rawWins:conservativeWins,winBase=personalModel.winProbability,be=personalModel.breakevenProbability;
    const winScenarios=[-.15,-.10,-.05,0,.05,.10,.15].map(x=>clamp(winBase+x,.05,.9));
    const riskMultipliers=[.25,.5,.75,1,1.25,1.5];
    return winScenarios.map((winRate,ri)=>({winRate,cells:riskMultipliers.map((mult,ci)=>{
      const random=rng(seed+991*(ri+1)+613*(ci+1)),sims=220,lossRate=Math.max(.001,1-winRate-be);let ruined=0;
      for(let s=0;s<sims;s++){
        let equity=cfg.start;
        for(let step=1;step<=cfg.steps;step++){
          const r=drawR(random,wins,{win:winRate,loss:lossRate,breakeven:be});equity+=r*cfg.risk*mult;
          if(equity<=cfg.floor){ruined+=1;break}
        }
      }
      return {mult,ruin:ruined/sims*100};
    })}));
  },[cfg,rawMode,seed]);
  const riskMultipliers=[.25,.5,.75,1,1.25,1.5];
  return <section className="qmcSensitivity"><div className="qmcSensitivityHead"><div><b>SENSITIVITY · WIN RATE × RISK</b><span>Fast scenario grid using the same payoff library. This is a directional stress test, not the posterior estimate above.</span></div></div><div className="qmcHeatGrid" style={{gridTemplateColumns:`110px repeat(${riskMultipliers.length},1fr)`}}><div className="head">Observed WR ±</div>{riskMultipliers.map(m=><div className="head" key={m}>{m.toFixed(2)}× risk</div>)}{rows.flatMap(row=>[<div className="rowHead" key={`h-${row.winRate}`}>{(row.winRate*100).toFixed(1)}% WR</div>,...row.cells.map(cell=>{const alpha=clamp(cell.ruin/35,.08,.9);return <div className="heat" key={`${row.winRate}-${cell.mult}`} style={{background:`rgba(239,102,112,${alpha})`}}><b>{cell.ruin.toFixed(1)}%</b><span>P(ruin)</span></div>})])}</div></section>;
}

function ModelAudit({result,cfg,rawMode,seed}){
  const avgWin=mean(rawMode?rawWins:conservativeWins),avgLoss=mean(personalModel.lossR),payoff=Math.abs(avgLoss)?avgWin/Math.abs(avgLoss):0,expectancy=personalModel.winProbability*avgWin+personalModel.lossProbability*avgLoss;
  return <section className="qmcModelAudit"><div className="qmcAuditGrid"><Metric label="OBSERVED WIN RATE" value={percent(personalModel.winProbability*100)} sub={`${personalModel.evalWins}/${personalModel.evalPositionIdeas} curated eval ideas`}/><Metric label="POSTERIOR WR 90%" value={rangePct(result.modelWinCI)} sub="sample uncertainty"/><Metric label="AVG MODELED WIN" value={`+${avgWin.toFixed(2)}R*`} sub={rawMode?'raw normalized payoff':'conservative transform'}/><Metric label="AVG MODELED LOSS" value={`${avgLoss.toFixed(2)}R*`} sub="remaining eval losses"/><Metric label="PAYOFF RATIO" value={`${payoff.toFixed(2)} : 1`} sub="avg win ÷ |avg loss|"/><Metric label="EXPECTANCY" value={`${expectancy>=0?'+':''}${expectancy.toFixed(2)}R*`} sub="observed WR before posterior variation"/></div><div className="qmcAuditNotes"><b>RUN PROVENANCE</b><span>Seed {seed}</span><span>{cfg.simulations.toLocaleString()} simulations</span><span>{cfg.steps} trades max</span><span>{money(cfg.risk)} risk / modeled 1R</span><span>{percent(cfg.risk/cfg.start*100)} of starting equity per modeled 1R</span><span>{money(cfg.start-cfg.floor)} distance to ruin</span></div><p>*R is the current normalized payoff unit, not stop-defined true R. Winner magnitudes use {rawMode?'raw normalized payoffs':'the conservative log transform'}; probabilities are sampled around the curated eval counts rather than held at exactly {percent(personalModel.winProbability*100)}.</p></section>;
}

export default function RiskMonteCarloV2(){
  const defaults={simulations:4000,steps:109,start:100000,risk:500,target:116165,floor:95000};
  const [active,setActive]=useState(defaults),[draft,setDraft]=useState(defaults),[rawMode,setRawMode]=useState(false),[rawDraft,setRawDraft]=useState(false),[seed,setSeed]=useState(7331),[section,setSection]=useState('Simulation'),[settings,setSettings]=useState(false),[crossStep,setCrossStep]=useState(44),[cursorStep,setCursorStep]=useState(defaults.steps),[selectedPath,setSelectedPath]=useState(null);
  const validation=useMemo(()=>validateConfig(draft),[draft]);
  const result=useMemo(()=>simulate(active,rawMode,seed),[active,rawMode,seed]);

  const run=(newSeed=false)=>{
    const safe={...draft,simulations:clamp(Math.round(Number(draft.simulations)||4000),100,10000),steps:clamp(Math.round(Number(draft.steps)||109),5,500)};
    const check=validateConfig(safe);if(check.errors.length)return;
    setActive(safe);setDraft(safe);setRawMode(rawDraft);setCrossStep(v=>clamp(v,1,safe.steps));setCursorStep(safe.steps);setSelectedPath(null);if(newSeed)setSeed(s=>(s+104729)>>>0);
  };

  const terminalData=histogram(result.pnl,28),ddData=histogram(result.maxDds,24),underData=histogram(result.underwater,24);
  const tabs=['Simulation','Sensitivity','Outcome distributions','Tail risk','Model audit'];
  return <div className="qmcPage qmcRiskV2">
    <div className="qmcToolbar"><div className="qmcSectionTabs">{tabs.map(tab=><button key={tab} className={section===tab?'active':''} onClick={()=>setSection(tab)}>{tab}</button>)}</div><div className="qmcToolbarRight"><span className="qmcSeed">SEED {seed}</span><button onClick={()=>setSettings(v=>!v)}><Settings2 size={12}/> Settings</button><button onClick={()=>run(true)}><RefreshCw size={12}/> New seed</button><button className="qmcRun" disabled={validation.errors.length>0} onClick={()=>run(false)}><Play size={12}/> Run</button></div></div>
    {settings&&<Settings draft={draft} setDraft={setDraft} rawDraft={rawDraft} setRawDraft={setRawDraft}/>}<Validation validation={validation}/>
    <div className="qmcModelNote"><b>PERSONAL MODEL</b><span>{percent(personalModel.winProbability*100)} observed win · posterior 90% win range {rangePct(result.modelWinCI)} · {personalModel.evalPositionIdeas} curated eval ideas</span><em>{rawMode?'RAW PAYOFF + UNCERTAINTY':'CONSERVATIVE + UNCERTAINTY'}</em></div>
    <div className="qmcMetrics qmcMetrics7"><Metric label="RISK INDEX" value={result.riskScore} sub="model-aware · 0 low · 100 extreme"/><Metric label="P(RUIN)" value={percent(result.ruinPct)} sub={`90% range ${rangePct(result.ruinCI)}`} tone="bad"/><Metric label="P(PROFIT + SURVIVE)" value={percent(result.profitPct)} sub={`90% range ${rangePct(result.profitCI)}`} tone="good"/><Metric label="MEDIAN ACCOUNT RETURN" value={percent(result.medianReturn)} tone={result.medianReturn>=0?'good':'bad'}/><Metric label="TRADE SHARPE" value={result.tradeSharpe.toFixed(2)} sub={`Sortino ${result.sortino==null?'—':result.sortino.toFixed(2)}`}/><Metric label="P95 MAX DD" value={money1(result.p95Dd)} tone="warn" sub={`${money1(result.p25Dd)} – ${money1(result.p75Dd)} IQR`}/><Metric label="95% LOSING STREAK" value={`${Math.round(result.p95Losing)} trades`} tone="bad"/></div>

    {section==='Simulation'&&<><section className="qmcChartBlock"><div className="qmcChartHead"><div><b>Monte Carlo Account Paths</b><small>{active.simulations.toLocaleString()} simulations · max {active.steps} trades · ruined paths terminate immediately</small></div><span>Trade {cursorStep} / {active.steps}</span></div><CanvasPaths result={result} cfg={active} cursorStep={cursorStep} setCursorStep={setCursorStep} onSelectPath={setSelectedPath}/><CrossSection result={result} cfg={active} crossStep={crossStep} setCrossStep={setCrossStep}/></section><section className="qmcSolver"><div className="qmcRaceTitle"><span>Race to first boundary</span><small>target vs ruin · first touch only</small></div><div className="qmcRace"><span style={{width:`${result.ruinPct}%`}} className="ruinSeg">{Math.round(result.ruinPct)}%</span><span style={{width:`${result.neitherPct}%`}} className="neutralSeg">{Math.round(result.neitherPct)}%</span><span style={{width:`${result.targetPct}%`}} className="targetSeg">{Math.round(result.targetPct)}%</span></div><div className="qmcRaceLegend"><span className="bad">● Ruin first {percent(result.ruinPct)}</span><span>● Neither {percent(result.neitherPct)}</span><span className="good">● Target first {percent(result.targetPct)}</span></div><div className="qmcBoundaryCards"><article><div><span>RISK OF RUIN</span><b className="bad">{percent(result.ruinPct)}</b><small>{money(active.floor)}</small></div><p>The path terminates on the trade that crosses the ruin floor. It cannot recover afterward.</p><div className="qmcTimes"><span>MEDIAN TIME<b>{result.timesToFloor.length?`${Math.round(median(result.timesToFloor))} trades`:'—'}</b></span><span>90% MODEL RANGE<b>{rangePct(result.ruinCI)}</b></span></div></article><article><div><span>TAIL DURATION</span><b>{Math.round(result.p95Underwater)} trades</b><small>P95 underwater streak</small></div><p>Sequence-risk context from simulated account paths before ruin or the end of the horizon.</p><div className="qmcTimes"><span>MEDIAN RECOVERY<b>{result.medianRecovery?`${Math.round(result.medianRecovery)} trades`:'—'}</b></span><span>P95 MAX DD<b>{money(result.p95Dd)}</b></span></div></article></div></section></>}
    {section==='Sensitivity'&&<Sensitivity cfg={active} rawMode={rawMode} seed={seed}/>} 
    {section==='Outcome distributions'&&<section className="qmcAltGrid qmcAltGrid3"><article><h3>Stopped account terminal P&L</h3><ResponsiveContainer width="100%" height={245}><BarChart data={terminalData}><XAxis dataKey="x" stroke="#4d535a" tick={{fontSize:8}} tickFormatter={v=>money1(v)}/><YAxis hide/><Bar dataKey="count" fill="#7861d0"/></BarChart></ResponsiveContainer></article><article><h3>Account max drawdown</h3><ResponsiveContainer width="100%" height={245}><BarChart data={ddData}><XAxis dataKey="x" stroke="#4d535a" tick={{fontSize:8}} tickFormatter={v=>money1(v)}/><YAxis hide/><Bar dataKey="count" fill="#d85b6b"/></BarChart></ResponsiveContainer></article><article><h3>Max time underwater</h3><ResponsiveContainer width="100%" height={245}><BarChart data={underData}><XAxis dataKey="x" stroke="#4d535a" tick={{fontSize:8}} tickFormatter={v=>`${Math.round(v)}t`}/><YAxis hide/><Bar dataKey="count" fill="#5f8dd6"/></BarChart></ResponsiveContainer></article></section>}
    {section==='Tail risk'&&<section className="qmcTail qmcTail4"><Metric label="P95 ACCOUNT MAX DD" value={money(result.p95Dd)} tone="bad"/><Metric label="P(RUIN)" value={percent(result.ruinPct)} sub={`90% ${rangePct(result.ruinCI)}`} tone="bad"/><Metric label="P5 STOPPED ACCOUNT P&L" value={money(result.p5Pnl)} tone={result.p5Pnl<0?'bad':''}/><Metric label="P95 UNDERWATER" value={`${Math.round(result.p95Underwater)} trades`} tone="warn"/><p>Every account path now stops immediately when its ruin floor is crossed. No later simulated winner can revive that account. Posterior uncertainty varies the win/loss/breakeven probabilities around the curated eval sample, and trade Sharpe/Sortino use only trades actually generated before ruin or horizon completion.</p></section>}
    {section==='Model audit'&&<ModelAudit result={result} cfg={active} rawMode={rawMode} seed={seed}/>} 
    {selectedPath!=null&&<PathDrawer index={selectedPath} result={result} cfg={active} onClose={()=>setSelectedPath(null)}/>} 
  </div>;
}
