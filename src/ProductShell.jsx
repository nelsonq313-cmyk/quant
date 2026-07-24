import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, BookOpen, ChevronRight, Command, Database, FileCode2, Folder, FolderKanban,
  Gauge, LayoutGrid, MessageSquareText, Plus, Search, Server, Star, WandSparkles,
} from 'lucide-react';
import App from './App.jsx';
import MarketTerminal from './MarketTerminal.jsx';

const projects=[
  {name:'NQ edge research',desc:'Primary strategy workspace using the curated eval sample and vetted practice payoff library.',files:4,meta:'Personal model',starred:true},
  {name:'Prop challenge study',desc:'Rule-driven pass/fail/timeout simulation and path inspection.',files:3,meta:'Risk research'},
  {name:'Market regime map',desc:'Awaiting verified futures context before publishing measured regime statistics.',files:5,meta:'Data pending'},
  {name:'Volatility surface lab',desc:'Delayed equity-options IV surface, skew, Greeks and term-structure research.',files:3,meta:'Options research'},
];

const templates=[
  {title:'Monte Carlo risk lab',tag:'RISK',text:'Run thousands of stopped-account paths, inspect ruin, drawdown, sensitivity and model uncertainty.'},
  {title:'Prop challenge simulator',tag:'PROP',text:'Model pass/fail/timeout outcomes against configurable challenge rules and inspect individual paths.'},
  {title:'Regime join workflow',tag:'REGIMES',text:'Prepare a real timestamp-to-market-data join before computing trend, volatility or session performance.'},
  {title:'Volatility term structure',tag:'VOLATILITY',text:'Inspect IV surface, smile, skew, Greeks, liquidity and term structure from the connected options provider.'},
  {title:'Strategy evidence review',tag:'RESEARCH',text:'Review expectancy, payoff asymmetry, uncertainty and data limitations without a fake magic score.'},
];

const recents=[
  ['personal_trade_model.qnt','NQ edge research','Curated eval model','Ready'],
  ['monte_carlo.qnt','Risk research','Stopped-path engine','Ready'],
  ['regime_map.qnt','Market regime map','Awaiting futures data','Blocked'],
  ['qqq_iv_surface.qnt','Volatility lab','Delayed options adapter','Ready'],
];

const commandDefs=[
  ['MC','Risk & Monte Carlo','Stopped-path Monte Carlo, sensitivity and model audit','research','Risk & Monte Carlo'],
  ['PROP','Prop Firm','Rule-driven prop simulation','research','Prop Firm'],
  ['VERDICT','Verdict','Transparent strategy evidence review','research','Verdict'],
  ['REGIME','Regimes','Market-regime research pipeline','research','Regimes'],
  ['VOL','Volatility','Interactive 3D IV surface and options analytics','research','Volatility'],
  ['DATA','Data','Dataset provenance and import workspace','research','Data'],
  ['MARKET','Market workstation','Quotes, price history, notes and provider health','shell','Market'],
  ['WORK','Research workspace','Editable quant research workspace + Copilot','research','Workspace'],
  ['API','API status','Provider configuration and recent request health','shell','API'],
  ['QQQ','QQQ security','Open QQQ in the market workstation','symbol','QQQ'],
  ['AAPL','AAPL security','Open AAPL in the market workstation','symbol','AAPL'],
  ['SPY','SPY security','Open SPY in the market workstation','symbol','SPY'],
  ['NQ','NQ futures','Open coverage status for direct NQ futures data','symbol','NQ'],
  ['ES','ES futures','Open coverage status for direct ES futures data','symbol','ES'],
  ['NEWS','News terminal','Show news-feed coverage status; never fabricate headlines','capability','NEWS'],
  ['CALENDAR','Economic calendar','Show calendar-feed coverage status; never fabricate events','capability','CALENDAR'],
];

const emitResearch=tab=>window.dispatchEvent(new CustomEvent('qnt:navigate',{detail:{type:'research',tab}}));
const emitMarket=detail=>window.dispatchEvent(new CustomEvent('qnt:market-command',{detail}));

