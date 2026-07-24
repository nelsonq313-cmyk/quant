import http from 'node:http';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 5000);

const cache = new Map();
const API_STATE = {
  marketData: { lastSuccess: null, lastError: null },
  openai: { lastSuccess: null, lastError: null },
};

app.use(express.json({ limit: '2mb' }));

const cleanSymbol = (value, fallback = 'AAPL') => String(value || fallback)
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9.\-]/g, '')
  .slice(0, 16) || fallback;

const cleanSymbols = (value) => String(value || 'AAPL,QQQ,SPY,NVDA,MSFT')
  .split(',')
  .map((s) => cleanSymbol(s, ''))
  .filter(Boolean)
  .slice(0, 20);

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function cached(key, ttlMs) {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.savedAt > ttlMs) return null;
  return { ...hit.payload, cache: 'memory', cacheAgeSeconds: Math.round((Date.now() - hit.savedAt) / 1000) };
}

function saveCache(key, payload) {
  cache.set(key, { savedAt: Date.now(), payload });
  return payload;
}

function authHeaders() {
  const token = process.env.MARKETDATA_TOKEN;
  return token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' };
}

async function marketData(pathname) {
  if (!process.env.MARKETDATA_TOKEN) throw new Error('MARKETDATA_TOKEN is not configured in Replit Secrets');
  const response = await fetch(`https://api.marketdata.app${pathname}`, { headers: authHeaders() });
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`Market Data returned a non-JSON response (${response.status})`); }
  if (![200, 203].includes(response.status) || body.s === 'error') throw new Error(body.errmsg || `Market Data request failed (${response.status})`);
  API_STATE.marketData.lastSuccess = new Date().toISOString();
  API_STATE.marketData.lastError = null;
  return body;
}

function arrayAt(body, key, i) {
  const value = body?.[key];
  return Array.isArray(value) ? value[i] : value;
}

function normalizeChain(body) {
  const length = Math.max(body.optionSymbol?.length || 0, body.strike?.length || 0, body.iv?.length || 0);
  const contracts = [];
  for (let i = 0; i < length; i += 1) {
    const iv = num(arrayAt(body, 'iv', i));
    const strike = num(arrayAt(body, 'strike', i));
    const dte = num(arrayAt(body, 'dte', i));
    if (!iv || iv <= 0 || strike == null || dte == null) continue;
    contracts.push({
      optionSymbol: arrayAt(body, 'optionSymbol', i) || '',
      symbol: arrayAt(body, 'underlying', i) || '',
      expiration: num(arrayAt(body, 'expiration', i)),
      side: String(arrayAt(body, 'side', i) || '').toLowerCase(),
      strike,
      dte,
      iv,
      delta: num(arrayAt(body, 'delta', i)),
      gamma: num(arrayAt(body, 'gamma', i)),
      theta: num(arrayAt(body, 'theta', i)),
      vega: num(arrayAt(body, 'vega', i)),
      bid: num(arrayAt(body, 'bid', i)),
      ask: num(arrayAt(body, 'ask', i)),
      mid: num(arrayAt(body, 'mid', i)),
      last: num(arrayAt(body, 'last', i)),
      volume: num(arrayAt(body, 'volume', i)),
      openInterest: num(arrayAt(body, 'openInterest', i)),
      intrinsicValue: num(arrayAt(body, 'intrinsicValue', i)),
      extrinsicValue: num(arrayAt(body, 'extrinsicValue', i)),
      inTheMoney: Boolean(arrayAt(body, 'inTheMoney', i)),
      underlyingPrice: num(arrayAt(body, 'underlyingPrice', i)),
      updated: num(arrayAt(body, 'updated', i)),
    });
  }
  return contracts;
}

function normalizeQuotes(body) {
  const symbols = Array.isArray(body.symbol) ? body.symbol : Array.isArray(body.symbols) ? body.symbols : [];
  const length = Math.max(symbols.length, body.last?.length || 0, body.price?.length || 0);
  const out = [];
  for (let i = 0; i < length; i += 1) {
    const symbol = String(arrayAt(body, 'symbol', i) || arrayAt(body, 'symbols', i) || '').toUpperCase();
    if (!symbol) continue;
    out.push({
      symbol,
      last: num(arrayAt(body, 'last', i) ?? arrayAt(body, 'price', i)),
      change: num(arrayAt(body, 'change', i)),
      changePct: num(arrayAt(body, 'changepct', i) ?? arrayAt(body, 'changePct', i)),
      bid: num(arrayAt(body, 'bid', i)),
      ask: num(arrayAt(body, 'ask', i)),
      volume: num(arrayAt(body, 'volume', i)),
      dayHigh: num(arrayAt(body, 'dayHigh', i) ?? arrayAt(body, 'high', i)),
      dayLow: num(arrayAt(body, 'dayLow', i) ?? arrayAt(body, 'low', i)),
      prevClose: num(arrayAt(body, 'prevClose', i) ?? arrayAt(body, 'previousClose', i)),
      updated: num(arrayAt(body, 'updated', i)),
    });
  }
  return out;
}

