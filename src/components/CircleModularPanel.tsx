import { useState } from 'react'
import {
  DEFAULT_CIRCLE_MODULAR_CLIENT_URL,
  getCircleModularConfig,
  pingCircleModularRpc,
  resolveModularClientUrl,
} from '../circleModular'
import './CircleModularPanel.css'

/**
 * Smoke test uses direct JSON-RPC fetch (same headers as the SDK) so errors are readable; full Modular flows still use @circle-fin/modular-wallets-core.
 * Native USDC pay flows still use EIP-1193 (InjectedWalletBar); smart-account UX follows Circle’s full quickstart.
 */
export function CircleModularPanel() {
  const cfg = getCircleModularConfig()
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const test = async () => {
    if (!cfg) {
      setStatus('Add VITE_CIRCLE_CLIENT_KEY to .env and restart Vite.')
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      const { chainId, blockNumber } = await pingCircleModularRpc()
      setStatus(
        `Connected. chainId=${chainId}${blockNumber !== undefined ? `, block=${blockNumber.toString()}` : ''}`,
      )
    } catch (e) {
      const msg =
        e instanceof Error
          ? [e.message, e.cause instanceof Error ? e.cause.message : e.cause].filter(Boolean).join(' — ')
          : String(e)
      setStatus(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="circle-mod card">
      <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Circle Modular Wallets (SDK)</h2>
      <p className="muted" style={{ marginBottom: '0.65rem' }}>
        On localhost JSON-RPC goes to <code>POST /api/circle-modular</code> (Express → Circle; avoids CORS and
        Vite POST quirks). Else:{' '}
        <code>{DEFAULT_CIRCLE_MODULAR_CLIENT_URL}</code>. Override: <code>VITE_CIRCLE_MODULAR_CLIENT_URL</code>.
        Staging: <code>https://modular-sdk-staging.circle.com</code>. Direct URL on localhost:{' '}
        <code>VITE_CIRCLE_MODULAR_DIRECT=1</code>.
      </p>
      {cfg ? (
        <p className="muted" style={{ marginBottom: '0.65rem', fontSize: '0.85rem' }}>
          Resolved client URL: <code>{resolveModularClientUrl()}</code>
        </p>
      ) : null}
      <p className="muted" style={{ marginBottom: '0.75rem' }}>
        Status:{' '}
        <strong>{cfg ? 'VITE_CIRCLE_CLIENT_KEY is set' : 'Missing VITE_CIRCLE_CLIENT_KEY'}</strong>
      </p>
      <div className="circle-mod__row">
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void test()}>
          {busy ? 'Testing…' : 'Test Modular API (chainId)'}
        </button>
      </div>
      {status ? (
        <pre className="circle-mod__out" role="status">
          {status}
        </pre>
      ) : null}
    </section>
  )
}