function LeftRail({section,setSection}){
  const items=[['Projects',LayoutGrid],['Copilot',MessageSquareText],['Market',Gauge],['Library',BookOpen],['API',Server]];
  return <aside className="qpsRail"><div className="qpsRailBrand">Q</div><div className="qpsRailNav">{items.map(([name,Icon])=><button key={name} className={section===name?'active':''} onClick={()=>setSection(name)} title={name}><Icon size={16}/><span>{name}</span></button>)}</div><div className="qpsRailBottom"><button title="Research data" onClick={()=>{setSection('Copilot');emitResearch('Data')}}><Database size={16}/></button><div className="qpsAvatar">N</div></div></aside>
}

function ProjectsView({openWorkspace}){
  const [query,setQuery]=useState('');const filtered=useMemo(()=>projects.filter(p=>`${p.name} ${p.desc}`.toLowerCase().includes(query.toLowerCase())),[query]);
  return <div className="qpsPage qpsProjectsPage"><div className="qpsPageHead"><div><span>WORKSPACE</span><h1>Projects</h1><p>Research, simulate, inspect market data and keep assumptions visible.</p></div><button className="qpsPrimary" onClick={openWorkspace}><Plus size={14}/> New research</button></div><div className="qpsProjectToolbar"><div className="qpsSearch"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects"/></div><div className="qpsToolbarMeta">{projects.length} workspaces · local research</div></div><div className="qpsProjectGrid">{filtered.map(p=><button className="qpsProjectCard" key={p.name} onClick={openWorkspace}><div className="qpsCardTop"><div className="qpsProjectIcon"><FolderKanban size={16}/></div><Star size={13} className={p.starred?'starred':''}/></div><div className="qpsProjectText"><b>{p.name}</b><p>{p.desc}</p></div><div className="qpsCardFoot"><span><FileCode2 size={11}/>{p.files} files</span><span>{p.meta}</span><ChevronRight size={13}/></div></button>)}</div><section className="qpsRecent"><div className="qpsSectionTitle"><span>RECENT RESEARCH</span><button onClick={openWorkspace}>Open workspace</button></div>{recents.map(([file,project,meta,status])=><button className="qpsRecentRow" key={file} onClick={openWorkspace}><FileCode2 size={13}/><span>{file}</span><small>{project}</small><small>{meta}</small><b className={status!=='Ready'?'draft':''}>{status}</b></button>)}</section></div>
}

function LibraryView({openWorkspace}){
  const [active,setActive]=useState('ALL'),categories=['ALL','RISK','PROP','REGIMES','VOLATILITY','RESEARCH'],visible=templates.filter(x=>active==='ALL'||x.tag===active);
  return <div className="qpsPage"><div className="qpsPageHead"><div><span>RESEARCH LIBRARY</span><h1>Research workflows</h1><p>Reusable starting points that stay honest about what QNT actually executes.</p></div></div><div className="qpsLibraryTabs">{categories.map(x=><button key={x} className={active===x?'active':''} onClick={()=>setActive(x)}>{x}</button>)}</div><div className="qpsLibraryGrid">{visible.map(x=><article className="qpsLibraryCard" key={x.title}><div className="qpsLibTop"><small>{x.tag}</small><BookOpen size={14}/></div><h3>{x.title}</h3><p>{x.text}</p><div className="qpsLibFoot"><span><Star size={11}/> QNT research</span><button onClick={openWorkspace}>Open <ChevronRight size={12}/></button></div></article>)}</div></div>
}

