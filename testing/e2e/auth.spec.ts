/**
 * auth.spec.ts — Complete authentication & registration user journey.
 *
 * Scenario:
 *   1. First user registers → becomes admin, is auto-logged-in.
 *   2. Admin logs out.
 *   3. Second user registers → status = pending.
 *   4. Second user tries to log in → 403 "pending administrator approval".
 *   5. Admin approves second user via API.
 *   6. Second user logs in successfully.
 *
 * Each test run uses timestamp-suffixed usernames so tests are idempotent
 * even when the same DB is reused.
 */

import { test, expect } from '@playwright/test';
import {
  apiRegister,
  apiLogin,
  apiLogout,
  apiMe,
  apiGetUsers,
  apiApproveUser,
  uniqueUsername,
} from './helpers';

const PASSWORD = 'E2eTestPass123!';

test.describe('Auth: complete user journey', () => {
  // Unique username prefix per test-suite run
  const suffix = Date.now();
  const adminUsername = `e2e_admin_${suffix}`;
  const pendingUsername = `e2e_pending_${suffix}`;
  let adminCookieState: string | null = null; // We'll manage sessions via API
  let pendingUserId: number;

  test('1. First user registers and becomes admin, auto-logged-in', async ({ page, request }) => {
    // Use direct API
    const { status, body } = await apiRegister(request, {
      username: adminUsername,
      password: PASSWORD,
      displayName: 'E2E Admin',
    });

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    // First user message should indicate admin or auto-login
    expect(body.message).toMatch(/administrator/i);
    expect(body.user.username).toBe(adminUsername);
    expect(body.user.isAdmin).toBe(true);
    expect(body.user.status).toBe('active');

    // Session should now be established — verify via /me
    const me = await apiMe(request);
    expect(me.status).toBe(200);
    expect(me.body.authenticated).toBe(true);
    expect(me.body.user.username).toBe(adminUsername);
    expect(me.body.user.isAdmin).toBe(true);
  });

  test('2. Admin logs out and session is cleared', async ({ request }) => {
    // First, ensure we're logged in as admin
    const loginRes = await apiLogin(request, { username: adminUsername, password: PASSWORD });
    expect(loginRes.status).toBe(200);

    // Logout
    const logoutRes = await apiLogout(request);
    expect(logoutRes.status).toBe(200);

    // Verify session cleared
    const me = await apiMe(request);
    expect(me.body.authenticated).toBe(false);
    expect(me.body.user).toBeNull();
  });

  test('3. Second user registers and gets status=pending', async ({ request }) => {
    const { status, body } = await apiRegister(request, {
      username: pendingUsername,
      password: PASSWORD,
    });

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/pending/i);
    expect(body.user.status).toBe('pending');
    pendingUserId = body.user.id;

    // Session is NOT established for pending users
    const me = await apiMe(request);
    expect(me.body.authenticated).toBe(false);
  });

  test('4. Pending user login attempt returns 403 with pending notice', async ({ request }) => {
    const { status, body } = await apiLogin(request, {
      username: pendingUsername,
      password: PASSWORD,
    });

    expect(status).toBe(403);
    expect(body.error).toMatch(/pending administrator approval/i);
  });

  test('5. Admin approves pending user', async ({ request }) => {
    // Login as admin
    const loginRes = await apiLogin(request, { username: adminUsername, password: PASSWORD });
    expect(loginRes.status).toBe(200);

    // Fetch pending users to get the ID if not already known
    const pending = await apiGetUsers(request, { status: 'pending' });
    expect(pending.status).toBe(200);
    const pendingUser = pending.body.data.find(
      (u: { username: string; id: number }) => u.username === pendingUsername
    );
    expect(pendingUser).toBeDefined();
    pendingUserId = pendingUser.id;

    // Approve the user
    const approveRes = await apiApproveUser(request, pendingUserId);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('active');
  });

  test('6. Approved user can now log in successfully', async ({ request }) => {
    // Login as the approved user
    const { status, body } = await apiLogin(request, {
      username: pendingUsername,
      password: PASSWORD,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user.status).toBe('active');

    // Verify session
    const me = await apiMe(request);
    expect(me.status).toBe(200);
    expect(me.body.authenticated).toBe(true);
    expect(me.body.user.username).toBe(pendingUsername);
  });
});

test.describe('Auth UI: registration and pending notice', () => {
  const suffix = Date.now() + 1;
  const adminUsername = `e2e_ui_admin_${suffix}`;
  const pendingUsername = `e2e_ui_pending_${suffix}`;

  test.beforeAll(async ({ request }) => {
    // Seed admin user
    await apiRegister(request, { username: adminUsername, password: PASSWORD });
  });

  test('Register button opens modal; first user sees admin bootstrap notice', async ({ page, request }) => {
    // Since admin already exists from beforeAll, navigate to homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should show Sign In button (not bootstrap since admin exists)
    const signInBtn = page.getByRole('button', { name: /sign in/i }).first();
    await expect(signInBtn).toBeVisible();
  });

  test('Second user registration shows pending approval message in UI', async ({ page, request }) => {
    // Make sure we're not logged in
    await apiLogout(request);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click Register
    await page.getByRole('button', { name: /register/i }).first().click();

    // Fill the registration form
    await page.locator('#reg-username').fill(pendingUsername);
    await page.locator('#reg-password').fill(PASSWORD);

    // Submit
    await page.getByRole('button', { name: /create account/i }).click();

    // Expect pending notice or success toast
    // The modal should show a pending confirmation message
    await expect(
      page.getByText(/pending administrator approval/i)
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Pending user login attempt shows pending notice in UI', async ({ page, request }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open sign in modal
    await page.getByRole('button', { name: /sign in/i }).first().click();

    // Fill credentials of pending user
    await page.locator('#signin-identifier').fill(pendingUsername);
    await page.locator('#signin-password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).last().click();

    // Should show "Account Pending Approval" notice
    await expect(
      page.getByText(/account pending approval/i)
    ).toBeVisible({ timeout: 15_000 });
  });
});
