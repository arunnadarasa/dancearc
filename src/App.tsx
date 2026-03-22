import { useEffect, useMemo, useState } from 'react'
import { CircleModularPanel } from './components/CircleModularPanel'
import { ArcFaucetPanel } from './components/ArcFaucetPanel'
import { DeveloperWalletPanel } from './components/DeveloperWalletPanel'
import { BurstWalletPanel } from './components/BurstWalletPanel'
import { InjectedWalletBar } from './components/InjectedWalletBar'
import { HUB_ROUTE_GROUPS } from './hubRoutes'
import './App.css'
import { clearTxHistory, explorerTxUrl, listTxHistory, type TxHistoryItem } from './txHistory'
import { ARC_CHAIN_ID } from './arcChain'

const TX_PAGE_SIZE = 10

export default function App() {
  const [items, setItems] = useState<TxHistoryItem[]>(() => listTxHistory())
  const [txPage, setTxPage] = useState(1)

  const totalTxPages = items.length === 0 ? 0 : Math.ceil(items.length / TX_PAGE_SIZE)

  useEffect(() => {
    if (totalTxPages > 0 && txPage > totalTxPages) setTxPage(totalTxPages)
  }, [totalTxPages, txPage])

  const pageItems = useMemo(() => {
    const start = (txPage - 1) * TX_PAGE_SIZE
    return items.slice(start, start + TX_PAGE_SIZE)
  }, [items, txPage])

  const rows = useMemo(
    () =>
      pageItems.map((it) => (
        <tr key={`${it.hash}-${it.createdAt}`}>
          <td>{it.flow}</td>
          <td>
            <a href={explorerTxUrl(it.hash)} target="_blank" rel="noreferrer">
              {it.hash.slice(0, 10)}…
            </a>
          </td>
          <td className="muted">{new Date(it.createdAt).toLocaleString()}</td>
        </tr>
      )),
    [pageItems],
  )

  return (
    <main className="app">
      <header className="hero">
        <h1>DanceArc</h1>
        <InjectedWalletBar />
        <CircleModularPanel />
        <DeveloperWalletPanel />
        <ArcFaucetPanel />
        <BurstWalletPanel
          onTxRecorded={() => {
            setItems(listTxHistory())
            setTxPage(1)
          }}
        />
        <p>
          DanceTech Protocol reference hub on <strong>Arc Testnet</strong> (chain {ARC_CHAIN_ID}): native USDC gas,
          sub-cent per-action APIs, and x402-style payment challenges. See <code>README.md</code> for margin story and
          hackathon checklist.
        </p>
      </header>

      {HUB_ROUTE_GROUPS.map((g) => (
        <section key={g.label} className="hub-group">
          <h3>{g.label}</h3>
          <div className="hub-links">
            {g.routes.map((r) => (
              <a key={r.href} href={r.href}>
                <strong>{r.title}</strong>
                <span>{r.hint}</span>
              </a>
            ))}
          </div>
          {g.footnote ? <p className="muted" style={{ marginTop: '0.65rem' }}>{g.footnote}</p> : null}
        </section>
      ))}

      <section className="card">
        <h2>Recent on-chain activity (browser)</h2>
        <p className="muted">
          Successful wallet flows append tx hashes here (newest first, <strong>{TX_PAGE_SIZE}</strong> per page). Use{' '}
          <strong>Burst demo (wallet)</strong> above for many txs from the browser, or <code>npm run burst</code> with{' '}
          <code>ARC_BURST_PRIVATE_KEY</code> for unattended runs.
        </p>
        <div className="row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              clearTxHistory()
              setItems([])
              setTxPage(1)
            }}
          >
            Clear local history
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setItems(listTxHistory())}>
            Refresh
          </button>
        </div>
        {items.length === 0 ? (
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            No transactions recorded yet.
          </p>
        ) : (
          <table style={{ width: '100%', marginTop: '0.85rem', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e4e4e7' }}>
                <th style={{ padding: '0.35rem 0' }}>Flow</th>
                <th>Tx</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        )}
        {totalTxPages > 1 ? (
          <div style={{ marginTop: '0.85rem' }}>
            <p className="muted" style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
              Page {txPage} of {totalTxPages} · {items.length} total
            </p>
            <div className="row" style={{ marginTop: 0, flexWrap: 'wrap' }}>
              {Array.from({ length: totalTxPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={p === txPage ? 'btn btn-sm' : 'btn btn-sm btn-secondary'}
                  onClick={() => setTxPage(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <p className="muted">
        LLM bundle: <a href="/llm-full.txt">/llm-full.txt</a>
      </p>
    </main>
  )
}
