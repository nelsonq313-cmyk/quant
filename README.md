# QNT Research Terminal

A QuantPad-inspired personal quant research workspace focused on futures research without bundling an expensive historical-data warehouse.

## Current build

- Bloomberg-style three-pane research terminal
- EV / expectancy, realized volatility, Sharpe and profit-factor research output
- Monte Carlo engine with randomized equity paths
- Prop-firm target vs drawdown simulation
- Risk of ruin, terminal equity, drawdown and losing-streak statistics
- Return-vs-drawdown scatter analysis
- Strategy verdict / edge grading
- Regime-analysis workspace
- AAPL-style implied-volatility research lab with an interactive 3D surface
- Call / put / blended volatility views, skew and term-structure metrics
- Free historical options-data adapter that defaults to a week-old snapshot
- Server-side token protection and 12-hour caching
- Local snapshot archive for recent IV-surface captures
- CSV / trade-return import

## Run

```bash
npm install
npm run dev
```

## Free historical options data

The volatility lab can use Market Data's free options API. Add the API token as a private Replit Secret named:

```text
MARKETDATA_TOKEN
```

Do not put the token in frontend code or commit it to GitHub. The server defaults to an options-chain snapshot from roughly one week ago, requests only a few DTE/strike buckets, and caches the result for 12 hours. If no token is configured, the volatility page stays functional with a clearly labeled demo surface rather than pretending demo values are real market data.

## Next integration

Connect the user's market-data API for NQ/MNQ/ES candles, session ranges, ATR, volume and volatility/regime features. Keep API secrets server-side when the provider requires a private key.
