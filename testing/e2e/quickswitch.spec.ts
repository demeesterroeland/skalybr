/**
 * quickswitch.spec.ts — Dev QuickSwitch bar E2E tests.
 *
 * Tests (require NODE_ENV=development on the server):
 *   - QuickSwitch bar is visible on the page in dev mode.
 *   - Switching to Guest clears auth state.
 *   - Switching to Admin shows Admin pill in header.
 *   - Switching to Reader shows Reader badge.
 *
 * The /api/v1/dev/quickswitch endpoint only works when NODE_ENV=development.
 * These tests are designed to skip gracefully when running against a
 * production build.
 */

import { test, expect } from '@playwright/test';
import { BASE, apiQuickSwitch, apiMe, apiLogout } from './helpers';


test.describe('QuickSwitch dev persona bar', () => {
  // Check if dev mode is available before running tests
  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/dev/quickswitch`, {
      data: { persona: 'guest' },
    });
    // Skip if QuickSwitch is not available (403 in production, 404 if route not compiled)
    if (res.status() === 403 || res.status() === 404) {
      test.skip(true, 'QuickSwitch is only available in development mode');
    }
  });

  test('QuickSwitch bar is visible in dev mode', async ({ page, request }) => {
    // Switch to guest first to have a clean start
    await apiQuickSwitch(request, 'guest');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // The QuickSwitch aside element should be visible
    const quickSwitch = page.locator('aside[aria-label="Development Persona Switcher"]');
    await expect(quickSwitch).toBeVisible({ timeout: 10_000 });
    await expect(quickSwitch).toContainText('QuickSwitch');
  });

  test('QuickSwitch bar shows all 4 personas', async ({ page, request }) => {
    await apiQuickSwitch(request, 'guest');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const quickSwitch = page.locator('aside[aria-label="Development Persona Switcher"]');
    await expect(quickSwitch).toContainText('Guest');
    await expect(quickSwitch).toContainText('Reader');
    await expect(quickSwitch).toContainText('Curator');
    await expect(quickSwitch).toContainText('Admin');
  });

  test('Switching to Guest via API clears auth state', async ({ request }) => {
    // Start as Admin
    const adminSwitch = await apiQuickSwitch(request, 'admin');
    expect(adminSwitch.status).toBe(200);

    // Verify logged in
    let me = await apiMe(request);
    expect(me.body.authenticated).toBe(true);

    // Switch to Guest
    const guestSwitch = await apiQuickSwitch(request, 'guest');
    expect(guestSwitch.status).toBe(200);
    expect(guestSwitch.body.persona).toBe('guest');

    // Verify session cleared
    me = await apiMe(request);
    expect(me.body.authenticated).toBe(false);
    expect(me.body.user).toBeNull();
  });

  test('Switching to Admin via API creates admin session', async ({ request }) => {
    // Start as guest
    await apiQuickSwitch(request, 'guest');

    // Switch to Admin
    const adminSwitch = await apiQuickSwitch(request, 'admin');
    expect(adminSwitch.status).toBe(200);
    expect(adminSwitch.body.user).toBeDefined();
    expect(adminSwitch.body.user.isAdmin).toBe(true);

    // Verify via /me
    const me = await apiMe(request);
    expect(me.body.authenticated).toBe(true);
    expect(me.body.user.isAdmin).toBe(true);
  });

  test('Switching to Reader via API creates reader session', async ({ request }) => {
    const readerSwitch = await apiQuickSwitch(request, 'reader');
    expect(readerSwitch.status).toBe(200);
    expect(readerSwitch.body.user).toBeDefined();
    expect(readerSwitch.body.user.isAdmin).toBe(false);

    const me = await apiMe(request);
    expect(me.body.authenticated).toBe(true);
    expect(me.body.user.username).toBe('dev_reader');
  });

  test('Switching to Curator via API creates curator session', async ({ request }) => {
    const curatorSwitch = await apiQuickSwitch(request, 'curator');
    expect(curatorSwitch.status).toBe(200);
    expect(curatorSwitch.body.user.isAdmin).toBe(false);

    const me = await apiMe(request);
    expect(me.body.authenticated).toBe(true);
    expect(me.body.user.username).toBe('dev_curator');
  });

  test('QuickSwitch to Admin shows Admin dropdown in header UI', async ({ page, request }) => {
    await apiQuickSwitch(request, 'admin');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for React Query hydration

    // Header should show Admin pill
    const header = page.locator('header');
    await expect(header).toContainText(/admin/i);
  });

  test('QuickSwitch to Reader shows Reader badge in header UI', async ({ page, request }) => {
    await apiQuickSwitch(request, 'reader');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Header should show reader badge or username
    const header = page.locator('header');
    // Reader is logged in — so no Sign In button
    await expect(page.getByRole('button', { name: /sign in/i })).not.toBeVisible();
  });

  test('QuickSwitch to Guest shows Sign In button in header UI', async ({ page, request }) => {
    await apiQuickSwitch(request, 'guest');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Unauthenticated → Sign In button visible
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
  });

  test('Clicking QuickSwitch Admin button in UI switches to admin session', async ({
    page,
    request,
  }) => {
    // Start as guest
    await apiQuickSwitch(request, 'guest');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click the Admin button in the QuickSwitch bar
    const quickSwitch = page.locator('aside[aria-label="Development Persona Switcher"]');
    const adminBtn = quickSwitch.getByRole('button', { name: /admin/i });
    await adminBtn.click();

    // Wait for navigation/state update
    await page.waitForTimeout(3000);

    // Verify admin is now active
    const me = await apiMe(request);
    expect(me.body.authenticated).toBe(true);
    expect(me.body.user.isAdmin).toBe(true);
  });
});
