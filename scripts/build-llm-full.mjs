import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const out = path.join(root, 'public', 'llm-full.txt')

const chunks = [
  path.join(root, 'README.md'),
  path.join(root, 'docs', 'HACKATHON.md'),
]

let body = '# DanceArc LLM bundle\n\n'
for (const file of chunks) {
  if (!fs.existsSync(file)) continue
  body += `\n\n---\n\n# File: ${path.relative(root, file)}\n\n`
  body += fs.readFileSync(file, 'utf8')
}

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, body, 'utf8')
console.log('Wrote', out)
