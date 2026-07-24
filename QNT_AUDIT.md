# QNT audit and phased upgrade plan

## Product direction
QNT should stay an original product: a compact AI-native quantitative research workstation with dense terminal UX, a real statistical lab, transparent data provenance, and fast command-driven navigation.

## Audit findings

### P0 — correctness / trust
- Risk Monte Carlo currently records ruin but continues the strategy path after the ruin event. Account metrics mostly stop treating the account as alive, but the visual path can recover later and is confusing. Risk-mode paths should terminate/freeze immediately at ruin.
- Model probabilities are curated from a small eval sample, so uncertainty must remain visible. Never present a simulated probability as proof.
- The current normalized R values are not true stop-defined R. Every payoff/expectancy display must say this when relevant.
- Regimes still contain illustrative placeholder values. These should be removed entirely until market context is joined to real trade timestamps.
- Some workspace demo files still contain stale old win/loss probabilities and old curation notes.
- Verdict uses fixed hand-authored scores. It should become formula-driven and explain every component, or clearly remain an unscored research summary.

### P1 — Monte Carlo / prop research
- Stop risk paths at ruin; no recovery after failure.
- Seeded and reproducible runs with visible seed and explicit rerun/new-seed behavior.
- Show model inputs next to P(ruin): observed WR, posterior range, loss/BE rate, modeled winner/loser stats, payoff ratio, expectancy, sample count, risk, floor distance, horizon.
- Add sensitivity research for win rate, risk/trade, payoff scaling, and horizon.
- Separate account-path statistics from strategy-only hypothetical statistics.
- Keep Canvas rendering and path-level hit detection; avoid thousands of SVG nodes.
- Add time-underwater and recovery-time distributions.

### P2 — shell / command workflow
- Replace decorative top search with a functional command palette.
- Route commands such as MC, PROP, VERDICT, REGIME, VOL, DATA, NQ, ES, AAPL, QQQ.
- Add recent commands and keyboard shortcut support.
- Add API/data health in the shell.
- Keep navigation state owned directly rather than relying on DOM text click listeners.

### P3 — Copilot
- Make screen context structured: active module, model settings, selected path, simulation stats, active file, API/data state.
- Add server-side research actions/tools instead of pretending arbitrary Python execution exists.
- Add suggested questions per screen.
- Return structured metadata with answers (model, sources/context used, action proposal) while keeping secrets server-side.

### P4 — data / regimes / volatility
- Remove fake regime values now; later join actual futures context before calculating regime stats.
- Data page should show datasets, provenance, row count, date range, freshness, quality, and import status.
- CSV import should preview and map fields before ingestion.
- Volatility Lab should expose data freshness, strike/expiration selection, chain table, IV smile/skew/term structure, Greeks, volume/OI when the provider returns them.

### P5 — professional terminal features
- Watchlist / market monitor only for symbols supported by connected providers.
- Cross-asset context and correlations only from real data.
- Economic/event terminal only when a reliable data source is connected; never fabricate events.
- Saved research experiments: config, seed, dataset/model version, results, notes, timestamp.

## Verification rule
After each phase: build the app, inspect console/runtime errors, test affected interactions, and do not claim success without a running verification path.
