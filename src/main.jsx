import React,{useEffect,useState}from'react';
import ReactDOM from'react-dom/client';
import QntRedesign from'./QntRedesign.jsx';
import RiskMonteCarloV2 from'./RiskMonteCarloV2.jsx';
import PropFirmV2 from'./PropFirmV2.jsx';
import ModelStatsStrip from'./ModelStatsStrip.jsx';
import'./styles.css';
import'./volatility.css';
import'./montecarlo.css';
import'./montecarlo-validation.css';
import'./model-stats-strip.css';
import'./risk-v2.css';
import'./prop-v2.css';
import'./terminal-home.css';
import'./bloomberg-desk.css';
import'./analytics-terminal.css';
import'./terminal-workbench.css';
import'./terminal-workbench-extra.css';
import'./terminal-cohesion.css';
import'./research-studio.css';
import'./research-stats.css';
import'./research-validation.css';
import'./strategy-validation.css';
import'./product-shell.css';
import'./terminal-shell.css';
import'./terminal-market.css';
import'./data-terminal.css';
import'./functional.css';
import'./responsive-overrides.css';
import'./modern-ui.css';
import'./ui-v3.css';
import'./qnt-v4.css';

function Root(){
  const[mcMode,setMcMode]=useState(null);
  useEffect(()=>{const onNav=event=>{if(event.detail?.type!=='research')return;if(event.detail.tab==='Risk & Monte Carlo')setMcMode('risk');else if(event.detail.tab==='Prop Firm')setMcMode('prop');else setMcMode(null)};window.addEventListener('qnt:navigate',onNav);return()=>window.removeEventListener('qnt:navigate',onNav)},[]);
  return <><QntRedesign/>{mcMode&&<div className="qmcOverlay"><ModelStatsStrip/>{mcMode==='risk'?<RiskMonteCarloV2/>:<PropFirmV2/>}</div>}</>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><Root/></React.StrictMode>);