function normalizeCandles(body) {
  const t = Array.isArray(body.t) ? body.t : [];
  const length = Math.max(t.length, body.c?.length || 0);
  const candles = [];
  for (let i = 0; i < length; i += 1) {
    const time = num(arrayAt(body, 't', i));
    const close = num(arrayAt(body, 'c', i));
    if (time == null || close == null) continue;
    candles.push({
      time,
      open: num(arrayAt(body, 'o', i)),
      high: num(arrayAt(body, 'h', i)),
      low: num(arrayAt(body, 'l', i)),
      close,
      volume: num(arrayAt(body, 'v', i)),
    });
  }
  return candles;
}

app.get('/api/status', (_req, res) => {
  res.json({
    server: { ok: true, now: new Date().toISOString(), cacheEntries: cache.size },
    marketData: {
      configured: Boolean(process.env.MARKETDATA_TOKEN),
      mode: 'provider entitlement dependent; QNT labels returned market data as delayed unless verified otherwise',
      ...API_STATE.marketData,
    },
    openai: {
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL || 'gpt-5.6-terra',
      ...API_STATE.openai,
    },
  });
});

app.get('/api/market/quotes', async (req, res) => {
  const symbols = cleanSymbols(req.query.symbols);
  const key = `quotes:${symbols.join(',')}`;
  const hit = cached(key, 60_000);
  if (hit) return res.json(hit);
  try {
    const body = await marketData(`/v1/stocks/quotes/?symbols=${encodeURIComponent(symbols.join(','))}`);
    const quotes = normalizeQuotes(body);
    if (!quotes.length) throw new Error('No supported stock/ETF quotes were returned');
    return res.json(saveCache(key, { source: 'MarketData.app stock quotes', delayed: true, updated: new Date().toISOString(), quotes }));
  } catch (error) {
    API_STATE.marketData.lastError = error instanceof Error ? error.message : 'Quote request failed';
    return res.status(503).json({ error: API_STATE.marketData.lastError });
  }
});

app.get('/api/market/candles', async (req, res) => {
  const symbol = cleanSymbol(req.query.symbol, 'QQQ');
  const resolution = String(req.query.resolution || 'D').replace(/[^0-9A-Za-z]/g, '').slice(0, 4) || 'D';
  const countback = Math.min(365, Math.max(10, Number(req.query.countback) || 90));
  const key = `candles:${symbol}:${resolution}:${countback}`;
  const hit = cached(key, 5 * 60_000);
  if (hit) return res.json(hit);
  try {
    const body = await marketData(`/v1/stocks/candles/${encodeURIComponent(resolution)}/${encodeURIComponent(symbol)}/?countback=${countback}`);
    const candles = normalizeCandles(body);
    if (!candles.length) throw new Error(`No candle data returned for ${symbol}`);
    return res.json(saveCache(key, { symbol, source: 'MarketData.app stock candles', delayed: true, updated: new Date().toISOString(), candles }));
  } catch (error) {
    API_STATE.marketData.lastError = error instanceof Error ? error.message : 'Candle request failed';
    return res.status(503).json({ error: API_STATE.marketData.lastError });
  }
});

app.get('/api/options-expirations', async (req, res) => {
  const symbol = cleanSymbol(req.query.symbol);
  const key = `expirations:${symbol}`;
  const hit = cached(key, 30 * 60_000);
  if (hit) return res.json(hit);
  try {
    const body = await marketData(`/v1/options/expirations/${encodeURIComponent(symbol)}/`);
    const expirations = (body.expirations || []).map((x) => num(x)).filter((x) => x != null);
    return res.json(saveCache(key, { symbol, source: 'MarketData.app options expirations', updated: new Date().toISOString(), expirations }));
  } catch (error) {
    API_STATE.marketData.lastError = error instanceof Error ? error.message : 'Expiration request failed';
    return res.status(503).json({ error: API_STATE.marketData.lastError });
  }
});

