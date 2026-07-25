import React,{useEffect,useMemo,useState}from'react';
import{Bar,BarChart,CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis}from'recharts';
import{AlertTriangle,Database,LockKeyhole}from'lucide-react';
import{personalModel}from'./personalDataset.js';

const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const quantile=(values,p)=>{if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y),i=(a.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(i-lo)};
const sampleSd=a=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1))};
const fmt=(n,d=2)=>Number.isFinite(n)?`${n>=0?'+':''}${n.toFixed(d)}`:'—';
const plain=(n,d=2)=>Number.isFinite(n)?n.toFixed(d):'—';
const openJournal=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('QNTJournalDB',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('trades'))r.result.createObjectStore('trades',{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
const readJournal=db=>new Promise((resolve,reject)=>{const r=db.transaction('trades','readonly').objectStore('trades').getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)});

export function calculateTradeStats(values,sequenceValid=false){
  const r=(values||[]).map(Number).filter(Number.isFinite),n=r.length;
  if(!n)return null;
  const m=mean(r),sd=sampleSd(r),wins=r.filter(x=>x>0),losses=r.filter(x=>x<0),grossWin=wins.reduce((s,v)=>s+v,0),grossLoss=Math.abs(losses.reduce((s,v)=>s+v,0));
  const avgWin=mean(wins),avgLoss=Math.abs(mean(losses)),pf=grossLoss?grossWin/grossLoss:grossWin>0?Infinity:null,payoff=avgLoss?avgWin/avgLoss:null;
  const downside=Math.sqrt(mean(r.map(x=>Math.min(x,0)**2))),popSd=Math.sqrt(mean(r.map(x=>(x-m)**2)))||0;
  const skew=popSd?mean(r.map(x=>((x-m)/popSd)**3)):0,kurt=popSd?mean(r.map(x=>((x-m)/popSd)**4))-3:0,p10=quantile(r,.10),p90=quantile(r,.90),tail=p10!==0?p90/Math.abs(p10):null;
  const tailCut=r.filter(x=>x<=p10),es10=tailCut.length?mean(tailCut):p10,se=sd/Math.sqrt(n),ci=[m-1.96*se,m+1.96*se],positive=[...wins].sort((a,b)=>b-a),top5=grossWin?positive.slice(0,5).reduce((s,v)=>s+v,0)/grossWin*100:0;
  let seq=null;
  if(sequenceValid){
    let cum=0,peak=0,maxDd=0,streak=0,longest=0;const curve=r.map((v,i)=>{cum+=v;peak=Math.max(peak,cum);maxDd=Math.max(maxDd,peak-cum);if(v<0){streak++;longest=Math.max(longest,streak)}else streak=0;return{i:i+1,cum}});
    const lag1=r.length>2?corr(r.slice(0,-1),r.slice(1)):null,recovery=maxDd>0?cum/maxDd:null,stability=curve.length>2?linearR2(curve.map(x=>x.i),curve.map(x=>x.cum)):null;
    seq={curve,maxDd,longest,lag1,recovery,stability,net:cum};
  }
  return{n,mean:m,median:quantile(r,.5),sd,downside,pf,payoff,skew,kurt,p10,p90,es10,tail,se,ci,top5,meanOverSd:sd?m/sd:null,meanOverDown:downside?m/downside:null,sequence:seq,values:r};
}

function corr(a,b){if(a.length!==b.length||a.length<2)return null;const ma=mean(a),mb=mean(b),num=a.reduce((s,v,i)=>s+(v-ma)*(b[i]-mb),0),da=Math.sqrt(a.reduce((s,v)=>s+(v-ma)**2,0)),db=Math.sqrt(b.reduce((s,v)=>s+(v-mb)**2,0));return da&&db?num/(da*db):null}
function linearR2(x,y){const mx=mean(x),my=mean(y),den=x.reduce((s,v)=>s+(v-mx)**2,0);if(!den)return null;const beta=x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0)/den,alpha=my-beta*mx,pred=x.map(v=>alpha+beta*v),ssr=y.reduce((s,v,i)=>s+(v-pred[i])**2,0),sst=y.reduce((s,v)=>s+(v-my)**2,0);return sst?1-ssr/sst:null}
function histogram(values,bins=10){if(!values.length)return[];const min=Math.min(...values),max=Math.max(...values);if(min===max)return[{bin:min.toFixed(2),count:values.length}];const width=(max-min)/bins,out=Array.from({length:bins},(_,i)=>({lo:min+i*width,hi:min+(i+1)*width,count:0}));values.forEach(v=>out[Math.min(bins-1,Math.floor((v-min)/width))].count++);return out.map(x=>({bin:`${x.lo.toFixed(1)}→${x.hi.toFixed(1)}`,count:x.count}))}
function Metric({label,value,sub,tone=''}){return <div className={`qpsMetric ${tone}`}><span>{label}</span><b>{value}</b>{sub&&<small>{sub}</small>}</div>}

