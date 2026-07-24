import React, { useMemo, useState } from 'react';
import {
  Activity, BarChart3, Braces, Database, FileCode2, Folder, MessageSquareText,
  Play, Plus, Search, Settings2, Sigma, Upload, Waves,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import VolatilityLab from './VolatilityLab';
import { personalModel } from './personalDataset';

const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))};
const fmtPct=n=>`${Number(n).toFixed(1)}%`;

const initialFiles={
  'nq_edge_study.py':`# QNT personal edge research\n# Draft research code only: no Python execution runtime is attached here.\n\nfrom qnt import trades, research\n\ndata = trades.load("personal_model")\nreport = research.validate(\n    data,\n    metrics=["expectancy", "drawdown", "payoff"],\n    split_by=["session", "trend", "volatility"],\n)\n\nreport.render()`,
  'monte_carlo.py':`from qnt import montecarlo\n\nmodel = montecarlo.personal(\n    win_probability=${personalModel.winProbability.toFixed(6)},\n    loss_probability=${personalModel.lossProbability.toFixed(6)},\n    breakeven_probability=${personalModel.breakevenProbability.toFixed(6)},\n)\n\n# QNT's live Monte Carlo screen applies posterior sample uncertainty\n# and conservative payoff calibration by default.\nmodel.run(paths=4000, horizon=109)`,
  'regime_map.ipynb':`# Regime research\n# No measured regime statistics are available yet.\n# First join each trade timestamp to real NQ/MNQ market context, then compare:\n# session / time of day / direction\n# trend / consolidation\n# realized volatility / volume\n# day of week / event context when verified`,
  'trade_log.csv':`source,status,count\neval,curated position ideas,${personalModel.evalPositionIdeas}\neval,winning ideas,${personalModel.evalWins}\neval,losing ideas,${personalModel.evalLosses}\neval,breakeven ideas,${personalModel.evalBreakevens}\npractice,vetted winner payoff library,${personalModel.practiceWinners}`,
  'notes.md':`# Research notes\n\n- July 22 winners that matched the normal setup sample are included.\n- Selected tilt/mechanical/very-short losses are excluded from the curated baseline.\n- Practice winners affect payoff shape, not the eval probability counts.\n- Current normalized R is not stop-defined true R.\n- Regime statistics remain unavailable until real futures context is joined.`,
};

function Stat({label,value,sub,tone=''}){return <div className="qpStat"><span>{label}</span><b className={tone}>{value}</b>{sub&&<small>{sub}</small>}</div>}

function researchSnapshot(){
  const r=personalModel.evalR,wins=r.filter(x=>x>0),losses=r.filter(x=>x<0);
  const pf=Math.abs(wins.reduce((s,v)=>s+v,0)/(losses.reduce((s,v)=>s+v,0)||-1)),ev=mean(r),tradeSharpe=sd(r)?mean(r)/sd(r):0;
  return {pf,ev,tradeSharpe};
}

function extractCode(text){
  const match=String(text||'').match(/<qnt_code>([\s\S]*?)<\/qnt_code>/i);
  if(!match)return {display:text,code:null};
  return {display:String(text).replace(match[0],'').trim(),code:match[1].replace(/^\n|\n$/g,'')};
}

