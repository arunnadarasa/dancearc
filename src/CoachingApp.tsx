import { useMemo, useState } from 'react'
import { getAddress, isAddress, type Address } from 'viem'
import { InjectedWalletBar } from './components/InjectedWalletBar'
import { ARC_CHAIN_ID, explorerTxUrl } from './arcChain'
import { getInjectedEthereum } from './eip1193'
import { sendNativeUsdc } from './payArc'
import { addTxHistory } from './txHistory'
import { extractPaymentTxHashFromLog } from './txUi'
import './App.css'

type CoachingPayState = {
  sessionId?: string
  status?: string
  recipient?: unknown
  amountDisplay?: unknown
  chainId?: unknown
  network?: unknown
  [key: string]: unknown
}

export default function CoachingApp() {
  const [sessionId, setSessionId] = useState('')
  const [log, setLog] = useState('')
  const [lastPay, setLastPay] = useState<CoachingPayState | null>(null)
  const [busy, setBusy] = useState(false)

  const paymentTxHash = useMemo(() => extractPaymentTxHashFromLog(log), [log])

  const start = async () => {
    const res = await fetch('/api/coaching/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId: 'c1', dancerId: 'd1', ratePerMinute: 2 }),
    })
    const j = (await res.json()) as CoachingPayState
    setSessionId(typeof j.id === 'string' ? j.id : '')
    setLastPay(null)
    setLog(JSON.stringify(j, null, 2))
  }

  const tick = async () => {
    const res = await fetch('/api/coaching/tick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, seconds: 30 }),
    })
    const j = (await res.json()) as CoachingPayState
    setLog(JSON.stringify(j, null, 2))
  }

  const end = async () => {
    const res = await fetch('/api/coaching/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    const j = (await res.json()) as CoachingPayState
    setLog(JSON.stringify(j, null, 2))
    if (j.status === 'requires_payment' && typeof j.sessionId === 'string') {
      setLastPay(j)
    } else {
      setLastPay(null)
    }
  }

  const confirmMockPayment = async () => {
    const id = lastPay?.sessionId
    if (typeof id !== 'string') return
    setBusy(true)
    try {
      const res = await fetch('/api/coaching/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: id,
          paymentTx: `0x${'a'.repeat(64)}`,
        }),
      })
      const j = (await res.json()) as CoachingPayState
      setLog(JSON.stringify(j, null, 2))
      setLastPay(j.status === 'payment_finalized' ? null : lastPay)
    } finally {
      setBusy(false)
    }
  }

  const payWithWallet = async () => {
    if (lastPay?.status !== 'requires_payment' || typeof lastPay.sessionId !== 'string') return

    const rawRecipient = lastPay.recipient
    if (typeof rawRecipient !== 'string' || !isAddress(rawRecipient)) {
      setLog(
        JSON.stringify(
          {
            error: 'invalid_recipient',
            message:
              'Set ARC_RECIPIENT to a valid 0x address in API .env and click End again to refresh the bill.',
            recipient: rawRecipient,
          },
          null,
          2,
        ),
      )
      return
    }

    const cid = lastPay.chainId
    if (typeof cid === 'number' && cid !== ARC_CHAIN_ID) {
      setLog(
        JSON.stringify(
          {
            error: 'wrong_chain',
            message: `This UI pays on Arc Testnet only (chain ${ARC_CHAIN_ID}).`,
          },
          null,
          2,
        ),
      )
      return
    }

    const amountDisplay =
      typeof lastPay.amountDisplay === 'string' && lastPay.amountDisplay.length > 0
        ? lastPay.amountDisplay
        : '0.00'

    const eth = getInjectedEthereum()
    if (!eth) {
      setLog(
        JSON.stringify(
          {
            error: 'no_wallet',
            message: 'No injected wallet — connect or use Confirm payment (mock).',
          },
          null,
          2,
        ),
      )
      return
    }

    const recipient = getAddress(rawRecipient as Address)

    setBusy(true)
    try {
      setLog(
        JSON.stringify(
          {
            step: 'sign_tx',
            message: `Sending ${amountDisplay} USDC (native) for coaching session to ${recipient}…`,
          },
          null,
          2,
        ),
      )
      const paymentTx = await sendNativeUsdc(eth, recipient, amountDisplay)
      addTxHistory({ hash: paymentTx, network: 'testnet', flow: 'coaching' })

      const verifyRes = await fetch('/api/coaching/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: lastPay.sessionId, paymentTx }),
      })
      const verifyJson = (await verifyRes.json()) as CoachingPayState
      if (!verifyRes.ok) {
        setLog(
          JSON.stringify(
            {
              error: 'verify_failed',
              verify: verifyJson,
              paymentTx,
              hint: 'Transfer submitted; retry verify with the same paymentTx if needed.',
            },
            null,
            2,
          ),
        )
        return
      }
      setLog(JSON.stringify(verifyJson, null, 2))
      setLastPay(null)
    } catch (e) {
      setLog(
        JSON.stringify(
          {
            error: 'pay_failed',
            message: e instanceof Error ? e.message : String(e),
          },
          null,
          2,
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <h1>Coaching minutes</h1>
        <p>
          <strong>Start</strong> a session, <strong>Tick +30s</strong> to accumulate time, then <strong>End</strong> to
          get a bill. Pay native USDC on Arc Testnet (<strong>Pay with wallet</strong>) or{' '}
          <strong>Confirm payment (mock)</strong>, same pattern as Battle entry.
        </p>
      </header>
      <InjectedWalletBar />
      <section className="card">
        <div className="row" style={{ marginTop: 0 }}>
          <button type="button" className="btn" disabled={busy} onClick={() => void start()}>
            Start
          </button>
          <button type="button" className="btn btn-secondary" disabled={!sessionId || busy} onClick={() => void tick()}>
            Tick +30s
          </button>
          <button type="button" className="btn btn-secondary" disabled={!sessionId || busy} onClick={() => void end()}>
            End
          </button>
          {lastPay?.status === 'requires_payment' && typeof lastPay.sessionId === 'string' ? (
            <>
              <button type="button" className="btn" disabled={busy} onClick={() => void payWithWallet()}>
                {busy ? 'Working…' : 'Pay with wallet'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => void confirmMockPayment()}
              >
                Confirm payment (mock)
              </button>
            </>
          ) : null}
        </div>
        <p className="muted">sessionId: {sessionId || '—'}</p>
        <pre className="log">{log || '—'}</pre>
        {paymentTxHash ? (
          <p className="muted" style={{ marginTop: '0.65rem', marginBottom: 0 }}>
            <a href={explorerTxUrl(paymentTxHash)} target="_blank" rel="noreferrer">
              View transaction on ArcScan
            </a>
            <code style={{ fontSize: '0.8rem', marginLeft: '0.35rem' }}>
              {paymentTxHash.slice(0, 10)}…{paymentTxHash.slice(-8)}
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
