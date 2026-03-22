import type { Address, Hex } from 'viem'
import { sendNativeUsdc } from './payArc'

export type WalletBurstProgress = { index: number; total: number; hash: Hex }

export type RunWalletBurstOpts = {
  ethereum: NonNullable<Window['ethereum']>
  recipient: Address
  count: number
  amountDisplay: string
  /** @default 400 */
  delayMs?: number
  isCancelled?: () => boolean
  onProgress?: (p: WalletBurstProgress) => void
}

/**
 * Sequential native USDC transfers on Arc Testnet (same idea as `npm run burst`, but EIP-1193 wallet signatures).
 */
export async function runWalletBurst(opts: RunWalletBurstOpts): Promise<{ hashes: Hex[] }> {
  const { ethereum, recipient, count, amountDisplay, delayMs = 400, isCancelled, onProgress } = opts
  if (count < 1 || count > 80) throw new Error('count must be 1–80.')
  const hashes: Hex[] = []

  for (let i = 0; i < count; i++) {
    if (isCancelled?.()) throw new Error('Burst cancelled.')
    const hash = await sendNativeUsdc(ethereum, recipient, amountDisplay)
    hashes.push(hash)
    onProgress?.({ index: i + 1, total: count, hash })
    if (i < count - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return { hashes }
}
