#!/usr/bin/env node
import 'dotenv/config'

const checks = []
let hasErrors = false

// 1. Node Version Check
const currentVersion = process.versions.node
const [major, minor] = currentVersion.split('.').map(Number)
const isNodeValid = major > 22 || (major === 22 && minor >= 13)

if (isNodeValid) {
  checks.push(`✔ Node.js version is v${currentVersion} (meets requirement >= 22.13)`)
} else {
  hasErrors = true
  checks.push(
    `✖ Node.js version is v${currentVersion}. Requires Node >= 22.13. Run 'nvm use' or update Node.`
  )
}

// 2. Environment file check
const token = process.env.VITE_MAPBOX_ACCESS_TOKEN
const hasPlaceholder = !token || token.includes('your_token_here') || token === ''

if (!token || hasPlaceholder) {
  checks.push(`ℹ Mapbox Token: Not set or using placeholder (${token || 'undefined'}).`)
  checks.push(
    `  → VIT Reunite will use Tier 2 (MapLibre keyless tiles) and Tier 3 (offline SVG campus map).`
  )
  checks.push(
    `  → To enable Tier 1 Mapbox GL: set VITE_MAPBOX_ACCESS_TOKEN in .env and restart dev server.`
  )
} else {
  checks.push(`✔ VITE_MAPBOX_ACCESS_TOKEN is present in environment.`)

  // 3. Test token with Mapbox API
  try {
    const testUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${token}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)

    const res = await fetch(testUrl, {method: 'HEAD', signal: controller.signal})
    clearTimeout(timeout)

    if (res.status === 200) {
      checks.push(`✔ Mapbox token verified successfully with Mapbox Styles API (HTTP 200).`)
    } else if (res.status === 401 || res.status === 403) {
      checks.push(
        `✖ Mapbox token rejected with HTTP ${res.status}. Check token scopes and domain restrictions.`
      )
    } else {
      checks.push(`ℹ Mapbox styles returned HTTP ${res.status}.`)
    }
  } catch (err) {
    checks.push(
      `ℹ Could not reach Mapbox API (${err.message}). Offline or firewall active; fallback tiers will activate.`
    )
  }
}

// 4. Database file check
const dbPath = process.env.DATABASE_PATH || './data/reunite.sqlite'
checks.push(`✔ SQLite database path configured: ${dbPath}`)

console.log('\n=== VIT Reunite Environment Doctor ===\n')
for (const line of checks) {
  console.log(line)
}
console.log('\n======================================\n')

if (hasErrors) {
  process.exit(1)
} else {
  process.exit(0)
}
