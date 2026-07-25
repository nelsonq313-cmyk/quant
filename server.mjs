import http from 'node:http';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const app=express();
const port=Number(process.env.PORT||5000);
const cache=new Map();
const API_STATE={marketData:{lastSuccess:null,lastError:null},openai:{lastSuccess:null,lastError:null,lastMode:null,lastModel:null}};
app.use(express.json({limit:'12mb'}));

const cleanSymbol=(value,fallback='AAPL')=>String(value||fallback).trim().toUpperCase().replace(/[^A-Z0-9.\-]/g,'').slice(0,16)||fallback;
const cleanSymbols=value=>String(value||'AAPL,QQQ,SPY,NVDA,MSFT').split(',').map(s=>cleanSymbol(s,'')).filter(Boolean).slice(0,20);
const num=value=>{const n=Number(value);return Number.isFinite(n)?n:null};
const at=(body,key,i)=>Array.isArray(body?.[key])?body[key][i]:body?.[key];
function cached(key,ttl){const hit=cache.get(key);if(!hit||Date.now()-hit.savedAt>ttl)return null;return{...hit.payload,cache:'memory',cacheAgeSeconds:Math.round((Date.now()-hit.savedAt)/1000)}}
function saveCache(key,payload){cache.set(key,{savedAt:Date.now(),payload});return payload}
function authHeaders(){const token=process.env.MARKETDATA_TOKEN;return token?{Authorization:`Bearer ${token}`,Accept:'application/json'}:{Accept:'application/json'}}

async function marketData(pathname){
  if(!process.env.MARKETDATA_TOKEN)throw new Error('MARKETDATA_TOKEN is not configured in Replit Secrets');
  const response=await fetch(`https://api.marketdata.app${pathname}`,{headers:authHeaders()});
  if(response.status===204)throw new Error('MarketData returned no cached data (204)');
  const text=await response.text();let body={};
  try{body=text?JSON.parse(text):{}}catch{throw new Error(`MarketData returned a non-JSON response (${response.status})`)}
  if(![200,203].includes(response.status)||body.s==='error')throw new Error(body.errmsg||`MarketData request failed (${response.status})`);
  API_STATE.marketData.lastSuccess=new Date().toISOString();API_STATE.marketData.lastError=null;return body;
}