function ApiView(){
  const [health,setHealth]=useState(null),[error,setError]=useState('');const load=async()=>{try{const r=await fetch('/api/status');const d=await r.json();setHealth(d);setError('')}catch(e){setError(e.message)}};useEffect(()=>{load()},[]);
  const rows=[['QNT server',Boolean(health?.server?.ok),health?.server?.now||'—',`${health?.server?.cacheEntries??0} cache entries`],['MarketData.app',Boolean(health?.marketData?.configured),health?.marketData?.lastSuccess||'No successful request yet',health?.marketData?.lastError||health?.marketData?.mode||'—'],['OpenAI',Boolean(health?.openai?.configured),health?.openai?.lastSuccess||'No successful request yet',health?.openai?.lastError||health?.openai?.model||'—']];
  return <div className="qpsPage"><div className="qpsPageHead"><div><span>TERMINAL HEALTH</span><h1>API & data status</h1><p>Secrets stay server-side. This page reports connection state, recent success/error state and cache usage.</p></div><button className="qpsPrimary" onClick={load}>Refresh</button></div>{error&&<div className="qpsApiError">{error}</div>}<div className="qpsApiTable">{rows.map(([name,ok,last,detail])=><div key={name}><span className={ok?'live':'off'}/><b>{name}</b><em>{ok?'CONNECTED':'NOT CONFIGURED'}</em><small>{last}</small><p>{detail}</p></div>)}</div></div>
}

function CopilotShell(){return <div className="qpsCopilotShell"><div className="qpsWorkspaceStrip"><div><Folder size={13}/> NQ edge research <ChevronRight size={12}/><b>personal_trade_model.qnt</b></div><div><span className="qpsLive"/> personal model loaded</div></div><App/></div>}

function CommandPalette({open,onClose,setSection}){
  const [query,setQuery]=useState('');useEffect(()=>{if(open)setQuery('')},[open]);
  if(!open)return null;const q=query.trim().toUpperCase(),visible=commandDefs.filter(x=>`${x[0]} ${x[1]} ${x[2]}`.toUpperCase().includes(q));
  const run=item=>{const [code,,,type,target]=item;if(type==='shell')setSection(target);else if(type==='research'){setSection('Copilot');emitResearch(target)}else{setSection('Market');try{sessionStorage.setItem('qnt.market.command',JSON.stringify({type,target}))}catch{}window.setTimeout(()=>emitMarket({type,target}),0)}try{const prior=JSON.parse(localStorage.getItem('qnt.recent.commands')||'[]');localStorage.setItem('qnt.recent.commands',JSON.stringify([code,...prior.filter(x=>x!==code)].slice(0,8)))}catch{}onClose()};
  return <div className="qpsCommandBackdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="qpsCommand"><div className="qpsCommandInput"><Command size={15}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')onClose();if(e.key==='Enter'&&visible[0])run(visible[0])}} placeholder="Type a function: MC, PROP, VOL, NQ, AAPL, NEWS…"/><kbd>ESC</kbd></div><div className="qpsCommandList">{visible.map(item=><button key={item[0]} onClick={()=>run(item)}><kbd>{item[0]}</kbd><div><b>{item[1]}</b><span>{item[2]}</span></div><ChevronRight size={13}/></button>)}</div><div className="qpsCommandFoot">QNT command layer · navigation + instrument lookup + coverage status · unavailable feeds stay explicitly unavailable</div></div></div>
}

export default function ProductShell(){
  const [section,setSection]=useState('Copilot'),[commandOpen,setCommandOpen]=useState(false);const openWorkspace=()=>{setSection('Copilot');emitResearch('Workspace')};
  useEffect(()=>{const key=e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setCommandOpen(true)}if(e.key==='Escape')setCommandOpen(false)};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[]);
  return <div className="productShell"><LeftRail section={section} setSection={setSection}/><div className="qpsMain"><header className="qpsTopbar"><div className="qpsTopTitle"><WandSparkles size={14}/><span>{section==='Copilot'?'QNT Copilot':section}</span></div><button className="qpsTopSearch qpsTopSearchButton" onClick={()=>setCommandOpen(true)}><Search size={13}/><span>Search research, symbols, or commands</span><kbd>⌘ K</kbd></button><div className="qpsActions"><Activity size={14}/><span className="qpsLive"/> RESEARCH ONLINE</div></header>{section==='Projects'&&<ProjectsView openWorkspace={openWorkspace}/>} {section==='Copilot'&&<CopilotShell/>}{section==='Market'&&<MarketTerminal/>}{section==='Library'&&<LibraryView openWorkspace={openWorkspace}/>} {section==='API'&&<ApiView/>}</div><CommandPalette open={commandOpen} onClose={()=>setCommandOpen(false)} setSection={setSection}/></div>
}
