# v0.3.1 — Patch Release: Version Sync & E2E Stability

**Release Date:** 2026-09-21

## Summary

This patch release synchronizes project versioning across all manifests and stabilizes the automated Playwright E2E testing infrastructure.

### 🐛 Bug Fixes & Improvements
- **Version Manifest Sync**: Synchronized `package.json` and `package-lock.json` to version `0.3.1` (was lagging on `0.2.0`).
- **AuthModal Bootstrap Logic**: Fixed registration status evaluation to use `res.user?.isAdmin` directly rather than message substring matching (preventing pending approval notices from being misinterpreted as admin bootstrap).
- **Playwright Test Isolation**: Configured `playwright.config.ts` with a dedicated `webServer` block utilizing an isolated temporary `DATA_DIR` per run, preventing E2E tests from interfering with development database state.
- **Tab Form Selector Collision**: Explicitly targeted form field IDs (`#reg-username`, `#reg-password`, `#signin-identifier`, `#signin-password`) in E2E tests to eliminate collisions between active and inactive modal tabs.
- **Test Mode Admin Promotion**: Added support for `SKALYBR_TEST_MODE=1` to allow deterministic multi-suite E2E test runs without state pollution.
- **Git Ignore**: Added `test-results/` and `playwright-report/` to `.gitignore`.

### 🧪 Verification
- **Unit Tests**: 126/126 passing across 9 test suites (`vitest`).
- **E2E Tests**: 27/27 passing across 3 active test suites (`playwright`).