export default function ResearchStats(){
  const[journal,setJournal]=useState([]),[mode,setMode]=useState('model');
  useEffect(()=>{let live=true,db;(async()=>{try{db=await openJournal();const rows=await readJournal(db);if(!live)return;const usable=rows.filter(t=>Number.isFinite(Number(t.rMultiple))).sort((a,b)=>new Date(`${a.date||'1970-01-01'}T${a.time||'00:00'}`)-new Date(`${b.date||'1970-01-01'}T${b.time||'00:00'}`));setJournal(usable);if(usable.length>=5)setMode('journal')}catch{}finally{db?.close?.()}})();return()=>{live=false;db?.close?.()}},[]);
  const modelStats=useMemo(()=>calculateTradeStats(personalModel.evalR,false),[]),journalStats=useMemo(()=>calculateTradeStats(journal.map(t=>t.rMultiple),true),[journal]),stats=mode==='journal'&&journalStats?journalStats:modelStats,sequence=stats?.sequence,hist=useMemo(()=>histogram(stats?.values||[]),[stats]);
  return <div className="qpsStats">
    <header className="qpsStatsHead"><div><span>PERSONAL QUANT STATS</span><h2>Strategy statistics</h2><p>Distribution-first metrics for your trading sample. No headline win rate.</p></div><div className="qpsDatasetSwitch"><button className={mode==='model'?'active':''} onClick={()=>setMode('model')}>MODEL SAMPLE <em>{modelStats?.n||0}</em></button><button className={mode==='journal'?'active':''} disabled={!journalStats} onClick={()=>journalStats&&setMode('journal')}>JOURNAL R <em>{journalStats?.n||0}</em></button></div></header>
    <div className="qpsStatsNotice"><AlertTriangle size={14}/><p>{mode==='model'?<>The model sample is selectively curated and its payoff units are normalized, not true stop-defined R. Distribution metrics are useful; sequence metrics stay locked because chronology is not verified.</>:<>Journal mode uses recorded <b>R multiple</b> values ordered by trade date/time. Sequence metrics become meaningful only when those R values and timestamps are complete.</>}</p></div>

    <section className="qpsMetricBlock"><div className="qpsMetricTitle"><span>EDGE</span><small>per-trade distribution</small></div><div className="qpsMetricGrid">
      <Metric label="EXPECTANCY / TRADE" value={`${fmt(stats.mean)}R`} sub="sample mean payoff" tone="hero"/>
      <Metric label="MEDIAN TRADE" value={`${fmt(stats.median)}R`} sub="50th percentile"/>
      <Metric label="PROFIT FACTOR" value={stats.pf===Infinity?'∞':plain(stats.pf)} sub="gross positive / gross negative"/>
      <Metric label="PAYOFF RATIO" value={stats.payoff?`${plain(stats.payoff)}:1`:'—'} sub="avg positive / avg negative"/>
      <Metric label="MEAN / σ" value={plain(stats.meanOverSd)} sub="trade-level ratio · not annualized Sharpe"/>
      <Metric label="MEAN / DOWNSIDE" value={plain(stats.meanOverDown)} sub="trade-level ratio · not annualized Sortino"/>
    </div></section>

    <section className="qpsMetricBlock"><div className="qpsMetricTitle"><span>DISPERSION + TAILS</span><small>shape and downside</small></div><div className="qpsMetricGrid">
      <Metric label="TRADE σ" value={`${plain(stats.sd)}R`} sub="sample standard deviation"/>
      <Metric label="DOWNSIDE DEVIATION" value={`${plain(stats.downside)}R`} sub="deviation below 0R"/>
      <Metric label="SKEWNESS" value={fmt(stats.skew)} sub={stats.skew>0?'right-tail dominated':'left-tail dominated'}/>
      <Metric label="EXCESS KURTOSIS" value={fmt(stats.kurt)} sub="tail / outlier intensity"/>
      <Metric label="10% EXPECTED SHORTFALL" value={`${fmt(stats.es10)}R`} sub="mean of worst tail beyond P10" tone="risk"/>
      <Metric label="TAIL RATIO" value={plain(stats.tail)} sub="P90 / |P10|"/>
      <Metric label="TOP-5 PROFIT SHARE" value={`${plain(stats.top5,1)}%`} sub="positive-payoff concentration"/>
      <Metric label="STANDARD ERROR" value={`${plain(stats.se)}R`} sub="uncertainty of sample mean"/>
      <Metric label="APPROX 95% MEAN RANGE" value={`${fmt(stats.ci[0])} to ${fmt(stats.ci[1])}R`} sub="normal approximation; bootstrap is preferred"/>
    </div></section>

    <div className="qpsStatsCharts"><section><div className="qpsMetricTitle"><span>PAYOFF DISTRIBUTION</span><small>{stats.n} observations</small></div><div className="qpsChart"><ResponsiveContainer width="100%" height="100%"><BarChart data={hist}><CartesianGrid stroke="#202225" vertical={false}/><XAxis dataKey="bin" tick={{fontSize:8}} stroke="#62666c" interval="preserveStartEnd"/><YAxis tick={{fontSize:8}} stroke="#62666c" allowDecimals={false}/><Tooltip contentStyle={{background:'#111214',border:'1px solid #303238',fontSize:9}}/><Bar dataKey="count"/></BarChart></ResponsiveContainer></div></section>
      <section><div className="qpsMetricTitle"><span>SEQUENCE</span><small>{sequence?'journal chronology':'locked for model sample'}</small></div>{sequence?<><div className="qpsSequenceStrip"><div><span>MAX DD</span><b>{plain(sequence.maxDd)}R</b></div><div><span>RECOVERY</span><b>{plain(sequence.recovery)}</b></div><div><span>LONGEST NEGATIVE RUN</span><b>{sequence.longest}</b></div><div><span>LAG-1 CORR</span><b>{fmt(sequence.lag1)}</b></div><div><span>CURVE R²</span><b>{plain(sequence.stability)}</b></div></div><div className="qpsChart"><ResponsiveContainer width="100%" height="100%"><LineChart data={sequence.curve}><CartesianGrid stroke="#202225" vertical={false}/><XAxis dataKey="i" tick={{fontSize:8}} stroke="#62666c"/><YAxis tick={{fontSize:8}} stroke="#62666c"/><Tooltip contentStyle={{background:'#111214',border:'1px solid #303238',fontSize:9}}/><Line dataKey="cum" dot={false} strokeWidth={1.5}/></LineChart></ResponsiveContainer></div></>:<div className="qpsLocked"><LockKeyhole size={20}/><b>Chronological metrics locked</b><p>Max drawdown, recovery factor, streaks, autocorrelation and equity-curve stability need a verified trade order. Add true R multiples in Journal and this panel will calculate them from the timestamped sequence.</p></div>}</section></div>

    <footer className="qpsStatsFoot"><Database size={12}/><span>Model stats use personalModel.evalR. Journal stats read QNTJournalDB locally in your browser. Nothing from the journal is committed to the public repo.</span></footer>
  </div>;
}
