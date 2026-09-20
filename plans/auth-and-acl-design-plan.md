# Skalybr Auth & Cascading ACL Architecture Plan

## 1. Executive Summary & Goals

This plan specifies the complete Authentication & Authorization architecture for Skalybr.
It unifies lessons learned from **Calibre-Web**, **CarSharing**, and **Sacred-Fire-Songs** into a cohesive, self-contained system tailored to Skalybr's multi-library e-book model.

### Core Principles
1. **Cascading Access Control (Google Drive Style)**: Permissions ripple down from **All Libraries (`*`)** → **Specific Library (`library:<name>`)** → **Virtual Shelf (`shelf:<id>`)**. Child-level grants can elevate access or explicitly deny access.
2. **Unified Read & Download**: If a user is permitted to read/consume a book, they can also download its raw e-book file (`.epub`, `.pdf`, `.mobi`).
3. **Public Guest Access**: Unauthenticated visitors can browse and read any library or shelf marked `is_public = 1`. Private resources require authentication.
4. **Open Registration with Admin Approval**: Any visitor can register. New accounts enter `status = 'pending'` and cannot log in until an administrator approves them.
5. **Self-Contained SQLite Migrations**: Migration files live strictly under `./data/migrations/` and run sequentially on startup via an automated, transactional runner.
6. **CI/CD Schema Validation**: Following Sacred-Fire-Songs, migration integrity and roll-forward safety are verified in GitHub Actions during CI test runs.

---

## 2. Cascading ACL Model ("Ripple Down")

```
┌────────────────────────────────────────────────────────┐
│ Level 1: Global / System Scope ('*')                   │
│   e.g. Alice has 'curator' -> curates all libraries    │
│   e.g. Bob has 'reader'   -> reads all libraries       │
└──────────────────────────┬─────────────────────────────┘
                           │ (ripples down / inherits)
                           ▼
┌────────────────────────────────────────────────────────┐
│ Level 2: Specific Library Scope ('library:<name>')      │
│   e.g. Charlie has 'curator' on 'Tech Vault'           │
│   e.g. Bob has 'none' on 'Secret Archive' (blocked)    │
└──────────────────────────┬─────────────────────────────┘
                           │ (ripples down / inherits)
                           ▼
┌────────────────────────────────────────────────────────┐
│ Level 3: Shelf / Collection Scope ('shelf:<uuid>')     │
│   e.g. Dave has 'curator' on collaborative shelf       │
│   e.g. Shelf has is_public = 1 -> visible to readers   │
└────────────────────────────────────────────────────────┘
```

### Roles & Numerical Weight
- **`admin` (Weight: 3)**: Full instance authority (create/delete libraries, approve/manage users, edit system settings).
- **`curator` (Weight: 2)**: Power user / editor (upload books/ZIPs, edit book metadata and covers, create and organize public shelves).
- **`reader` (Weight: 1)**: Consumer (browse, search, read in-browser, download files, personal reading progress & private shelves).
- **`none` (Weight: 0)**: Explicit denial (overrides parent-level broad access for specific resources).

### Resolution Algorithm (`getEffectiveRole`)
```ts
function getEffectiveRole(user: User | null, resourceType: 'library' | 'shelf', resourceId: string): Role {
  // 1. Super Admin always has full power everywhere
  if (user?.isAdmin) return 'admin';

  // 2. Exact Shelf Grant (if checking a shelf)
  if (resourceType === 'shelf' && user) {
    const shelfGrant = findGrant(user.id, 'shelf', resourceId);
    if (shelfGrant) return shelfGrant.role;
  }

  // 3. Exact Library Grant
  const libraryName = resourceType === 'shelf' ? getShelfLibrary(resourceId) : resourceId;
  if (user) {
    const libGrant = findGrant(user.id, 'library', libraryName);
    if (libGrant) return libGrant.role;
  }

  // 4. Global Grant ('*')
  if (user) {
    const globalGrant = findGrant(user.id, 'global', '*');
    if (globalGrant) return globalGrant.role;
  }

  // 5. Public / Guest Fallback
  const isPublic = checkResourceIsPublic(resourceType, resourceId);
  if (isPublic) return 'reader';

  return 'none';
}
```

---

## 3. Database Schema & `./data/migrations/` Strategy

All schema changes will be stored as versioned `.sql` files in `./data/migrations/` with a 4-digit sequential prefix:

```
data/migrations/
├── 0001_initial_schema.sql
├── 0002_add_is_public_to_libraries.sql
├── 0003_create_users_and_sessions.sql
└── 0004_create_cascading_acl.sql
```

### Migration Table: `_migrations`
```sql
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### New Tables to be Created

#### `users` Table
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'active' | 'suspended'
  is_admin INTEGER NOT NULL DEFAULT 0,
  session_epoch INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
```

#### `access_grants` (Cascading ACL)
```sql
CREATE TABLE IF NOT EXISTS access_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK(resource_type IN ('global', 'library', 'shelf')),
  resource_id TEXT NOT NULL, -- '*' for global, library name for library, shelf UUID for shelf
  role TEXT NOT NULL CHECK(role IN ('admin', 'curator', 'reader', 'none')),
  granted_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_acl_lookup 
ON access_grants(user_id, resource_type, resource_id);
```

