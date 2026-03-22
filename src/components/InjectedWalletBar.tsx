import { useCallback, useEffect, useState } from 'react'
import { getInjectedEthereum } from '../eip1193'
import './InjectedWalletBar.css'

/**
 * EIP-1193 connect flow — works with MetaMask, Rabby, and browser wallets that
 * inject `window.ethereum` (including Circle Modular Wallets when used as an EIP-1193 provider).
 */
export function InjectedWalletBar() {
  const [address, setAddress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const eth = getInjectedEthereum()
    if (!eth) {
      setAddress(null)
      return
    }
    try {
      const accounts = (await eth.request({ method: 'eth_accounts' })) as string[]
      setAddress(accounts[0] ?? null)
    } catch {
      setAddress(null)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const eth = getInjectedEthereum()
    if (!eth?.on) return
    const onAccounts = () => void refresh()
    eth.on('accountsChanged', onAccounts)
    return () => {
      eth.removeListener?.('accountsChanged', onAccounts)
    }
  }, [refresh])

  const connect = async () => {
    setError(null)
    const eth = getInjectedEthereum()
    if (!eth) {
      setError(
        'No EIP-1193 wallet found. Install MetaMask, Rabby, or another extension that injects window.ethereum. (Circle Modular alone does not add Connect here — use an injected browser wallet.)',
      )
      return
    }
    try {
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
      setAddress(accounts[0] ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect')
    }
  }

  return (
    <div className="wallet-bar">
      <div className="wallet-bar__row">
        <span className="wallet-bar__label">Wallet</span>
        {address ? (
          <code className="wallet-bar__addr" title={address}>
            {address.slice(0, 6)}…{address.slice(-4)}
          </code>
        ) : (
          <span className="wallet-bar__none">Not connected</span>
        )}
        <button type="button" className="btn btn-sm" onClick={() => void connect()}>
          {address ? 'Reconnect' : 'Connect'}
        </button>
        {address ? (
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => void refresh()}>
            Refresh
          </button>
        ) : null}
      </div>
      {error ? <p className="wallet-bar__err">{error}</p> : null}
    </div>
  )
}
