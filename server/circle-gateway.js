/**
 * Optional Circle Gateway x402 verify/settle (see Circle API reference: Gateway x402).
 * Set CIRCLE_API_KEY in .env — never commit keys.
 */

const DEFAULT_BASE = 'https://api.circle.com'

export function getCircleBaseUrl() {
  return (process.env.CIRCLE_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, '')
}

/**
 * @param {string} path e.g. /v1/gateway/v1/x402/verify
 * @param {unknown} body
 */
export async function circleGatewayPost(path, body) {
  const key = process.env.CIRCLE_API_KEY
  if (!key) {
    return { skipped: true, reason: 'CIRCLE_API_KEY not set' }
  }
  const url = `${getCircleBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    return { ok: false, status: res.status, body: json }
  }
  return { ok: true, body: json }
}
