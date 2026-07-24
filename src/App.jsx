import React,{useEffect,useState}from'react';
import{Activity,BarChart3,Braces,Database,Settings2,Sigma,Waves}from'lucide-react';
import ResearchStudio from'./ResearchStudio.jsx';
import{ResearchVerdict,RegimeLab}from'./ResearchValidation.jsx';
import VolatilityLab from'./VolatilityLab.jsx';
import DataTerminal from'./DataTerminal.jsx';

const tabs=[['Workspace',Braces],['Prop Firm',Sigma],['Verdict',Activity],['Regimes',BarChart3],['Risk & Monte Carlo',BarChart3],['Volatility',Waves],['Data',Database]];
const emitTab=tab=>window.dispatchEvent(new CustomEvent('qnt:navigate',{detail:{type:'research',tab}}));

export default function App(){
  const[tab,setTab]=useState('Workspace');
  useEffect(()=>{const nav=e=>{if(e.detail?.type==='research'&&tabs.some(([name])=>name===e.detail.tab))setTab(e.detail.tab)};window.addEventListener('qnt:navigate',nav);return()=>window.removeEventListener('qnt:navigate',nav)},[]);
  const select=name=>{setTab(name);emitTab(name)};
  return <div className="appShell qpCore"><header className="topNav qpResearchNav"><nav>{tabs.map(([name,Icon])=><button key={name} className={tab===name?'active':''} onClick={()=>select(name)}><Icon size={12}/>{name}</button>)}</nav><div className="rightNav"><span className="statusDot"/> PERSONAL MODEL</div></header><main>{tab==='Workspace'&&<ResearchStudio/>}{tab==='Verdict'&&<ResearchVerdict/>}{tab==='Regimes'&&<RegimeLab/>}{tab==='Volatility'&&<VolatilityLab/>}{tab==='Data'&&<DataTerminal/>}{(tab==='Prop Firm'||tab==='Risk & Monte Carlo')&&<div className="qpLoadingTool"><Settings2 size={15}/><span>Opening simulation workspace…</span></div>}</main></div>;
}
