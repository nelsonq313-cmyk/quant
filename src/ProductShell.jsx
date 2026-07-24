import React, { useMemo, useState } from 'react';
import {
  Activity,
  BookOpen,
  ChevronRight,
  Clock3,
  Database,
  FileCode2,
  Folder,
  FolderKanban,
  LayoutGrid,
  MessageSquareText,
  Plus,
  Search,
  Sparkles,
  Star,
  WandSparkles,
} from 'lucide-react';
import App from './App.jsx';

const projects = [
  {name:'NQ edge research', desc:'Primary strategy workspace using the serious eval sample and vetted practice winners.', files:4, meta:'Personal model', starred:true},
  {name:'Prop challenge study', desc:'Monte Carlo boundary testing, target probability, drawdown and path timing.', files:3, meta:'Risk research'},
  {name:'Market regime map', desc:'Trend, consolidation, volatility, volume and session segmentation for NQ/MNQ.', files:5, meta:'Regime research'},
  {name:'Volatility surface lab', desc:'Delayed equity-options IV surface, skew and term-structure research.', files:3, meta:'Volatility'},
];

const templates = [
  {title:'Monte Carlo risk lab', tag:'RISK', text:'Resample a strategy through thousands of paths, add a loss floor and goal, then inspect tail behavior.'},
  {title:'Prop challenge simulator', tag:'PROP', text:'Model race-to-boundary probabilities, expected time to target and challenge failure risk.'},
  {title:'Trend vs consolidation', tag:'REGIMES', text:'Split performance by directional persistence, compression and choppy conditions.'},
  {title:'Volume + volatility map', tag:'REGIMES', text:'Compare edge quality under low, normal and high volume or realized-volatility environments.'},
  {title:'Volatility term structure', tag:'VOLATILITY', text:'Inspect ATM IV, skew and term structure across expirations with a surface view.'},
  {title:'Strategy verdict', tag:'RESEARCH', text:'Summarize expectancy, payoff asymmetry, robustness, drawdown and sample adequacy in one report.'},
];

const recents = [
  ['personal_trade_model.qnt','NQ edge research','Eval + vetted practice winners','Ready'],
  ['monte_carlo.qnt','Prop challenge study','Personal calibration','Ready'],
  ['regime_map.qnt','Market regime map','Awaiting futures features','Draft'],
  ['qqq_iv_surface.qnt','Volatility surface lab','Delayed options adapter','Ready'],
];

function LeftRail({section,setSection}){
  const items=[
    ['Projects',LayoutGrid],
    ['Copilot',MessageSquareText],
    ['Library',BookOpen],
  ];
  return <aside className="qpsRail">
    <div className="qpsRailBrand">Q</div>
    <div className="qpsRailNav">{items.map(([name,Icon])=><button key={name} className={section===name?'active':''} onClick={()=>setSection(name)} title={name}><Icon size={16}/><span>{name}</span></button>)}</div>
    <div className="qpsRailBottom"><button title="Data"><Database size={16}/></button><div className="qpsAvatar">N</div></div>
  </aside>
}

function ProjectsView({openWorkspace}){
  const [query,setQuery]=useState('');
  const filtered=useMemo(()=>projects.filter(p=>`${p.name} ${p.desc}`.toLowerCase().includes(query.toLowerCase())),[query]);
  return <div className="qpsPage qpsProjectsPage">
    <div className="qpsPageHead">
      <div><span>WORKSPACE</span><h1>Projects</h1><p>Research, simulate and compare your strategy from one place.</p></div>
      <button className="qpsPrimary" onClick={openWorkspace}><Plus size={14}/> New project</button>
    </div>

    <div className="qpsProjectToolbar"><div className="qpsSearch"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects"/></div><div className="qpsToolbarMeta">{projects.length} projects · personal research</div></div>

    <div className="qpsProjectGrid">{filtered.map((p,i)=><button className="qpsProjectCard" key={p.name} onClick={openWorkspace}>
      <div className="qpsCardTop"><div className="qpsProjectIcon"><FolderKanban size={16}/></div><Star size={13} className={p.starred?'starred':''}/></div>
      <div className="qpsProjectText"><b>{p.name}</b><p>{p.desc}</p></div>
      <div className="qpsCardFoot"><span><FileCode2 size={11}/>{p.files} files</span><span>{p.meta}</span><ChevronRight size={13}/></div>
    </button>)}</div>

    <section className="qpsRecent">
      <div className="qpsSectionTitle"><span>RECENT RESEARCH</span><button onClick={openWorkspace}>Open workspace</button></div>
      {recents.map(([file,project,meta,status])=><button className="qpsRecentRow" key={file} onClick={openWorkspace}><FileCode2 size={13}/><span>{file}</span><small>{project}</small><small>{meta}</small><b className={status==='Draft'?'draft':''}>{status}</b></button>)}
    </section>
  </div>
}

function LibraryView({openWorkspace}){
  const [active,setActive]=useState('ALL');
  const categories=['ALL','RISK','PROP','REGIMES','VOLATILITY','RESEARCH'];
  const visible=templates.filter(x=>active==='ALL'||x.tag===active);
  return <div className="qpsPage">
    <div className="qpsPageHead"><div><span>RESEARCH LIBRARY</span><h1>Research templates</h1><p>Start from a reusable study, then run it against your own data.</p></div></div>
    <div className="qpsLibraryTabs">{categories.map(x=><button key={x} className={active===x?'active':''} onClick={()=>setActive(x)}>{x}</button>)}</div>
    <div className="qpsLibraryGrid">{visible.map(x=><article className="qpsLibraryCard" key={x.title}>
      <div className="qpsLibTop"><small>{x.tag}</small><BookOpen size={14}/></div><h3>{x.title}</h3><p>{x.text}</p>
      <div className="qpsLibFoot"><span><Star size={11}/> QNT research</span><button onClick={openWorkspace}>Clone <ChevronRight size={12}/></button></div>
    </article>)}</div>
  </div>
}

function CopilotShell(){
  return <div className="qpsCopilotShell">
    <div className="qpsWorkspaceStrip"><div><Folder size={13}/> NQ edge research <ChevronRight size={12}/><b>personal_trade_model.qnt</b></div><div><span className="qpsLive"/> personal model loaded</div></div>
    <App/>
  </div>
}

export default function ProductShell(){
  const [section,setSection]=useState('Copilot');
  const openWorkspace=()=>setSection('Copilot');
  return <div className="productShell">
    <LeftRail section={section} setSection={setSection}/>
    <div className="qpsMain">
      <header className="qpsTopbar">
        <div className="qpsTopTitle"><WandSparkles size={14}/><span>{section==='Copilot'?'QNT Copilot':section}</span></div>
        <div className="qpsTopSearch"><Search size={13}/><span>Search research, projects, or commands</span><kbd>⌘ K</kbd></div>
        <div className="qpsActions"><Activity size={14}/><span className="qpsLive"/> RESEARCH ONLINE</div>
      </header>
      {section==='Projects'&&<ProjectsView openWorkspace={openWorkspace}/>} 
      {section==='Copilot'&&<CopilotShell/>}
      {section==='Library'&&<LibraryView openWorkspace={openWorkspace}/>} 
    </div>
  </div>
}
