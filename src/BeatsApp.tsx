import { useMemo, useState } from 'react'
import { getAddress, isAddress, type Address } from 'viem'
import { InjectedWalletBar } from './components/InjectedWalletBar'
import { ARC_CHAIN_ID, explorerTxUrl } from './arcChain'
import { getInjectedEthereum } from './eip1193'
import { sendNativeUsdc } from './payArc'
import { addTxHistory } from './txHistory'
import { extractPaymentTxHashFromLog } from './txUi'
import './App.css'

type BeatLicenseRow = {
  licenseId?: string
  status?: string
  recipient?: unknown
  amountDisplay?: unknown
  chainId?: unknown
  network?: unknown
  [key: string]: unknown
}

export default function BeatsApp() {
  const [log, setLog] = useState('')
  const [lastLicense, setLastLicense] = useState<BeatLicenseRow | null>(null)
  const [busy, setBusy] = useState(false)

  const paymentTxHash = useMemo(() => extractPaymentTxHashFromLog(log), [log])

  const intent = async () => {
    const res = await fetch('/api/beats/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beatId: 'beat-1', consumerId: 'u1', amountDisplay: '5.00' }),
    })
    const j = (await res.json()) as BeatLicenseRow
    setLog(JSON.stringify(j, null, 2))
    if (typeof j.licenseId === 'string') setLastLicense(j)
    else setLastLicense(null)
  }

  const confirmMockPayment = async () => {
    const id = lastLicense?.licenseId
    if (typeof id !== 'string') return
    setBusy(true)
    try {
      const res = await fetch('/api/beats/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseId: id,
          paymentTx: `0x${'a'.repeat(64)}`,
        }),
      })
      const j = (await res.json()) as BeatLicenseRow
      setLog(JSON.stringify(j, null, 2))
      setLastLicense(j.status === 'granted' ? null : lastLicense)
    } finally {
      setBusy(false)
    }
  }

  const payWithWallet = async () => {
    if (lastLicense?.status !== 'requires_payment' || typeof lastLicense.licenseId !== 'string') return

    const rawRecipient = lastLicense.recipient
    if (typeof rawRecipient !== 'string' || !isAddress(rawRecipient)) {
      setLog(
        JSON.stringify(
          {
            error: 'invalid_recipient',
            message:
              'Set ARC_RECIPIENT to a valid 0x address in API .env and create a new intent.',
            recipient: rawRecipient,
          },
          null,
          2,
        ),
      )
      return
    }

    const cid = lastLicense.chainId
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
      typeof lastLicense.amountDisplay === 'string' && lastLicense.amountDisplay.length > 0
        ? lastLicense.amountDisplay
        : '5.00'

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
            message: `Sending ${amountDisplay} USDC (native) for beat license to ${recipient}…`,
          },
          null,
          2,
        ),
      )
      const paymentTx = await sendNativeUsdc(eth, recipient, amountDisplay)
      addTxHistory({ hash: paymentTx, network: 'testnet', flow: 'beats' })

      const grantRes = await fetch('/api/beats/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseId: lastLicense.licenseId, paymentTx }),
      })
      const grantJson = (await grantRes.json()) as BeatLicenseRow
      if (!grantRes.ok) {
        setLog(
          JSON.stringify(
            {
              error: 'grant_failed',
              response: grantJson,
              paymentTx,
              hint: 'Transfer submitted; retry grant with the same paymentTx if needed.',
            },
            null,
            2,
          ),
        )
        return
      }
      setLog(JSON.stringify(grantJson, null, 2))
      setLastLicense(null)
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
        <h1>Beat licensing</h1>
        <p>
          <strong>Create intent</strong> for a fixed USDC price, then <strong>Pay with wallet</strong> on Arc Testnet or{' '}
          <strong>Confirm payment (mock)</strong>. <code>POST /api/beats/grant</code> records the tx hash.
        </p>
      </header>
      <InjectedWalletBar />
      <section className="card">
        <div className="row" style={{ marginTop: 0 }}>
          <button type="button" className="btn" disabled={busy} onClick={() => void intent()}>
            Create intent
          </button>
          {lastLicense?.status === 'requires_payment' && typeof lastLicense.licenseId === 'string' ? (
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
          {log || '—'}
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
