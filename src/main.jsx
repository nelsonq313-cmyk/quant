import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import ProductShell from './ProductShell.jsx';
import RiskMonteCarloV2 from './RiskMonteCarloV2.jsx';
import PropFirmV2 from './PropFirmV2.jsx';
import ModelStatsStrip from './ModelStatsStrip.jsx';
import './styles.css';
import './volatility.css';
import './montecarlo.css';
import './montecarlo-validation.css';
import './model-stats-strip.css';
import './risk-v2.css';
import './prop-v2.css';
import './terminal-home.css';
import './bloomberg-desk.css';
import './analytics-terminal.css';
import './terminal-cohesion.css';
import './product-shell.css';
import './terminal-shell.css';
import './terminal-market.css';
import './data-terminal.css';
import './functional.css';
import './responsive-overrides.css';

function Root(){
  const [mcMode,setMcMode]=useState(null);

  useEffect(()=>{
    const onNav=event=>{
      if(event.detail?.type!=='research')return;
      if(event.detail.tab==='Risk & Monte Carlo')setMcMode('risk');
      else if(event.detail.tab==='Prop Firm')setMcMode('prop');
      else setMcMode(null);
    };
    const onClick=event=>{
      const productButton=event.target.closest?.('.qpsRailNav button, .qpsRailBottom button');
      if(productButton){setMcMode(null);return}
      const researchButton=event.target.closest?.('.topNav nav button');if(!researchButton)return;
      const label=researchButton.textContent.trim();
      if(label==='Risk & Monte Carlo')setMcMode('risk');
      else if(label==='Prop Firm')setMcMode('prop');
      else setMcMode(null);
    };
    window.addEventListener('qnt:navigate',onNav);document.addEventListener('click',onClick);
    return()=>{window.removeEventListener('qnt:navigate',onNav);document.removeEventListener('click',onClick)};
  },[]);

  return <><ProductShell/>{mcMode&&<div className="qmcOverlay"><ModelStatsStrip/>{mcMode==='risk'?<RiskMonteCarloV2/>:<PropFirmV2/>}</div>}</>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><Root/></React.StrictMode>);
