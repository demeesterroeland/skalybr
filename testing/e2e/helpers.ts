/**
 * Shared helpers for Skalybr E2E tests.
 *
 * All API helpers use `page.request` so they share the browser cookie
 * jar and therefore the authenticated session.
 */

import { type APIRequestContext, type Page } from '@playwright/test';

export const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

// ---------------------------------------------------------------------------
// State wipe
// ---------------------------------------------------------------------------

/**
 * Wipes the in-process SQLite database by hitting a dedicated test-helper
 * endpoint that only exists in NODE_ENV=test.  Falls back to nothing if the
 * endpoint is absent (i.e. in a regular dev server).
 *
 * For these E2E tests, instead of a hard DB wipe we use unique usernames
 * per test run (timestamped) so tests never collide.
 */
export function uniqueUsername(prefix: string): string {
  return `${prefix}_${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Auth helpers (call via page.request to stay in same cookie jar)
// ---------------------------------------------------------------------------

export async function apiRegister(
  request: APIRequestContext,
  opts: { username: string; password: string; email?: string; displayName?: string }
) {
  const res = await request.post(`${BASE}/api/v1/auth/register`, {
    data: opts,
  });
  return { status: res.status(), body: await res.json() };
}

export async function apiLogin(
  request: APIRequestContext,
  opts: { username: string; password: string }
) {
  const res = await request.post(`${BASE}/api/v1/auth/login`, {
    data: opts,
  });
  return { status: res.status(), body: await res.json() };
}

export async function apiLogout(request: APIRequestContext) {
  const res = await request.post(`${BASE}/api/v1/auth/logout`);
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

export async function apiMe(request: APIRequestContext) {
  const res = await request.get(`${BASE}/api/v1/auth/me`);
  return { status: res.status(), body: await res.json() };
}

export async function apiGetUsers(
  request: APIRequestContext,
  opts?: { status?: string }
) {
  const qs = opts?.status ? `?status=${opts.status}` : '';
  const res = await request.get(`${BASE}/api/v1/admin/users${qs}`);
  return { status: res.status(), body: await res.json() };
}

export async function apiApproveUser(
  request: APIRequestContext,
  userId: number
) {
  const res = await request.patch(`${BASE}/api/v1/admin/users/${userId}`, {
    data: { status: 'active' },
  });
  return { status: res.status(), body: await res.json() };
}

export async function apiQuickSwitch(
  request: APIRequestContext,
  persona: 'guest' | 'admin' | 'curator' | 'reader'
) {
  const res = await request.post(`${BASE}/api/v1/dev/quickswitch`, {
    data: { persona },
  });
  return { status: res.status(), body: await res.json() };
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to the home page and wait for it to be fully hydrated.
 */
export async function gotoHome(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}
