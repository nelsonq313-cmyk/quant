import React, { useEffect, useMemo, useState } from 'react';
import './volatility.css';
import { Activity, Braces, Database, FileCode2, Folder, Play, RefreshCw, Search, Waves } from 'lucide-react';

const DTE_BUCKETS = [7, 30, 60, 90];
const MONEYNESS_LEVELS = [-0.15, -0.10, -0.05, 0, 0.05, 0.10, 0.15];

function demoPayload(symbol = 'AAPL') {
  const underlyingPrice = 225;
  const contracts = [];
  DTE_BUCKETS.forEach((dte, di) => {
    MONEYNESS_LEVELS.forEach((m, mi) => {
      const strike = Math.round((underlyingPrice * (1 + m)) / 2.5) * 2.5;
      const smile = 0.205 + Math.abs(m) * 0.43 + Math.max(-m, 0) * 0.17;
      const term = di * 0.012;
      const wave = Math.sin((mi + 1) * 0.9 + di * 0.7) * 0.008;
      ['call', 'put'].forEach((side) => {
        contracts.push({
          symbol,
          side,
          strike,
          dte,
          expiration: Date.now() / 1000 + dte * 86400,
          iv: Math.max(0.12, smile + term + wave + (side === 'put' ? Math.max(-m, 0) * 0.03 : 0)),
          delta: side === 'call' ? Math.max(0.08, 0.50 - m * 2.5) : Math.min(-0.08, -0.50 - m * 2.5),
        });
      });
    });
  });
  return {
    symbol,
    underlyingPrice,
    source: 'Demo surface',
    delayed: true,
    updated: new Date().toISOString(),
    contracts,
    demo: true,
  };
}

function nearestContract(contracts, targetStrike, side) {
  const filtered = contracts.filter((c) => (side === 'blend' || c.side === side) && Number.isFinite(c.iv));
  if (!filtered.length) return null;
  if (side === 'blend') {
    const calls = filtered.filter((c) => c.side === 'call');
    const puts = filtered.filter((c) => c.side === 'put');
    const call = calls.sort((a, b) => Math.abs(a.strike - targetStrike) - Math.abs(b.strike - targetStrike))[0];
    const put = puts.sort((a, b) => Math.abs(a.strike - targetStrike) - Math.abs(b.strike - targetStrike))[0];
    if (call && put) return { ...call, iv: (call.iv + put.iv) / 2 };
    return call || put || null;
  }
  return filtered.sort((a, b) => Math.abs(a.strike - targetStrike) - Math.abs(b.strike - targetStrike))[0];
}

function buildSurface(payload, side) {
  const contracts = (payload.contracts || []).filter((c) => c.iv > 0.02 && c.iv < 5 && c.dte >= 0);
  const spot = payload.underlyingPrice || 1;
  const dtes = [...new Set(contracts.map((c) => c.dte))].sort((a, b) => a - b).slice(0, 7);
  const chosenDtes = dtes.length ? dtes : DTE_BUCKETS;
  const rows = chosenDtes.map((dte) => {
    const bucket = contracts.filter((c) => c.dte === dte);
    return MONEYNESS_LEVELS.map((m) => {
      const targetStrike = spot * (1 + m);
      const contract = nearestContract(bucket, targetStrike, side);
      return {
        dte,
        moneyness: m,
        strike: contract?.strike ?? targetStrike,
        iv: contract?.iv ?? 0,
      };
    });
  });
  return { rows, dtes: chosenDtes, spot };
}

function projectPoint(xi, yi, iv, minIv, maxIv) {
  const z = maxIv === minIv ? 0.5 : (iv - minIv) / (maxIv - minIv);
  return {
    x: 84 + xi * 69 + yi * 30,
    y: 278 - yi * 22 - z * 145 - xi * 5,
  };
}

