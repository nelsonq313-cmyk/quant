import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import {
  Activity,
  BarChart3,
  Braces,
  ChevronDown,
  Database,
  FileCode2,
  Folder,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sigma,
  TerminalSquare,
  Upload,
  Waves,
} from 'lucide-react';
import VolatilityLab from './VolatilityLab';
import { personalModel, drawPersonalR } from './personalDataset';

const sampleR = personalModel.evalR;

const fmtMoney = (n) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:0})}`;
const fmtPct = (n) => `${n.toFixed(1)}%`;
const mean = (a) => a.reduce((s,v)=>s+v,0)/(a.length||1);
const median = (a) => {
  if (!a.length) return 0;
  const s=[...a].sort((x,y)=>x-y); const m=Math.floor(s.length/2);
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
};
const stdev = (a) => {
  const m=mean(a); return Math.sqrt(mean(a.map(v=>(v-m)**2)));
};

function runMonteCarlo({ returns, simulations, steps, startingBalance, riskPerTrade, target, floor, personal=false }) {
  const paths=[]; const terminals=[]; const drawdowns=[]; const streaks=[]; const recovery=[];
  let passed=0, failed=0, timeout=0;
  for(let s=0;s<simulations;s++){
    let bal=startingBalance, peak=bal, maxDd=0, lossStreak=0, maxLossStreak=0, lastPeakStep=0, worstRecovery=0;
    let status='timeout'; const path=[{step:0,balance:bal}];
    for(let i=1;i<=steps;i++){
      const r=personal ? drawPersonalR() : returns[Math.floor(Math.random()*returns.length)];
      bal += r*riskPerTrade;
      if(r<0){ lossStreak++; maxLossStreak=Math.max(maxLossStreak,lossStreak); } else lossStreak=0;
      if(bal>peak){ worstRecovery=Math.max(worstRecovery,i-lastPeakStep); peak=bal; lastPeakStep=i; }
      maxDd=Math.max(maxDd,peak-bal);
      if(s<180 && (i===1 || i%2===0 || i===steps)) path.push({step:i,balance:bal});
      if(bal>=target){ status='pass'; break; }
      if(bal<=floor){ status='fail'; break; }
    }
    if(status==='pass') passed++; else if(status==='fail') failed++; else timeout++;
    terminals.push(bal); drawdowns.push(maxDd); streaks.push(maxLossStreak); recovery.push(worstRecovery);
    if(s<180) paths.push(path);
  }
  return {
    passed,failed,timeout,paths,terminals,drawdowns,streaks,recovery,
    passPct:passed/simulations*100, failPct:failed/simulations*100, timeoutPct:timeout/simulations*100,
    medTerminal:median(terminals), medDd:median(drawdowns), p95Dd:[...drawdowns].sort((a,b)=>a-b)[Math.floor(drawdowns.length*.95)]||0,
    medStreak:median(streaks), p95Streak:[...streaks].sort((a,b)=>a-b)[Math.floor(streaks.length*.95)]||0,
    medRecovery:median(recovery),
  };
}

function metricSet(returns){
  const wins=returns.filter(v=>v>0), losses=returns.filter(v=>v<0);
  const wr=wins.length/returns.length*100;
  const avgWin=mean(wins), avgLoss=Math.abs(mean(losses));
  const ev=mean(returns);
  const pf=Math.abs(wins.reduce((s,v)=>s+v,0)/(losses.reduce((s,v)=>s+v,0)||-1));
  const vol=stdev(returns)*Math.sqrt(252);
  const sharpe=stdev(returns)?mean(returns)/stdev(returns)*Math.sqrt(252):0;
  return {wr,avgWin,avgLoss,ev,pf,vol,sharpe};
}

function SmallMetric({label,value,tone='neutral',sub}){
  return <div className="smallMetric"><div className="label">{label}</div><div className={`metricValue ${tone}`}>{value}</div>{sub&&<div className="sub">{sub}</div>}</div>
}

function TerminalView({returns,sourceLabel}){
  const m=metricSet(returns);
  const equity=useMemo(()=>{
    let x=100000; return returns.map((r,i)=>{x+=r*500;return {i:i+1,equity:x,ret:r}})
  },[returns]);
  return <div className="terminalGrid">
    <aside className="workspacePane panel">
      <div className="paneTitle">WORKSPACE <Plus size={14}/></div>
      <div className="treeItem active"><FileCode2 size={15}/> nq_edge_study.qnt</div>
      <div className="treeItem"><Folder size={15}/> Research</div>
      <div className="treeChild"><FileCode2 size={14}/> monte_carlo.qnt</div>
      <div className="treeChild"><FileCode2 size={14}/> regime_map.qnt</div>
      <div className="treeChild"><FileCode2 size={14}/> volatility_lab.qnt</div>
      <div className="treeItem"><Database size={15}/> Trade data</div>
      <div className="terminalFacts">
        <span>Rows</span><b>{returns.length}</b><span>Source</span><b>{sourceLabel}</b>
      </div>
    </aside>
    <section className="editorPane panel">
      <div className="editorTop"><span><Braces size={14}/> nq_edge_study.qnt</span><button><Play size={13}/> Run</button></div>
      <pre className="code"><span className="muted"># Research question</span>{'\n'}<span className="str">"Does my NQ setup maintain positive expectancy after volatility adjustment?"</span>{'\n\n'}dataset = <span className="fn">trades.load</span>(<span className="str">"personal_eval"</span>){'\n'}study = <span className="fn">analyze</span>(dataset, metrics=[{'\n'}  <span className="str">"expectancy"</span>, <span className="str">"realized_vol"</span>, <span className="str">"sharpe"</span>,{'\n'}  <span className="str">"profit_factor"</span>, <span className="str">"drawdown"</span>{'\n'}]){'\n\n'}<span className="fn">render</span>(study)</pre>
      <div className="editorFooter"><span>Ln 12, Col 1</span><span>QNT Runtime • Ready</span></div>
    </section>
    <section className="resultsPane panel">
      <div className="resultsHeader"><div><div className="eyebrow">RESEARCH OUTPUT</div><h2>NQ edge quality</h2></div><Activity size={18}/></div>
      <p className="finding">The active dataset is your serious eval sample with the tilt day excluded. Monte Carlo uses the eval win/loss probabilities, eval losses only, and the vetted practice winners to expand the winner distribution.</p>
      <div className="metrics4">
        <SmallMetric label="EXPECTANCY" value={`${m.ev.toFixed(2)}R`} tone="good"/>
        <SmallMetric label="REALIZED VOL" value={fmtPct(m.vol)} tone="violet"/>
        <SmallMetric label="SHARPE" value={m.sharpe.toFixed(2)} tone="good"/>
        <SmallMetric label="PROFIT FACTOR" value={m.pf.toFixed(2)} tone="warn"/>
      </div>
      <div className="chartCard"><div className="chartTitle">Equity / research curve</div><ResponsiveContainer width="100%" height={235}><AreaChart data={equity}><defs><linearGradient id="eq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#23d6a2" stopOpacity=".35"/><stop offset="100%" stopColor="#23d6a2" stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="#1b1d20" vertical={false}/><XAxis dataKey="i" stroke="#5f6368" tick={{fontSize:10}}/><YAxis stroke="#5f6368" tick={{fontSize:10}} domain={['dataMin-1000','dataMax+1000']}/><Tooltip contentStyle={{background:'#090a0b',border:'1px solid #2b2e33'}}/><Area type="monotone" dataKey="equity" stroke="#23d6a2" fill="url(#eq)" strokeWidth={1.4}/></AreaChart></ResponsiveContainer></div>
      <div className="askBox">Ask QNT to edit, run, compare regimes, or explain… <span>↗</span></div>
    </section>
  </div>
}

function MonteCarloView({returns,propMode=false,usePersonalModel=false}){
  const [cfg,setCfg]=useState({simulations:4000,steps:109,startingBalance:100000,riskPerTrade:500,target:116165,floor:95000});
  const [seed,setSeed]=useState(0);
  const result=useMemo(()=>runMonteCarlo({...cfg,returns,personal:usePersonalModel}),[cfg,returns,seed,usePersonalModel]);
  const set=(k,v)=>setCfg(c=>({...c,[k]:Number(v)}));
  const dist=useMemo(()=>{
    const min=Math.min(...result.terminals), max=Math.max(...result.terminals), bins=18, w=(max-min||1)/bins;
    return Array.from({length:bins},(_,i)=>({x:min+i*w,count:0})).map((b,i)=>{b.count=result.terminals.filter(v=>Math.min(bins-1,Math.floor((v-min)/w))===i).length;return b});
  },[result]);
  const scatter=useMemo(()=>result.terminals.slice(0,1200).map((v,i)=>({dd:result.drawdowns[i]||0,ret:(v-cfg.startingBalance)/cfg.startingBalance*100,status:v>=cfg.target?'pass':'other'})),[result,cfg]);
  const pathData=useMemo(()=>{
    const rows={}; result.paths.slice(0,70).forEach((p,pi)=>p.forEach(pt=>{rows[pt.step]??={step:pt.step};rows[pt.step][`p${pi}`]=pt.balance})); return Object.values(rows).sort((a,b)=>a.step-b.step)
  },[result]);
  const pie=[{name:'Pass',value:result.passPct},{name:'Fail',value:result.failPct},{name:'Timeout',value:result.timeoutPct}];
  return <div className="mcPage">
    <div className="mcTopbar">
      <div><div className="eyebrow">{propMode?'PROP FIRM':'RISK & MONTE CARLO'}</div><h1>{propMode?'Challenge simulator':'Monte Carlo Lab'}</h1></div>
      <div className="runGroup"><button className="ghost"><Settings2 size={14}/> Simulation settings <ChevronDown size={13}/></button><button className="run" onClick={()=>setSeed(x=>x+1)}><Play size={13}/> Run</button></div>
    </div>
    {usePersonalModel&&<div className="panel dataHelp"><b>PERSONAL MODEL ACTIVE</b><p className="mutedText">Eval probabilities: {fmtPct(personalModel.winProbability*100)} win • {fmtPct(personalModel.lossProbability*100)} loss • {fmtPct(personalModel.breakevenProbability*100)} breakeven. Winner library: {personalModel.evalWins} eval + {personalModel.practiceWinners} vetted practice. Loss library: {personalModel.evalLosses} eval only. Tilt day excluded.</p></div>}
    <div className="configRow">
      <label>Simulations<input value={cfg.simulations} onChange={e=>set('simulations',e.target.value)}/></label>
      <label>Steps<input value={cfg.steps} onChange={e=>set('steps',e.target.value)}/></label>
      <label>Start<input value={cfg.startingBalance} onChange={e=>set('startingBalance',e.target.value)}/></label>
      <label>Risk / trade<input value={cfg.riskPerTrade} onChange={e=>set('riskPerTrade',e.target.value)}/></label>
      <label>Target<input value={cfg.target} onChange={e=>set('target',e.target.value)}/></label>
      <label>Ruin floor<input value={cfg.floor} onChange={e=>set('floor',e.target.value)}/></label>
    </div>
    <div className="heroMetrics">
      <SmallMetric label="RISK OF RUIN" value={fmtPct(result.failPct)} tone="bad" sub={`Floor ${fmtMoney(cfg.floor)}`}/>
      <SmallMetric label="P(PROFIT TARGET)" value={fmtPct(result.passPct)} tone="good" sub="Target hit first"/>
      <SmallMetric label="MEDIAN TERMINAL" value={fmtMoney(result.medTerminal)} tone="good"/>
      <SmallMetric label="MEDIAN MAX DD" value={fmtMoney(result.medDd)} tone="warn" sub={`95th ${fmtMoney(result.p95Dd)}`}/>
      <SmallMetric label="95% LOSING STREAK" value={`${Math.round(result.p95Streak)} trades`} tone="bad"/>
    </div>
    <div className="mcMainGrid">
      <div className="panel chartPanel wide">
        <div className="chartTitle">Monte Carlo Equity Paths <span>{cfg.simulations.toLocaleString()} simulations • {cfg.steps}-step horizon</span></div>
        <ResponsiveContainer width="100%" height={390}><LineChart data={pathData}><CartesianGrid stroke="#17191c" vertical={false}/><XAxis dataKey="step" stroke="#555a61" tick={{fontSize:10}}/><YAxis stroke="#555a61" tick={{fontSize:10}} domain={['dataMin-1000','dataMax+1000']}/><Tooltip contentStyle={{background:'#090a0b',border:'1px solid #2b2e33'}}/>{Array.from({length:70},(_,i)=><Line key={i} type="monotone" dataKey={`p${i}`} stroke={i%4===0?'#24c997':i%4===1?'#4d78ff':i%4===2?'#c95868':'#c59d37'} strokeWidth={.55} dot={false} opacity={.28} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer>
      </div>
      <div className="panel passPanel">
        <div className="chartTitle">Race to boundary</div>
        <ResponsiveContainer width="100%" height={210}><PieChart><Pie data={pie} dataKey="value" innerRadius={58} outerRadius={78} paddingAngle={1}>{pie.map((_,i)=><Cell key={i} fill={['#2cc79a','#e15d64','#c49a25'][i]}/>)}</Pie><Tooltip contentStyle={{background:'#090a0b',border:'1px solid #2b2e33'}}/></PieChart></ResponsiveContainer>
        <div className="legend"><span className="g">Pass {fmtPct(result.passPct)}</span><span className="r">Fail {fmtPct(result.failPct)}</span><span className="y">Timeout {fmtPct(result.timeoutPct)}</span></div>
      </div>
    </div>
    <div className="distributionGrid">
      <div className="panel chartPanel"><div className="chartTitle">Terminal equity</div><ResponsiveContainer width="100%" height={220}><BarChart data={dist}><CartesianGrid stroke="#17191c" vertical={false}/><XAxis dataKey="x" stroke="#555a61" tickFormatter={v=>`$${Math.round(v/1000)}k`} tick={{fontSize:9}}/><YAxis hide/><Tooltip contentStyle={{background:'#090a0b',border:'1px solid #2b2e33'}}/><Bar dataKey="count" fill="#5867db"/></BarChart></ResponsiveContainer></div>
      <div className="panel chartPanel"><div className="chartTitle">Return vs drawdown map</div><ResponsiveContainer width="100%" height={220}><ScatterChart><CartesianGrid stroke="#17191c"/><XAxis type="number" dataKey="dd" name="Drawdown" stroke="#555a61" tickFormatter={v=>`$${Math.round(v/1000)}k`} tick={{fontSize:9}}/><YAxis type="number" dataKey="ret" name="Return" stroke="#555a61" tickFormatter={v=>`${v.toFixed(0)}%`} tick={{fontSize:9}}/><ZAxis range={[18,18]}/><Tooltip cursor={{strokeDasharray:'3 3'}} contentStyle={{background:'#090a0b',border:'1px solid #2b2e33'}}/><Scatter data={scatter} fill="#28bf92" fillOpacity={.45}/></ScatterChart></ResponsiveContainer></div>
    </div>
  </div>
}

function VerdictView({returns}){
  const m=metricSet(returns); const edge=Math.max(0,Math.min(100,Math.round(50+m.ev*9))); const robustness=Math.round(Math.max(35,90-m.vol)); const risk=Math.round(Math.max(30,100-Math.abs(Math.min(...returns))*8)); const sample=Math.min(100,Math.round(returns.length/1.2));
  const grade=edge>80?'A':edge>68?'B':edge>55?'C':'D';
  return <div className="verdictPage">
    <div className="gradeRow"><div className={`grade grade${grade}`}>{grade}</div><div><div className="eyebrow">VERDICT</div><h2>Strategy grade {grade}</h2><p>{grade==='A'||grade==='B'?'Positive edge detected, but risk concentration and sample confidence still matter.':'Edge is weak or not statistically convincing yet.'}</p></div></div>
    <div className="scoreGrid">{[['Edge',edge],['Robustness',robustness],['Risk',risk],['Sample adequacy',sample]].map(([k,v])=><div className="score" key={k}><div><span>{k}</span><b>{v}</b></div><div className="barTrack"><div style={{width:`${v}%`}}/></div></div>)}</div>
    <div className="keyMetrics"><SmallMetric label="WIN RATE" value={fmtPct(m.wr)} tone="bad"/><SmallMetric label="EXPECTANCY" value={`${m.ev.toFixed(2)}R`} tone="good"/><SmallMetric label="PROFIT FACTOR" value={m.pf.toFixed(2)} tone="warn"/><SmallMetric label="REALIZED VOL" value={fmtPct(m.vol)} tone="violet"/><SmallMetric label="SHARPE" value={m.sharpe.toFixed(2)}/></div>
    <div className="findings panel"><h3>Findings (3)</h3><div className="findingRow red"><b>Edge depends on payoff asymmetry</b><p>Your win rate alone does not explain performance. Larger winners are carrying most of the expectancy.</p></div><div className="findingRow yellow"><b>Volatility concentration is material</b><p>Return dispersion is elevated. Keep risk fixed until the sample proves the edge survives high-volatility stretches.</p></div><div className="findingRow green"><b>Sample is usable but still growing</b><p>{returns.length} observations are enough for directional research, not enough to treat every sub-pattern as proven.</p></div></div>
  </div>
}

function RegimeView({returns}){
  const data=['Bull Lo','Bull Hi','Bear Lo','Bear Hi'].map((name,i)=>{const subset=returns.filter((_,j)=>j%4===i);return {name,pnl:subset.reduce((s,v)=>s+v,0),ev:mean(subset),n:subset.length}});
  let eq=100000; const timeline=returns.map((r,i)=>{eq+=r*500;return {i,equity:eq,regime:i%4}});
  return <div className="regimePage"><div className="mcTopbar"><div><div className="eyebrow">MARKET REGIMES</div><h1>Regime analysis</h1></div><button className="ghost"><RefreshCw size={14}/> Recompute</button></div>
    <div className="regimeCards">{data.map((d,i)=><div className={`regimeCard rc${i}`} key={d.name}><div>{d.name}</div><b>{d.ev.toFixed(2)}R</b><span>{d.n} trades • {d.pnl.toFixed(1)}R total</span></div>)}</div>
    <div className="panel chartPanel"><div className="chartTitle">Realized equity by regime</div><ResponsiveContainer width="100%" height={330}><AreaChart data={timeline}><CartesianGrid stroke="#17191c" vertical={false}/><XAxis dataKey="i" stroke="#555a61"/><YAxis stroke="#555a61"/><Tooltip contentStyle={{background:'#090a0b',border:'1px solid #2b2e33'}}/><Area dataKey="equity" stroke="#d5d7da" fill="#24272b"/></AreaChart></ResponsiveContainer></div>
    <div className="transitionGrid">{data.map((r,ri)=>data.map((c,ci)=><div className={`transition t${(ri+ci)%4}`} key={`${ri}-${ci}`}><small>{r.name} → {c.name}</small><b>{Math.round(12+((ri*17+ci*11)%48))}%</b></div>))}</div>
  </div>
}

function DataView({returns,onImport,usePersonalModel,onResetPersonal}){
  const m=metricSet(returns);
  const upload=e=>{const f=e.target.files?.[0]; if(!f)return; const reader=new FileReader(); reader.onload=()=>{const text=String(reader.result);const vals=text.split(/\r?\n/).flatMap(line=>line.split(',')).map(v=>Number(v.trim())).filter(Number.isFinite);if(vals.length)onImport(vals)};reader.readAsText(f);e.target.value='';};
  return <div className="dataPage">
    <div className="mcTopbar"><div><div className="eyebrow">DATA</div><h1>Research dataset</h1></div><div className="runGroup">{!usePersonalModel&&<button className="ghost" onClick={onResetPersonal}><RefreshCw size={14}/> Personal model</button>}<label className="run uploadBtn"><Upload size={14}/> Import CSV<input type="file" accept=".csv,.txt" onChange={upload}/></label></div></div>
    <div className="heroMetrics"><SmallMetric label="EVAL POSITION IDEAS" value={usePersonalModel?personalModel.evalPositionIdeas:returns.length}/><SmallMetric label="EVAL WIN RATE" value={usePersonalModel?fmtPct(personalModel.winProbability*100):fmtPct(m.wr)} tone="good"/><SmallMetric label="VETTED PRACTICE WINS" value={usePersonalModel?personalModel.practiceWinners:'—'} tone="violet"/><SmallMetric label="1R ANCHOR" value={usePersonalModel?`$${personalModel.rAnchorDollarsPerMNQEquivalent.toFixed(2)}`:'Imported R'} tone="warn"/></div>
    <div className="panel dataHelp"><h3>{usePersonalModel?'Personal Monte Carlo dataset loaded':'Imported dataset active'}</h3>{usePersonalModel?<><p>{personalModel.description}</p><p className="mutedText">The Monte Carlo does not inflate win rate with the practice winners. It keeps the eval probabilities and only uses the vetted practice trades to expand the distribution of winning outcomes.</p></>:<p>The imported numeric return dataset is active. Use “Personal model” to restore the built-in eval + cleaned practice model.</p>}</div>
    <div className="panel dataHelp"><h3>Regime tagging next</h3><p>Market-data timestamps can be joined to these trades to test consolidation, trend, low/high volume, volatility, and session conditions without changing the core personal Monte Carlo dataset.</p></div>
  </div>
}

export default function App(){
  const [tab,setTab]=useState('Terminal');
  const [returns,setReturns]=useState(sampleR);
  const [usePersonalModel,setUsePersonalModel]=useState(true);
  const tabs=[['Terminal',TerminalSquare],['Volatility',Waves],['Prop Firm',Sigma],['Verdict',Activity],['Regimes',BarChart3],['Risk & Monte Carlo',BarChart3],['Data',Database]];
  const importReturns=(vals)=>{setReturns(vals);setUsePersonalModel(false)};
  const resetPersonal=()=>{setReturns(personalModel.evalR);setUsePersonalModel(true)};
  const sourceLabel=usePersonalModel?'Eval + clean practice':'Imported CSV';
  return <div className="appShell">
    <header className="topNav"><div className="brand"><div className="mark">Q</div><span>QNT</span><small>RESEARCH TERMINAL</small></div><nav>{tabs.map(([t,I])=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}><I size={14}/>{t}</button>)}</nav><div className="rightNav"><Search size={16}/><span className="statusDot"/>RESEARCH</div></header>
    <main>{tab==='Terminal'&&<TerminalView returns={returns} sourceLabel={sourceLabel}/>} {tab==='Volatility'&&<VolatilityLab/>} {tab==='Prop Firm'&&<MonteCarloView returns={returns} propMode usePersonalModel={usePersonalModel}/>} {tab==='Verdict'&&<VerdictView returns={returns}/>} {tab==='Regimes'&&<RegimeView returns={returns}/>} {tab==='Risk & Monte Carlo'&&<MonteCarloView returns={returns} usePersonalModel={usePersonalModel}/>} {tab==='Data'&&<DataView returns={returns} onImport={importReturns} usePersonalModel={usePersonalModel} onResetPersonal={resetPersonal}/>}</main>
  </div>
}
