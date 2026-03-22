import 'dotenv/config'
import express from 'express'
import {
  arcChain,
  arcMainnet,
  arcTestnet,
  getArcChain,
  getPerActionValueWei,
  getRecipient,
  getRecipientForNetwork,
  normalizeArcNetwork,
} from './config.js'
import { getPerActionPriceDisplay } from './payments.js'
import { verifyNativeUsdcPayment } from './onchain-verify.js'
import { circleGatewayPost } from './circle-gateway.js'
import { recordNanopaymentEvent, listNanopaymentEvents } from './nanopayments.js'
import {
  createBattleEntryIntent,
  getBattleEntryIntent,
  createBeatLicenseIntent,
  endCoachingSession,
  executeBattlePayout,
  finalizeBattleResults,
  getBattlePayoutExecution,
  getCoachingReceipt,
  grantBeatLicense,
  startCoachingSession,
  tickCoachingSession,
  verifyBattleEntryPayment,
  verifyCoachingPayment,
} from './payments.js'
import {
  createArcTestnetDcwWallet,
  formatCircleRequestError,
  getDcwClient,
  requestArcTestnetFaucet,
} from './dcw-wallets.js'

const app = express()
const port = Number(process.env.PORT || 8787)

/**
 * Circle Modular SDK always calls `response.json()`. Empty or HTML bodies (403 lockout, etc.) throw
 * "Unexpected end of JSON input" in the browser — normalize to JSON-RPC error JSON.
 * @param {string} text
 * @param {number} status
 */
function normalizeCircleModularResponseBody(text, status) {
  const t = (text ?? '').trim()
  if (!t) {
    return JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: status === 403 ? -32003 : -32603,
        message: `Circle Modular returned an empty body (HTTP ${status}). In Circle Console, allow this app origin (e.g. localhost) for your Client Key and confirm the key is correct.`,
      },
    })
  }
  try {
    JSON.parse(t)
    return t
  } catch {
    const lockout = /lockout/i.test(t) || /<title>\s*Lockout/i.test(t)
    const hint = lockout
      ? 'Circle returned an HTML Lockout page (403). Try: (1) new Client Key + paste full value into VITE_CIRCLE_CLIENT_KEY; (2) in Console allowlist add BOTH localhost and http://localhost:5173 if the UI allows URLs; (3) server env CIRCLE_MODULAR_PRESERVE_ORIGIN=1 to stop stripping :5173 from Origin; (4) staging key + CIRCLE_MODULAR_SDK_URL=https://modular-sdk-staging.circle.com; (5) wait if WAF rate-limited.'
      : 'Response was not JSON — check Client Key, domain allowlist, or upstream errors.'
    return JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: status === 403 ? -32003 : -32603,
        message: `Circle Modular proxy (HTTP ${status}): ${hint}`,
        data: t.slice(0, 400),
      },
    })
  }
}

/**
 * Circle sometimes returns JSON-RPC `error.message` as empty; viem then shows "Unknown RPC" with blank details.
 */
function enrichCircleModularRpcBody(bodyStr, httpStatus) {
  try {
    const j = JSON.parse(bodyStr)
    if (!j || typeof j !== 'object' || j.error == null || typeof j.error !== 'object') return bodyStr
    const err = j.error
    const m = err.message
    if (m !== undefined && m !== null && String(m).trim() !== '') return bodyStr
    const code = err.code
    let dataBit = ''
    if (err.data !== undefined) {
      dataBit =
        typeof err.data === 'string'
          ? err.data.slice(0, 280)
          : JSON.stringify(err.data).slice(0, 280)
    }
    err.message = `Circle Modular returned an RPC error with no message (HTTP ${httpStatus}${code !== undefined ? `, code ${code}` : ''}). Check Client Key and allowed domain (localhost) in Circle Console.${dataBit ? ` Data: ${dataBit}` : ''}`
    return JSON.stringify(j)
  } catch {
    return bodyStr
  }
}

/**
 * Circle’s edge may Lockout (403) for server-side fetches. We forward browser UA and tune Origin:
 * default strips :5173 for “localhost-only” allowlists; set CIRCLE_MODULAR_PRESERVE_ORIGIN=1 if Console lists full URL.
 */
