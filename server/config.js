import { defineChain, isAddress, parseUnits } from 'viem'
import { arcTestnet } from 'viem/chains'

/** Placeholder recipient when env is missing or not a valid EVM address (40 hex chars after 0x). */
const DEFAULT_RECIPIENT = '0x742d35Cc6634c0532925a3b844bC9e7595F8fE00'

/**
 * @param {string | undefined} raw
 * @param {string} label env var name (for logs)
 * @returns {string | null}
 */
function recipientFromEnv(raw, label) {
  const r = typeof raw === 'string' ? raw.trim() : ''
  if (!r) return null
  if (isAddress(r)) return r
  if (r.startsWith('0x')) {
    console.warn(
      `[dancearc] Ignoring invalid ${label} (use a 0x + 40 hex EVM address, not a UUID): ${r.slice(0, 24)}…`,
    )
  }
  return null
}

/** Arc Mainnet — chain id 1243 (viem ships testnet only; mainnet via defineChain). */
export const arcMainnet = /*#__PURE__*/ defineChain({
  id: 1243,
  name: 'Arc',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        process.env.ARC_MAINNET_RPC_URL || 'https://rpc.arc.network',
        'https://rpc.quicknode.arc.network',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://arcscan.app',
      apiUrl: 'https://arcscan.app/api',
    },
  },
  testnet: false,
})

/** @typedef {'testnet' | 'mainnet'} ArcNetwork */

/** @param {string | undefined} value */
export function normalizeArcNetwork(value) {
  const v = String(value ?? 'testnet').toLowerCase()
  if (v === 'mainnet' || v === '1243' || v === '0x4db') return 'mainnet'
  return 'testnet'
}

/** @param {ArcNetwork} network */
export function getArcChain(network) {
  return network === 'mainnet' ? arcMainnet : arcTestnet
}

export function getRecipientForNetwork(network) {
  if (network === 'mainnet') {
    const pick =
      recipientFromEnv(process.env.ARC_MAINNET_RECIPIENT, 'ARC_MAINNET_RECIPIENT') ||
      recipientFromEnv(process.env.ARC_RECIPIENT, 'ARC_RECIPIENT') ||
      recipientFromEnv(process.env.USDC_RECIPIENT, 'USDC_RECIPIENT')
    return pick ?? DEFAULT_RECIPIENT
  }
  const pick =
    recipientFromEnv(process.env.ARC_RECIPIENT, 'ARC_RECIPIENT') ||
    recipientFromEnv(process.env.USDC_RECIPIENT, 'USDC_RECIPIENT')
  return pick ?? DEFAULT_RECIPIENT
}

/** Default export for legacy imports — testnet. */
export const arcChain = arcTestnet

export { arcTestnet }

export function getRecipient() {
  return getRecipientForNetwork('testnet')
}

/** Per-action price in USDC display string (≤ 0.01 for hackathon). */
export function getPerActionUsdc() {
  const raw = process.env.PER_ACTION_USDC || '0.001'
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n <= 0) return '0.001'
  return raw
}

export function getPerActionValueWei() {
  return parseUnits(getPerActionUsdc(), 18)
}
