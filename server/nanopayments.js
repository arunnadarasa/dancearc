/**
 * Circle Nanopayments — high-frequency sub-cent settlement rail.
 * Wire your Circle Developer account + Gateway/Nanopayments docs to enable server-side calls.
 * This module records intent for demo metrics; on-chain micro-transfers remain the source of truth for Arc.
 */

const events = []

export function recordNanopaymentEvent(entry) {
  events.unshift({
    ...entry,
    at: new Date().toISOString(),
  })
  return events.length
}

export function listNanopaymentEvents(limit = 100) {
  return events.slice(0, limit)
}