#### Alterations to Existing Tables
```sql
-- Allow public unauthenticated reading per library
ALTER TABLE libraries ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
```

---

## 4. CI/CD Workflow & Migration Testing (Sacred-Fire-Songs Blueprint)

In `sacred-fire-songs`, migrations are verified during CI runs. In Skalybr:

1. **Automated Migration Test in CI (`testing/unit/migrations.test.ts`)**:
   - Creates an in-memory SQLite database.
   - Executes all `.sql` scripts in `./data/migrations/` sequentially in alphabetical order.
   - Asserts that all tables, indexes, and constraints exist.
   - Tests roll-forward data preservation (e.g. inserting records before later migrations run).
   - Validates that every file in `./data/migrations/` begins with an incrementing 4-digit number.
2. **Workflow Update (`.github/workflows/ci.yml`)**:
   - `npm test` automatically executes `migrations.test.ts`.
   - Add step: `Validate Migration Filenames and SQL Syntax`.
3. **Docker Packaging (`Dockerfile`)**:
   - Stage 3 Runner must copy migrations:
     `COPY --from=builder --chown=nextjs:nodejs /app/data/migrations ./data/migrations`
   - On container startup, `lib/db/migrate.ts` automatically executes pending migrations inside atomic SQLite transactions before the server begins serving traffic.

---

## 5. Authentication & Session Architecture

Following the **CarSharing** security implementation:
- **Engine**: `iron-session` storing an AES-256-GCM encrypted HTTP-only cookie (`skalybr_session`).
- **Cookie Payload**:
  ```ts
  interface SessionData {
    authenticated: boolean;
    userId: number;
    username: string;
    displayName: string;
    isAdmin: boolean;
    epoch: number;
  }
  ```
- **Password Security**:
  - `bcryptjs` with salt work factor 12.
  - Constant-time verification using Node.js `crypto.timingSafeEqual` to eliminate response timing leakage.
- **Session Revocation**:
  - Validated against `users.session_epoch`. When an admin revokes a session or changes a role, `session_epoch` is incremented in `skalybr.db`, immediately invalidating all active cookies across all devices.
- **Initial Setup / Bootstrap**:
  - If `users` table has 0 accounts on first launch, the first registered user automatically becomes `is_admin = 1` and `status = 'active'`. Subsequent signups enter `status = 'pending'`.

---

## 6. Frontend UX & Dev Personas

### A. Navigation & Top Header
- **Unauthenticated**: "Sign In" and "Register" buttons in the top right.
- **Authenticated**: User avatar and name dropdown:
  - Displays assigned libraries and active role.
  - "Log Out" option.
  - (If Admin): "User Management" & "Instance Settings" options.

### B. Sign In & Registration Modals
- Clean tabbed modal (`Sign In` / `Register`).
- Post-registration alert: *"Your account has been created and is pending administrator approval."*

### C. Admin User & ACL Management Modal
- **Tab 1: Pending Approvals**:
  - Badge showing pending count.
  - One-click `Approve` (with default library grants) or `Reject`.
- **Tab 2: Users & Permissions**:
  - User list with role chips (`Admin`, `Active`, `Suspended`).
  - Google Drive-style permission drawer:
    - Set Global Role (`None`, `Reader`, `Curator`).
    - Add Library Overrides: Select library (`Fiction`, `Tech Vault`) → Select role (`Reader`, `Curator`, `None`).
    - Reset password / Revoke all sessions button.

### D. Development Personas (`QuickSwitch`)
Following `sacred-fire-songs`:
- In `NODE_ENV === 'development'`, a bottom-corner floating pill allows instant one-click persona switching:
  - `Guest (Unauthenticated)`
  - `Reader (Alice)`
  - `Curator (Bob)`
  - `Admin (Roeland)`
- Enables rapid testing of cascading ACL inheritance without logging in and out.

---

## 7. Implementation Phases & Roadmap

| Phase | Milestone | Deliverables |
| :--- | :--- | :--- |
| **Phase 1** | Migration Infrastructure | Create `lib/db/migrate.ts`, `./data/migrations/0001_initial_schema.sql`, and `testing/unit/migrations.test.ts`. Update `ci.yml` and `Dockerfile`. |
| **Phase 2** | Auth & ACL Schema | Add migrations `0002_add_is_public.sql`, `0003_create_users.sql`, `0004_create_acl.sql`. Implement DAO functions in `lib/db/skalybr-db.ts`. |
| **Phase 3** | AuthN API & Session Engine | Install `iron-session`, `bcryptjs`. Create `/api/v1/auth/login`, `register`, `logout`, `me`, and session helpers. |
| **Phase 4** | ACL Resolution & Route Guards | Implement `getEffectiveRole()`. Wrap book/library routes to enforce read/curate/admin permissions. Filter `/api/v1/libraries` by visibility. |
| **Phase 5** | Frontend UI & Admin Panel | Implement Sign-in/Register modal, header user dropdown, Admin User & ACL Manager modal, and `QuickSwitch` dev tool. |
| **Phase 6** | E2E & Production Release | Run comprehensive test suite, verify CI workflow pass, update documentation, and release `v0.3.0`. |