function Surface3D({ surface }) {
  const values = surface.rows.flat().map((p) => p.iv).filter((v) => v > 0);
  const minIv = Math.min(...values, 0.15);
  const maxIv = Math.max(...values, 0.45);
  const faces = [];
  for (let x = 0; x < surface.rows.length - 1; x += 1) {
    for (let y = 0; y < MONEYNESS_LEVELS.length - 1; y += 1) {
      const pts = [
        projectPoint(x, y, surface.rows[x][y].iv, minIv, maxIv),
        projectPoint(x + 1, y, surface.rows[x + 1][y].iv, minIv, maxIv),
        projectPoint(x + 1, y + 1, surface.rows[x + 1][y + 1].iv, minIv, maxIv),
        projectPoint(x, y + 1, surface.rows[x][y + 1].iv, minIv, maxIv),
      ];
      const avg = [surface.rows[x][y].iv, surface.rows[x + 1][y].iv, surface.rows[x + 1][y + 1].iv, surface.rows[x][y + 1].iv].reduce((a, b) => a + b, 0) / 4;
      const t = Math.max(0, Math.min(1, (avg - minIv) / (maxIv - minIv || 1)));
      const hue = 258 - t * 65;
      faces.push(
        <polygon
          key={`${x}-${y}`}
          points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
          fill={`hsla(${hue}, 78%, ${42 + t * 16}%, .70)`}
          stroke="rgba(204,190,255,.24)"
          strokeWidth="0.8"
        />,
      );
    }
  }

  return (
    <svg className="volSurface" viewBox="0 0 720 360" role="img" aria-label="Implied volatility surface">
      <defs>
        <linearGradient id="surfaceFloor" x1="0" x2="1">
          <stop offset="0" stopColor="#08090c" />
          <stop offset="1" stopColor="#11121a" />
        </linearGradient>
      </defs>
      <polygon points="65,290 500,258 665,138 224,175" fill="url(#surfaceFloor)" stroke="#272a31" />
      {faces}
      {surface.dtes.map((dte, xi) => {
        const p = projectPoint(xi, 0, minIv, minIv, maxIv);
        return <text key={dte} x={p.x - 4} y="326" className="surfaceAxis">{dte}d</text>;
      })}
      {MONEYNESS_LEVELS.map((m, yi) => {
        const p = projectPoint(0, yi, minIv, minIv, maxIv);
        return <text key={m} x={Math.max(8, p.x - 72)} y={Math.min(318, p.y + 56)} className="surfaceAxis">{m === 0 ? 'ATM' : `${Math.round(m * 100)}%`}</text>;
      })}
      <text x="326" y="350" className="surfaceTitleAxis">DAYS TO EXPIRY</text>
      <text x="18" y="66" className="surfaceTitleAxis">IV</text>
      <text x="575" y="208" className="surfaceTitleAxis">MONEYNESS</text>
    </svg>
  );
}

function metricSummary(surface) {
  if (!surface.rows.length) return { atm: 0, skew: 0, term: 0, min: 0, max: 0 };
  const atmIndex = MONEYNESS_LEVELS.indexOf(0);
  const atmValues = surface.rows.map((r) => r[atmIndex]?.iv || 0).filter(Boolean);
  const first = surface.rows[0];
  const putWing = first?.[1]?.iv || 0;
  const callWing = first?.[5]?.iv || 0;
  const values = surface.rows.flat().map((p) => p.iv).filter(Boolean);
  return {
    atm: atmValues[0] || 0,
    skew: putWing - callWing,
    term: (atmValues.at(-1) || 0) - (atmValues[0] || 0),
    min: Math.min(...values, 0),
    max: Math.max(...values, 0),
  };
}