function Workspace(){
  const [activeFile,setActiveFile]=useState('nq_edge_study.py'),[files,setFiles]=useState(initialFiles),[prompt,setPrompt]=useState('');
  const [messages,setMessages]=useState([{role:'assistant',text:'Personal model loaded. Ask me to analyze the dataset, design a study, explain a result, or propose an editor change.'}]);
  const [loading,setLoading]=useState(false),[proposal,setProposal]=useState(null),[runState,setRunState]=useState({status:'ready',message:'Draft workspace · no Python runtime attached'});
  const stats=useMemo(researchSnapshot,[]),equity=useMemo(()=>{let x=100000;return personalModel.evalR.map((r,i)=>{x+=r*500;return {i:i+1,equity:x}})},[]);

  const setCode=value=>setFiles(prev=>({...prev,[activeFile]:value}));
  const addFile=()=>{let i=1,name=`scratch_${i}.py`;while(files[name]){i+=1;name=`scratch_${i}.py`}setFiles(prev=>({...prev,[name]:'# New research draft\n'}));setActiveFile(name)};
  const stageActive=()=>{setRunState({status:'running',message:'Validating research draft…'});window.setTimeout(()=>setRunState({status:'done',message:'Draft staged · execution requires a connected runtime'}),250)};

  const send=async()=>{
    const text=prompt.trim();if(!text||loading)return;
    const prior=messages;setMessages([...prior,{role:'user',text}]);setPrompt('');setProposal(null);setLoading(true);
    try{
      const researchContext=[
        `Curated eval ideas: ${personalModel.evalPositionIdeas}.`,
        `Observed eval probabilities: win ${(personalModel.winProbability*100).toFixed(1)}%, loss ${(personalModel.lossProbability*100).toFixed(1)}%, breakeven ${(personalModel.breakevenProbability*100).toFixed(1)}%.`,
        `Payoff library: ${personalModel.evalWins} eval winners + ${personalModel.practiceWinners} vetted practice winners; loss library: ${personalModel.evalLosses} remaining eval losses.`,
        personalModel.curationNote,
        'Current normalized payoff units are not true stop-defined R. Conservative calibration is preferred for long simulations.',
        'Regime results are unavailable until real futures context is joined to trade timestamps.',
      ].join('\n');
      const res=await fetch('/api/copilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history:prior,activeFile,code:files[activeFile],researchContext})});
      const data=await res.json();if(!res.ok)throw new Error(data.error||'Copilot request failed');
      const parsed=extractCode(data.text);setMessages(prev=>[...prev,{role:'assistant',text:parsed.display||'I prepared an editor update.'}]);if(parsed.code)setProposal({file:activeFile,code:parsed.code});
    }catch(error){setMessages(prev=>[...prev,{role:'assistant',text:`Copilot error: ${error.message}`}])}finally{setLoading(false)}
  };

  const applyProposal=()=>{if(!proposal)return;setFiles(prev=>({...prev,[proposal.file]:proposal.code}));setActiveFile(proposal.file);setMessages(prev=>[...prev,{role:'assistant',text:`Applied the proposed replacement to ${proposal.file}.`}]);setProposal(null)};

  return <div className="qpWorkspace">
    <aside className="qpFiles"><div className="qpPaneHead"><span>EXPLORER</span><button onClick={addFile} title="New file"><Plus size={13}/></button></div><div className="qpProjectName"><Folder size={13}/> NQ edge research</div><div className="qpFileList">{Object.keys(files).map(name=><button key={name} className={activeFile===name?'active':''} onClick={()=>setActiveFile(name)}><FileCode2 size={12}/><span>{name}</span><small>{name.split('.').pop()}</small></button>)}</div><div className="qpDataBlock"><div><Database size={12}/> DATA SOURCES</div><p><b>Personal trade model</b><span>connected</span></p><p><b>Market Data</b><span>delayed options</span></p><p><b>OpenAI Copilot</b><span>server-side</span></p></div></aside>
    <section className="qpEditor"><div className="qpEditorTabs"><div className="active"><FileCode2 size={12}/>{activeFile}<span>×</span></div><button onClick={addFile}><Plus size={12}/></button></div><div className="qpEditorBar"><span>personal / NQ edge research</span><div><small className={`qpRunState ${runState.status}`}>{runState.message}</small><button onClick={stageActive}><Play size={12}/> Stage</button></div></div><textarea className="qpCode qpCodeEditor" value={files[activeFile]} onChange={e=>setCode(e.target.value)} spellCheck="false"/><div className="qpNotebookOutput"><div className="qpOutputHead"><span>OUTPUT</span><b>personal_model.summary()</b><small>curated research snapshot</small></div><div className="qpOutputStats"><Stat label="OBSERVED EVAL WIN" value={fmtPct(personalModel.winProbability*100)} tone="good"/><Stat label="EXPECTANCY*" value={`${stats.ev.toFixed(2)}R`} sub="raw normalized eval scale"/><Stat label="PROFIT FACTOR*" value={stats.pf.toFixed(2)} sub="raw normalized eval scale"/><Stat label="TRADE SHARPE*" value={stats.tradeSharpe.toFixed(2)} sub="not annualized"/></div><div className="qpOutputChart"><ResponsiveContainer width="100%" height={190}><AreaChart data={equity}><defs><linearGradient id="qpeq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7a8190" stopOpacity=".24"/><stop offset="100%" stopColor="#7a8190" stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="#171a1e" vertical={false}/><XAxis dataKey="i" stroke="#4d5259" tick={{fontSize:8}}/><YAxis stroke="#4d5259" tick={{fontSize:8}} tickFormatter={v=>`$${Math.round(v/1000)}k`}/><Tooltip contentStyle={{background:'#080a0c',border:'1px solid #2b3036',fontSize:9}}/><Area type="monotone" dataKey="equity" stroke="#b6bbc3" fill="url(#qpeq)" strokeWidth={1}/></AreaChart></ResponsiveContainer></div></div><div className="qpStatus"><span>QNT draft workspace</span><span>editor writable</span><span>{activeFile}</span></div></section>
    <aside className="qpCopilot"><div className="qpCopilotHead"><div><MessageSquareText size={14}/><b>QNT Copilot</b></div><button onClick={()=>{setMessages([]);setProposal(null)}}><Plus size={12}/> New chat</button></div><div className="qpChat">{messages.map((m,i)=>m.role==='user'?<div className="qpUserBubble" key={i}>{m.text}</div>:<div className="qpAgentBlock" key={i}><div><span className="qpAgentDot"/><b>QNT</b><small>OpenAI</small></div><p>{m.text}</p></div>)}{loading&&<div className="qpToolRow"><Search size={12}/><span>Reasoning over the active file and research context</span><b>working</b></div>}{proposal&&<div className="qpProposal"><div><FileCode2 size={12}/><b>Editor update proposed</b><span>{proposal.file}</span></div><button onClick={applyProposal}>Apply to editor</button></div>}</div><div className="qpComposer"><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Ask QNT to analyze, explain, or propose a research edit…"/><div><span>OpenAI API · active-file context</span><button onClick={send} disabled={loading}>{loading?'Thinking…':'Send ↗'}</button></div></div></aside>
  </div>;
}

function Verdict(){
  const sampleQuality=Math.min(1,personalModel.evalPositionIdeas/60),payoffWins=personalModel.winR.map(r=>1.1*Math.log1p(Math.max(0,r))),avgWin=mean(payoffWins),avgLoss=Math.abs(mean(personalModel.lossR)),expectancy=personalModel.winProbability*avgWin-personalModel.lossProbability*avgLoss;
  return <div className="qpToolPage"><div className="qpToolTitle"><span>STRATEGY VALIDATION</span><h1>Verdict</h1><p>Transparent evidence review. QNT no longer assigns a fake magic grade.</p></div><div className="qpVerdictHero"><div className="qpGrade">—</div><div><b>Promising research sample, still uncertain</b><p>The curated model has positive modeled expectancy, but the probability estimate is based on {personalModel.evalPositionIdeas} eval ideas and the payoff unit is not true stop-defined R.</p></div></div><div className="qpDataMetrics"><Stat label="MODELED EXPECTANCY*" value={`${expectancy>=0?'+':''}${expectancy.toFixed(2)}R`} tone={expectancy>=0?'good':'bad'}/><Stat label="OBSERVED WIN RATE" value={fmtPct(personalModel.winProbability*100)}/><Stat label="AVG MODELED WIN*" value={`+${avgWin.toFixed(2)}R`}/><Stat label="AVG MODELED LOSS*" value={`-${avgLoss.toFixed(2)}R`}/><Stat label="SAMPLE COMPLETENESS" value={fmtPct(sampleQuality*100)} sub="60-idea reference, not a confidence claim"/></div><div className="qpFindings"><article><span className="good">●</span><div><b>Payoff asymmetry is present in the curated library</b><p>Conservative transformed winners are larger than the remaining average loss.</p></div></article><article><span className="warn">●</span><div><b>Probability uncertainty remains material</b><p>Monte Carlo varies win/loss/breakeven probabilities around the observed eval counts instead of assuming 57.7% is exact.</p></div></article><article><span className="bad">●</span><div><b>True stop-defined R is unavailable</b><p>Do not interpret the normalized payoff units as exact planned risk multiples.</p></div></article></div></div>;
}

function Regimes(){
  const steps=[['1','Join trades to futures bars','Match each real entry timestamp to NQ/MNQ market data.'],['2','Create measured features','Session, time of day, trend, realized volatility, volume and direction.'],['3','Require minimum sample','Show sample count and uncertainty before any regime comparison.'],['4','Publish only measured results','No regime WR/EV until the join is complete.']];
  return <div className="qpToolPage"><div className="qpToolTitle"><span>MARKET REGIMES</span><h1>Regime map</h1><p>No measured market-regime dataset is connected yet, so QNT intentionally shows no fake performance numbers.</p></div><div className="qpRegimeEmpty"><BarChart3 size={20}/><div><b>Awaiting real futures context</b><p>Trade timestamps exist, but trend/volatility/volume features have not been joined from a verified historical futures source.</p></div></div><div className="qpFindings">{steps.map(([n,title,text])=><article key={n}><span className="violet">{n}</span><div><b>{title}</b><p>{text}</p></div></article>)}</div></div>;
}

function DataPage(){
  const [importMeta,setImportMeta]=useState(null);
  const importFile=event=>{const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{const text=String(reader.result||''),lines=text.split(/\r?\n/).filter(Boolean),headers=(lines[0]||'').split(',').map(x=>x.trim());setImportMeta({name:file.name,rows:Math.max(0,lines.length-1),headers:headers.filter(Boolean).slice(0,12)})};reader.readAsText(file)};
  return <div className="qpToolPage"><div className="qpToolTitle"><span>DATA</span><h1>Research dataset</h1><p>Current model provenance and a real local CSV preview. Imported files are not automatically added to the statistical model.</p></div><div className="qpDataMetrics"><Stat label="EVAL IDEAS" value={personalModel.evalPositionIdeas}/><Stat label="EVAL WINS" value={personalModel.evalWins}/><Stat label="EVAL LOSSES" value={personalModel.evalLosses}/><Stat label="BREAKEVENS" value={personalModel.evalBreakevens}/><Stat label="VETTED PRACTICE WINS" value={personalModel.practiceWinners} tone="violet"/></div><div className="qpDataTable"><div><b>Probability model</b><span>{fmtPct(personalModel.winProbability*100)} win · {fmtPct(personalModel.lossProbability*100)} loss · {fmtPct(personalModel.breakevenProbability*100)} breakeven</span><small>{personalModel.evalPositionIdeas} curated eval ideas</small></div><div><b>Loss library</b><span>{personalModel.evalLosses} outcomes</span><small>remaining eval losses only</small></div><div><b>Winner library</b><span>{personalModel.evalWins+personalModel.practiceWinners} outcomes</span><small>eval + vetted practice payoff library</small></div><div><b>Curation</b><span>user-reviewed baseline</span><small>{personalModel.curationNote}</small></div></div><label className="qpUpload"><Upload size={13}/> Preview another CSV<input type="file" accept=".csv,.txt" onChange={importFile}/></label>{importMeta&&<div className="qpRegimeEmpty"><Database size={18}/><div><b>{importMeta.name}</b><p>{importMeta.rows.toLocaleString()} data rows · fields: {importMeta.headers.join(', ')||'none detected'}</p><small>Preview only — no model mutation occurs until a mapping/import workflow is implemented.</small></div></div>}</div>;
}

export default function App(){
  const [tab,setTab]=useState('Workspace');
  const tabs=[['Workspace',Braces],['Prop Firm',Sigma],['Verdict',Activity],['Regimes',BarChart3],['Risk & Monte Carlo',BarChart3],['Volatility',Waves],['Data',Database]];
  return <div className="appShell qpCore"><header className="topNav qpResearchNav"><nav>{tabs.map(([name,Icon])=><button key={name} className={tab===name?'active':''} onClick={()=>setTab(name)}><Icon size={12}/>{name}</button>)}</nav><div className="rightNav"><span className="statusDot"/> PERSONAL MODEL</div></header><main>{tab==='Workspace'&&<Workspace/>}{tab==='Verdict'&&<Verdict/>}{tab==='Regimes'&&<Regimes/>}{tab==='Volatility'&&<VolatilityLab/>}{tab==='Data'&&<DataPage/>}{(tab==='Prop Firm'||tab==='Risk & Monte Carlo')&&<div className="qpLoadingTool"><Settings2 size={15}/><span>Opening simulation workspace…</span></div>}</main></div>;
}
