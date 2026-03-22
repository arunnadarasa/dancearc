# Hackathon checklist (Agentic Economy on Arc)

## Tracks

This MVP aligns with **Per-API monetization** and **Usage-based compute billing**: paid `POST /api/judges/score` and `/api/dance-extras/live/judge-score/testnet` with **per-action pricing** (default **0.001 USDC**, configurable via `PER_ACTION_USDC`, must stay **≤ $0.01**).

## Economic proof

1. **Per-action pricing:** `PER_ACTION_USDC` (default `0.001`) — see `GET /api/health`.
2. **Transaction frequency:** run `npm run burst` with a funded test key to produce **50+** Arc Testnet txs; hashes print to stdout (link recipient on ArcScan).
3. **Margin vs traditional gas:** On general-purpose L1s, a single paid interaction often implies **base fee + priority fee** in a volatile gas token, frequently **orders of magnitude above** sub-cent unit economics unless you batch, subsidize, or custody. **Arc uses USDC for gas** and supports **high-frequency microflows** (Circle Nanopayments + Gateway x402) so **per-call** pricing can match **actual usage** without forcing subscription bundling.

## Feedback ($500 USDC incentive)

Document concrete integration notes for Circle (Gateway verify paths, Nanopayments UX, App Kit Bridge friction) in your final submission field.
