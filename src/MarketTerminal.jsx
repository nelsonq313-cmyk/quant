import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Database, RefreshCw, Search, Server, ShieldAlert, StickyNote, Waves } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const DEFAULT_SYMBOLS=['QQQ','SPY','AAPL','NVDA','MSFT'];
const UNSUPPORTED_FUTURES=new Set(['NQ','ES','YM','RTY']);
const money=n=>Number.isFinite(Number(n))?`$${Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`:'—';
const pct=n=>Number.isFinite(Number(n))?`${Number(n)>=0?'+':''}${Number(n).toFixed(2)}%`:'—';
const fmtTime=t=>t?new Date(Number(t)*1000).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';
function StatusPill({ok,label}){return <span className={`qtStatusPill ${ok?'ok':'off'}`}><i/>{label}</span>}

export default function MarketTerminal(){
  const [quotes,setQuotes]=useState([]),[symbol,setSymbol]=useState('QQQ'),[query,setQuery]=useState('QQQ');
  const [candles,setCandles]=useState([]),[health,setHealth]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[coverageNotice,setCoverageNotice]=useState('');
  const [notes,setNotes]=useState(()=>localStorage.getItem('qnt.market.notes.QQQ')||'');

  const loadQuotes=async()=>{try{const r=await fetch(`/api/market/quotes?symbols=${encodeURIComponent(DEFAULT_SYMBOLS.join(','))}`),d=await r.json();if(!r.ok)throw new Error(d.error||'Quote request failed');setQuotes(d.quotes||[]);setError('')}catch(e){setError(e.message)}};
  const loadSymbol=async(next=symbol)=>{
    const clean=String(next||'QQQ').trim().toUpperCase();if(!clean)return;
    if(UNSUPPORTED_FUTURES.has(clean)){setCoverageNotice(`${clean} direct futures data is not connected. QNT will not substitute an ETF or fabricate a futures quote.`);setQuery(clean);setError('');return}
    setCoverageNotice('');setLoading(true);
    try{const r=await fetch(`/api/market/candles?symbol=${encodeURIComponent(clean)}&resolution=D&countback=90`),d=await r.json();if(!r.ok)throw new Error(d.error||'Candle request failed');setCandles((d.candles||[]).map(x=>({...x,label:fmtTime(x.time)})));setSymbol(clean);setQuery(clean);setNotes(localStorage.getItem(`qnt.market.notes.${clean}`)||'');setError('')}catch(e){setError(e.message)}finally{setLoading(false)}
  };
  const loadHealth=async()=>{try{const r=await fetch('/api/status'),d=await r.json();setHealth(d)}catch{setHealth(null)}};
  const handleCommand=detail=>{
    if(!detail)return;
    if(detail.type==='symbol')loadSymbol(detail.target);
    if(detail.type==='capability'){
      const copy=detail.target==='NEWS'?'No verified news-feed API is connected, so QNT will not generate or display fake headlines.':'No verified economic-calendar feed is connected, so QNT will not invent FOMC, CPI, NFP, earnings, or other event dates.';
      setCoverageNotice(copy);setError('');
    }
  };
  useEffect(()=>{
    loadQuotes();loadHealth();loadSymbol('QQQ');
    try{const pending=JSON.parse(sessionStorage.getItem('qnt.market.command')||'null');if(pending){sessionStorage.removeItem('qnt.market.command');window.setTimeout(()=>handleCommand(pending),0)}}catch{}
    const onCommand=e=>handleCommand(e.detail);window.addEventListener('qnt:market-command',onCommand);return()=>window.removeEventListener('qnt:market-command',onCommand);
  },[]);

  const quote=quotes.find(q=>q.symbol===symbol) || null;
  const summary=useMemo(()=>{
    if(!candles.length)return {last:null,change:null,range:null,vol:null};
    const last=candles.at(-1),prev=candles.at(-2),ret=prev?(last.close-prev.close)/prev.close*100:null;
    const hi=Math.max(...candles.slice(-20).map(c=>c.high??c.close)),lo=Math.min(...candles.slice(-20).map(c=>c.low??c.close));
    const daily=candles.slice(1).map((c,i)=>(c.close-candles[i].close)/candles[i].close).filter(Number.isFinite),m=daily.reduce((a,b)=>a+b,0)/(daily.length||1),sd=Math.sqrt(daily.reduce((s,v)=>s+(v-m)**2,0)/(daily.length||1))*Math.sqrt(252)*100;
    return {last:last.close,change:ret,range:[lo,hi],vol:sd};
  },[candles]);

  const saveNotes=value=>{setNotes(value);localStorage.setItem(`qnt.market.notes.${symbol}`,value)};
  const selectSymbol=s=>{setQuery(s);loadSymbol(s)};

  return <div className="qtMarket">
    <header className="qtMarketHead"><div><span>MARKET WORKSTATION</span><h1>{symbol} security monitor</h1><p>Provider-backed stock/ETF data only. Unsupported futures, macro, news and calendar feeds remain visibly unavailable.</p></div><div className="qtHeadStatus"><StatusPill ok={health?.marketData?.configured} label="MARKET DATA"/><StatusPill ok={health?.openai?.configured} label="OPENAI"/></div></header>
    <div className="qtMarketToolbar"><div className="qtTickerSearch"><Search size={13}/><input value={query} onChange={e=>setQuery(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&loadSymbol(query)} placeholder="AAPL / QQQ / SPY / NQ coverage"/><button onClick={()=>loadSymbol(query)}>GO</button></div><button onClick={()=>{loadQuotes();loadSymbol(symbol);loadHealth()}}><RefreshCw size={12}/>{loading?'REFRESHING':'REFRESH'}</button><span>{health?.server?.now?`STATUS ${new Date(health.server.now).toLocaleTimeString()}`:'STATUS —'}</span></div>
    {coverageNotice&&<div className="qtCoverageNotice"><ShieldAlert size={13}/>{coverageNotice}</div>}
    {error&&<div className="qtDataError"><ShieldAlert size={13}/>{error} · no placeholder quote was substituted.</div>}
    <section className="qtTickerTape">{DEFAULT_SYMBOLS.map(s=>{const q=quotes.find(x=>x.symbol===s);return <button key={s} className={symbol===s?'active':''} onClick={()=>selectSymbol(s)}><b>{s}</b><span>{money(q?.last)}</span><em className={(q?.changePct??0)>=0?'up':'down'}>{pct(q?.changePct)}</em></button>})}</section>
    <div className="qtMarketGrid">
      <section className="qtMarketChart panel"><div className="qtPanelHead"><div><b>{symbol} · 90D PRICE</b><span>{quote?.updated?'delayed provider quote':'historical candle series'}</span></div><strong>{money(quote?.last??summary.last)} <em className={(quote?.changePct??summary.change??0)>=0?'up':'down'}>{pct(quote?.changePct??summary.change)}</em></strong></div><ResponsiveContainer width="100%" height={330}><AreaChart data={candles}><defs><linearGradient id="qntMarketArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8f6cff" stopOpacity=".34"/><stop offset="100%" stopColor="#8f6cff" stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="#171a20" vertical={false}/><XAxis dataKey="label" minTickGap={42} stroke="#505660" tick={{fontSize:8}}/><YAxis domain={['auto','auto']} stroke="#505660" tick={{fontSize:8}} tickFormatter={v=>`$${Number(v).toFixed(0)}`}/><Tooltip contentStyle={{background:'#08090d',border:'1px solid #34303f',fontSize:9}} formatter={v=>money(v)}/><Area dataKey="close" type="monotone" stroke="#a58cff" strokeWidth={1.3} fill="url(#qntMarketArea)"/></AreaChart></ResponsiveContainer></section>
      <aside className="qtInstrument panel"><div className="qtPanelHead"><div><b>SECURITY SNAPSHOT</b><span>{symbol}</span></div><BarChart3 size={14}/></div><div className="qtSnapGrid"><div><span>LAST</span><b>{money(quote?.last??summary.last)}</b></div><div><span>1D</span><b className={(quote?.changePct??summary.change??0)>=0?'up':'down'}>{pct(quote?.changePct??summary.change)}</b></div><div><span>20D RANGE</span><b>{summary.range?`${money(summary.range[0])} – ${money(summary.range[1])}`:'—'}</b></div><div><span>REALIZED VOL*</span><b>{Number.isFinite(summary.vol)?`${summary.vol.toFixed(1)}%`:'—'}</b></div><div><span>BID / ASK</span><b>{money(quote?.bid)} / {money(quote?.ask)}</b></div><div><span>VOLUME</span><b>{Number.isFinite(quote?.volume)?Number(quote.volume).toLocaleString():'—'}</b></div></div><p className="qtFootnote">*Annualized standard deviation of daily close-to-close returns from the displayed candle sample; not implied volatility.</p></aside>
      <section className="qtCrossAsset panel"><div className="qtPanelHead"><div><b>CROSS-ASSET BOARD</b><span>verified availability only</span></div><Activity size={14}/></div><div className="qtCrossRows"><div><b>QQQ</b><span>Nasdaq-100 ETF</span><em className="ready">CONNECTED</em></div><div><b>SPY</b><span>S&P 500 ETF</span><em className="ready">CONNECTED</em></div><div><b>NQ / ES</b><span>direct futures feed</span><em>NOT CONNECTED</em></div><div><b>VIX / DXY / YIELDS</b><span>macro/cross-asset source</span><em>NOT CONNECTED</em></div><div><b>NEWS / EVENTS</b><span>news + economic calendar feeds</span><em>NOT CONNECTED</em></div></div></section>
      <section className="qtResearchNotes panel"><div className="qtPanelHead"><div><b>RESEARCH NOTES</b><span>saved locally by symbol</span></div><StickyNote size={14}/></div><textarea value={notes} onChange={e=>saveNotes(e.target.value)} placeholder={`Notes for ${symbol}…`}/></section>
      <section className="qtApiPanel panel"><div className="qtPanelHead"><div><b>DATA / API HEALTH</b><span>server-side secrets only</span></div><Server size={14}/></div><div className="qtApiRows"><div><Database size={12}/><span>MarketData.app</span><b>{health?.marketData?.configured?'CONNECTED':'NOT CONFIGURED'}</b><small>{health?.marketData?.lastSuccess?new Date(health.marketData.lastSuccess).toLocaleTimeString():'no successful request recorded'}</small></div><div><Waves size={12}/><span>Options</span><b>{health?.marketData?.configured?'AVAILABLE BY ENTITLEMENT':'OFFLINE'}</b><small>surface + chain endpoints</small></div><div><Activity size={12}/><span>OpenAI</span><b>{health?.openai?.configured?'CONNECTED':'NOT CONFIGURED'}</b><small>{health?.openai?.model||'—'}</small></div></div></section>
    </div>
  </div>;
}
