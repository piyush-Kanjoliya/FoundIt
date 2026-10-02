import {test, expect} from '@playwright/test'

test('board loads with seeded items and shows the empty state after filtering to nothing', async ({
  page
}) => {
  await page.goto('/')

  await expect(page.getByRole('link', {name: 'Reunite home'})).toBeVisible()
  await expect(page.getByRole('button', {name: /A pair of wireless earbuds/})).toBeVisible()
  await expect(page.getByRole('button', {name: /Lab safety goggles/})).toBeVisible()

  // Filter down to nothing and expect the empty state, not an error.
  await page.getByLabel('Search items').fill('zzz-no-such-item')
  await expect(page.getByText('No items here just yet.')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})