export default function VolatilityLab() {
  const [symbol, setSymbol] = useState('AAPL');
  const [query, setQuery] = useState('AAPL');
  const [side, setSide] = useState('blend');
  const [payload, setPayload] = useState(() => demoPayload('AAPL'));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Demo surface loaded. Connect the free delayed-data token to replace it.');

  const load = async (requested = query) => {
    const clean = String(requested || 'AAPL').trim().toUpperCase();
    setLoading(true);
    setMessage('Loading delayed option-chain snapshots…');
    try {
      const res = await fetch(`/api/options-chain?symbol=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.contracts) || !data.contracts.length) throw new Error(data.error || 'No option data returned');
      setPayload(data);
      setQuery(clean);
      setSymbol(clean);
      setMessage(`${data.source || 'Options API'} • ${data.delayed ? 'delayed data' : 'live data'}`);
      try {
        const key = `qnt.iv.archive.${clean}`;
        const prior = JSON.parse(localStorage.getItem(key) || '[]');
        const next = [...prior, { updated: data.updated, underlyingPrice: data.underlyingPrice, contracts: data.contracts }].slice(-30);
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Archiving is best-effort only.
      }
    } catch (error) {
      setPayload(demoPayload(clean));
      setQuery(clean);
      setSymbol(clean);
      setMessage(`${error.message}. Showing a clearly labeled demo surface instead.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load('AAPL');
    // Run once on first mount; refresh is manual after that to conserve free API credits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const surface = useMemo(() => buildSurface(payload, side), [payload, side]);
  const metrics = useMemo(() => metricSummary(surface), [surface]);
  const updated = payload.updated ? new Date(payload.updated).toLocaleString() : '—';

  return (
    <div className="volLabGrid">
      <aside className="volWorkspace panel">
        <div className="paneTitle">RESEARCH WORKSPACE <Search size={13} /></div>
        <div className="treeItem active"><FileCode2 size={15} /> {symbol.toLowerCase()}_iv_surface.qnt</div>
        <div className="treeItem"><Folder size={15} /> Volatility</div>
        <div className="treeChild"><FileCode2 size={14} /> iv_surface.qnt</div>
        <div className="treeChild"><FileCode2 size={14} /> skew_scan.qnt</div>
        <div className="treeChild"><FileCode2 size={14} /> term_structure.qnt</div>
        <div className="treeItem"><Database size={15} /> Snapshots</div>
        <div className="terminalFacts">
          <span>Underlying</span><b>{symbol}</b>
          <span>Spot</span><b>${Number(payload.underlyingPrice || 0).toFixed(2)}</b>
          <span>Source</span><b>{payload.demo ? 'DEMO' : 'FREE API'}</b>
          <span>Updated</span><b>{updated}</b>
        </div>
      </aside>

      <section className="volEditor panel">
        <div className="editorTop">
          <span><Braces size={14} /> {symbol.toLowerCase()}_iv_surface.qnt</span>
          <button onClick={() => load(query)} disabled={loading}><Play size={13} /> {loading ? 'Running…' : 'Run'}</button>
        </div>
        <div className="volSymbolBar">
          <input value={query} onChange={(e) => setQuery(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && load(query)} aria-label="Ticker symbol" />
          <button onClick={() => load(query)} disabled={loading}><RefreshCw size={13} /> Refresh</button>
        </div>
        <pre className="code volCode"><span className="muted"># Research question</span>{'\n'}<span className="str">"Map {symbol} implied volatility across strike and expiry."</span>{'\n\n'}chain = <span className="fn">options.chain</span>(<span className="str">"{symbol}"</span>, delay=<span className="str">"free"</span>){'\n'}surface = <span className="fn">iv.surface</span>(chain, axes=[{'\n'}  <span className="str">"moneyness"</span>, <span className="str">"dte"</span>, <span className="str">"implied_volatility"</span>{'\n'}]){'\n\n'}<span className="fn">render3d</span>(surface){'\n'}<span className="fn">explain</span>(surface, metrics=[<span className="str">"skew"</span>, <span className="str">"term_structure"</span>])</pre>
        <div className="volResearchNote">
          <div className="eyebrow">DATA MODE</div>
          <p>{message}</p>
          <small>The free adapter is intentionally cached so repeated screen refreshes do not burn through the daily options-data allowance.</small>
        </div>
        <div className="editorFooter"><span>IV Surface Runtime</span><span>{payload.demo ? 'DEMO' : 'DELAYED'} • Ready</span></div>
      </section>

      <section className="volResults panel">
        <div className="volResultsTop">
          <div><div className="eyebrow">VOLATILITY RESEARCH</div><h1>{symbol} implied volatility surface</h1></div>
          <div className="volStatus"><span className={payload.demo ? 'statusDot demoDot' : 'statusDot'} />{payload.demo ? 'DEMO' : 'DELAYED'}</div>
        </div>

        <div className="volControls">
          {['blend', 'call', 'put'].map((value) => <button key={value} className={side === value ? 'active' : ''} onClick={() => setSide(value)}>{value === 'blend' ? 'Call + Put' : `${value[0].toUpperCase()}${value.slice(1)}s`}</button>)}
        </div>

        <div className="volMetrics">
          <div><span>ATM IV</span><b>{(metrics.atm * 100).toFixed(1)}%</b></div>
          <div><span>PUT/CALL SKEW</span><b className={metrics.skew >= 0 ? 'violet' : ''}>{(metrics.skew * 100).toFixed(1)} vol</b></div>
          <div><span>TERM SLOPE</span><b>{metrics.term >= 0 ? '+' : ''}{(metrics.term * 100).toFixed(1)} vol</b></div>
          <div><span>SURFACE RANGE</span><b>{(metrics.min * 100).toFixed(0)}–{(metrics.max * 100).toFixed(0)}%</b></div>
        </div>

        <div className="surfaceCard">
          <div className="surfaceCardHead"><span><Waves size={14} /> 3D IV surface</span><small>X: DTE · Y: moneyness · Z: implied volatility</small></div>
          <Surface3D surface={surface} />
        </div>

        <div className="volInsight">
          <Activity size={17} />
          <div><b>QNT interpretation</b><p>{metrics.skew > 0.015 ? 'Downside options carry a visible volatility premium, producing a negative-equity-style skew.' : 'The smile is relatively balanced across the displayed strikes.'} {metrics.term > 0.01 ? 'Longer-dated volatility is richer than the front end.' : metrics.term < -0.01 ? 'Front-end volatility is richer than longer-dated contracts.' : 'The term structure is fairly flat.'}</p></div>
        </div>
        <div className="askBox">Ask QNT: “Explain the skew”, “compare expiries”, “show only ATM”, or “save this snapshot”… <span>↗</span></div>
      </section>
    </div>
  );
}
