import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import ProductShell from './ProductShell.jsx';
import MonteCarloResearch from './MonteCarloResearch.jsx';
import './styles.css';
import './volatility.css';
import './montecarlo.css';
import './product-shell.css';

function Root(){
  const [mcMode,setMcMode]=useState(null);

  useEffect(()=>{
    const onClick=(event)=>{
      const productButton=event.target.closest?.('.qpsRailNav button, .qpsRailBottom button');
      if(productButton){
        setMcMode(null);
        return;
      }
      const researchButton=event.target.closest?.('.topNav nav button');
      if(!researchButton)return;
      const label=researchButton.textContent.trim();
      if(label==='Risk & Monte Carlo') setMcMode('risk');
      else if(label==='Prop Firm') setMcMode('prop');
      else setMcMode(null);
    };
    document.addEventListener('click',onClick);
    return ()=>document.removeEventListener('click',onClick);
  },[]);

  return <>
    <ProductShell />
    {mcMode&&<div className="qmcOverlay"><MonteCarloResearch propMode={mcMode==='prop'}/></div>}
  </>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
