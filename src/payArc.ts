import { createWalletClient, custom, parseUnits, type Address } from 'viem'
import { arcTestnet } from 'viem/chains'

type ChallengeAccept = {
  payTo: string
  maxAmountRequired: string
  extra?: { perActionUsdc?: string }
}

export type PaymentChallenge = {
  x402Version: number
  accepts: ChallengeAccept[]
}

export function parseChallenge402(json: unknown): PaymentChallenge | null {
  if (!json || typeof json !== 'object') return null
  const o = json as Record<string, unknown>
  if (o.x402Version !== 1 || !Array.isArray(o.accepts)) return null
  return json as PaymentChallenge
}

export async function ensureArcTestnet(ethereum: NonNullable<Window['ethereum']>) {
  const chainIdHex = `0x${arcTestnet.id.toString(16)}`
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    })
  } catch (e: unknown) {
    const code = (e as { code?: number }).code
    if (code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdHex,
            chainName: arcTestnet.name,
            nativeCurrency: arcTestnet.nativeCurrency,
            rpcUrls: [arcTestnet.rpcUrls.default.http[0]],
            blockExplorerUrls: [arcTestnet.blockExplorers.default.url],
          },
        ],
      })
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
      return
    }
    throw e
  }
}

/**
 * Send native USDC on Arc Testnet (18 decimals) to `recipient`.
 */
export async function sendNativeUsdc(
  ethereum: NonNullable<Window['ethereum']>,
  recipient: Address,
  amountDisplay: string,
) {
  await ensureArcTestnet(ethereum)
  const client = createWalletClient({
    chain: arcTestnet,
    transport: custom(ethereum),
  })
  const [account] = await client.getAddresses()
  if (!account) throw new Error('Unlock your wallet to continue.')

  const value = parseUnits(amountDisplay, 18)
  return client.sendTransaction({
    account,
    chain: arcTestnet,
    to: recipient,
    value,
  })
}

/** POST JSON with optional X-Payment-Tx after optional payment step. */
export async function postPaidJson(
  url: string,
  body: unknown,
  options: { pay?: (challenge: PaymentChallenge) => Promise<`0x${string}`> },
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  let res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (res.status === 402 && options.pay) {
    const j = await res.json()
    const challenge = parseChallenge402(j)
    if (!challenge?.accepts[0]) throw new Error('Invalid 402 payment challenge from server.')
    const txHash = await options.pay(challenge)
    headers['X-Payment-Tx'] = txHash
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  }

  return res
}
