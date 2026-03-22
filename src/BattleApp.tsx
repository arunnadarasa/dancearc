import { useMemo, useState } from 'react'
import { getAddress, isAddress, type Address } from 'viem'
import { CircleModularPanel } from './components/CircleModularPanel'
import { ArcFaucetPanel } from './components/ArcFaucetPanel'
import { DeveloperWalletPanel } from './components/DeveloperWalletPanel'
import { InjectedWalletBar } from './components/InjectedWalletBar'
import { ARC_CHAIN_ID, explorerTxUrl } from './arcChain'
import { getInjectedEthereum } from './eip1193'
import { sendNativeUsdc } from './payArc'
import { addTxHistory } from './txHistory'
import { extractPaymentTxHashFromLog } from './txUi'
import './App.css'

type BattleIntentRow = {
  intentId?: string
  status?: string
  recipient?: unknown
  amountDisplay?: unknown
  chainId?: unknown
  network?: unknown
  [key: string]: unknown
}

export default function BattleApp() {
  const [battleId, setBattleId] = useState('b1')
  const [dancerId, setDancerId] = useState('d1')
  const [out, setOut] = useState('')
  const [lastIntent, setLastIntent] = useState<BattleIntentRow | null>(null)
  const [busy, setBusy] = useState(false)

  const paymentTxHash = useMemo(() => extractPaymentTxHashFromLog(out), [out])

  const intent = async () => {
    const res = await fetch('/api/battle/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ battleId, dancerId, amountDisplay: '10.00' }),
    })
    const j = (await res.json()) as BattleIntentRow
    setOut(JSON.stringify(j, null, 2))
    if (typeof j.intentId === 'string') setLastIntent(j)
  }

  const confirmMockPayment = async () => {
    const id = lastIntent?.intentId
    if (typeof id !== 'string') return
    setBusy(true)
    try {
      const res = await fetch('/api/battle/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId: id,
          paymentTx: `0x${'a'.repeat(64)}`,
        }),
      })
      const j = (await res.json()) as BattleIntentRow
      setOut(JSON.stringify(j, null, 2))
      if (typeof j.intentId === 'string') setLastIntent(j)
    } finally {
      setBusy(false)
    }
  }

  const payWithWallet = async () => {
    if (lastIntent?.status !== 'requires_payment' || typeof lastIntent.intentId !== 'string') return

    const rawRecipient = lastIntent.recipient
    if (typeof rawRecipient !== 'string' || !isAddress(rawRecipient)) {
      setOut(
        JSON.stringify(
          {
            error: 'invalid_recipient',
            message:
              'Intent recipient is not a valid 0x address. Set ARC_RECIPIENT (or USDC_RECIPIENT) in the API .env to a valid address and create a new intent.',
            recipient: rawRecipient,
          },
          null,
          2,
        ),
      )
      return
    }

    const cid = lastIntent.chainId
    if (typeof cid === 'number' && cid !== ARC_CHAIN_ID) {
      setOut(
        JSON.stringify(
          {
            error: 'wrong_chain',
            message: `This UI sends on Arc Testnet only (chain ${ARC_CHAIN_ID}). Intent chainId was ${cid}.`,
          },
          null,
          2,
        ),
      )
      return
    }

    const amountDisplay =
      typeof lastIntent.amountDisplay === 'string' && lastIntent.amountDisplay.length > 0
        ? lastIntent.amountDisplay
        : '10.00'

    const eth = getInjectedEthereum()
    if (!eth) {
      setOut(
        JSON.stringify(
          {
            error: 'no_wallet',
            message: 'No injected wallet (MetaMask, Rabby, etc.). Connect above or use Confirm payment (mock).',
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
      setOut(
        JSON.stringify(
          { step: 'sign_tx', message: `Sending ${amountDisplay} USDC (native) on Arc Testnet to ${recipient}…` },
          null,
          2,
        ),
      )
      const paymentTx = await sendNativeUsdc(eth, recipient, amountDisplay)
      addTxHistory({ hash: paymentTx, network: 'testnet', flow: 'battle' })

      const verifyRes = await fetch('/api/battle/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentId: lastIntent.intentId, paymentTx }),
      })
      const verifyJson = (await verifyRes.json()) as BattleIntentRow
      if (!verifyRes.ok) {
        setOut(
          JSON.stringify(
            {
              error: 'verify_failed',
              verify: verifyJson,
              paymentTx,
              hint: 'USDC transfer was submitted; fix verify errors or retry verify with the same paymentTx.',
            },
            null,
            2,
          ),
        )
        return
      }
      setOut(JSON.stringify(verifyJson, null, 2))
      if (typeof verifyJson.intentId === 'string') setLastIntent(verifyJson)
    } catch (e) {
      setOut(
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
        <h1>Battle entry</h1>
        <p>
          Create an entry intent, then <strong>Pay with wallet</strong> sends native USDC on Arc Testnet (same as Judge
          score) and calls <code>POST /api/battle/verify</code> with the real tx hash. Use{' '}
          <strong>Confirm payment (mock)</strong> without a wallet.
        </p>
      </header>
      <CircleModularPanel />
      <DeveloperWalletPanel />
      <ArcFaucetPanel />
      <InjectedWalletBar />
      <section className="card">
        <label className="field">
          battleId
          <input value={battleId} onChange={(e) => setBattleId(e.target.value)} />
        </label>
        <label className="field">
          dancerId
          <input value={dancerId} onChange={(e) => setDancerId(e.target.value)} />
        </label>
        <div className="row" style={{ marginTop: 0 }}>
          <button type="button" className="btn" disabled={busy} onClick={() => void intent()}>
            Create intent
          </button>
          {lastIntent?.status === 'requires_payment' && typeof lastIntent.intentId === 'string' ? (
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
        <pre className="log" style={{ marginTop: '1rem' }}>
          {out || '—'}
        </pre>
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
