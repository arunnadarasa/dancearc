/** Shown in Circle Console when you create a Client Key — must match `validateClientUrl` in the SDK. */
export const DEFAULT_CIRCLE_MODULAR_CLIENT_URL = 'https://modular-sdk.circle.com'

/**
 * Direct calls from the browser to `modular-sdk.circle.com` fail CORS; a plain Vite path proxy can return
 * HTML for POST (SPA fallback). On localhost we use same-origin `POST /api/circle-modular` on Express.
 * Set `VITE_CIRCLE_MODULAR_DIRECT=1` to call Circle’s URL directly from the browser.
 */
export function resolveModularClientUrl(): string {
  const explicit = import.meta.env.VITE_CIRCLE_MODULAR_CLIENT_URL?.trim()
  if (explicit) return explicit
  const direct =
    import.meta.env.VITE_CIRCLE_MODULAR_DIRECT === 'true' ||
    import.meta.env.VITE_CIRCLE_MODULAR_DIRECT === '1'
  if (direct) return DEFAULT_CIRCLE_MODULAR_CLIENT_URL
  if (typeof window !== 'undefined') {
    const h = window.location.hostname
    if (h === 'localhost' || h === '127.0.0.1') {
      return `${window.location.origin}/api/circle-modular`
    }
  }
  return DEFAULT_CIRCLE_MODULAR_CLIENT_URL
}

export function getCircleModularConfig(): { clientUrl: string; clientKey: string } | null {
  const clientKey = import.meta.env.VITE_CIRCLE_CLIENT_KEY?.trim()
  const clientUrl = resolveModularClientUrl()
  if (!clientKey) return null
  return { clientUrl, clientKey }
}

type JsonRpcResponse = {
  jsonrpc?: string
  id?: string
  result?: unknown
  error?: { code?: number; message?: string; data?: unknown }
}

/**
 * Same wire format as @circle-fin/modular-wallets-core fetchFromApi, without viem — avoids
 * UnknownRpcError / empty "Returned error:" when Circle omits error.message.
 */
async function circleModularJsonRpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const c = getCircleModularConfig()
  if (!c) throw new Error('Set VITE_CIRCLE_CLIENT_KEY in .env')

  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'unknown'
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}`

  const res = await fetch(c.clientUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${c.clientKey}`,
      'X-AppInfo': `platform=web;version=1.0.13;uri=${hostname}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  })

  const text = await res.text()
  let json: JsonRpcResponse
  try {
    json = JSON.parse(text) as JsonRpcResponse
  } catch {
    throw new Error(`Circle Modular: non-JSON (HTTP ${res.status}): ${text.slice(0, 500)}`)
  }

  if (json.error) {
    const e = json.error
    const msg = e.message != null && String(e.message).trim() !== '' ? String(e.message) : '(no message)'
    const bits = [
      msg,
      e.code !== undefined ? `code=${e.code}` : '',
      e.data !== undefined ? `data=${JSON.stringify(e.data).slice(0, 400)}` : '',
    ].filter(Boolean)
    throw new Error(bits.join(' · '))
  }

  if (json.result === undefined) {
    throw new Error(`Circle Modular: unexpected JSON ${JSON.stringify(json).slice(0, 400)}`)
  }

  return json.result as T
}

/**
 * Smoke test: eth_chainId (+ optional eth_blockNumber) via direct JSON-RPC.
 * Does not use viem or toModularTransport — clearer errors when Circle rejects the Client Key.
 */
export async function pingCircleModularRpc(): Promise<{ chainId: number; blockNumber?: bigint }> {
  const hex = await circleModularJsonRpc<string>('eth_chainId', [])
  const chainId = Number.parseInt(hex, 16)
  let blockNumber: bigint | undefined
  try {
    const bnHex = await circleModularJsonRpc<string>('eth_blockNumber', [])
    blockNumber = BigInt(bnHex)
  } catch {
    /* optional */
  }
  return { chainId, blockNumber }
}