function buildCircleModularProxyHeaders(req) {
  const preserveOrigin =
    process.env.CIRCLE_MODULAR_PRESERVE_ORIGIN === '1' ||
    process.env.CIRCLE_MODULAR_PRESERVE_ORIGIN === 'true'

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  const auth = req.get('authorization')
  if (typeof auth === 'string' && auth.length > 0) headers.Authorization = auth

  const appInfo = req.get('x-appinfo')
  if (typeof appInfo === 'string' && appInfo.length > 0) headers['X-AppInfo'] = appInfo

  const ua = req.get('user-agent')
  if (typeof ua === 'string' && ua.length > 0) {
    headers['User-Agent'] = ua
  } else {
    headers['User-Agent'] =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  }

  const al = req.get('accept-language')
  headers['Accept-Language'] = typeof al === 'string' && al.length > 0 ? al : 'en-US,en;q=0.9'

  /** Helps some edges treat the outbound call like a CORS preflight-style browser POST to Circle. */
  headers['Sec-Fetch-Dest'] = 'empty'
  headers['Sec-Fetch-Mode'] = 'cors'
  headers['Sec-Fetch-Site'] = 'cross-site'

  const origin = req.get('origin')
  if (typeof origin === 'string' && origin.length > 0) {
    if (preserveOrigin) {
      headers.Origin = origin
      const ref = req.get('referer')
      if (typeof ref === 'string') headers.Referer = ref
    } else {
      try {
        const u = new URL(origin)
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
          headers.Origin = `${u.protocol}//${u.hostname}`
          const ref = req.get('referer')
          if (typeof ref === 'string' && ref.length > 0) {
            try {
              const ru = new URL(ref)
              if (ru.hostname === 'localhost' || ru.hostname === '127.0.0.1') {
                headers.Referer = `${ru.protocol}//${ru.hostname}${ru.pathname}${ru.search}`
              } else {
                headers.Referer = ref
              }
            } catch {
              headers.Referer = ref
            }
          }
        } else {
          headers.Origin = origin
          const ref = req.get('referer')
          if (typeof ref === 'string') headers.Referer = ref
        }
      } catch {
        headers.Origin = origin
      }
    }
  }

  return headers
}

/** Must run before `express.json()` so the JSON-RPC body is forwarded verbatim to Circle (Vite proxy + JSON parse edge cases). */
const DEFAULT_MODULAR_SDK_URL = 'https://modular-sdk.circle.com'
app.post(
  '/api/circle-modular',
  express.raw({ type: '*/*', limit: '2mb' }),
  async (req, res) => {
    const target = (process.env.CIRCLE_MODULAR_SDK_URL || DEFAULT_MODULAR_SDK_URL).trim()
    try {
      const rawBody =
        Buffer.isBuffer(req.body) && req.body.length > 0 ? req.body.toString('utf8') : '{}'
      const upstream = await fetch(target, {
        method: 'POST',
        headers: buildCircleModularProxyHeaders(req),
        body: rawBody,
      })
      const text = await upstream.text()
      let body = normalizeCircleModularResponseBody(text, upstream.status)
      body = enrichCircleModularRpcBody(body, upstream.status)
      res.status(upstream.status).setHeader('Content-Type', 'application/json; charset=utf-8').send(body)
    } catch (err) {
      console.error('circle-modular proxy', err)
      res.status(502).json({ error: 'proxy_failed', message: String(err?.message ?? err) })
    }
  },
)

app.use(express.json({ limit: '1mb' }))

function normalizeTxHeader(req) {
  const a = req.get('x-payment-tx')
  const b = req.get('payment-tx')
  const raw = typeof a === 'string' && a.length > 0 ? a : typeof b === 'string' ? b : ''
  const h = raw.trim()
  if (!h) return null
  return h.startsWith('0x') ? /** @type {`0x${string}`} */ (h) : /** @type {`0x${string}`} */ (`0x${h}`)
}

/**
 * @param {{ resource: string; description: string; network: import('./config.js').ArcNetwork; minValueWei?: bigint }} p
 */
function buildArcPaymentChallenge({ resource, description, network, minValueWei }) {
  const chain = getArcChain(network)
  const recipient = getRecipientForNetwork(network)
  const wei = minValueWei ?? getPerActionValueWei()
  return {
    x402Version: 1,
    error: 'Payment required — settle on Arc with native USDC (x402-inspired; see README)',
    accepts: [
      {
        scheme: 'arc-native-usdc',
        network: network === 'mainnet' ? 'arc-mainnet' : 'arc-testnet',
        chainId: chain.id,
        maxAmountRequired: wei.toString(),
        asset: 'native',
        payTo: recipient,
        resource,
        description,
        mimeType: 'application/json',
        maxTimeoutSeconds: 120,
        extra: {
          rpcUrl: chain.rpcUrls.default.http[0],
          explorer: `${chain.blockExplorers.default.url}/tx/`,
          perActionUsdc: minValueWei ? undefined : getPerActionPriceDisplay(),
        },
      },
    ],
  }
}

