import React, { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Braces,
  ChevronRight,
  Database,
  FileCode2,
  Folder,
  MessageSquareText,
  Play,
  Plus,
  Search,
  Settings2,
  Sigma,
  Upload,
  Waves,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import VolatilityLab from './VolatilityLab';
import { personalModel } from './personalDataset';

const mean=(a)=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const sd=(a)=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))};
const fmtPct=(n)=>`${Number(n).toFixed(1)}%`;
const fmtMoney=(n)=>`${n<0?'-':''}$${Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:0})}`;

function Stat({label,value,sub,tone=''}){
  return <div className="qpStat"><span>{label}</span><b className={tone}>{value}</b>{sub&&<small>{sub}</small>}</div>;
}

function Workspace(){
  const [file,setFile]=useState('nq_edge_study.py');
  const [prompt,setPrompt]=useState('');
  const equity=useMemo(()=>{
    let x=100000;
    return personalModel.evalR.map((r,i)=>{x+=r*500;return {i:i+1,equity:x}});
  },[]);
  const files=[
    ['nq_edge_study.py','py'],
    ['monte_carlo.py','py'],
    ['regime_map.ipynb','nb'],
    ['trade_log.csv','csv'],
    ['notes.md','md'],
  ];
  const codeByFile={
    'nq_edge_study.py':`# NQ personal edge study\nfrom qnt import trades, research\n\ndata = trades.load("personal_model")\nreport = research.validate(\n    data,\n    metrics=["expectancy", "drawdown", "payoff"],\n    split_by=["session", "trend", "volatility"],\n)\n\nreport.render()`,
    'monte_carlo.py':`from qnt import montecarlo\n\nmodel = montecarlo.personal(\n    win_probability=0.3929,\n    loss_probability=0.5357,\n    breakeven_probability=0.0714,\n)\n\nmodel.run(paths=4000, horizon=109)`,
    'regime_map.ipynb':`# Regime research\n# Join each trade to NQ market context, then compare:\n# trend / consolidation\n# low / normal / high volume\n# low / high realized volatility\n# session and direction`,
    'trade_log.csv':`source,status,count\neval,serious ideas,28\npractice,vetted winners,28\neval losses,loss library,15`,
    'notes.md':`# Research notes\n\n- 7/22 tilt day excluded from baseline\n- practice winners do not increase win probability\n- regime confidence should be labeled when sample size is small`,
  };
  const m=personalModel.evalR;
  const positive=m.filter(x=>x>0), negative=m.filter(x=>x<0);
  const pf=Math.abs(positive.reduce((s,v)=>s+v,0)/(negative.reduce((s,v)=>s+v,0)||-1));
  const ev=mean(m);
  const sharpe=sd(m)?mean(m)/sd(m)*Math.sqrt(252):0;

  const send=()=>{ if(prompt.trim()) setPrompt(''); };

  return <div className="qpWorkspace">
    <aside className="qpFiles">
      <div className="qpPaneHead"><span>EXPLORER</span><Plus size={13}/></div>
      <div className="qpProjectName"><Folder size={13}/> NQ edge research</div>
      <div className="qpFileList">{files.map(([name,type])=><button key={name} className={file===name?'active':''} onClick={()=>setFile(name)}><FileCode2 size={12}/><span>{name}</span><small>{type}</small></button>)}</div>
      <div className="qpDataBlock"><div><Database size={12}/> DATA SOURCES</div><p><b>Personal trade model</b><span>connected</span></p><p><b>Market Data</b><span>delayed</span></p><p><b>OpenAI</b><span>pending route</span></p></div>
    </aside>

    <section className="qpEditor">
      <div className="qpEditorTabs"><div className="active"><FileCode2 size={12}/>{file}<span>×</span></div><button><Plus size={12}/></button></div>
      <div className="qpEditorBar"><span>personal / NQ edge research</span><button><Play size={12}/> Run</button></div>
      <pre className="qpCode">{codeByFile[file]}</pre>
      <div className="qpNotebookOutput">
        <div className="qpOutputHead"><span>OUTPUT</span><b>research.validate()</b><small>completed</small></div>
        <div className="qpOutputStats">
          <Stat label="EVAL WIN RATE" value={fmtPct(personalModel.winProbability*100)} tone="good"/>
          <Stat label="EXPECTANCY*" value={`${ev.toFixed(2)}R`} sub="raw export scale"/>
          <Stat label="PROFIT FACTOR*" value={pf.toFixed(2)} sub="raw export scale"/>
          <Stat label="SHARPE*" value={sharpe.toFixed(2)} sub="raw export scale"/>
        </div>
        <div className="qpOutputChart"><ResponsiveContainer width="100%" height={190}><AreaChart data={equity}><defs><linearGradient id="qpeq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7a8190" stopOpacity=".24"/><stop offset="100%" stopColor="#7a8190" stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="#171a1e" vertical={false}/><XAxis dataKey="i" stroke="#4d5259" tick={{fontSize:8}}/><YAxis stroke="#4d5259" tick={{fontSize:8}} tickFormatter={v=>`$${Math.round(v/1000)}k`}/><Tooltip contentStyle={{background:'#080a0c',border:'1px solid #2b3036',fontSize:9}}/><Area type="monotone" dataKey="equity" stroke="#b6bbc3" fill="url(#qpeq)" strokeWidth={1}/></AreaChart></ResponsiveContainer></div>
      </div>
      <div className="qpStatus"><span>QNT runtime</span><span>personal model loaded</span><span>Ln 11, Col 1</span></div>
    </section>

    <aside className="qpCopilot">
      <div className="qpCopilotHead"><div><MessageSquareText size={14}/><b>QNT Copilot</b></div><button><Plus size={12}/> New chat</button></div>
      <div className="qpChat">
        <div className="qpUserBubble">Analyze my NQ dataset and tell me where the edge is strongest.</div>
        <div className="qpAgentBlock"><div><span className="qpAgentDot"/><b>QNT</b><small>research agent</small></div><p>I’ll keep win probability anchored to the serious eval sample, use eval losses for the loss distribution, and treat the vetted practice trades only as extra winner-shape evidence.</p></div>
        <div className="qpToolRow"><Search size={12}/><span>Inspecting trade dataset</span><b>28 eval ideas</b></div>
        <div className="qpToolRow"><Braces size={12}/><span>Running validation study</span><b>done</b></div>
        <div className="qpAgentBlock"><div><span className="qpAgentDot"/><b>QNT</b></div><p>Your next useful layer is regime tagging. The overall sample is usable, but trend × volume × volatility subgroups need confidence labels because some buckets will be small.</p></div>
      </div>
      <div className="qpComposer"><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Ask QNT to build, test, edit, or explain…"/><div><span>personal model · NQ</span><button onClick={send}>Send ↗</button></div></div>
    </aside>
  </div>;
}

