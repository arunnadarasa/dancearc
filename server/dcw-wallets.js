import { randomUUID } from 'node:crypto'
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

/**
 * Pull HTTP status + message from axios-style errors thrown by the Circle SDK.
 * @param {unknown} e
 * @returns {{ httpStatus: number | null; message: string; body: unknown }}
 */
export function formatCircleRequestError(e) {
  const resp =
    e && typeof e === 'object' && 'response' in e
      ? /** @type {{ status?: number; statusText?: string; data?: unknown }} */ (e).response
      : undefined
  if (!resp || typeof resp !== 'object') {
    return { httpStatus: null, message: e instanceof Error ? e.message : String(e), body: null }
  }
  const status = typeof resp.status === 'number' ? resp.status : null
  const data = resp.data
  let detail = ''
  if (data && typeof data === 'object') {
    const o = /** @type {Record<string, unknown>} */ (data)
    if (typeof o.message === 'string') detail = o.message
    else if (typeof o.error === 'string') detail = o.error
    else if (Array.isArray(o.errors) && o.errors[0] && typeof o.errors[0] === 'object') {
      const f = /** @type {Record<string, unknown>} */ (o.errors[0])
      detail = [f.message, f.error].filter((x) => typeof x === 'string').join(' — ')
    }
    if (!detail) detail = JSON.stringify(data).slice(0, 400)
  } else if (typeof data === 'string' && data.trim()) {
    detail = data.trim().slice(0, 500)
  }
  const fallback = e instanceof Error ? e.message : 'Request failed'
  const message = detail || fallback || (status ? `HTTP ${status}` : 'Unknown error')
  return { httpStatus: status, message, body: data }
}

export function getDcwClient() {
  const apiKey = process.env.CIRCLE_API_KEY?.trim()
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET?.trim()
  if (!apiKey || !entitySecret) return null
  return initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
    baseUrl: process.env.CIRCLE_API_BASE_URL?.trim() || 'https://api.circle.com',
  })
}

/**
 * Create a wallet set (unless `walletSetId` is provided) and one Arc testnet wallet (SCA by default).
 * @param {{ walletSetName?: string; walletSetId?: string; accountType?: 'SCA' | 'EOA' }} opts
 */
export async function createArcTestnetDcwWallet(opts = {}) {
  const client = getDcwClient()
  if (!client) {
    throw new Error('Set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET in .env (server only).')
  }

  const walletSetName = opts.walletSetName?.trim() || 'DanceArc wallets'
  let walletSetId = opts.walletSetId?.trim() || process.env.CIRCLE_DCW_WALLET_SET_ID?.trim()
  if (!walletSetId) {
    const ws = await client.createWalletSet({
      name: walletSetName,
      idempotencyKey: randomUUID(),
    })
    walletSetId = ws.data?.walletSet?.id
    if (!walletSetId) throw new Error('createWalletSet: missing walletSet.id')
  }

  const accountType = opts.accountType === 'EOA' ? 'EOA' : 'SCA'
  const wallets = await client.createWallets({
    blockchains: ['ARC-TESTNET'],
    count: 1,
    walletSetId,
    accountType,
    idempotencyKey: randomUUID(),
  })

  const w = wallets.data?.wallets?.[0]
  if (!w) throw new Error('createWallets: missing wallets[0]')

  return {
    walletSetId,
    walletId: w.id,
    address: w.address,
    blockchain: w.blockchain,
    accountType,
  }
}

/**
 * Circle programmatic testnet faucet (same limits as console — e.g. one request per asset/network / 2h).
 * @param {string} address `0x…` EVM address on Arc Testnet
 */
export async function requestArcTestnetFaucet(address) {
  const client = getDcwClient()
  if (!client) {
    throw new Error('Set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET in .env (server only).')
  }
  const a = address.trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(a)) {
    throw new Error('Invalid EVM address (expected 0x + 40 hex chars).')
  }
  /** Arc Testnet gas token is native USDC — `native` matches Circle faucet “native” on Arc. */
  const res = await client.requestTestnetTokens({
    address: a,
    blockchain: 'ARC-TESTNET',
    native: true,
  })
  return { ok: true, status: res.status }
}
