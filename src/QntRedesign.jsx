import React,{useEffect,useMemo,useState}from'react';
import{BookOpen,ChevronRight,Command,FlaskConical,Search}from'lucide-react';
import App from'./App.jsx';
import JournalWorkspace from'./JournalWorkspace.jsx';

const COMMANDS=[
  ['WORK','Workspace','Research IDE, Python, artifacts and QNT agent'],
  ['VALIDATE','Validation','Holdouts, bootstrap, stability and robustness'],
  ['VERDICT','Verdict','Strategy evidence review'],
  ['REGIME','Regimes','Regime research pipeline'],
  ['MC','Monte Carlo','Stopped-path risk simulation'],
  ['PROP','Prop Simulator','Rule-driven challenge simulation'],
  ['VOL','Volatility Lab','Volatility research'],
  ['JOURNAL','Journal','Trade input, recorded trades and refine bot']
];
const researchMap={WORK:'Workspace',VALIDATE:'Validation',VERDICT:'Verdict',REGIME:'Regimes',MC:'Risk & Monte Carlo',PROP:'Prop Firm',VOL:'Volatility'};
const emit=(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail}));

function CommandPalette({open,onClose,run}){
  const[q,setQ]=useState('');
  useEffect(()=>{if(open)setQ('')},[open]);
  const visible=useMemo(()=>{const s=q.trim().toUpperCase();return COMMANDS.filter(x=>!s||`${x[0]} ${x[1]} ${x[2]}`.toUpperCase().includes(s)).slice(0,12)},[q]);
  if(!open)return null;
  return <div className="q4CommandBackdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="q4Command"><div className="q4CommandSearch"><Search size={16}/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')onClose();if(e.key==='Enter'){e.preventDefault();run(q||visible[0]?.[0])}}} placeholder="Workspace, validation, Monte Carlo, journal…"/><kbd>ESC</kbd></div><div className="q4CommandRows">{visible.map(x=><button key={x[0]} onClick={()=>run(x[0])}><kbd>{x[0]}</kbd><div><b>{x[1]}</b><span>{x[2]}</span></div><ChevronRight size={14}/></button>)}</div><div className="q4CommandHint">WORK · VALIDATE · VERDICT · MC · JOURNAL</div></div></div>;
}

export default function QntRedesign(){
  const[section,setSection]=useState('Research'),[commandOpen,setCommandOpen]=useState(false);
  const go=(next,tab)=>{if(section==='Research'&&next!=='Research')emit('qnt:navigate',{type:'research',tab:'Workspace'});setSection(next);if(next==='Research'&&tab)setTimeout(()=>emit('qnt:navigate',{type:'research',tab}),0)};
  const runCommand=raw=>{const fn=String(raw||'').trim().toUpperCase().split(/\s+/)[0];if(!fn)return;if(fn==='JOURNAL')go('Journal');else if(researchMap[fn])go('Research',researchMap[fn]);setCommandOpen(false)};
  useEffect(()=>{const key=e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setCommandOpen(true)}if(e.key==='Escape')setCommandOpen(false)},route=e=>{const d=e.detail||{};if(d.section==='Research')go('Research',d.tab||'Workspace')};window.addEventListener('keydown',key);window.addEventListener('qnt:route',route);return()=>{window.removeEventListener('keydown',key);window.removeEventListener('qnt:route',route)}},[section]);
  const nav=[['Research',FlaskConical],['Journal',BookOpen]];
  return <div className="q4App"><aside className="q4Sidebar"><div className="q4Brand"><span>Q</span><div><b>QNT</b><small>research + journal</small></div></div><nav>{nav.map(([name,Icon])=><button key={name} className={section===name?'active':''} onClick={()=>go(name)}><Icon size={16}/><span>{name}</span></button>)}</nav><div className="q4SideFoot"><button onClick={()=>setCommandOpen(true)}><Command size={15}/><span>Commands</span><kbd>⌘K</kbd></button><div><i/><span>Local workspace</span></div></div></aside>
    <main className="q4Main"><header className="q4Top"><div className="q4Breadcrumb"><b>QNT</b><ChevronRight size={12}/><span>{section}</span></div><button className="q4GlobalSearch" onClick={()=>setCommandOpen(true)}><Search size={14}/><span>Search research tools or open journal…</span><kbd>⌘ K</kbd></button><div className="q4TopStatus"><i/><span>Research online</span></div></header>
      <div className="q4Content">{section==='Research'&&<div className="q4ToolFrame research"><App/></div>}{section==='Journal'&&<JournalWorkspace/>}</div>
    </main><CommandPalette open={commandOpen} onClose={()=>setCommandOpen(false)} run={runCommand}/></div>;
}
