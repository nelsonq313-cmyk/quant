import React, { useState } from 'react';
import { BookOpen, FolderKanban, MessageSquareText, Plus, Search, Star, Clock3, Database, Sparkles } from 'lucide-react';
import App from './App.jsx';

const projects = [
  {name:'NQ edge research', desc:'Eval + cleaned practice study, Monte Carlo, regimes and risk.', meta:'Personal dataset • active'},
  {name:'Volatility surface lab', desc:'Delayed options-chain research and implied-volatility surface.', meta:'Market Data adapter • delayed'},
  {name:'Prop challenge study', desc:'Boundary solver, pass probability and payout-path research.', meta:'Monte Carlo • personal model'},
  {name:'Market regime map', desc:'Trend, consolidation, volume and volatility classification workspace.', meta:'Next research layer'},
];

const library = [
  {title:'Volatility term structure', tag:'VOLATILITY', text:'Compare realized and implied volatility across horizons to see whether risk is front- or back-loaded.'},
  {title:'Directional pressure map', tag:'MICROSTRUCTURE', text:'Separate persistent directional acceptance from rejection and mean-reversion behavior.'},
  {title:'Trend vs consolidation', tag:'REGIMES', text:'Score directional persistence, compression and chop so strategy performance can be segmented by environment.'},
  {title:'Prop boundary simulator', tag:'RISK', text:'Run thousands of resampled paths against a target and loss floor using your personal trade distribution.'},
];

function ProjectsView({openWorkspace}){
  return <div className="qpsPage">
    <div className="qpsPageHead"><div><span>RESEARCH WORKSPACE</span><h1>Projects</h1><p>Open a research project or start a new study.</p></div><button className="qpsPrimary" onClick={openWorkspace}><Plus size={14}/> New project</button></div>
    <div className="qpsProjectGrid">{projects.map((p,i)=><button className="qpsProjectCard" key={p.name} onClick={openWorkspace}>
      <div className="qpsProjectIcon"><FolderKanban size={17}/></div><div className="qpsProjectText"><b>{p.name}</b><p>{p.desc}</p><small><Clock3 size={11}/>{p.meta}</small></div><Star size={14} className={i===0?'starred':''}/>
    </button>)}</div>
    <section className="qpsRecent"><div className="qpsSectionTitle">RECENT RESEARCH</div><div className="qpsRecentRow"><Database size={14}/><span>personal_trade_model.qnt</span><small>Eval + vetted practice winners</small><b>Ready</b></div><div className="qpsRecentRow"><Sparkles size={14}/><span>qqq_iv_surface.qnt</span><small>Delayed options adapter</small><b>Ready</b></div></section>
  </div>
}

function LibraryView({openWorkspace}){
  return <div className="qpsPage"><div className="qpsPageHead"><div><span>RESEARCH LIBRARY</span><h1>Clone-ready studies</h1><p>Reusable research templates for market structure, volatility and risk.</p></div></div><div className="qpsLibraryGrid">{library.map(x=><article className="qpsLibraryCard" key={x.title}><div className="qpsLibTop"><small>{x.tag}</small><BookOpen size={15}/></div><h3>{x.title}</h3><p>{x.text}</p><button onClick={openWorkspace}>Open in workspace</button></article>)}</div></div>
}

export default function ProductShell(){
  const [section,setSection]=useState('Copilot');
  const openWorkspace=()=>setSection('Copilot');
  return <div className="productShell">
    <header className="qpsTopbar">
      <div className="qpsBrand"><div>Q</div><b>QNT</b></div>
      <nav>
        <button className={section==='Projects'?'active':''} onClick={()=>setSection('Projects')}><FolderKanban size={14}/> Projects</button>
        <button className={section==='Copilot'?'active':''} onClick={()=>setSection('Copilot')}><MessageSquareText size={14}/> QNT Copilot</button>
        <button className={section==='Library'?'active':''} onClick={()=>setSection('Library')}><BookOpen size={14}/> Library</button>
      </nav>
      <div className="qpsActions"><Search size={15}/><span className="qpsLive"/> PERSONAL RESEARCH</div>
    </header>
    {section==='Projects'&&<ProjectsView openWorkspace={openWorkspace}/>} 
    {section==='Copilot'&&<App/>}
    {section==='Library'&&<LibraryView openWorkspace={openWorkspace}/>} 
  </div>
}
