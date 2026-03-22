export type TxNetwork = 'testnet'

export type TxFlow = 'battle' | 'coaching' | 'beats' | 'judge' | 'burst'

export type TxHistoryItem = {
  hash: string
  network: TxNetwork
  flow: TxFlow
  createdAt: string
}

const STORAGE_KEY = 'dancearc_tx_history_v1'

const safeParse = (raw: string | null): TxHistoryItem[] => {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is TxHistoryItem =>
        item !== null &&
        typeof item === 'object' &&
        typeof (item as TxHistoryItem).hash === 'string' &&
        typeof (item as TxHistoryItem).network === 'string' &&
        typeof (item as TxHistoryItem).flow === 'string' &&
        typeof (item as TxHistoryItem).createdAt === 'string',
    )
  } catch {
    return []
  }
}

export const listTxHistory = (): TxHistoryItem[] => {
  if (typeof window === 'undefined') return []
  return safeParse(window.localStorage.getItem(STORAGE_KEY))
}

export const addTxHistory = (item: Omit<TxHistoryItem, 'createdAt'>) => {
  if (typeof window === 'undefined') return
  const raw = item.hash.trim()
  const tx = raw.startsWith('0x') ? raw : /^([a-fA-F0-9]{64})$/.test(raw) ? `0x${raw}` : raw
  if (!tx.startsWith('0x') || tx.length !== 66) return
  const current = listTxHistory()
  const exists = current.some(
    (entry) => entry.hash.toLowerCase() === tx.toLowerCase() && entry.network === item.network,
  )
  if (exists) return
  const next: TxHistoryItem[] = [{ ...item, hash: tx, createdAt: new Date().toISOString() }, ...current].slice(
    0,
    200,
  )
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export const clearTxHistory = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}

export { explorerTxUrl } from './arcChain'
