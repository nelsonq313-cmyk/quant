import React,{useEffect,useState}from'react';
import ResearchStudio from'./ResearchStudio.jsx';
import{ResearchVerdict,RegimeLab}from'./ResearchValidation.jsx';
import StrategyValidationLab from'./StrategyValidationLab.jsx';
import VolatilityLab from'./VolatilityLab.jsx';

const tabs=['Workspace','Validation','Verdict','Regimes','Volatility','Risk & Monte Carlo','Prop Firm'];
const emitTab=tab=>window.dispatchEvent(new CustomEvent('qnt:navigate',{detail:{type:'research',tab}}));

export default function App(){
  const[tab,setTab]=useState('Workspace');
  useEffect(()=>{const nav=e=>{if(e.detail?.type==='research'&&tabs.includes(e.detail.tab))setTab(e.detail.tab)};window.addEventListener('qnt:navigate',nav);return()=>window.removeEventListener('qnt:navigate',nav)},[]);
  const select=name=>{setTab(name);emitTab(name)};
  return <div className="appShell qpCore q4ResearchShell"><header className="topNav qpResearchNav"><nav>{tabs.map(name=><button key={name} className={tab===name?'active':''} onClick={()=>select(name)}>{name}</button>)}</nav><div className="rightNav"><span className="statusDot"/> PERSONAL MODEL</div></header><main>{tab==='Workspace'&&<ResearchStudio/>}{tab==='Validation'&&<StrategyValidationLab/>}{tab==='Verdict'&&<ResearchVerdict/>}{tab==='Regimes'&&<RegimeLab/>}{tab==='Volatility'&&<VolatilityLab/>}{(tab==='Prop Firm'||tab==='Risk & Monte Carlo')&&<div className="qpLoadingTool"><span>Opening simulation workspace…</span></div>}</main></div>;
}