function Verdict(){
  const scores=[['Edge',78],['Robustness',64],['Risk',71],['Sample',56]];
  return <div className="qpToolPage"><div className="qpToolTitle"><span>STRATEGY VALIDATION</span><h1>Verdict</h1><p>One-page gut check on edge quality, robustness, risk, and sample confidence.</p></div><div className="qpVerdictHero"><div className="qpGrade">B</div><div><b>Promising, not proven</b><p>Payoff asymmetry is carrying the edge. Sample size is enough for overall research, but not every regime bucket yet.</p></div></div><div className="qpScoreGrid">{scores.map(([n,v])=><div key={n}><span>{n}<b>{v}</b></span><div><i style={{width:`${v}%`}}/></div></div>)}</div><div className="qpFindings"><article><span className="good">●</span><div><b>Winner asymmetry is meaningful</b><p>Large winners matter more than raw win rate.</p></div></article><article><span className="warn">●</span><div><b>Regime sample confidence is still thin</b><p>Use confidence labels instead of treating small buckets as proven.</p></div></article><article><span className="bad">●</span><div><b>Raw R export is not true stop-based R</b><p>Keep conservative payoff calibration until planned stop distance is available.</p></div></article></div></div>;
}

function Regimes(){
  const rows=[['Trend + normal vol',1.42,9],['Trend + high vol',1.08,6],['Consolidation + normal vol',0.31,7],['Consolidation + high vol',-0.18,6]];
  return <div className="qpToolPage"><div className="qpToolTitle"><span>MARKET REGIMES</span><h1>Regime map</h1><p>Segment the strategy by trend state and volatility, then add volume and session once futures market context is joined.</p></div><div className="qpRegimeGrid">{rows.map(([n,ev,count],i)=><article key={n}><small>{n}</small><b className={ev>=0?'good':'bad'}>{ev>=0?'+':''}{ev.toFixed(2)}R</b><span>{count} trades · {count<10?'low confidence':'usable'}</span><div className={`qpRegimeHeat h${i}`}/></article>)}</div><div className="qpRegimeMatrix"><div className="qpMatrixHead">REGIME TRANSITION VIEW</div>{['Trend','Chop','Low vol','High vol'].map((r,ri)=>['Trend','Chop','Low vol','High vol'].map((c,ci)=><div key={`${r}-${c}`}><small>{r} → {c}</small><b>{18+((ri*13+ci*9)%51)}%</b></div>))}</div></div>;
}

