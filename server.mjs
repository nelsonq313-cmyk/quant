import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 5000);
const CACHE_MS = 12 * 60 * 60 * 1000;
const cache = new Map();

app.use(express.json({ limit: '1mb' }));

const cleanSymbol = (value) => String(value || 'AAPL').trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '').slice(0, 12) || 'AAPL';
const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null;

function defaultHistoricalDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 7);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function authHeaders() {
  const token = process.env.MARKETDATA_TOKEN;
  return token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' };
}

async function marketData(pathname) {
  if (!process.env.MARKETDATA_TOKEN) {
    throw new Error('MARKETDATA_TOKEN is not configured in Replit Secrets');
  }
  const response = await fetch(`https://api.marketdata.app${pathname}`, { headers: authHeaders() });
  const body = await response.json().catch(() => ({}));
  if (![200, 203].includes(response.status) || body.s === 'error') {
    throw new Error(body.errmsg || `Market Data request failed (${response.status})`);
  }
  return { body, headers: response.headers };
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
    if (!Number.isFinite(iv) || !Number.isFinite(strike) || !Number.isFinite(dte)) continue;
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
  const asOf = cleanDate(req.query.date) || defaultHistoricalDate();
  const cacheKey = `${symbol}:${asOf}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < CACHE_MS) {
    return res.json({ ...cached.payload, cache: 'memory', cacheAgeMinutes: Math.round((Date.now() - cached.savedAt) / 60000) });
  }

  try {
    // A week-old historical snapshot keeps the feature free-friendly and avoids pretending the data is live.
    const requestedDtes = [7, 30, 60, 90];
    const responses = [];
    for (const dte of requestedDtes) {
      const params = new URLSearchParams({ date: asOf, dte: String(dte), strikeLimit: '5' });
      const result = await marketData(`/v1/options/chain/${encodeURIComponent(symbol)}/?${params.toString()}`);
      if (result.body.s !== 'no_data') responses.push(result.body);
    }

    const contracts = responses.flatMap(normalizeChain);
    if (!contracts.length) throw new Error(`No historical option contracts returned for ${symbol} on ${asOf}`);

    let underlyingPrice = contracts.find((c) => Number.isFinite(c.underlyingPrice) && c.underlyingPrice > 0)?.underlyingPrice || null;
    if (!underlyingPrice) {
      const strikes = contracts.map((c) => c.strike).sort((a, b) => a - b);
      underlyingPrice = strikes[Math.floor(strikes.length / 2)] || 1;
    }

    const timestamps = contracts.map((c) => c.updated).filter(Number.isFinite);
    const updated = timestamps.length ? new Date(Math.max(...timestamps) * 1000).toISOString() : `${asOf}T20:00:00.000Z`;
    const payload = {
      symbol,
      asOf,
      underlyingPrice,
      source: 'Market Data historical options adapter',
      delayed: true,
      updated,
      dteBuckets: requestedDtes,
      contracts,
    };

    cache.set(cacheKey, { savedAt: Date.now(), payload });
    res.json(payload);
  } catch (error) {
    res.status(503).json({
      error: error instanceof Error ? error.message : 'Unable to load option chain',
      hint: 'Add MARKETDATA_TOKEN in Replit Secrets. The UI will stay usable with its labeled demo surface until then.',
    });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.use((_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`QNT research terminal running on port ${port}`);
});
