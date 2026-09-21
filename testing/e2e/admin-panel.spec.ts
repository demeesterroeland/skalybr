/**
 * admin-panel.spec.ts — Admin Panel (AdminModal) E2E tests.
 *
 * Tests:
 *   - Admin can open the Admin Panel modal.
 *   - Pending Approvals tab shows pending user.
 *   - Approving user decrements pending count.
 *   - Users & Permissions tab lists users.
 *   - Setting global role for a user works via API.
 */

import { test, expect } from '@playwright/test';
import { BASE, apiRegister, apiLogin, apiLogout, apiGetUsers, apiApproveUser } from './helpers';

const PASSWORD = 'E2eTestPass123!';

test.describe('Admin Panel (API)', () => {
  const suffix = Date.now();
  const adminUsername = `e2e_ap_admin_${suffix}`;
  const pendingUsername = `e2e_ap_pending_${suffix}`;
  let pendingUserId: number;

  test.beforeAll(async ({ request }) => {
    // Set up admin (first user)
    await apiRegister(request, { username: adminUsername, password: PASSWORD });
    // Log out admin session (browserContext is shared but we'll manage in each test)
    await apiLogout(request);
    // Register a pending user (second user)
    const reg = await apiRegister(request, { username: pendingUsername, password: PASSWORD });
    pendingUserId = reg.body.user?.id;
  });

  test('Admin can fetch pending users list', async ({ request }) => {
    await apiLogin(request, { username: adminUsername, password: PASSWORD });

    const { status, body } = await apiGetUsers(request, { status: 'pending' });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    const found = body.data.find(
      (u: { username: string }) => u.username === pendingUsername
    );
    expect(found).toBeDefined();
    expect(found.status).toBe('pending');
  });

  test('Admin can approve a pending user', async ({ request }) => {
    await apiLogin(request, { username: adminUsername, password: PASSWORD });

    // Get pending user id
    const { body: beforeBody } = await apiGetUsers(request, { status: 'pending' });
    const pendingUser = beforeBody.data.find(
      (u: { username: string; id: number }) => u.username === pendingUsername
    );
    pendingUserId = pendingUser?.id ?? pendingUserId;

    const { status, body } = await apiApproveUser(request, pendingUserId);
    expect(status).toBe(200);
    expect(body.data.status).toBe('active');
  });

  test('After approval, pending count decrements', async ({ request }) => {
    await apiLogin(request, { username: adminUsername, password: PASSWORD });

    const { body } = await apiGetUsers(request, { status: 'pending' });
    const found = body.data.find(
      (u: { username: string }) => u.username === pendingUsername
    );
    // Should no longer be in pending list
    expect(found).toBeUndefined();
  });

  test('Admin can list all users', async ({ request }) => {
    await apiLogin(request, { username: adminUsername, password: PASSWORD });

    const { status, body } = await apiGetUsers(request);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });

  test('Admin can set global role for a user via grants API', async ({ request }) => {
    await apiLogin(request, { username: adminUsername, password: PASSWORD });

    // Get all users to find the pending (now active) user id
    const { body: usersBody } = await apiGetUsers(request);
    const targetUser = usersBody.data.find(
      (u: { username: string; id: number }) => u.username === pendingUsername
    );
    expect(targetUser).toBeDefined();
    const targetId = targetUser.id;

    // Set a curator grant
    const grantRes = await request.post(
      `${BASE}/api/v1/admin/users/${targetId}/grants`,
      {
        data: {
          resourceType: 'global',
          resourceId: '*',
          role: 'curator',
        },
      }
    );
    expect([200, 201]).toContain(grantRes.status());
    const grantBody = await grantRes.json();
    expect(grantBody.success).toBe(true);
  });

  test('Non-admin cannot access admin endpoints', async ({ request }) => {
    // Login as the (now active) non-admin user
    await apiLogin(request, { username: pendingUsername, password: PASSWORD });

    const res = await request.get(`${BASE}/api/v1/admin/users`);
    expect(res.status()).toBe(403);
  });
});

test.describe('Admin Panel UI', () => {
  const suffix = Date.now() + 3;
  const adminUsername = `e2e_apui_admin_${suffix}`;
  const pendingUsername = `e2e_apui_pending_${suffix}`;

  test.beforeAll(async ({ request }) => {
    await apiRegister(request, { username: adminUsername, password: PASSWORD });
    await apiLogout(request);
    await apiRegister(request, { username: pendingUsername, password: PASSWORD });
  });

  test('Admin sees pending approval badge in header after pending user registers', async ({
    page,
  }) => {
    // Use page.context().request so session cookies are shared with the page
    await apiLogin(page.context().request, { username: adminUsername, password: PASSWORD });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Allow time for React Query to fetch pending users
    await page.waitForTimeout(3000);

    // The header should have the admin dropdown button visible
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // An amber dot (notification indicator) should appear for pending approvals
    // It's rendered as a span with bg-amber-400 class when there are pending users
    const notificationDot = header.locator('span.bg-amber-400').first();
    await expect(notificationDot).toBeVisible({ timeout: 10_000 });
  });

  test('Admin can open Admin Panel modal via header dropdown', async ({ page }) => {
    // Use page.context().request so session cookies are shared with the page
    await apiLogin(page.context().request, { username: adminUsername, password: PASSWORD });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click the user dropdown in the header
    // The dropdown trigger wraps the avatar initials
    const avatarBtn = page.locator('header button').filter({
      has: page.locator('div.rounded-lg.bg-gradient-to-tr'),
    }).first();
    await avatarBtn.click();

    // Click "Admin Panel" or "User Management" menu item
    const adminPanelItem = page.getByRole('menuitem', { name: /admin panel|user management/i }).first();
    await expect(adminPanelItem).toBeVisible({ timeout: 5_000 });
    await adminPanelItem.click();

    // Admin Panel dialog should open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toContainText(/pending|approval/i);
  });

  test('Admin Panel pending approvals tab shows pending user', async ({ page }) => {
    // Use page.context().request so session cookies are shared with the page
    await apiLogin(page.context().request, { username: adminUsername, password: PASSWORD });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Open Admin Panel via dropdown
    const avatarBtn = page.locator('header button').filter({
      has: page.locator('div.rounded-lg.bg-gradient-to-tr'),
    }).first();
    await avatarBtn.click();
    await page.getByRole('menuitem', { name: /admin panel|user management/i }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Pending approvals tab should be default or navigate to it
    const pendingTab = dialog.getByRole('tab', { name: /pending/i });
    if (await pendingTab.isVisible()) {
      await pendingTab.click();
    }

    // The pending user should be listed
    await expect(dialog).toContainText(pendingUsername, { timeout: 10_000 });
  });
});