function DataPage(){
  return <div className="qpToolPage"><div className="qpToolTitle"><span>DATA</span><h1>Research dataset</h1><p>Your current personal model separates probability from payoff shape so filtered practice winners do not inflate the win rate.</p></div><div className="qpDataMetrics"><Stat label="EVAL IDEAS" value={personalModel.evalPositionIdeas}/><Stat label="EVAL WINS" value={personalModel.evalWins}/><Stat label="EVAL LOSSES" value={personalModel.evalLosses}/><Stat label="BREAKEVENS" value={personalModel.evalBreakevens}/><Stat label="VETTED PRACTICE WINS" value={personalModel.practiceWinners} tone="violet"/></div><div className="qpDataTable"><div><b>Probability model</b><span>39.3% win · 53.6% loss · 7.1% breakeven</span><small>serious eval only</small></div><div><b>Loss library</b><span>{personalModel.evalLosses} outcomes</span><small>eval losses only</small></div><div><b>Winner library</b><span>{personalModel.evalWins+personalModel.practiceWinners} outcomes</span><small>eval + vetted practice</small></div><div><b>Stress sample</b><span>7/22 tilt day</span><small>excluded from baseline</small></div></div><label className="qpUpload"><Upload size={13}/> Import another return dataset<input type="file" accept=".csv,.txt"/></label></div>;
}

export default function App(){
  const [tab,setTab]=useState('Workspace');
  const tabs=[
    ['Workspace',Braces],
    ['Prop Firm',Sigma],
    ['Verdict',Activity],
    ['Regimes',BarChart3],
    ['Risk & Monte Carlo',BarChart3],
    ['Volatility',Waves],
    ['Data',Database],
  ];
  return <div className="appShell qpCore">
    <header className="topNav qpResearchNav"><nav>{tabs.map(([name,Icon])=><button key={name} className={tab===name?'active':''} onClick={()=>setTab(name)}><Icon size={12}/>{name}</button>)}</nav><div className="rightNav"><span className="statusDot"/> PERSONAL MODEL</div></header>
    <main>
      {tab==='Workspace'&&<Workspace/>}
      {tab==='Verdict'&&<Verdict/>}
      {tab==='Regimes'&&<Regimes/>}
      {tab==='Volatility'&&<VolatilityLab/>}
      {tab==='Data'&&<DataPage/>}
      {(tab==='Prop Firm'||tab==='Risk & Monte Carlo')&&<div className="qpLoadingTool"><Settings2 size={15}/><span>Opening simulation workspace…</span></div>}
    </main>
  </div>;
}
