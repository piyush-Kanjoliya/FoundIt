import {test, expect} from '@playwright/test'

// The finder's identity must never reach the claimant's browser: not in any
// API response body, not in the rendered page. The "Brown leather wallet"
// report is owned by the seeded finder (finder@vitstudent.ac.in, "Demo
// Finder", registration 24BIT9001).
const SECRETS = ['finder@vitstudent.ac.in', 'Demo Finder', '24BIT9001']

test('claimant session never receives finder identity in responses or page text', async ({
  page
}) => {
  const responseBodies = []
  page.on('response', async response => {
    try {
      // Only dynamic API data counts. The static JS bundle is excluded: the
      // auth modal prints the public demo credentials by design, so the demo
      // finder's email exists in app code shipped to every visitor. What must
      // never leak is finder *data* in API responses and rendered text.
      if (!response.url().includes('/api/')) return
      const type = response.headers()['content-type'] || ''
      if (type.includes('json') || type.includes('text'))
        responseBodies.push(`${response.url()}\n${await response.text()}`)
    } catch {
      // streams can already be consumed; nothing to inspect
    }
  })

  // Register and sign in as a fresh claimant.
  await page.goto('/')
  await page.getByRole('button', {name: 'Student sign in'}).click()
  await page.getByRole('button', {name: 'Create account'}).click()
  await page.getByLabel('Your name').fill('E2E Privacy')
  await page.getByLabel('Registration number (private)').fill('24BIT5678')
  await page.getByLabel('VIT email address').fill('e2e-privacy@vitstudent.ac.in')
  await page.getByLabel('Password · at least 10 characters').fill('E2eStrongPass1!')
  await page.locator('.modal form').getByRole('button', {name: 'Create student account'}).click()
  await page.getByRole('button', {name: 'Back to sign in'}).click()
  await page.getByLabel('VIT email address').fill('e2e-privacy@vitstudent.ac.in')
  await page.getByLabel('Password', {exact: true}).fill('E2eStrongPass1!')
  await page.locator('.modal form').getByRole('button', {name: 'Sign in', exact: true}).click()
  await expect(page.locator('.avatar')).toBeVisible()

  // Submit a private claim on the finder's report.
  await page.getByRole('button', {name: /Brown leather wallet/}).click()
  const itemDialog = page.getByRole('dialog', {name: /Brown leather wallet/})
  await expect(itemDialog).toBeVisible()
  await page
    .getByLabel('Your private verification answer')
    .fill('It has a purple stitch on the corner and two cards inside.')
  await page.getByRole('button', {name: 'Send verification request'}).click()
  await expect(itemDialog).toBeHidden()

  // Review everything the claimant can see: the board and the dashboard.
  await page.getByRole('button', {name: /My activity/}).click()
  await expect(page.locator('.request-card').first()).toBeVisible()
  const pageText = await page.locator('body').innerText()

  for (const secret of SECRETS) {
    const leaking = responseBodies.filter(body => body.includes(secret))
    expect(
      leaking,
      `API/page responses visible to the claimant contained "${secret}": ` +
        leaking[0]?.slice(0, 300)
    ).toEqual([])
    expect(pageText.includes(secret), `rendered dashboard text contained "${secret}"`).toBe(false)
  }
})
