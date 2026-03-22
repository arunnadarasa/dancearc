import { useState } from 'react'
import type { Address } from 'viem'
import { CircleModularPanel } from './components/CircleModularPanel'
import { InjectedWalletBar } from './components/InjectedWalletBar'
import { explorerTxUrl } from './arcChain'
import './App.css'
import { getInjectedEthereum } from './eip1193'
import { postPaidJson, sendNativeUsdc, type PaymentChallenge } from './payArc'
import { addTxHistory } from './txHistory'

export default function ExtraDanceApp() {
  const [battleId, setBattleId] = useState('demo-battle')
  const [roundId, setRoundId] = useState('r1')
  const [judgeId, setJudgeId] = useState('j1')
  const [dancerId, setDancerId] = useState('d1')
  const [score, setScore] = useState(9.5)
  const [log, setLog] = useState('')
  const [lastPaymentTx, setLastPaymentTx] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const append = (line: string) => setLog((prev) => `${prev}\n${line}`.trim())

  const runLive = async () => {
    setBusy(true)
    setLog('')
    setLastPaymentTx(null)
    try {
      const eth = getInjectedEthereum()
      if (!eth) {
        append('No injected wallet (MetaMask, Rabby, etc.).')
        return
      }
      const body = { battleId, roundId, judgeId, dancerId, score }
      const res = await postPaidJson('/api/dance-extras/live/judge-score/testnet', body, {
        pay: async (challenge: PaymentChallenge) => {
          const acc = challenge.accepts[0]
          const recipient = acc.payTo as Address
          const amt = acc.extra?.perActionUsdc ?? '0.001'
          append(`402 challenge — paying ${amt} USDC to ${recipient}…`)
          const hash = await sendNativeUsdc(eth, recipient, amt)
          setLastPaymentTx(hash)
          append(`tx: ${hash}`)
          addTxHistory({ hash, network: 'testnet', flow: 'judge' })
          return hash
        },
      })
      const text = await res.text()
      append(`HTTP ${res.status} ${text}`)
    } catch (e) {
      append(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <h1>Judge score (live)</h1>
        <CircleModularPanel />
        <InjectedWalletBar />
        <p>
          Paid <code>POST</code> with <strong>x402-style 402</strong> + <strong>Arc native USDC</strong>. After payment,
          the API records the score. Explorer:{' '}
          <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">
            testnet.arcscan.app
          </a>
          .
        </p>
      </header>

      <section className="card">
        <h2>Payload</h2>
        <label className="field">
          battleId
          <input value={battleId} onChange={(e) => setBattleId(e.target.value)} />
        </label>
        <label className="field">
          roundId
          <input value={roundId} onChange={(e) => setRoundId(e.target.value)} />
        </label>
        <label className="field">
          judgeId
          <input value={judgeId} onChange={(e) => setJudgeId(e.target.value)} />
        </label>
        <label className="field">
          dancerId
          <input value={dancerId} onChange={(e) => setDancerId(e.target.value)} />
        </label>
        <label className="field">
          score
          <input
            type="number"
            step="0.1"
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
          />
        </label>
        <button type="button" className="btn" disabled={busy} onClick={() => void runLive()}>
          {busy ? 'Working…' : 'Pay + submit (live)'}
        </button>
      </section>

      <section className="card">
        <h2>Log</h2>
        <pre className="log">{log || '—'}</pre>
        {lastPaymentTx ? (
          <p className="muted" style={{ marginTop: '0.65rem', marginBottom: 0 }}>
            <a href={explorerTxUrl(lastPaymentTx)} target="_blank" rel="noreferrer">
              View payment transaction on ArcScan
            </a>
            <code style={{ fontSize: '0.8rem', marginLeft: '0.35rem' }}>
              {lastPaymentTx.slice(0, 10)}…{lastPaymentTx.slice(-8)}
            </code>
          </p>
        ) : null}
      </section>

      <p className="muted">
        <a href="/">← Hub</a>
      </p>
    </main>
  )
}
