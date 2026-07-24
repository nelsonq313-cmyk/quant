import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import MonteCarloResearch from './MonteCarloResearch.jsx';
import './styles.css';
import './volatility.css';
import './montecarlo.css';

function Root(){
  const [mcMode,setMcMode]=useState(null);

  useEffect(()=>{
    const onClick=(event)=>{
      const button=event.target.closest?.('.topNav nav button');
      if(!button)return;
      const label=button.textContent.trim();
      if(label==='Risk & Monte Carlo') setMcMode('risk');
      else if(label==='Prop Firm') setMcMode('prop');
      else setMcMode(null);
    };
    document.addEventListener('click',onClick);
    return ()=>document.removeEventListener('click',onClick);
  },[]);

  return <>
    <App />
    {mcMode&&<div className="qmcOverlay"><MonteCarloResearch propMode={mcMode==='prop'}/></div>}
  </>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