/**
 * @param {{ resource: string; description: string; network: import('./config.js').ArcNetwork; minValueWei?: bigint }} opts
 */
async function requireArcPayment(req, res, opts) {
  const { resource, description, network, minValueWei } = opts
  const net = network ?? 'testnet'
  const txHash = normalizeTxHeader(req)
  if (!txHash) {
    res.status(402).json(buildArcPaymentChallenge({ resource, description, network: net, minValueWei }))
    return null
  }
  const minValue = minValueWei ?? getPerActionValueWei()
  const recipient = getRecipientForNetwork(net)
  const v = await verifyNativeUsdcPayment(txHash, { recipient, minValue, network: net })
  if (!v.ok) {
    res.status(402).json({
      ...buildArcPaymentChallenge({ resource, description, network: net, minValueWei }),
      verifyError: v.reason,
    })
    return null
  }

  recordNanopaymentEvent({
    kind: 'arc-native-usdc',
    txHash,
    resource,
    value: v.value?.toString(),
    from: v.from,
    network: net,
  })

  const chain = getArcChain(net)
  const circleBody = {
    txHash,
    chainId: chain.id,
    resource,
    amountWei: minValue.toString(),
    recipient,
  }
  const circle = await circleGatewayPost('/v1/gateway/v1/x402/verify', circleBody)
  return { txHash, verify: v, circle, network: net }
}

const judgeScores = []

function devWalletsAuthOk(req) {
  const secret = process.env.DEV_WALLET_SECRET?.trim()
  if (!secret) return true
  const auth = req.get('authorization')?.replace(/^Bearer\s+/i, '')?.trim()
  const header = req.get('x-dancearc-dcw-secret')?.trim()
  return auth === secret || header === secret
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'dancearc',
    chainId: arcChain.id,
    perActionUsdc: getPerActionPriceDisplay(),
    recipient: getRecipient(),
  })
})

/** Circle Developer-Controlled Wallets — server-side only (Entity Secret never in the browser). */
app.get('/api/dev-wallets/status', (_req, res) => {
  const hasApiKey = Boolean(process.env.CIRCLE_API_KEY?.trim())
  const hasEntitySecret = Boolean(process.env.CIRCLE_ENTITY_SECRET?.trim())
  res.json({
    configured: Boolean(getDcwClient()),
    hasApiKey,
    hasEntitySecret,
    authRequired: Boolean(process.env.DEV_WALLET_SECRET?.trim()),
    arcTestnet: { chainId: arcTestnet.id, rpcUrl: arcTestnet.rpcUrls.default.http[0] },
    hint: 'Set CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET. Optional: DEV_WALLET_SECRET to require Bearer on POST.',
    note: 'Env vars alone are not enough: you must register the entity secret with Circle once (npm run circle:entity-secret:register or Console), or wallet APIs return "entity secret has not been set".',
  })
})

app.post('/api/dev-wallets/create', async (req, res) => {
  if (!devWalletsAuthOk(req)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Set DEV_WALLET_SECRET in .env and send Authorization: Bearer <secret> or X-DanceArc-Dcw-Secret.',
    })
  }
  if (!getDcwClient()) {
    return res.status(503).json({
      error: 'not_configured',
      message: 'Set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET (server .env only).',
    })
  }
  try {
    const { walletSetName, walletSetId, accountType } = req.body ?? {}
    const out = await createArcTestnetDcwWallet({
      walletSetName: typeof walletSetName === 'string' ? walletSetName : undefined,
      walletSetId: typeof walletSetId === 'string' ? walletSetId : undefined,
      accountType: accountType === 'EOA' ? 'EOA' : 'SCA',
    })
    res.json(out)
  } catch (e) {
    console.error('dev-wallets/create', e)
    const msg = String(e?.message ?? e)
    const needsRegistration =
      /entity secret has not been set|encrypted ciphertext|register.*entity secret/i.test(msg)
    res.status(500).json({
      error: 'dcw_failed',
      message: msg,
      ...(needsRegistration && {
        hint: 'Your API key and CIRCLE_ENTITY_SECRET are in .env, but Circle has not registered this entity secret yet. Run once: npm run circle:entity-secret:register (then restart the server). Or register the ciphertext in Circle Console.',
        nextCommand: 'npm run circle:entity-secret:register',
      }),
    })
  }
})

