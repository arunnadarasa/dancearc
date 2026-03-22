#!/usr/bin/env node
/**
 * Sends 55 sequential native USDC transfers on Arc Testnet (≤ $0.01 each by default).
 * Requires ARC_BURST_PRIVATE_KEY (0x…) and ARC_RECIPIENT in .env — never commit real keys.
 */
import 'dotenv/config'
import { createWalletClient, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arcTestnet } from 'viem/chains'

const pk = process.env.ARC_BURST_PRIVATE_KEY
const recipient = process.env.ARC_RECIPIENT
const amount = process.env.BURST_AMOUNT_USDC || '0.0005'
const count = Number(process.env.BURST_COUNT || 55)

if (!pk || !pk.startsWith('0x')) {
  console.error('Set ARC_BURST_PRIVATE_KEY in .env (test key only).')
  process.exit(1)
}
if (!recipient || !recipient.startsWith('0x')) {
  console.error('Set ARC_RECIPIENT to a valid 0x address.')
  process.exit(1)
}

const account = privateKeyToAccount(/** @type {`0x${string}`} */ (pk))
const client = createWalletClient({
  account,
  chain: arcTestnet,
  transport: http(arcTestnet.rpcUrls.default.http[0]),
})

const value = parseUnits(amount, 18)
console.error(`From ${account.address} → ${recipient}, ${count} txs × ${amount} USDC (wei ${value})`)

const hashes = []
for (let i = 0; i < count; i++) {
  const hash = await client.sendTransaction({
    to: recipient,
    value,
    chain: arcTestnet,
  })
  hashes.push(hash)
  console.log(hash)
  await new Promise((r) => setTimeout(r, 400))
}

console.error(`Done. ${hashes.length} transactions.`)
console.error(`Explorer: https://testnet.arcscan.app/address/${recipient}`)
