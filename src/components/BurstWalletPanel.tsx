import { useEffect, useRef, useState } from 'react'
import { getAddress, isAddress, type Address } from 'viem'
import { explorerTxUrl } from '../arcChain'
import { getInjectedEthereum } from '../eip1193'
import { runWalletBurst } from '../walletBurst'
import { addTxHistory } from '../txHistory'
import './CircleModularPanel.css'

type BurstTxRow = { index: number; total: number; hash: string }

type HealthJson = {
  recipient?: string
  perActionUsdc?: string
}

export function BurstWalletPanel({ onTxRecorded }: { onTxRecorded?: () => void }) {
  const [apiRecipient, setApiRecipient] = useState<string | null>(null)
  const [count, setCount] = useState(55)
  const [amount, setAmount] = useState('0.0005')
  const [burstHeader, setBurstHeader] = useState('')
  const [burstTxs, setBurstTxs] = useState<BurstTxRow[]>([])
  const [burstFooter, setBurstFooter] = useState('')
  const [busy, setBusy] = useState(false)
  const cancelRef = useRef(false)

  useEffect(() => {
    void fetch('/api/health')
      .then((r) => r.json())
      .then((j: HealthJson) => {
        if (typeof j.recipient === 'string' && isAddress(j.recipient)) setApiRecipient(j.recipient)
      })
      .catch(() => setApiRecipient(null))
  }, [])

  const run = async () => {
    const eth = getInjectedEthereum()
    if (!eth) {
      setBurstHeader('')
      setBurstTxs([])
      setBurstFooter('Connect a wallet (InjectedWalletBar above).')
      return
    }
    if (!apiRecipient || !isAddress(apiRecipient)) {
      setBurstHeader('')
      setBurstTxs([])
      setBurstFooter('API /api/health has no valid ARC_RECIPIENT — set ARC_RECIPIENT in server .env.')
      return
    }
    const n = Math.floor(Number(count))
    if (!Number.isFinite(n) || n < 1 || n > 80) {
      setBurstHeader('')
      setBurstTxs([])
      setBurstFooter('Count must be an integer 1–80.')
      return
    }

    cancelRef.current = false
    setBusy(true)
    setBurstFooter('')
    setBurstTxs([])
    setBurstHeader(
      `Starting ${n} txs × ${amount} USDC → ${apiRecipient.slice(0, 10)}… (each tx opens your wallet)`,
    )
    try {
      const recipient = getAddress(apiRecipient as Address)
      await runWalletBurst({
        ethereum: eth,
        recipient,
        count: n,
        amountDisplay: amount,
        delayMs: 400,
        isCancelled: () => cancelRef.current,
        onProgress: ({ index, total, hash }) => {
          setBurstTxs((prev) => [...prev, { index, total, hash }])
          addTxHistory({ hash, network: 'testnet', flow: 'burst' })
        },
      })
      setBurstFooter('Done.')
    } catch (e) {
      setBurstFooter(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      onTxRecorded?.()
    }
  }

  return (
    <section className="circle-mod card">
      <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Burst demo (wallet)</h2>
      <p className="muted" style={{ marginBottom: '0.65rem' }}>
        Same economics as <code>npm run burst</code> (native USDC microtransfers on Arc Testnet), but your{' '}
        <strong>browser wallet</strong> signs each tx — no <code>ARC_BURST_PRIVATE_KEY</code>. For unattended 50+ txs,
        keep using the CLI.
      </p>
      <p className="muted" style={{ marginBottom: '0.65rem', fontSize: '0.85rem' }}>
        Payee from <code>GET /api/health</code>:{' '}
        {apiRecipient ? (
          <code>{apiRecipient.slice(0, 12)}…</code>
        ) : (
          <strong>unavailable</strong>
        )}
      </p>
      <label className="muted" style={{ display: 'block', marginBottom: '0.5rem' }}>
        Number of transactions (1–80, default 55)
        <input
          type="number"
          min={1}
          max={80}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          disabled={busy}
          style={{ display: 'block', width: '100%', marginTop: '0.35rem', padding: '0.35rem 0.5rem' }}
        />
      </label>
      <label className="muted" style={{ display: 'block', marginBottom: '0.65rem' }}>
        USDC per tx (display)
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={busy}
          spellCheck={false}
          style={{ display: 'block', width: '100%', marginTop: '0.35rem', padding: '0.35rem 0.5rem' }}
        />
      </label>
      <div className="circle-mod__row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void run()}>
          {busy ? 'Burst running…' : 'Run burst (wallet)'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={!busy}
          onClick={() => {
            cancelRef.current = true
          }}
        >
          Cancel between txs
        </button>
      </div>
      {burstHeader || burstTxs.length > 0 || burstFooter ? (
        <div
          className="circle-mod__out"
          role="status"
          style={{
            marginTop: '0.65rem',
            maxHeight: '220px',
            overflow: 'auto',
            fontSize: '0.8rem',
            lineHeight: 1.45,
          }}
        >
          {burstHeader ? <div style={{ marginBottom: '0.4rem' }}>{burstHeader}</div> : null}
          {burstTxs.map((row) => (
            <div key={`${row.hash}-${row.index}`} style={{ marginBottom: '0.2rem' }}>
              <span style={{ opacity: 0.75 }}>
                {row.index}/{row.total}{' '}
              </span>
              <a
                href={explorerTxUrl(row.hash)}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#7dd3fc', wordBreak: 'break-all' }}
              >
                {row.hash}
              </a>
            </div>
          ))}
          {burstFooter ? <div style={{ marginTop: '0.4rem', opacity: 0.9 }}>{burstFooter}</div> : null}
        </div>
      ) : null}
    </section>
  )
}
