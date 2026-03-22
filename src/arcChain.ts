import { arcTestnet } from 'viem/chains'

export const arcChain = arcTestnet

export const ARC_CHAIN_ID = arcTestnet.id

export function explorerTxUrl(hash: string) {
  const h = hash.startsWith('0x') ? hash : `0x${hash}`
  return `${arcTestnet.blockExplorers.default.url}/tx/${h}`
}
