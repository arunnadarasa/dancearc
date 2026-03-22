export type Eip1193Provider = NonNullable<Window['ethereum']>

/**
 * Picks a usable EIP-1193 provider when multiple wallets inject `window.ethereum`
 * (`providers[]`, e.g. Brave + MetaMask).
 */
export function getInjectedEthereum(): Eip1193Provider | undefined {
  if (typeof window === 'undefined') return undefined
  const raw = (window as Window & { ethereum?: unknown }).ethereum
  if (raw == null) return undefined

  const pick = (p: unknown): Eip1193Provider | undefined => {
    if (typeof p !== 'object' || p === null) return undefined
    const r = p as { request?: unknown }
    if (typeof r.request === 'function') return p as Eip1193Provider
    return undefined
  }

  const multi = raw as { providers?: unknown[] }
  if (Array.isArray(multi.providers) && multi.providers.length > 0) {
    const mm = multi.providers.find((p) => (p as { isMetaMask?: boolean }).isMetaMask)
    return pick(mm ?? multi.providers[0])
  }

  return pick(raw)
}
