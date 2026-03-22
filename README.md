# DanceArc · [DanceTech Protocol](https://github.com/arunnadarasa/dancearc)

**DanceTech Protocol** is a reference implementation for **metered value exchange on Arc** using **native USDC**, **HTTP 402 (x402-shaped) payment challenges**, and optional **Circle Gateway** verification. This repo (`DanceArc`) is the **MVP hub + API + UI** for hackathon and production experiments.

**Repository:** [github.com/arunnadarasa/dancearc](https://github.com/arunnadarasa/dancearc)  
**Agent skill (ClawdHub / OpenClaw):** see [`skills/dancearc-protocol/SKILL.md`](skills/dancearc-protocol/SKILL.md)

---

## Protocol lens: h2h · h2a · a2a · a2h

DanceTech classifies interactions by **who pays whom** and **who initiates settlement**. On-chain settlement uses **Arc Testnet / Arc** with **USDC-native gas** and **micro-transfers** so unit economics stay aligned with **per-action** pricing (sub-cent where configured).

| Mode | Acronym | Definition | Role in DanceArc |
|------|---------|------------|------------------|
| **Human → Human** | **h2h** | A person compensates another person (or a shared treasury) for a real-world or in-app outcome | **Battle** (`/battle`): entry intent → pay **`ARC_RECIPIENT`** (coach, venue, treasury). **Coaching** (`/coaching`): minute-metered bill → same. **Beats** (`/beats`): license purchase → payee from config. |
| **Human → Agent** | **h2a** | A person pays an **autonomous or API-bound** service for compute, scoring, or access | **Judge score (live)** (`/dance-extras`): `POST` returns **402** + challenge; wallet sends USDC; retry with **`X-Payment-Tx`**. Same pattern on **`POST /api/judges/score`**. |
| **Agent → Agent** | **a2a** | One automated system pays another for API calls, tools, or metered resources (no human in the signing hot path) | **Designed for:** server or agent wallet holds funds; client uses **bearer + programmatic signing** (not yet a first-class UI in this MVP). **Today:** burst CLI (`npm run burst`) and **Burst demo (wallet)** illustrate **high-frequency micro-txs** agents would need; extend with headless keys or smart accounts for full a2a. |
| **Agent → Human** | **a2h** | Settlement or notification flows where the **service** credits, refunds, or pays out to a **person** | **Payout / finalize** paths (mock in MVP), **receipt** payloads, explorer links, and **Circle DCW / faucet** server routes that fund a **human-controlled** testnet address. |

Together, these modes describe **who signs** and **who receives** USDC on Arc—without forcing every product into a single “subscription” shape.

---

## Stack

- **Frontend:** React 19, Vite 8, TypeScript  
- **Chain:** Arc Testnet (`5042002`) via [`arcTestnet`](https://github.com/wevm/viem/blob/main/src/chains/definitions/arcTestnet.ts)  
- **Payments:** `402 Payment Required` + `X-Payment-Tx` + **`waitForTransactionReceipt`** on the server; optional **`CIRCLE_API_KEY`** → Circle Gateway [`x402/verify`](https://developers.circle.com)  
- **x402 shape:** `x402Version`, `accepts[]` (Arc uses a custom `arc-native-usdc` accept block until upstream lists chain `5042002`)  
- **Circle:** Modular Wallets (Client Key), Developer-Controlled Wallets (API + Entity Secret), App Kit / Bridge hooks  

---

## Quick start

```bash
npm install
cp .env.example .env
npm run dev:full   # Express :8787 + Vite :5173
```

Open **http://localhost:5173** — hub lists **Battle**, **Coaching**, **Beats**, **Judge score**, **Bridge**, burst demo, and tx history (paginated).

### Production-style local run

```bash
npm run build
npm run start:local
```

---

## Environment (summary)

| Variable | Purpose |
|----------|---------|
| `ARC_RECIPIENT` | `0x…` payee for native USDC (h2h / licensed flows) |
| `PER_ACTION_USDC` | Default `0.001` for **h2a** judge routes (≤ `0.01` for hackathon rules) |
| `CIRCLE_API_KEY` | Gateway x402 verify + DCW / faucet (server) |
| `CIRCLE_ENTITY_SECRET` | Developer-Controlled Wallets |
| `VITE_CIRCLE_CLIENT_KEY` | Modular Wallets (browser) |
| `ARC_BURST_PRIVATE_KEY` | **Test only** — unattended `npm run burst` |

Full table: [.env.example](.env.example). **Never commit `.env`.**

---

## Hackathon checklist

See [docs/HACKATHON.md](docs/HACKATHON.md): per-API monetization, **50+ tx** evidence (`npm run burst` or **Burst demo (wallet)**), margin narrative (USDC gas on Arc).

---

## API highlights

| Area | Example |
|------|---------|
| **h2a** | `POST /api/dance-extras/live/judge-score/testnet` (402 → pay → retry) |
| **h2h** | `POST /api/battle/intent`, `/api/battle/verify`; coaching `/api/coaching/*`; beats `/api/beats/*` |
| **Health** | `GET /api/health` (chain, recipient hint, `PER_ACTION_USDC`) |
| **Events** | `GET /api/nanopayments/events` (in-memory audit log after successful verify) |

OpenAPI stub: `GET /openapi.json`.

---

## LLM bundle

```bash
npm run build:llm
```

Served at `/llm-full.txt` in dev.

---

## ClawdHub / OpenClaw skill

Install or copy the skill for agent sessions:

```bash
# Manual (OpenClaw)
git clone https://github.com/arunnadarasa/dancearc.git
cp -r dancearc/skills/dancearc-protocol ~/.openclaw/skills/dancearc-protocol
```

When published to ClawdHub, prefer: `clawdhub install dancearc-protocol` (after publish).

---

## License

MIT — see [LICENSE](LICENSE).
