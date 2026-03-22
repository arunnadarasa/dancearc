import { useEffect, useState } from 'react'
import './CircleModularPanel.css'

type Status = {
  configured: boolean
  hasApiKey?: boolean
  hasEntitySecret?: boolean
  authRequired?: boolean
  arcTestnet?: { chainId: number; rpcUrl: string }
  hint?: string
  note?: string
}

/**
 * Server-side Circle Developer-Controlled Wallets — creates ARC-TESTNET addresses (SCA/EOA).
 * Entity Secret and API key never leave the server.
 */
export function DeveloperWalletPanel() {
  const [status, setStatus] = useState<Status | null>(null)
  const [secret, setSecret] = useState('')
  const [out, setOut] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch('/api/dev-wallets/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false }))
  }, [])

  const create = async () => {
    setBusy(true)
    setOut(null)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (status?.authRequired && secret.trim()) {
        headers['X-DanceArc-Dcw-Secret'] = secret.trim()
      }
      const r = await fetch('/api/dev-wallets/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({ accountType: 'SCA' }),
      })
      const text = await r.text()
      try {
        const parsed = JSON.parse(text) as { address?: string }
        if (r.ok && typeof parsed.address === 'string') {
          try {
            localStorage.setItem('dancearc_last_arc_address', parsed.address)
          } catch {
            /* ignore */
          }
        }
        setOut(JSON.stringify(parsed, null, 2))
      } catch {
        setOut(`HTTP ${r.status}\n${text}`)
      }
    } catch (e) {
      setOut(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="circle-mod card">
      <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Developer-controlled wallet (Circle)</h2>
      <p className="muted" style={{ marginBottom: '0.65rem' }}>
        Creates an <strong>ARC-TESTNET</strong> address via{' '}
        <code>@circle-fin/developer-controlled-wallets</code> on this API (<code>createWalletSet</code> when needed, then{' '}
        <code>createWallets</code> with <code>accountType: SCA</code>). RPC:{' '}
        <code>https://rpc.testnet.arc.network</code>, chain id <code>5042002</code>. Entity Secret cannot run in the
        browser — use CLI: <code>npm run circle:entity-secret:generate</code> then{' '}
        <code>npm run circle:entity-secret:register</code> (
        <a href="https://developers.circle.com/wallets/dev-controlled/entity-secret-management" target="_blank" rel="noreferrer">
          docs
        </a>
        ).
      </p>
      {status ? (
        <p className="muted" style={{ marginBottom: '0.65rem', fontSize: '0.85rem' }}>
          Status:{' '}
          <strong>{status.configured ? 'API key + Entity Secret configured' : 'Not configured'}</strong>
          {status.arcTestnet ? (
            <>
              {' '}
              · chain {status.arcTestnet.chainId}
            </>
          ) : null}
          {status.hasApiKey === true && status.hasEntitySecret === false ? (
            <>
              <br />
              <strong>Add </strong>
              <code>CIRCLE_ENTITY_SECRET</code>
              <strong> to server </strong>
              <code>.env</code>
              <strong> </strong>(Circle Console → Developer-Controlled Wallets → Entity Secret; never commit). Then restart{' '}
              <code>npm run dev:full</code>.
            </>
          ) : null}
          {status.configured && status.note ? (
            <>
              <br />
              {status.note}
            </>
          ) : null}
        </p>
      ) : null}
      {status?.authRequired ? (
        <label className="muted" style={{ display: 'block', marginBottom: '0.65rem' }}>
          <span>Local POST secret (matches </span>
          <code>DEV_WALLET_SECRET</code>
          <span>)</span>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Required when DEV_WALLET_SECRET is set"
            autoComplete="off"
            style={{ display: 'block', width: '100%', marginTop: '0.35rem', padding: '0.35rem 0.5rem' }}
          />
        </label>
      ) : null}
      <div className="circle-mod__row">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy || !status?.configured}
          onClick={() => void create()}
        >
          {busy ? 'Creating…' : 'Create Arc testnet wallet (SCA)'}
        </button>
      </div>
      {out ? (
        <pre className="circle-mod__out" role="status">
          {out}
        </pre>
      ) : null}
    </section>
  )
}
