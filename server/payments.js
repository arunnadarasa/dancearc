import crypto from 'node:crypto'
import { parseUnits } from 'viem'
import { getArcChain, getPerActionUsdc, getRecipientForNetwork, normalizeArcNetwork } from './config.js'

const DEFAULT_DECIMALS = 18

function toBaseUnits(amountDisplay, decimals = DEFAULT_DECIMALS) {
  return parseUnits(String(amountDisplay), decimals)
}

function getPaymentConfig(network = 'testnet') {
  const net = normalizeArcNetwork(network)
  const chain = getArcChain(net)
  return {
    mode: process.env.PAYMENT_MODE || 'mock',
    chainId: chain.id,
    network: net,
    recipient: getRecipientForNetwork(net),
    decimals: DEFAULT_DECIMALS,
  }
}

export function createMockReceipt(label) {
  return {
    method: 'arc-native-usdc',
    reference: `0x${crypto.randomBytes(32).toString('hex')}`,
    status: 'success',
    timestamp: new Date().toISOString(),
    externalId: label,
  }
}

const battleEntries = new Map()
const battleResults = new Map()
const payoutExecutions = new Map()
const coachingSessions = new Map()
const beatLicenses = new Map()

export function createBattleEntryIntent({ battleId, dancerId, amountDisplay, network }) {
  const paymentConfig = getPaymentConfig(network)
  const amount = toBaseUnits(amountDisplay || '10.00')
  const intentId = crypto.randomUUID()
  const externalId = `battle_entry_${battleId}_${dancerId}_${intentId}`

  const entryIntent = {
    intentId,
    battleId,
    dancerId,
    amountDisplay: amountDisplay || '10.00',
    amount: amount.toString(),
    status: 'requires_payment',
    mode: paymentConfig.mode,
    chainId: paymentConfig.chainId,
    network: paymentConfig.network,
    recipient: paymentConfig.recipient,
    createdAt: new Date().toISOString(),
    externalId,
  }

  battleEntries.set(intentId, entryIntent)
  return entryIntent
}

export function getBattleEntryIntent(intentId) {
  return battleEntries.get(intentId) ?? null
}

export function verifyBattleEntryPayment({ intentId, paymentTx }) {
  const intent = battleEntries.get(intentId)
  if (!intent) throw new Error('Battle entry intent not found.')
  if (!paymentTx) return intent

  const finalized = {
    ...intent,
    status: 'payment_finalized',
    finalizedAt: new Date().toISOString(),
    paymentTx,
  }
  battleEntries.set(intentId, finalized)
  return finalized
}

export function finalizeBattleResults({ battleId, winners }) {
  const result = {
    battleId,
    winners,
    finalizedAt: new Date().toISOString(),
  }
  battleResults.set(battleId, result)
  return result
}

export function executeBattlePayout({ battleId }) {
  const paymentConfig = getPaymentConfig('testnet')
  const result = battleResults.get(battleId)
  if (!result) throw new Error('Battle result not found. Finalize results before payout.')
  if (paymentConfig.mode === 'live') {
    throw new Error('Live payout execution is not enabled in this MVP scaffold. Use PAYMENT_MODE=mock.')
  }

  const payouts = result.winners.map((winner) => ({
    ...winner,
    status: 'settled',
    receipt: createMockReceipt(`battle_payout_${battleId}_${winner.dancerId}`),
  }))

  const execution = {
    battleId,
    mode: paymentConfig.mode,
    executedAt: new Date().toISOString(),
    payouts,
  }
  payoutExecutions.set(battleId, execution)
  return execution
}

export function getBattlePayoutExecution(battleId) {
  return payoutExecutions.get(battleId) || null
}

export function startCoachingSession({ coachId, dancerId, ratePerMinute }) {
  const id = crypto.randomUUID()
  const session = {
    id,
    coachId,
    dancerId,
    ratePerMinute,
    seconds: 0,
    status: 'open',
    createdAt: new Date().toISOString(),
  }
  coachingSessions.set(id, session)
  return session
}

export function tickCoachingSession({ sessionId, seconds }) {
  const session = coachingSessions.get(sessionId)
  if (!session) throw new Error('Session not found.')
  if (session.status !== 'open') throw new Error('Session is not open.')
  session.seconds += seconds
  return session
}

function coachingPaymentPayload(session) {
  const paymentConfig = getPaymentConfig('testnet')
  return {
    sessionId: session.id,
    status: 'requires_payment',
    coachId: session.coachId,
    dancerId: session.dancerId,
    seconds: session.seconds,
    minutes: session.minutes,
    ratePerMinute: session.ratePerMinute,
    amountDisplay: session.amountDisplay,
    amount: session.amount,
    mode: paymentConfig.mode,
    chainId: session.chainId,
    network: session.network,
    recipient: session.recipient,
    billedAt: session.billedAt,
  }
}

