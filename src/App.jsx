import React,{useEffect,useState}from'react';
import ResearchStudio from'./ResearchStudio.jsx';
import{ResearchVerdict,RegimeLab}from'./ResearchValidation.jsx';
import StrategyValidationLab from'./StrategyValidationLab.jsx';
import VolatilityLab from'./VolatilityLab.jsx';
import RiskMonteCarloV2 from'./RiskMonteCarloV2.jsx';
import PropFirmV2 from'./PropFirmV2.jsx';

const tabs=['Research Lab','Validation','Verdict','Regimes','Volatility','Risk & Monte Carlo','Prop Firm'];
const aliases={'Workspace':'Research Lab'};
const emitTab=tab=>window.dispatchEvent(new CustomEvent('qnt:navigate',{detail:{type:'research',tab}}));

export default function App(){
  const[tab,setTab]=useState('Research Lab');
  useEffect(()=>{const nav=e=>{if(e.detail?.type!=='research')return;const next=aliases[e.detail.tab]||e.detail.tab;if(tabs.includes(next))setTab(next)};window.addEventListener('qnt:navigate',nav);return()=>window.removeEventListener('qnt:navigate',nav)},[]);
  const select=name=>{setTab(name);emitTab(name)};
  return <div className="appShell qpCore q4ResearchShell"><header className="topNav qpResearchNav"><nav>{tabs.map(name=><button key={name} className={tab===name?'active':''} onClick={()=>select(name)}>{name}</button>)}</nav><div className="rightNav"><span className="statusDot"/> PERSONAL MODEL</div></header><main>
    <div className={tab==='Research Lab'?'q4ResearchModule active':'q4ResearchModule'} aria-hidden={tab!=='Research Lab'}><ResearchStudio/></div>
    {tab==='Validation'&&<StrategyValidationLab/>}
    {tab==='Verdict'&&<ResearchVerdict/>}
    {tab==='Regimes'&&<RegimeLab/>}
    {tab==='Volatility'&&<VolatilityLab/>}
    {tab==='Risk & Monte Carlo'&&<RiskMonteCarloV2/>}
    {tab==='Prop Firm'&&<PropFirmV2/>}
  </main></div>;
}
