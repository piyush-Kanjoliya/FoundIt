import {test, expect} from '@playwright/test'

test('map never ends blank when Mapbox hosts are blocked', async ({page}) => {
  // Simulate an unreachable/blocked Mapbox: token verification, styles, tiles
  // and telemetry all fail. The app must still show map or fallback content.
  await page.route(/mapbox\.com/, route => route.abort())

  await page.goto('/')
  await page.getByRole('button', {name: 'Map', exact: true}).click()

  const shell = page.getByTestId('map-shell')
  await expect(shell).toBeVisible()

  // Within 10 s the area must render real content: a live engine canvas, the
  // offline schematic, or the explicit fallback message. A bare empty shell is
  // a failure.
  const content = shell.locator('canvas, svg, .map-tier-chip, .map-fallback, .reunite-map-pin')
  await expect(content.first()).toBeVisible({timeout: 10_000})
  await expect(shell).not.toBeEmpty()
  await expect(page.getByText('Map failed')).toHaveCount(0)
})
