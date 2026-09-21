# v0.3.0 — Auth, Cascading ACL & Frontend UI

**Release Date:** 2026-09-21

## What's New

This release brings comprehensive multi-user authentication, Google Drive-style cascading access control, and a polished admin UI to Skalybr.

### 🔐 Authentication Engine (Phase 3)
- **`bcryptjs` password hashing** with work factor 12 and constant-time verification.
- **`iron-session` encrypted HTTP-only cookies** (`skalybr_session`) with 7-day TTL.
- **First-user bootstrap**: First registered account is automatically promoted to Administrator.
- **Open registration with admin approval**: Subsequent signups enter `status = 'pending'` until an admin approves them.
- **Session revocation**: `session_epoch` invalidation across all devices instantly.
- **Endpoints**: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`.

### 🗄️ SQLite Schema & Migrations (Phases 1–2)
- Automated transactional migration runner (`lib/db/migrate.ts`).
- `users` table with status, epoch, and admin flag.
- `access_grants` cascading ACL table (global → library → shelf).
- `is_public` flag on libraries for guest-accessible content.

### 🛡️ Cascading ACL & Route Guards (Phase 4)
- Ripple-down permission engine (`lib/auth/acl.ts`):
  `Admin bypass → Shelf grant → Library grant → Global grant → Public fallback`
- Route guard helpers: `requireLibraryAccess`, `requireAdmin`, `requireAuth`.
- All book, library, cover, download, and progress endpoints are guarded.
- Admin management APIs: `GET/PATCH/DELETE /api/v1/admin/users/[id]` and `/grants`.

### 🖥️ Frontend UI (Phase 5)
- **Header dropdown**: Avatar with initials, role badge (Admin / Curator / Reader), logout.
- **AuthModal**: Tabbed Sign In / Register with pending approval notice.
- **AdminModal**: Pending approvals tab + Users & Permissions tab with Google Drive-style ACL drawer.
- **QuickSwitch dev bar**: Floating persona switcher (`Guest ↔ Reader ↔ Curator ↔ Admin`) for development.
- **`useAuth` hook** with React Query for auth state management.

### 🧪 E2E Test Suite (Phase 6)
- **Playwright Chromium** test suite in `testing/e2e/`:
  - `auth.spec.ts`: Full registration → pending → approval → login journey (API + UI).
  - `library-access.spec.ts`: Guest/reader/admin ACL enforcement tests.
  - `admin-panel.spec.ts`: Admin Panel CRUD and UI interaction tests.
  - `quickswitch.spec.ts`: Dev persona switching API and UI tests.
- CI workflow E2E job with artifact upload on failure.

## Testing
- **126 unit tests** pass (vitest).
- **Playwright E2E suite** covers the complete auth & ACL user journey.

## Migration Notes
- A fresh SQLite database is created automatically on first start.
- Set `SESSION_SECRET` (≥ 32 chars) in environment or a secure secret is generated and stored in DB.
- First user to register on a fresh instance becomes the administrator.