function normalizeQuotes(body){const symbols=Array.isArray(body.symbol)?body.symbol:Array.isArray(body.symbols)?body.symbols:[],length=Math.max(symbols.length,body.last?.length||0,body.price?.length||0),out=[];for(let i=0;i<length;i++){const symbol=String(at(body,'symbol',i)||at(body,'symbols',i)||'').toUpperCase();if(!symbol)continue;out.push({symbol,last:num(at(body,'last',i)??at(body,'price',i)),change:num(at(body,'change',i)),changePct:num(at(body,'changepct',i)??at(body,'changePct',i)),bid:num(at(body,'bid',i)),ask:num(at(body,'ask',i)),volume:num(at(body,'volume',i)),dayHigh:num(at(body,'dayHigh',i)??at(body,'high',i)),dayLow:num(at(body,'dayLow',i)??at(body,'low',i)),prevClose:num(at(body,'prevClose',i)??at(body,'previousClose',i)),updated:num(at(body,'updated',i))})}return out}
function normalizeCandles(body){const t=Array.isArray(body.t)?body.t:[],length=Math.max(t.length,body.c?.length||0),out=[];for(let i=0;i<length;i++){const time=num(at(body,'t',i)),close=num(at(body,'c',i));if(time==null||close==null)continue;out.push({time,open:num(at(body,'o',i)),high:num(at(body,'h',i)),low:num(at(body,'l',i)),close,volume:num(at(body,'v',i))})}return out}
function normalizeChain(body){const length=Math.max(body.optionSymbol?.length||0,body.strike?.length||0,body.iv?.length||0),out=[];for(let i=0;i<length;i++){const iv=num(at(body,'iv',i)),strike=num(at(body,'strike',i)),dte=num(at(body,'dte',i));if(!iv||iv<=0||strike==null||dte==null)continue;out.push({optionSymbol:at(body,'optionSymbol',i)||'',symbol:at(body,'underlying',i)||'',expiration:num(at(body,'expiration',i)),side:String(at(body,'side',i)||'').toLowerCase(),strike,dte,iv,delta:num(at(body,'delta',i)),gamma:num(at(body,'gamma',i)),theta:num(at(body,'theta',i)),vega:num(at(body,'vega',i)),bid:num(at(body,'bid',i)),ask:num(at(body,'ask',i)),mid:num(at(body,'mid',i)),last:num(at(body,'last',i)),volume:num(at(body,'volume',i)),openInterest:num(at(body,'openInterest',i)),intrinsicValue:num(at(body,'intrinsicValue',i)),extrinsicValue:num(at(body,'extrinsicValue',i)),inTheMoney:Boolean(at(body,'inTheMoney',i)),underlyingPrice:num(at(body,'underlyingPrice',i)),updated:num(at(body,'updated',i))})}return out}
function normalizeNews(body){const length=Math.max(body.headline?.length||0,body.source?.length||0,body.publicationDate?.length||0),out=[];for(let i=0;i<length;i++){const headline=String(at(body,'headline',i)||'').trim();if(!headline)continue;out.push({symbol:String(at(body,'symbol',i)||'').toUpperCase(),headline:headline.slice(0,500),source:String(at(body,'source',i)||'').trim(),publicationDate:num(at(body,'publicationDate',i))})}return out}
function normalizeEarnings(body){const length=Math.max(body.reportDate?.length||0,body.fiscalYear?.length||0,body.reportedEPS?.length||0),out=[];for(let i=0;i<length;i++)out.push({symbol:String(at(body,'symbol',i)||'').toUpperCase(),fiscalYear:num(at(body,'fiscalYear',i)),fiscalQuarter:num(at(body,'fiscalQuarter',i)),date:num(at(body,'date',i)),reportDate:num(at(body,'reportDate',i)),reportTime:String(at(body,'reportTime',i)||''),currency:String(at(body,'currency',i)||''),reportedEPS:num(at(body,'reportedEPS',i)),estimatedEPS:num(at(body,'estimatedEPS',i)),surpriseEPS:num(at(body,'surpriseEPS',i)),surpriseEPSpct:num(at(body,'surpriseEPSpct',i)),updated:num(at(body,'updated',i))});return out}