/** Circle testnet faucet API for Arc (native USDC) — uses same credentials as DCW. */
app.post('/api/dev-wallets/faucet', async (req, res) => {
  if (!devWalletsAuthOk(req)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Set DEV_WALLET_SECRET in .env and send Authorization: Bearer <secret> or X-DanceArc-Dcw-Secret.',
    })
  }
  if (!getDcwClient()) {
    return res.status(503).json({
      error: 'not_configured',
      message: 'Set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET (server .env only).',
    })
  }
  const addr = typeof req.body?.address === 'string' ? req.body.address.trim() : ''
  if (!addr) {
    return res.status(400).json({ error: 'address required' })
  }
  try {
    const out = await requestArcTestnetFaucet(addr)
    res.status(200).json(out)
  } catch (e) {
    console.error('dev-wallets/faucet', e)
    const { httpStatus, message } = formatCircleRequestError(e)
    const clientStatus =
      httpStatus === 401 || httpStatus === 403 || httpStatus === 404 || httpStatus === 429 ? httpStatus : 502
    const hint403 =
      httpStatus === 403
        ? 'Circle rejected programmatic testnet tokens (403). Common causes: API key missing DCW / faucet scopes, wrong environment (sandbox vs prod), or programmatic faucet not enabled for the project. Use “Open Circle faucet” (browser) or check API key permissions in Circle Console.'
        : undefined
    const hint429 =
      httpStatus === 429
        ? 'Faucet rate-limited (e.g. one drip per asset/network every ~2h). Wait and retry or use the web faucet.'
        : undefined
    res.status(clientStatus).json({
      error: 'faucet_failed',
      message,
      ...(httpStatus != null && { upstreamStatus: httpStatus }),
      ...(hint403 && { hint: hint403 }),
      ...(hint429 && { hint: hint429 }),
    })
  }
})

/** Paid judge score — golden path for per-API monetization (≤ $0.01 per action). */
app.post('/api/judges/score', async (req, res) => {
  const resource = `${req.protocol}://${req.get('host')}/api/judges/score`
  const paid = await requireArcPayment(req, res, {
    resource,
    description: 'Judge score write (DanceArc)',
  })
  if (!paid) return

  const { battleId, roundId, judgeId, dancerId, score } = req.body ?? {}
  if (
    typeof battleId !== 'string' ||
    typeof roundId !== 'string' ||
    typeof judgeId !== 'string' ||
    typeof dancerId !== 'string' ||
    typeof score !== 'number'
  ) {
    return res.status(400).json({
      error: 'Invalid payload. Expected battleId, roundId, judgeId, dancerId (strings) and score (number).',
    })
  }

  const entry = {
    id: judgeScores.length + 1,
    battleId,
    roundId,
    judgeId,
    dancerId,
    score,
    paymentTx: paid.txHash,
    createdAt: new Date().toISOString(),
  }
  judgeScores.push(entry)

  res.json({
    ok: true,
    result: entry,
    settlement: 'arc',
    circleGateway: paid.circle,
  })
})

/** Live dance-extras style route — judge-score only for MVP */
app.post('/api/dance-extras/live/:flowKey/:network', async (req, res) => {
  const { flowKey, network } = req.params
  if (flowKey !== 'judge-score') {
    return res.status(404).json({ error: 'Only judge-score is wired in DanceArc MVP.' })
  }
  if (network !== 'testnet') {
    return res.status(400).json({ error: 'Use testnet for Arc testnet (chain ' + arcChain.id + ').' })
  }

  const resource = `${req.protocol}://${req.get('host')}${req.originalUrl}`
  const paid = await requireArcPayment(req, res, {
    resource,
    description: 'Dance extras live — judge score',
  })
  if (!paid) return

  const { battleId, roundId, judgeId, dancerId, score } = req.body ?? {}
  if (
    typeof battleId !== 'string' ||
    typeof roundId !== 'string' ||
    typeof judgeId !== 'string' ||
    typeof dancerId !== 'string' ||
    typeof score !== 'number'
  ) {
    return res.status(400).json({
      error: 'Invalid payload. Expected battleId, roundId, judgeId, dancerId (strings) and score (number).',
    })
  }

  const entry = {
    id: judgeScores.length + 1,
    battleId,
    roundId,
    judgeId,
    dancerId,
    score,
    paymentTx: paid.txHash,
    createdAt: new Date().toISOString(),
    flow: 'judge-score',
  }
  judgeScores.push(entry)
  res.json({ ok: true, network: 'testnet', chainId: arcChain.id, result: entry })
})

app.post('/api/battle/intent', (req, res) => {
  const { battleId, dancerId, amountDisplay } = req.body ?? {}
  if (typeof battleId !== 'string' || typeof dancerId !== 'string') {
    return res.status(400).json({ error: 'Expected battleId and dancerId (strings).' })
  }
  const intent = createBattleEntryIntent({ battleId, dancerId, amountDisplay })
  res.json(intent)
})

