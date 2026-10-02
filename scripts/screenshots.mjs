#!/usr/bin/env node
/**
 * npm run screenshots — captures the key screens at 1440 px (desktop) and
 * 390 px (mobile) into docs/screens/, using a throwaway server and temporary
 * database, exactly like the Playwright e2e suite.
 *
 * Requires the client to be built (`npm run build`, the server serves
 * client/dist) and Playwright's Chromium (`npx playwright install chromium`).
 */
import {chromium} from '@playwright/test'
import {mkdirSync, mkdtempSync} from 'node:fs'
import {createServer} from 'node:net'
import {dirname, join} from 'node:path'
import {tmpdir} from 'node:os'
import {spawn, spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outDir = join(root, 'docs', 'screens')
mkdirSync(outDir, {recursive: true})

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port
      probe.close(() => resolve(port))
    })
  })

const port = await freePort()
const base = `http://localhost:${port}`
const workDir = mkdtempSync(join(tmpdir(), 'reunite-shots-'))
const env = {
  ...process.env,
  PORT: String(port),
  DATABASE_PATH: join(workDir, 'reunite.sqlite'),
  UPLOADS_DIR: join(workDir, 'uploads'),
  NODE_ENV: 'development',
  DEV_AUTO_VERIFY: 'true',
  APP_ORIGIN: base
}

for (const script of ['bootstrap.js', 'seed.js'])
  spawnSync('node', [join(root, 'scripts', script)], {env, stdio: 'inherit'})

const server = spawn('node', [join(root, 'server', 'index.js')], {env, stdio: 'ignore'})
process.on('exit', () => server.kill())

const deadline = Date.now() + 30000
for (;;) {
  try {
    const res = await fetch(`${base}/api/health`)
    if (res.ok) break
  } catch {}
  if (Date.now() > deadline) throw new Error('Server did not become healthy within 30s.')
  await new Promise(r => setTimeout(r, 250))
}
console.log(`Server ready on ${base}; capturing into docs/screens/ ...`)

const browser = await chromium.launch()
try {
  const viewports = [
    ['desktop', {width: 1440, height: 900}],
    ['mobile', {width: 390, height: 844, deviceScaleFactor: 2}]
  ]

  for (const [label, viewport] of viewports) {
    const suffix = label === 'mobile' ? '-mobile' : ''
    // Desktop and mobile passes use different seeded items for the claim /
    // handoff flow, so each pass starts from untouched board state.
    const flowItem = label === 'desktop' ? 'Brown leather wallet' : 'Lab safety goggles'

    const context = await browser.newContext({viewport, baseURL: base})
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    // The dashboard guards destructive actions behind confirm() dialogs.
    page.on('dialog', dialog => dialog.accept())

    const shot = (name, noSuffix = false) =>
      page.screenshot({path: join(outDir, `${name}${noSuffix ? '' : suffix}.png`)})

    const signIn = async (email, password) => {
      await page.goto('/')
      await page.getByRole('button', {name: 'Student sign in'}).click()
      await page.getByLabel('VIT email address').fill(email)
      await page.getByLabel('Password', {exact: true}).fill(password)
      await page.locator('.modal form').getByRole('button', {name: 'Sign in', exact: true}).click()
      await page.locator('.avatar').waitFor()
    }

    // 1. Board with seeded reports.
    await page.goto('/')
    const earbuds = page.getByRole('button', {name: /A pair of wireless earbuds/})
    await earbuds.waitFor()
    await earbuds.scrollIntoViewIfNeeded()
    await shot(label, true)

    // 2. Item detail.
    const card = page.getByRole('button', {name: new RegExp(flowItem)})
    await card.click()
    await page.getByRole('dialog', {name: new RegExp(flowItem)}).waitFor()
    await shot('item-detail')
    await page.getByRole('button', {name: 'Close dialog'}).click()

    // 3. Report form (signed in as the finder).
    await signIn('finder@vitstudent.ac.in', 'CampusDemo2026!')
    await page.getByRole('button', {name: 'I lost something'}).click()
    await page.getByRole('dialog', {name: 'A little detail goes a long way'}).waitFor()
    await shot('report-form')
    await page.getByRole('button', {name: 'Close dialog'}).click()

    // 4. The student claims the item...
    await page.getByRole('button', {name: 'Sign out'}).click()
    await signIn('student@vitstudent.ac.in', 'CampusDemo2026!')
    await page.getByRole('button', {name: new RegExp(flowItem)}).click()
    await page
      .getByLabel('Your private verification answer')
      .fill('It has my initials on the inside and a small scratch near the corner.')
    await page.getByRole('button', {name: 'Send verification request'}).click()

    // ...the finder approves, opening the private handoff thread.
    await page.getByRole('button', {name: 'Sign out'}).click()
    await signIn('finder@vitstudent.ac.in', 'CampusDemo2026!')
    await page.getByRole('button', {name: /My activity/}).click()

    // 5. Dashboard with the pending claim visible.
    const requestCard = page.locator('.request-card', {hasText: flowItem})
    await requestCard.waitFor()
    await shot('dashboard')

    // 6. Approved handoff thread with a message.
    await requestCard.getByRole('button', {name: 'Approve'}).click()
    await requestCard.getByRole('button', {name: 'Private handoff'}).click()
    const thread = page.getByRole('dialog', {name: 'Your private handoff'})
    await thread.waitFor()
    const message = `Meet me at the library help desk at 4pm for the ${flowItem.toLowerCase()}.`
    await page.getByLabel('Private message').fill(message)
    await page.getByRole('button', {name: 'Send message'}).click()
    await thread.getByText(message).waitFor()
    await shot('handoff-thread')

    await context.close()
    console.log(`  ${label}: board, item-detail, report-form, dashboard, handoff-thread`)
  }
} finally {
  await browser.close()
  server.kill()
}
console.log('Done.')