const defaultModels={fast:'gpt-5.6-luna',research:'gpt-5.6-terra',deep:'gpt-5.6'};
function copilotProfile(body,message){
  const requested=String(body?.mode||'').toLowerCase();
  const deepIntent=/\b(?:\/deep|deep audit|full audit|exhaustive|overfitting audit|comprehensive robustness)\b/i.test(message);
  const usePython=Boolean(body?.usePython);
  const allowWeb=Boolean(body?.allowWeb);
  const mode=['fast','research','deep'].includes(requested)?requested:(deepIntent?'deep':(usePython||allowWeb?'research':'fast'));
  if(mode==='deep')return{mode,model:process.env.OPENAI_MODEL||defaultModels.deep,effort:'medium',verbosity:'medium',maxOutput:6500,usePython:true,allowWeb};
  if(mode==='research')return{mode,model:process.env.OPENAI_RESEARCH_MODEL||defaultModels.research,effort:'low',verbosity:'medium',maxOutput:4200,usePython,allowWeb};
  return{mode,model:process.env.OPENAI_FAST_MODEL||defaultModels.fast,effort:'none',verbosity:'low',maxOutput:1800,usePython:false,allowWeb:false};
}
function compactContext(value,max){return typeof value==='string'?value.slice(0,max):JSON.stringify(value??{}).slice(0,max)}
function writeNdjson(res,payload){if(!res.writableEnded)res.write(`${JSON.stringify(payload)}\n`)}
function responseText(body){if(typeof body?.output_text==='string'&&body.output_text.trim())return body.output_text.trim();const out=[];for(const item of body?.output||[])for(const part of item?.content||[])if(part?.type==='output_text'&&part?.text)out.push(part.text);return out.join('\n').trim()}
function parseJsonText(text){const clean=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');return JSON.parse(clean)}

app.get('/api/status',(_req,res)=>res.json({server:{ok:true,now:new Date().toISOString(),cacheEntries:cache.size},marketData:{configured:Boolean(process.env.MARKETDATA_TOKEN),mode:'entitlement dependent; QNT labels provider market data as delayed unless verified otherwise',...API_STATE.marketData},openai:{configured:Boolean(process.env.OPENAI_API_KEY),models:{fast:process.env.OPENAI_FAST_MODEL||defaultModels.fast,research:process.env.OPENAI_RESEARCH_MODEL||defaultModels.research,deep:process.env.OPENAI_MODEL||defaultModels.deep,journal:process.env.OPENAI_JOURNAL_MODEL||defaultModels.fast},tools:['on-demand code_interpreter','optional web_search','journal vision'],...API_STATE.openai}}));

app.get('/api/market/quotes',async(req,res)=>{const symbols=cleanSymbols(req.query.symbols),key=`quotes:${symbols.join(',')}`,hit=cached(key,60_000);if(hit)return res.json(hit);try{const body=await marketData(`/v1/stocks/quotes/?symbols=${encodeURIComponent(symbols.join(','))}`),quotes=normalizeQuotes(body);if(!quotes.length)throw new Error('No supported stock/ETF quotes were returned');return res.json(saveCache(key,{source:'MarketData.app stock quotes',delayed:true,updated:new Date().toISOString(),quotes}))}catch(error){API_STATE.marketData.lastError=error instanceof Error?error.message:'Quote request failed';return res.status(503).json({error:API_STATE.marketData.lastError})}});
app.get('/api/market/candles',async(req,res)=>{const symbol=cleanSymbol(req.query.symbol,'QQQ'),resolution=String(req.query.resolution||'D').replace(/[^0-9A-Za-z]/g,'').slice(0,4)||'D',countback=Math.min(365,Math.max(10,Number(req.query.countback)||90)),key=`candles:${symbol}:${resolution}:${countback}`,hit=cached(key,5*60_000);if(hit)return res.json(hit);try{const body=await marketData(`/v1/stocks/candles/${encodeURIComponent(resolution)}/${encodeURIComponent(symbol)}/?countback=${countback}`),candles=normalizeCandles(body);if(!candles.length)throw new Error(`No candle data returned for ${symbol}`);return res.json(saveCache(key,{symbol,source:'MarketData.app stock candles',delayed:true,updated:new Date().toISOString(),candles}))}catch(error){API_STATE.marketData.lastError=error instanceof Error?error.message:'Candle request failed';return res.status(503).json({error:API_STATE.marketData.lastError})}});
app.get('/api/market/news',async(req,res)=>{const symbol=cleanSymbol(req.query.symbol,'AAPL'),countback=Math.min(100,Math.max(1,Number(req.query.countback)||20)),key=`news:${symbol}:${countback}`,hit=cached(key,10*60_000);if(hit)return res.json(hit);try{const body=await marketData(`/v1/stocks/news/${encodeURIComponent(symbol)}/?countback=${countback}`);return res.json(saveCache(key,{symbol,source:'MarketData.app stock news beta',beta:true,updated:new Date().toISOString(),articles:normalizeNews(body)}))}catch(error){API_STATE.marketData.lastError=error instanceof Error?error.message:'News request failed';return res.status(503).json({error:API_STATE.marketData.lastError,beta:true})}});
app.get('/api/market/earnings',async(req,res)=>{const symbol=cleanSymbol(req.query.symbol,'AAPL'),countback=Math.min(40,Math.max(1,Number(req.query.countback)||12)),key=`earnings:${symbol}:${countback}`,hit=cached(key,30*60_000);if(hit)return res.json(hit);try{const body=await marketData(`/v1/stocks/earnings/${encodeURIComponent(symbol)}/?countback=${countback}`);return res.json(saveCache(key,{symbol,source:'MarketData.app earnings',updated:new Date().toISOString(),reports:normalizeEarnings(body)}))}catch(error){API_STATE.marketData.lastError=error instanceof Error?error.message:'Earnings request failed';return res.status(503).json({error:API_STATE.marketData.lastError})}});
app.get('/api/options-expirations',async(req,res)=>{const symbol=cleanSymbol(req.query.symbol),key=`expirations:${symbol}`,hit=cached(key,30*60_000);if(hit)return res.json(hit);try{const body=await marketData(`/v1/options/expirations/${encodeURIComponent(symbol)}/`),expirations=(body.expirations||[]).map(num).filter(x=>x!=null);return res.json(saveCache(key,{symbol,source:'MarketData.app options expirations',updated:new Date().toISOString(),expirations}))}catch(error){API_STATE.marketData.lastError=error instanceof Error?error.message:'Expiration request failed';return res.status(503).json({error:API_STATE.marketData.lastError})}});
app.get('/api/options-chain',async(req,res)=>{const symbol=cleanSymbol(req.query.symbol),strikeLimit=Math.min(20,Math.max(4,Number(req.query.strikeLimit)||10)),requestedDtes=String(req.query.dtes||'7,30,60,90').split(',').map(Number).filter(x=>Number.isFinite(x)&&x>=0&&x<=730).slice(0,8),key=`options:${symbol}:${requestedDtes.join(',')}:${strikeLimit}`,hit=cached(key,30*60_000);if(hit)return res.json(hit);try{const responses=[];for(const dte of requestedDtes){const params=new URLSearchParams({dte:String(dte),strikeLimit:String(strikeLimit)}),body=await marketData(`/v1/options/chain/${encodeURIComponent(symbol)}/?${params.toString()}`);if(body.s!=='no_data')responses.push(body)}const contracts=responses.flatMap(normalizeChain);if(!contracts.length)throw new Error(`No option contracts with implied volatility were returned for ${symbol}`);let underlyingPrice=contracts.find(c=>c.underlyingPrice&&c.underlyingPrice>0)?.underlyingPrice||null;if(!underlyingPrice){const strikes=contracts.map(c=>c.strike).sort((a,b)=>a-b);underlyingPrice=strikes[Math.floor(strikes.length/2)]||1}const timestamps=contracts.map(c=>c.updated).filter(Number.isFinite),updated=timestamps.length?new Date(Math.max(...timestamps)*1000).toISOString():new Date().toISOString();return res.json(saveCache(key,{symbol,underlyingPrice,source:'MarketData.app options chain',delayed:true,updated,dteBuckets:requestedDtes,contracts}))}catch(error){API_STATE.marketData.lastError=error instanceof Error?error.message:'Unable to load option chain';return res.status(503).json({error:API_STATE.marketData.lastError,hint:'Verify MARKETDATA_TOKEN and the account entitlement for delayed options chains.'})}});

app.post('/api/journal/refine',async(req,res)=>{
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'OPENAI_API_KEY is not configured in Replit Secrets'});
  const mode=req.body?.mode==='charts'?'charts':'notes',trade=req.body?.trade&&typeof req.body.trade==='object'?req.body.trade:{},memory=Array.isArray(req.body?.memory)?req.body.memory.slice(0,10):[];
  const images=(Array.isArray(req.body?.images)?req.body.images:[]).filter(x=>typeof x?.dataUrl==='string'&&x.dataUrl.startsWith('data:image/')&&x.dataUrl.length<=3_500_000).slice(0,3);
  if(mode==='notes'&&!String(trade.notes||'').trim())return res.status(400).json({error:'Rough journal notes are required'});
  if(mode==='charts'&&!images.length)return res.status(400).json({error:'At least one chart image is required'});
  const model=process.env.OPENAI_JOURNAL_MODEL||defaultModels.fast;
  const safeTrade={date:String(trade.date||'').slice(0,20),time:String(trade.time||'').slice(0,12),instrument:String(trade.instrument||'').slice(0,20),direction:String(trade.direction||'').slice(0,12),session:String(trade.session||'').slice(0,30),result:String(trade.result||'').slice(0,12),pnl:num(trade.pnl),risk:num(trade.risk),rMultiple:num(trade.rMultiple),concepts:Array.isArray(trade.concepts)?trade.concepts.slice(0,30):[],notes:String(trade.notes||'').slice(0,18_000)};
  const safeMemory=memory.map(t=>({date:String(t.date||'').slice(0,20),instrument:String(t.instrument||'').slice(0,20),direction:String(t.direction||'').slice(0,12),session:String(t.session||'').slice(0,30),result:String(t.result||'').slice(0,12),notes:String(t.notes||'').slice(0,5000),concepts:Array.isArray(t.concepts)?t.concepts.slice(0,20):[],refinedJournal:String(t.refinedJournal||'').slice(0,5000),researchQuestions:Array.isArray(t.researchQuestions)?t.researchQuestions.slice(0,3):[],improvement:String(t.improvement||'').slice(0,1200)}));
  const instructions=[
    'You are the QNT Trade Journal Refiner. This is retrospective journaling and research reflection only, never a live trade signal, forecast, setup call, or instruction to enter a market.',
    'Return ONLY valid JSON with exactly these keys: refinedJournal (string), thinkDeeper (array of 1 to 3 strings), improvement (string), patternInsights (array of 0 to 3 strings).',
    mode==='charts'?'Read the marked screenshots in order as higher-timeframe context, intraday/range context, then entry context when that ordering fits the supplied images. Notes are optional clarification. State uncertainty only where the visual evidence is genuinely insufficient.':'Rewrite the rough notes into a clear first-person journal narrative. Preserve every supplied fact, qualification, causal link, uncertainty, management detail, and ICT term. Improve organization and grammar without adding facts.',
    'Preserve ICT terminology and distinctions instead of translating them into generic support/resistance language. IOFED is a partial FVG/gap interaction that leaves before CE with displacement; CE is midpoint; CISD is a close through the candle or sequence that initiated the prior move; OB is a candle or sequence made important after a close beyond it; RB is a reaction wick created from reacting in a meaningful PD array; later RBs can nest through reaction lineage; BAG is breakaway gap; internal liquidity is within the active range and external liquidity is outside it.',
    'When charts are supplied, trace the reaction lineage. Do not collapse OB/CISD -> reaction wick/RB -> later nested RB -> entry into a vague random-wick explanation.',
    'Research questions should test sequencing, causality, alternative explanations, or what evidence should be recorded next. Avoid shallow acronym repetition and generic psychology coaching.',
    'Give one concrete observation to record or one optional experiment for the next genuinely comparable trade. Do not manufacture a rule from one trade.',
    'Past-trade memory is context only. Never blend old trade facts into the current trade. Only return patternInsights when at least three comparable prior trades support the observation; otherwise use an empty array.'
  ].join(' ');
  const content=[{type:'input_text',text:`MODE\n${mode}\n\nCURRENT TRADE\n${JSON.stringify(safeTrade)}\n\nPAST TRADE MEMORY\n${JSON.stringify(safeMemory)}`}];
  for(const img of images)content.push({type:'input_image',image_url:img.dataUrl,detail:'auto'});
  try{
    const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,reasoning:{effort:'low'},text:{verbosity:'medium'},instructions,input:[{role:'user',content}],max_output_tokens:3000})});
    const body=await upstream.json().catch(()=>({}));if(!upstream.ok){const error=body?.error?.message||`OpenAI request failed (${upstream.status})`;API_STATE.openai.lastError=error;return res.status(upstream.status).json({error})}
    const text=responseText(body);if(!text)throw new Error('OpenAI returned no journal text');let parsed;try{parsed=parseJsonText(text)}catch{throw new Error('Journal refiner returned invalid JSON')}
    const result={refinedJournal:String(parsed.refinedJournal||'').trim(),thinkDeeper:(Array.isArray(parsed.thinkDeeper)?parsed.thinkDeeper:[]).map(String).filter(Boolean).slice(0,3),improvement:String(parsed.improvement||'').trim(),patternInsights:(Array.isArray(parsed.patternInsights)?parsed.patternInsights:[]).map(String).filter(Boolean).slice(0,3),model,source:'QNT Journal Refiner'};
    if(!result.refinedJournal)throw new Error('Journal refiner returned an empty narrative');API_STATE.openai.lastSuccess=new Date().toISOString();API_STATE.openai.lastError=null;API_STATE.openai.lastMode='journal';API_STATE.openai.lastModel=model;return res.json(result)
  }catch(error){API_STATE.openai.lastError=error instanceof Error?error.message:'Unable to refine journal';return res.status(503).json({error:API_STATE.openai.lastError})}
});