app.post('/api/battle/verify', (req, res) => {
  const { intentId, paymentTx } = req.body ?? {}
  if (typeof intentId !== 'string') {
    return res.status(400).json({ error: 'Expected intentId.' })
  }
  try {
    const out = verifyBattleEntryPayment({ intentId, paymentTx })
    res.json(out)
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'verify failed' })
  }
})

app.post('/api/battle/finalize', (req, res) => {
  const { battleId, winners } = req.body ?? {}
  if (typeof battleId !== 'string' || !Array.isArray(winners)) {
    return res.status(400).json({ error: 'Expected battleId and winners array.' })
  }
  res.json(finalizeBattleResults({ battleId, winners }))
})

app.post('/api/battle/payout', (req, res) => {
  const { battleId } = req.body ?? {}
  if (typeof battleId !== 'string') {
    return res.status(400).json({ error: 'Expected battleId.' })
  }
  try {
    res.json(executeBattlePayout({ battleId }))
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'payout failed' })
  }
})

app.get('/api/battle/payout/:battleId', (req, res) => {
  const execution = getBattlePayoutExecution(req.params.battleId)
  if (!execution) return res.status(404).json({ error: 'No payout execution for this battle.' })
  res.json(execution)
})

app.post('/api/coaching/start', (req, res) => {
  const { coachId, dancerId, ratePerMinute } = req.body ?? {}
  if (typeof coachId !== 'string' || typeof dancerId !== 'string' || typeof ratePerMinute !== 'number') {
    return res.status(400).json({ error: 'Expected coachId, dancerId, ratePerMinute.' })
  }
  res.json(startCoachingSession({ coachId, dancerId, ratePerMinute }))
})

app.post('/api/coaching/tick', (req, res) => {
  const { sessionId, seconds } = req.body ?? {}
  if (typeof sessionId !== 'string' || typeof seconds !== 'number') {
    return res.status(400).json({ error: 'Expected sessionId and seconds.' })
  }
  try {
    res.json(tickCoachingSession({ sessionId, seconds }))
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'tick failed' })
  }
})

app.post('/api/coaching/end', (req, res) => {
  const { sessionId } = req.body ?? {}
  if (typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Expected sessionId.' })
  }
  try {
    res.json(endCoachingSession({ sessionId }))
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'end failed' })
  }
})

app.post('/api/coaching/verify', (req, res) => {
  const { sessionId, paymentTx } = req.body ?? {}
  if (typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Expected sessionId.' })
  }
  try {
    res.json(verifyCoachingPayment({ sessionId, paymentTx }))
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'verify failed' })
  }
})

app.get('/api/coaching/receipt/:sessionId', (req, res) => {
  const r = getCoachingReceipt(req.params.sessionId)
  if (!r) return res.status(404).json({ error: 'No receipt.' })
  res.json(r)
})

app.post('/api/beats/intent', (req, res) => {
  const { beatId, consumerId, amountDisplay } = req.body ?? {}
  if (typeof beatId !== 'string' || typeof consumerId !== 'string') {
    return res.status(400).json({ error: 'Expected beatId and consumerId.' })
  }
  res.json(createBeatLicenseIntent({ beatId, consumerId, amountDisplay }))
})

app.post('/api/beats/grant', (req, res) => {
  const { licenseId, paymentTx } = req.body ?? {}
  if (typeof licenseId !== 'string') {
    return res.status(400).json({ error: 'Expected licenseId.' })
  }
  try {
    res.json(grantBeatLicense({ licenseId, paymentTx }))
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'grant failed' })
  }
})

app.get('/api/nanopayments/events', (_req, res) => {
  res.json({ events: listNanopaymentEvents(200) })
})

app.get('/openapi.json', (_req, res) => {
  res.json({
    openapi: '3.1.0',
    info: {
      title: 'DanceArc API',
      version: '0.1.0',
      description: 'Arc + USDC + x402-inspired payment challenges. Paid routes require X-Payment-Tx.',
    },
    paths: {
      '/api/judges/score': {
        post: {
          summary: 'Paid judge score (402 + Arc native USDC)',
          'x-payment-info': {
            chainId: arcChain.id,
            perActionUsdc: getPerActionPriceDisplay(),
            header: 'X-Payment-Tx',
          },
        },
      },
    },
  })
})

app.listen(port, () => {
  console.log(`DanceArc API http://localhost:${port}`)
})
