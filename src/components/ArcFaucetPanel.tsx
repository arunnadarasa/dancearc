import { useCallback, useEffect, useState } from 'react'
import { getInjectedEthereum } from '../eip1193'
import './CircleModularPanel.css'

const FAUCET_URL = 'https://faucet.circle.com/'
const STORAGE_KEY = 'dancearc_last_arc_address'

/**
 * Arc Testnet USDC: Circle programmatic faucet (server) + web faucet link.
 */
export function ArcFaucetPanel() {
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState<{ configured: boolean; authRequired?: boolean } | null>(null)
  const [secret, setSecret] = useState('')
  const [out, setOut] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setAddress(saved)
    } catch {
      /* ignore */
    }
    void fetch('/api/dev-wallets/status')
      .then((r) => r.json())
      .then((j) => setStatus({ configured: Boolean(j.configured), authRequired: Boolean(j.authRequired) }))
      .catch(() => setStatus({ configured: false }))
  }, [])

  const fillConnected = useCallback(async () => {
    const eth = getInjectedEthereum()
    if (!eth) {
      setOut('No injected wallet — connect with MetaMask/Rabby or paste an address.')
      return
    }
    try {
      const acc = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
      const a = acc[0]
      if (a) setAddress(a)
    } catch (e) {
      setOut(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const requestApi = async () => {
    setBusy(true)
    setOut(null)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (status?.authRequired && secret.trim()) {
        headers['X-DanceArc-Dcw-Secret'] = secret.trim()
      }
      const r = await fetch('/api/dev-wallets/faucet', {
        method: 'POST',
        headers,
        body: JSON.stringify({ address: address.trim() }),
      })
      const text = await r.text()
      try {
        setOut(JSON.stringify(JSON.parse(text), null, 2))
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
      <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Arc testnet faucet</h2>
      <p className="muted" style={{ marginBottom: '0.65rem' }}>
        Native USDC on Arc Testnet (chain <code>5042002</code>). Use Circle’s{' '}
        <a href={FAUCET_URL} target="_blank" rel="noreferrer">
          web faucet
        </a>{' '}
        (reCAPTCHA), or request via Circle’s API from this app (same limits — typically one request per asset/network
        every ~2 hours).
      </p>
      {status ? (
        <p className="muted" style={{ marginBottom: '0.65rem', fontSize: '0.85rem' }}>
          API faucet:{' '}
          <strong>{status.configured ? 'ready (DCW credentials on server)' : 'needs CIRCLE_API_KEY + Entity Secret'}</strong>
        </p>
      ) : null}
      <label className="muted" style={{ display: 'block', marginBottom: '0.5rem' }}>
        Recipient address (0x…)
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
          style={{ display: 'block', width: '100%', marginTop: '0.35rem', padding: '0.35rem 0.5rem' }}
        />
      </label>
      {status?.authRequired ? (
        <label className="muted" style={{ display: 'block', marginBottom: '0.65rem' }}>
          <code>DEV_WALLET_SECRET</code>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="X-DanceArc-Dcw-Secret"
            autoComplete="off"
            style={{ display: 'block', width: '100%', marginTop: '0.35rem', padding: '0.35rem 0.5rem' }}
          />
        </label>
      ) : null}
      <div className="circle-mod__row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => void fillConnected()}>
          Use connected wallet
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={busy || !status?.configured || !address.trim()}
          onClick={() => void requestApi()}
        >
          {busy ? 'Requesting…' : 'Request testnet USDC (API)'}
        </button>
        <a className="btn btn-sm btn-secondary" href={FAUCET_URL} target="_blank" rel="noreferrer">
          Open Circle faucet
        </a>
      </div>
      {out ? (
        <pre className="circle-mod__out" role="status" style={{ marginTop: '0.65rem' }}>
          {out}
        </pre>
      ) : null}
    </section>
  )
}
