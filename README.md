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
- CSV / trade-return import

## Run

```bash
npm install
npm run dev
```

## Next integration

Connect the user's market-data API for NQ/MNQ/ES candles, session ranges, ATR, volume and volatility/regime features. Keep API secrets server-side when the provider requires a private key.
