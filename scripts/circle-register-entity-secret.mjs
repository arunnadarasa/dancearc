#!/usr/bin/env node
/**
 * Local-only helper for Circle Developer-Controlled Wallets Entity Secret.
 * Never run this in the browser; never put CIRCLE_ENTITY_SECRET in Vite (no VITE_*).
 *
 * The SDK writes recovery files under `recoveryFileDownloadPath` (must be an existing directory).
 *
 * @see https://developers.circle.com/wallets/dev-controlled/entity-secret-management
 * @see https://developers.circle.com/wallets/dev-controlled/register-entity-secret
 */
import 'dotenv/config'
import { mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateEntitySecret, registerEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const defaultRecoveryDir = join(root, '.circle-recovery')

const cmd = process.argv[2] || 'help'

function help() {
  const dir = process.env.CIRCLE_RECOVERY_DIR?.trim() || defaultRecoveryDir
  console.log(`
Circle Entity Secret — run on your machine only (not in the frontend)

  npm run circle:entity-secret:generate
      Prints a new 32-byte hex secret. Add to .env:
        CIRCLE_ENTITY_SECRET=<hex from output>
      Do not commit .env.

  npm run circle:entity-secret:register
      Reads CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET from .env, registers with Circle.
      Recovery .dat files are written under:
        ${dir}
      (gitignored). Override with CIRCLE_RECOVERY_DIR=/absolute/path/to/dir
`)
}

if (cmd === 'generate' || cmd === 'gen') {
  generateEntitySecret()
  console.error('\nNext: set CIRCLE_ENTITY_SECRET in .env, then: npm run circle:entity-secret:register\n')
  process.exit(0)
}

if (cmd === 'register' || cmd === 'reg') {
  const apiKey = process.env.CIRCLE_API_KEY?.trim()
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET?.trim()
  const baseUrl = process.env.CIRCLE_API_BASE_URL?.trim() || 'https://api.circle.com'
  const recoveryDir = process.env.CIRCLE_RECOVERY_DIR?.trim() || defaultRecoveryDir

  if (!apiKey) {
    console.error('Missing CIRCLE_API_KEY in .env')
    process.exit(1)
  }
  if (!entitySecret) {
    console.error('Missing CIRCLE_ENTITY_SECRET in .env. Run: npm run circle:entity-secret:generate')
    process.exit(1)
  }

  mkdirSync(recoveryDir, { recursive: true })
  if (!existsSync(recoveryDir)) {
    console.error('Could not create recovery directory:', recoveryDir)
    process.exit(1)
  }

  try {
    await registerEntitySecretCiphertext({
      apiKey,
      entitySecret,
      baseUrl,
      recoveryFileDownloadPath: recoveryDir,
    })
    console.log(`Done. If registration succeeded, check recovery files under:\n  ${recoveryDir}`)
    console.log('Back up that directory; Circle requires the recovery material for reset/rotation.')
  } catch (e) {
    console.error('registerEntitySecretCiphertext failed:', e?.message ?? e)
    process.exit(1)
  }
  process.exit(0)
}

help()
process.exit(cmd === 'help' ? 0 : 1)
