import React from 'react';
import { personalModel } from './personalDataset';

const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const median=a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
const conservativeWins=personalModel.winR.map(r=>1.1*Math.log1p(Math.max(0,r)));

function Stat({label,value,sub}){
  return <div className="qmcInputStat"><span>{label}</span><b>{value}</b>{sub&&<small>{sub}</small>}</div>;
}

export default function ModelStatsStrip(){
  const avgWin=mean(conservativeWins),medWin=median(conservativeWins);
  const avgLoss=mean(personalModel.lossR),medLoss=median(personalModel.lossR);
  const payoff=Math.abs(avgLoss)>0?avgWin/Math.abs(avgLoss):0;
  const expectancy=personalModel.winProbability*avgWin+personalModel.lossProbability*avgLoss;

  return <section className="qmcInputStrip">
    <div className="qmcInputStripHead">
      <div><b>MODEL INPUTS TO P(RUIN)</b><span>These are the WR / payoff assumptions the simulator is actually drawing from.</span></div>
      <em>P(ruin) also uses Start · Risk/trade · Floor · Horizon above</em>
    </div>
    <div className="qmcInputStats">
      <Stat label="OBSERVED WIN RATE" value={`${(personalModel.winProbability*100).toFixed(1)}%`} sub={`${personalModel.evalWins} wins / ${personalModel.evalPositionIdeas} eval ideas`}/>
      <Stat label="LOSS / BE RATE" value={`${(personalModel.lossProbability*100).toFixed(1)}% / ${(personalModel.breakevenProbability*100).toFixed(1)}%`} sub={`${personalModel.evalLosses} losses · ${personalModel.evalBreakevens} BE`}/>
      <Stat label="AVG MODELED WIN" value={`+${avgWin.toFixed(2)}R*`} sub={`median +${medWin.toFixed(2)}R*`}/>
      <Stat label="AVG MODELED LOSS" value={`${avgLoss.toFixed(2)}R*`} sub={`median ${medLoss.toFixed(2)}R*`}/>
      <Stat label="PAYOFF RATIO" value={`${payoff.toFixed(2)} : 1`} sub="avg win ÷ avg loss"/>
      <Stat label="MODELED EXPECTANCY" value={`${expectancy>=0?'+':''}${expectancy.toFixed(2)}R*`} sub="using observed WR before uncertainty"/>
      <Stat label="PAYOFF LIBRARIES" value={`${personalModel.winR.length}W / ${personalModel.lossR.length}L`} sub={`${personalModel.practiceWinners} vetted practice winners included`}/>
    </div>
    <p className="qmcInputFoot">*R is a modeled payoff unit anchored to the current MNQ-equivalent normalization and conservative winner transform; it is not stop-defined true R. Posterior uncertainty varies the win/loss/BE probabilities around the ${personalModel.evalPositionIdeas}-idea curated eval sample on each simulation block.</p>
  </section>;
}
