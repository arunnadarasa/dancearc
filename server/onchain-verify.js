import { createPublicClient, http, isAddressEqual } from 'viem'
import { getArcChain } from './config.js'

const clientCache = new Map()

function getPublicClient(network) {
  const chain = getArcChain(network)
  const key = chain.id
  if (!clientCache.has(key)) {
    clientCache.set(
      key,
      createPublicClient({
        chain,
        transport: http(chain.rpcUrls.default.http[0]),
      }),
    )
  }
  return /** @type {import('viem').PublicClient} */ (clientCache.get(key))
}

/**
 * Verifies a native USDC transfer on Arc (testnet or mainnet).
 * Uses `waitForTransactionReceipt` so the API does not race the mempool (avoids TransactionReceiptNotFoundError right after pay).
 * @param {`0x${string}`} txHash
 * @param {{ recipient: `0x${string}`; minValue: bigint; from?: `0x${string}`; network?: import('./config.js').ArcNetwork }} params
 */
export async function verifyNativeUsdcPayment(txHash, params) {
  const network = params.network ?? 'testnet'
  const client = getPublicClient(network)
  const timeout = Number(process.env.ARC_TX_RECEIPT_TIMEOUT_MS || 120_000)
  const pollingInterval = Number(process.env.ARC_TX_RECEIPT_POLL_MS || 2_000)

  let receipt
  try {
    receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      pollingInterval,
      timeout,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    if (/WaitForTransactionReceiptTimeoutError|timeout/i.test(name + msg)) {
      return { ok: false, reason: 'receipt_timeout' }
    }
    if (/TransactionReceiptNotFound|receipt.*not found/i.test(msg)) {
      return { ok: false, reason: 'receipt_not_found' }
    }
    throw e
  }

  if (receipt.status !== 'success') {
    return { ok: false, reason: 'transaction_reverted' }
  }
  const tx = await client.getTransaction({ hash: txHash })
  if (!tx.to || !isAddressEqual(tx.to, params.recipient)) {
    return { ok: false, reason: 'recipient_mismatch' }
  }
  if (tx.value < params.minValue) {
    return { ok: false, reason: 'insufficient_amount' }
  }
  if (params.from && !isAddressEqual(tx.from, params.from)) {
    return { ok: false, reason: 'sender_mismatch' }
  }
  return {
    ok: true,
    blockNumber: receipt.blockNumber,
    from: tx.from,
    value: tx.value,
    chainId: getArcChain(network).id,
  }
}
