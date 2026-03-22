/** `paymentTx` on API JSON or on `verify_failed` payloads */
export function extractPaymentTxHashFromLog(raw: string): string | null {
  const t = raw.trim()
  if (!t || t === '—') return null
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    const tx = j.paymentTx
    if (typeof tx === 'string' && /^0x[a-fA-F0-9]{64}$/i.test(tx)) return tx
  } catch {
    /* not JSON */
  }
  return null
}