/**
 * Close metering → `requires_payment` (Arc testnet USDC). Call `verifyCoachingPayment` with tx hash to finalize.
 */
export function endCoachingSession({ sessionId }) {
  const session = coachingSessions.get(sessionId)
  if (!session) throw new Error('Session not found.')

  if (session.status === 'closed') {
    return {
      sessionId: session.id,
      status: 'closed',
      coachId: session.coachId,
      dancerId: session.dancerId,
      minutes: session.minutes,
      amountDisplay: session.amountDisplay,
      paymentTx: session.paymentTx,
      receipt: session.receipt,
      closedAt: session.closedAt,
    }
  }

  if (session.status === 'awaiting_payment') {
    return coachingPaymentPayload(session)
  }

  const minutes = Math.max(1, Math.ceil(session.seconds / 60))
  const total = Number(session.ratePerMinute) * minutes
  const amountDisplay = total.toFixed(2)
  const paymentConfig = getPaymentConfig('testnet')
  const amount = toBaseUnits(amountDisplay)

  session.status = 'awaiting_payment'
  session.billedAt = new Date().toISOString()
  session.minutes = minutes
  session.amountDisplay = amountDisplay
  session.amount = amount.toString()
  session.chainId = paymentConfig.chainId
  session.network = paymentConfig.network
  session.recipient = paymentConfig.recipient

  return coachingPaymentPayload(session)
}

export function verifyCoachingPayment({ sessionId, paymentTx }) {
  const session = coachingSessions.get(sessionId)
  if (!session) throw new Error('Session not found.')
  if (session.status !== 'awaiting_payment') {
    throw new Error('Session is not awaiting payment. End the session first.')
  }
  const tx = paymentTx != null ? String(paymentTx).trim() : ''
  if (!tx) throw new Error('paymentTx required.')

  session.status = 'closed'
  session.closedAt = new Date().toISOString()
  session.paymentTx = tx
  session.receipt = {
    method: 'arc-native-usdc',
    reference: tx,
    status: 'success',
    timestamp: new Date().toISOString(),
    externalId: `coaching_${session.coachId}_${session.dancerId}`,
  }

  return {
    sessionId: session.id,
    status: 'payment_finalized',
    paymentTx: tx,
    coachId: session.coachId,
    dancerId: session.dancerId,
    minutes: session.minutes,
    amountDisplay: session.amountDisplay,
    chainId: session.chainId,
    network: session.network,
    receipt: session.receipt,
    finalizedAt: session.closedAt,
  }
}

export function getCoachingReceipt(sessionId) {
  const session = coachingSessions.get(sessionId)
  if (!session || !session.receipt) return null
  return {
    id: session.id,
    coachId: session.coachId,
    dancerId: session.dancerId,
    minutes: session.minutes,
    amountDisplay: session.amountDisplay,
    paymentTx: session.paymentTx,
    receipt: session.receipt,
  }
}

export function createBeatLicenseIntent({ beatId, consumerId, amountDisplay }) {
  const paymentConfig = getPaymentConfig('testnet')
  const amount = toBaseUnits(amountDisplay || '10.00')
  const licenseId = crypto.randomUUID()

  const license = {
    licenseId,
    beatId,
    consumerId,
    amountDisplay: amountDisplay || '10.00',
    amount: amount.toString(),
    status: 'requires_payment',
    mode: paymentConfig.mode,
    chainId: paymentConfig.chainId,
    network: paymentConfig.network,
    recipient: paymentConfig.recipient,
    createdAt: new Date().toISOString(),
  }

  beatLicenses.set(licenseId, license)
  return license
}

export function grantBeatLicense({ licenseId, paymentTx }) {
  const license = beatLicenses.get(licenseId)
  if (!license) throw new Error('License not found.')
  if (license.status === 'granted') throw new Error('License already granted.')
  if (license.status !== 'requires_payment') throw new Error('License is not awaiting payment.')
  const tx = paymentTx != null ? String(paymentTx).trim() : ''
  if (!tx) throw new Error('paymentTx required.')

  const granted = {
    ...license,
    status: 'granted',
    grantedAt: new Date().toISOString(),
    paymentTx: tx,
  }
  beatLicenses.set(licenseId, granted)
  return granted
}

export function getPerActionPriceDisplay() {
  return getPerActionUsdc()
}