app.post('/api/copilot',async(req,res)=>{
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'OPENAI_API_KEY is not configured in Replit Secrets'});
  const message=String(req.body?.message||'').trim().slice(0,10_000);if(!message)return res.status(400).json({error:'Message is required'});
  const profile=copilotProfile(req.body,message);
  const historyLimit=profile.mode==='fast'?6:profile.mode==='research'?10:14;
  const historyChars=profile.mode==='fast'?2400:profile.mode==='research'?4200:6000;
  const codeLimit=profile.mode==='fast'?5000:profile.mode==='research'?18_000:28_000;
  const contextLimit=profile.mode==='fast'?5000:profile.mode==='research'?12_000:20_000;
  const screenLimit=profile.mode==='fast'?6000:profile.mode==='research'?14_000:24_000;
  const history=Array.isArray(req.body?.history)?req.body.history.slice(-historyLimit):[];
  const activeFile=String(req.body?.activeFile||'research.py').slice(0,160);
  const code=String(req.body?.code||'').slice(0,codeLimit);
  const researchContext=compactContext(req.body?.researchContext||'',contextLimit);
  const screenContext=compactContext(req.body?.screenContext||{},screenLimit);
  const input=[...history.filter(m=>['user','assistant'].includes(m?.role)&&typeof m?.text==='string').map(m=>({role:m.role,content:m.text.slice(0,historyChars)})),{role:'user',content:`ACTIVE FILE\n${activeFile}\n\nSCREEN CONTEXT\n${screenContext}\n\nRESEARCH CONTEXT\n${researchContext}\n\nEDITOR CONTENT\n${code}\n\nREQUEST\n${message}`}];
  const tools=[];
  if(profile.usePython)tools.push({type:'code_interpreter',container:{type:'auto'}});
  if(profile.allowWeb)tools.push({type:'web_search'});
  const artifactSchema=[
    'When a calculation benefits from a visual or structured result, use Python Code Interpreter and emit one or more compact artifacts exactly between <qnt_artifact> and </qnt_artifact>.',
    'Valid artifact JSON shapes:',
    'surface3d: {"kind":"surface3d","title":"...","xLabel":"...","yLabel":"...","zLabel":"...","x":[numbers],"y":[numbers],"z":[[numbers]],"note":"..."}. Keep grids <=15x15; QNT smooths the rendered mesh client-side.',
    'line/bar: {"kind":"line"|"bar","title":"...","xKey":"x","series":[{"key":"value","label":"..."}],"data":[{"x":...,"value":...}]}. Keep <=150 rows.',
    'scatter: {"kind":"scatter","title":"...","xKey":"x","yKey":"y","data":[{"x":...,"y":...}]}.',
    'table: {"kind":"table","title":"...","columns":["..."],"rows":[[...]]}.',
    'metrics: {"kind":"metrics","title":"...","items":[{"label":"...","value":"...","sub":"..."}]}.',
    'Artifact tags must contain strict JSON only, no markdown fences inside the tag.'
  ].join(' ');
  const instructions=[
    'You are QNT Research Agent inside an original quantitative research workstation.',
    'Ground every answer in supplied screen/model/dataset/API context. Never invent market values, regime measurements, news, or events.',
    profile.usePython?'Use Code Interpreter for the requested quantitative calculation or model.':'Do not claim to have run Python unless Code Interpreter is enabled for this request.',
    profile.allowWeb?'Web search is enabled. Clearly distinguish external research from QNT data and cite source names or URLs used.':'Web search is disabled; do not imply current internet research.',
    'Be strong at quantitative research design, validation, Monte Carlo interpretation, statistics, data cleaning, options volatility, factor research, model diagnostics and code review.',
    'Treat simulated probabilities as model outputs with assumptions, never guarantees or live forecasts.',
    'When asked about a displayed metric, identify the inputs and assumptions that drive it.',
    'When asked to edit the active research file, briefly explain and include the COMPLETE proposed replacement between <qnt_code> and </qnt_code>.',
    profile.usePython?artifactSchema:'',
    'Do not claim direct NQ/MNQ regime measurements unless verified futures context is supplied. Do not substitute equity ETF proxies as if they were futures.',
    'Keep suggestions research-focused; do not tell the user what live trade to place.'
  ].filter(Boolean).join(' ');
  try{
    const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:profile.model,reasoning:{effort:profile.effort},text:{verbosity:profile.verbosity},tools,instructions,input,max_output_tokens:profile.maxOutput,stream:true})});
    if(!upstream.ok){const body=await upstream.json().catch(()=>({}));API_STATE.openai.lastError=body?.error?.message||`OpenAI request failed (${upstream.status})`;return res.status(upstream.status).json({error:API_STATE.openai.lastError})}
    if(!upstream.body)throw new Error('OpenAI returned no streaming body');
    res.status(200);res.setHeader('Content-Type','application/x-ndjson; charset=utf-8');res.setHeader('Cache-Control','no-cache, no-transform');res.setHeader('Connection','keep-alive');res.setHeader('X-Accel-Buffering','no');res.flushHeaders?.();
    writeNdjson(res,{type:'meta',mode:profile.mode,model:profile.model,tools:tools.map(t=>t.type)});
    const reader=upstream.body.getReader(),decoder=new TextDecoder();let buffer='',fullText='',requestId=null;
    const consumeBlock=block=>{for(const line of block.split('\n')){if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(!raw||raw==='[DONE]')continue;let event;try{event=JSON.parse(raw)}catch{continue}if(event.type==='response.output_text.delta'&&typeof event.delta==='string'){fullText+=event.delta;writeNdjson(res,{type:'delta',delta:event.delta})}else if(event.type==='response.completed'){requestId=event.response?.id||requestId}else if(event.type==='error'){throw new Error(event.error?.message||event.message||'OpenAI streaming error')}}};
    while(true){const{value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let idx;while((idx=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,idx);buffer=buffer.slice(idx+2);consumeBlock(block)}}
    buffer+=decoder.decode();if(buffer.trim())consumeBlock(buffer);
    if(!fullText.trim())throw new Error('OpenAI returned no text output');
    API_STATE.openai.lastSuccess=new Date().toISOString();API_STATE.openai.lastError=null;API_STATE.openai.lastMode=profile.mode;API_STATE.openai.lastModel=profile.model;
    writeNdjson(res,{type:'done',mode:profile.mode,model:profile.model,requestId});return res.end();
  }catch(error){API_STATE.openai.lastError=error instanceof Error?error.message:'Unable to reach OpenAI';if(res.headersSent){writeNdjson(res,{type:'error',error:API_STATE.openai.lastError});return res.end()}return res.status(503).json({error:API_STATE.openai.lastError})}
});

const server=http.createServer(app);
if(process.env.NODE_ENV==='production'){app.use(express.static(path.join(__dirname,'dist')));app.use((_req,res)=>res.sendFile(path.join(__dirname,'dist','index.html')))}else{const vite=await createViteServer({server:{middlewareMode:true,hmr:{server},allowedHosts:true},appType:'spa'});app.use(vite.middlewares)}
server.on('error',err=>{if(err.code==='EADDRINUSE')console.error(`Port ${port} is already in use. Stop the existing Replit run before starting another server.`);else console.error('Server error:',err);process.exit(1)});
server.listen(port,'0.0.0.0',()=>console.log(`QNT research terminal running on port ${port}`));
