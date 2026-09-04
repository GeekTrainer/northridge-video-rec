import { test, expect } from '@playwright/test';

// Video department end-to-end tests.

test('Video (jQuery) renders its catalog', async ({ page }) => {
  await page.goto('/video/');
  await expect(page.locator('h1')).toContainText('Video');
  await expect(page.locator('.list-item-legacy').first()).toBeVisible();
});

test('Video page shows Add-to-cart buttons', async ({ page }) => {
  await page.goto('/video/');
  await expect(page.locator('.list-item-legacy button.add').first()).toBeVisible();
});

test('Video uses a numbered pager and page 2 changes results', async ({
  page,
}) => {
  await page.goto('/video/');
  await expect(page.locator('.list-item-legacy')).toHaveCount(12);
  await expect(page.locator('.pagination-legacy')).toBeVisible();
  const firstOnP1 = await page.locator('.li-title').first().innerText();
  await page.locator('.pagination-legacy a', { hasText: '2' }).click();
  await expect(page.locator('.pagination-legacy .active')).toContainText('2');
  const firstOnP2 = await page.locator('.li-title').first().innerText();
  expect(firstOnP2).not.toEqual(firstOnP1);
});

test('clicking a Video item opens its detail page', async ({
  page,
}) => {
  await page.goto('/video/');
  const title = await page.locator('.li-title a').first().innerText();
  await page.locator('.li-title a').first().click();
  await expect(page).toHaveURL(/\/video\/VID-/);
  await expect(page.locator('.panel-heading-legacy')).toHaveText(title);
  await expect(page.locator('.detail-add')).toBeVisible();
});
