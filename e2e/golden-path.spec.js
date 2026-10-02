import {test, expect} from '@playwright/test'

// Full recovery lifecycle on the seeded board: the "Casio scientific
// calculator" report belongs to the seeded finder (finder@vitstudent.ac.in).
test('golden path: claim, approve, message, mark returned, item leaves the board', async ({
  page
}) => {
  // The dashboard uses confirm() dialogs for destructive actions.
  page.on('dialog', dialog => dialog.accept())

  // 1. Register a fresh claimant (DEV_AUTO_VERIFY makes it instantly usable).
  await page.goto('/')
  await page.getByRole('button', {name: 'Student sign in'}).click()
  await page.getByRole('button', {name: 'Create account'}).click()
  await page.getByLabel('Your name').fill('E2E Claimant')
  await page.getByLabel('Registration number (private)').fill('24BIT4321')
  await page.getByLabel('VIT email address').fill('e2e-claimant@vitstudent.ac.in')
  await page.getByLabel('Password · at least 10 characters').fill('E2eStrongPass1!')
  await page.locator('.modal form').getByRole('button', {name: 'Create student account'}).click()
  await page.getByRole('button', {name: 'Back to sign in'}).click()

  // 2. Sign in as the claimant and claim the calculator.
  await page.getByLabel('VIT email address').fill('e2e-claimant@vitstudent.ac.in')
  await page.getByLabel('Password', {exact: true}).fill('E2eStrongPass1!')
  await page.locator('.modal form').getByRole('button', {name: 'Sign in', exact: true}).click()
  await expect(page.locator('.avatar')).toBeVisible()

  await page.getByRole('button', {name: /Casio scientific calculator/}).click()
  const itemDialog = page.getByRole('dialog', {name: /Casio scientific calculator/})
  await expect(itemDialog).toBeVisible()
  await page
    .getByLabel('Your private verification answer')
    .fill('Casio fx-991EX with a blue star sticker on the back cover.')
  await page.getByRole('button', {name: 'Send verification request'}).click()
  await expect(itemDialog).toBeHidden()

  // 3. Switch to the finder and approve the request.
  await page.getByRole('button', {name: 'Sign out'}).click()
  await page.getByRole('button', {name: 'Student sign in'}).click()
  await page.getByLabel('VIT email address').fill('finder@vitstudent.ac.in')
  await page.getByLabel('Password', {exact: true}).fill('CampusDemo2026!')
  await page.locator('.modal form').getByRole('button', {name: 'Sign in', exact: true}).click()
  await expect(page.locator('.avatar')).toBeVisible()

  await page.getByRole('button', {name: /My activity/}).click()
  const requestCard = page.locator('.request-card', {
    hasText: 'Casio scientific calculator'
  })
  await expect(requestCard).toBeVisible()
  await requestCard.getByRole('button', {name: 'Approve'}).click()
  await requestCard.getByRole('button', {name: 'Private handoff'}).click()

  // 4. Send a message in the anonymous thread.
  const threadDialog = page.getByRole('dialog', {name: 'Your private handoff'})
  await expect(threadDialog).toBeVisible()
  await page
    .getByLabel('Private message')
    .fill('Meet me at the SJT security desk tomorrow afternoon?')
  await page.getByRole('button', {name: 'Send message'}).click()
  await expect(
    threadDialog.getByText('Meet me at the SJT security desk tomorrow afternoon?')
  ).toBeVisible()
  await page.getByRole('button', {name: 'Close dialog'}).click()

  // 5. Mark returned; the listing disappears from the active board.
  await requestCard.getByRole('button', {name: 'Mark returned'}).click()
  await expect(requestCard.getByText('Resolved')).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('button', {name: /Casio scientific calculator/})).toHaveCount(0)
})
