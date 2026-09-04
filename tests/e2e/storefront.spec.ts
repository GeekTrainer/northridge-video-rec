import { test, expect } from '@playwright/test';

// Full storefront journeys across the React verticals and the gateway.
// (Video has its own thin spec — see video.spec.ts.)

test('home shell links to every department', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.nrv-brand')).toContainText('Northridge Video');
  await expect(
    page.locator('.navbar-nav .nav-link', { hasText: 'Music' }),
  ).toBeVisible();
  await expect(
    page.locator('.navbar-nav .nav-link', { hasText: 'Books' }),
  ).toBeVisible();
});

test('Music (React) renders its catalog', async ({ page }) => {
  await page.goto('/music/');
  await expect(page.locator('h1')).toHaveText('Music');
  await expect(page.locator('.nrv-product').first()).toBeVisible();
  expect(await page.locator('.nrv-product').count()).toBeGreaterThan(0);
});

test('Books (React) renders its catalog with flattened authors', async ({
  page,
}) => {
  await page.goto('/books/');
  await expect(page.locator('h1')).toHaveText('Books');
  await expect(page.locator('.nrv-product').first()).toBeVisible();
});

test('cross-vertical search returns results spanning departments', async ({
  page,
}) => {
  await page.goto('/');
  await page.fill('.nrv-search input', 'the');
  await page.click('.nrv-search button[type="submit"]');
  await expect(page).toHaveURL(/\/search\?q=the/);
  await expect(page.locator('.nrv-results a').first()).toBeVisible();
});

test('gateway search filters by department and preserves it in the pager', async ({
  page,
}) => {
  await page.goto('/search?q=e&department=books');
  await expect(page.locator('select[name="department"]')).toHaveValue('books');
  await expect(page.locator('.nrv-results a')).toHaveCount(12);
  await expect(page.locator('.nrv-results a[href^="/books/"]')).toHaveCount(12);
  await page.locator('.pagination .page-link', { hasText: '2' }).first().click();
  await expect(page).toHaveURL(/\/search\?q=e&department=books&page=2/);
  await expect(page.locator('select[name="department"]')).toHaveValue('books');
  await expect(page.locator('.nrv-results a[href^="/books/"]')).toHaveCount(12);
});

test('cart persists across verticals and fake checkout confirms', async ({
  page,
}) => {
  // Add from Music (React).
  await page.goto('/music/');
  await page.locator('.nrv-add').first().click();
  await expect(page.locator('#nrv-cart-count')).toHaveText('1');

  // Add from Books (React) — cart persists across the two apps.
  await page.goto('/books/');
  await page.locator('.nrv-add').first().click();
  await expect(page.locator('#nrv-cart-count')).toHaveText('2');

  // Check out — fake "Buy Now" shows a confirmation and clears the cart.
  await page.goto('/cart');
  await expect(page.locator('#cart-view .list-group-item')).toHaveCount(2);
  await page.click('#buy');
  await expect(page.locator('.nrv-confirmation strong')).toContainText('NRV-');

  await page.goto('/cart');
  await expect(page.locator('#cart-view')).toContainText('empty');
  await expect(page.locator('#nrv-cart-count')).toHaveText('0');
});

test('Music (React) paginates: 12 per page and page 2 changes results', async ({
  page,
}) => {
  await page.goto('/music/');
  await expect(page.locator('.nrv-product')).toHaveCount(12);
  const firstOnP1 = await page
    .locator('.nrv-product .card-title')
    .first()
    .innerText();
  await page.locator('.pagination .page-link', { hasText: '2' }).click();
  await expect(page.locator('.pagination .active')).toContainText('2');
  const firstOnP2 = await page
    .locator('.nrv-product .card-title')
    .first()
    .innerText();
  expect(firstOnP2).not.toEqual(firstOnP1);
});

test('gateway search paginates', async ({ page }) => {
  await page.goto('/search?q=e');
  await expect(page.locator('.pagination')).toBeVisible();
  await page.locator('.pagination .page-link', { hasText: '2' }).first().click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('.nrv-results a').first()).toBeVisible();
});

test('clicking a Music item opens its detail page', async ({ page }) => {
  await page.goto('/music/');
  const title = await page
    .locator('.nrv-product .card-title a')
    .first()
    .innerText();
  await page.locator('.nrv-product .card-title a').first().click();
  await expect(page).toHaveURL(/\/music\/MUS-/);
  await expect(page.locator('main .card h1')).toHaveText(title);
  await expect(page.locator('main')).toContainText('SKU');
});

test('a search result links to the owning vertical detail page', async ({
  page,
}) => {
  await page.goto('/search?q=amber');
  await page.locator('.nrv-results a').first().click();
  await expect(page).toHaveURL(/\/(video|music|books)\/(VID|MUS|BK)-/);
});