app.get('/api/options-chain', async (req, res) => {
  const symbol = cleanSymbol(req.query.symbol);
  const strikeLimit = Math.min(20, Math.max(4, Number(req.query.strikeLimit) || 10));
  const requestedDtes = String(req.query.dtes || '7,30,60,90')
    .split(',').map(Number).filter((x) => Number.isFinite(x) && x >= 0 && x <= 730).slice(0, 8);
  const key = `options:${symbol}:${requestedDtes.join(',')}:${strikeLimit}`;
  const hit = cached(key, 30 * 60_000);
  if (hit) return res.json(hit);

  try {
    const responses = [];
    for (const dte of requestedDtes) {
      const params = new URLSearchParams({ dte: String(dte), strikeLimit: String(strikeLimit) });
      const body = await marketData(`/v1/options/chain/${encodeURIComponent(symbol)}/?${params.toString()}`);
      if (body.s !== 'no_data') responses.push(body);
    }
    const contracts = responses.flatMap(normalizeChain);
    if (!contracts.length) throw new Error(`No option contracts with implied volatility were returned for ${symbol}`);
    let underlyingPrice = contracts.find((c) => c.underlyingPrice && c.underlyingPrice > 0)?.underlyingPrice || null;
    if (!underlyingPrice) {
      const strikes = contracts.map((c) => c.strike).sort((a, b) => a - b);
      underlyingPrice = strikes[Math.floor(strikes.length / 2)] || 1;
    }
    const timestamps = contracts.map((c) => c.updated).filter(Number.isFinite);
    const updated = timestamps.length ? new Date(Math.max(...timestamps) * 1000).toISOString() : new Date().toISOString();
    return res.json(saveCache(key, {
      symbol,
      underlyingPrice,
      source: 'MarketData.app options chain',
      delayed: true,
      updated,
      dteBuckets: requestedDtes,
      contracts,
    }));
  } catch (error) {
    API_STATE.marketData.lastError = error instanceof Error ? error.message : 'Unable to load option chain';
    return res.status(503).json({
      error: API_STATE.marketData.lastError,
      hint: 'Verify MARKETDATA_TOKEN and the account entitlement for delayed options chains.',
    });
  }
});

function outputText(body) {
  if (typeof body?.output_text === 'string' && body.output_text.trim()) return body.output_text.trim();
  const parts = [];
  for (const item of body?.output || []) {
    for (const content of item?.content || []) if (content?.type === 'output_text' && content?.text) parts.push(content.text);
  }
  return parts.join('\n').trim();
}

app.post('/api/copilot', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is not configured in Replit Secrets' });

  const message = String(req.body?.message || '').trim().slice(0, 10_000);
  if (!message) return res.status(400).json({ error: 'Message is required' });
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-16) : [];
  const activeFile = String(req.body?.activeFile || 'research.qnt').slice(0, 160);
  const code = String(req.body?.code || '').slice(0, 24_000);
  const researchContext = String(req.body?.researchContext || '').slice(0, 14_000);
  const screenContext = req.body?.screenContext && typeof req.body.screenContext === 'object' ? JSON.stringify(req.body.screenContext).slice(0, 14_000) : '{}';
  const model = process.env.OPENAI_MODEL || 'gpt-5.6-terra';

  const input = [
    ...history.filter((m) => ['user', 'assistant'].includes(m?.role) && typeof m?.text === 'string')
      .map((m) => ({ role: m.role, content: m.text.slice(0, 6000) })),
    { role: 'user', content: `ACTIVE FILE\n${activeFile}\n\nSCREEN CONTEXT\n${screenContext}\n\nRESEARCH CONTEXT\n${researchContext}\n\nEDITOR CONTENT\n${code}\n\nREQUEST\n${message}` },
  ];

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        reasoning: { effort: 'medium' },
        text: { verbosity: 'medium' },
        instructions: [
          'You are QNT Copilot, the research agent inside an original quantitative research workstation.',
          'Ground every answer in the supplied screen, model, dataset, or API context. Never invent market values, regime measurements, news, or events.',
          'Be strong at quantitative research design, Monte Carlo interpretation, statistics, data cleaning, options volatility, model diagnostics, and research code review.',
          'Treat simulated probabilities as model outputs with assumptions, never guarantees or live forecasts.',
          'When asked about a displayed metric, explicitly identify the inputs and assumptions that drive it.',
          'When the user asks to edit the active research file, explain the change briefly and include the COMPLETE proposed replacement between <qnt_code> and </qnt_code>.',
          'Do not claim arbitrary Python execution exists. Distinguish editable research drafts from functions the app actually executes.',
          'Keep suggestions research-focused; do not tell the user what live trade to place.',
        ].join(' '),
        input,
        max_output_tokens: 3500,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      API_STATE.openai.lastError = body?.error?.message || `OpenAI request failed (${response.status})`;
      return res.status(response.status).json({ error: API_STATE.openai.lastError });
    }
    const text = outputText(body);
    if (!text) throw new Error('OpenAI returned no text output');
    API_STATE.openai.lastSuccess = new Date().toISOString();
    API_STATE.openai.lastError = null;
    return res.json({ text, model, requestId: body.id || null });
  } catch (error) {
    API_STATE.openai.lastError = error instanceof Error ? error.message : 'Unable to reach OpenAI';
    return res.status(503).json({ error: API_STATE.openai.lastError });
  }
});

const server = http.createServer(app);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.use((_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
} else {
  const vite = await createViteServer({ server: { middlewareMode: true, hmr: { server }, allowedHosts: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`Port ${port} is already in use. Stop the existing Replit run before starting another server.`);
  else console.error('Server error:', err);
  process.exit(1);
});

server.listen(port, '0.0.0.0', () => console.log(`QNT research terminal running on port ${port}`));
