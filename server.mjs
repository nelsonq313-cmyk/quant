import http from 'node:http';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 5000);
const CACHE_MS = 60 * 60 * 1000;
const cache = new Map();

app.use(express.json({ limit: '1mb' }));

const cleanSymbol = (value) => String(value || 'AAPL')
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9.\-]/g, '')
  .slice(0, 12) || 'AAPL';

function authHeaders() {
  const token = process.env.MARKETDATA_TOKEN;
  return token
    ? { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    : { Accept: 'application/json' };
}

async function marketData(pathname) {
  if (!process.env.MARKETDATA_TOKEN) {
    throw new Error('MARKETDATA_TOKEN is not configured in Replit Secrets');
  }

  const response = await fetch(`https://api.marketdata.app${pathname}`, {
    headers: authHeaders(),
  });

  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Market Data returned a non-JSON response (${response.status})`);
  }

  if (![200, 203].includes(response.status) || body.s === 'error') {
    throw new Error(body.errmsg || `Market Data request failed (${response.status})`);
  }

  return body;
}

function normalizeChain(body) {
  const length = Math.max(
    body.optionSymbol?.length || 0,
    body.strike?.length || 0,
    body.iv?.length || 0,
  );

  const contracts = [];
  for (let i = 0; i < length; i += 1) {
    const iv = Number(body.iv?.[i]);
    const strike = Number(body.strike?.[i]);
    const dte = Number(body.dte?.[i]);
    if (!Number.isFinite(iv) || iv <= 0 || !Number.isFinite(strike) || !Number.isFinite(dte)) continue;
    contracts.push({
      optionSymbol: body.optionSymbol?.[i] || '',
      symbol: body.underlying?.[i] || '',
      expiration: Number(body.expiration?.[i]) || null,
      side: body.side?.[i] || '',
      strike,
      dte,
      iv,
      delta: Number(body.delta?.[i]) || null,
      gamma: Number(body.gamma?.[i]) || null,
      theta: Number(body.theta?.[i]) || null,
      vega: Number(body.vega?.[i]) || null,
      bid: Number(body.bid?.[i]) || null,
      ask: Number(body.ask?.[i]) || null,
      underlyingPrice: Number(body.underlyingPrice?.[i]) || null,
      updated: Number(body.updated?.[i]) || null,
    });
  }
  return contracts;
}

app.get('/api/options-chain', async (req, res) => {
  const symbol = cleanSymbol(req.query.symbol);
  const cached = cache.get(symbol);

  if (cached && Date.now() - cached.savedAt < CACHE_MS) {
    return res.json({
      ...cached.payload,
      cache: 'memory',
      cacheAgeMinutes: Math.round((Date.now() - cached.savedAt) / 60000),
    });
  }

  try {
    const requestedDtes = [7, 30, 60, 90];
    const responses = [];
    for (const dte of requestedDtes) {
      const params = new URLSearchParams({ dte: String(dte), strikeLimit: '8' });
      const body = await marketData(`/v1/options/chain/${encodeURIComponent(symbol)}/?${params.toString()}`);
      if (body.s !== 'no_data') responses.push(body);
    }

    const contracts = responses.flatMap(normalizeChain);
    if (!contracts.length) throw new Error(`No option contracts with implied volatility were returned for ${symbol}`);

    let underlyingPrice = contracts.find((c) => Number.isFinite(c.underlyingPrice) && c.underlyingPrice > 0)?.underlyingPrice || null;
    if (!underlyingPrice) {
      const strikes = contracts.map((c) => c.strike).sort((a, b) => a - b);
      underlyingPrice = strikes[Math.floor(strikes.length / 2)] || 1;
    }

    const timestamps = contracts.map((c) => c.updated).filter(Number.isFinite);
    const updated = timestamps.length ? new Date(Math.max(...timestamps) * 1000).toISOString() : new Date().toISOString();
    const payload = {
      symbol,
      underlyingPrice,
      source: 'Market Data delayed options adapter',
      delayed: true,
      updated,
      dteBuckets: requestedDtes,
      contracts,
    };

    cache.set(symbol, { savedAt: Date.now(), payload });
    return res.json(payload);
  } catch (error) {
    return res.status(503).json({
      error: error instanceof Error ? error.message : 'Unable to load option chain',
      hint: 'Verify MARKETDATA_TOKEN in Replit Secrets and make sure the account can access delayed options chains.',
    });
  }
});

function outputText(body) {
  if (typeof body?.output_text === 'string' && body.output_text.trim()) return body.output_text.trim();
  const parts = [];
  for (const item of body?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && content?.text) parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

app.post('/api/copilot', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured in Replit Secrets' });
  }

  const message = String(req.body?.message || '').trim().slice(0, 8000);
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-12) : [];
  const activeFile = String(req.body?.activeFile || 'research.py').slice(0, 120);
  const code = String(req.body?.code || '').slice(0, 18000);
  const researchContext = String(req.body?.researchContext || '').slice(0, 8000);

  const input = [
    ...history
      .filter((m) => ['user', 'assistant'].includes(m?.role) && typeof m?.text === 'string')
      .map((m) => ({ role: m.role, content: m.text.slice(0, 5000) })),
    {
      role: 'user',
      content: `Active file: ${activeFile}\n\nResearch context:\n${researchContext}\n\nCurrent editor contents:\n${code}\n\nRequest:\n${message}`,
    },
  ];

  const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: 'low' },
        instructions: [
          'You are QNT Copilot, a quantitative research coding assistant inside a private trading research IDE.',
          'Help with research design, statistics, backtesting, code, data cleaning, Monte Carlo, volatility, and market-regime analysis.',
          'Do not invent market observations or claim live data unless the provided context contains them.',
          'Keep financial content educational and research-focused rather than telling the user what trade to place.',
          'When the user explicitly asks you to replace or edit the active file, give a concise explanation and then include the COMPLETE proposed replacement file between <qnt_code> and </qnt_code>.',
          'Do not use qnt_code tags unless a full-file replacement is actually useful.',
        ].join(' '),
        input,
        max_output_tokens: 2200,
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({ error: body?.error?.message || `OpenAI request failed (${response.status})` });
    }

    const text = outputText(body);
    if (!text) return res.status(502).json({ error: 'OpenAI returned no text output' });
    return res.json({ text, model });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : 'Unable to reach OpenAI' });
  }
});

const server = http.createServer(app);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.use((_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { server }, allowedHosts: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the existing Replit run before starting another server.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`QNT research terminal running on port ${port}`);
});