---
trigger: always_on
---

# Port Convention for Local Dev & Build Servers

When running a local dev server or testing a production build for **any GitHub issue** in this project, use the following port assignments so multiple issues can be developed side-by-side without conflicts:

| Mode | Port | Example (issue #42) |
|---|---|---|
| **Dev server** (`npm run dev`) | `3<issue#>` | `3042` |
| **E2E / production build** (`npm run build && npm run start`) | `4<issue#>` | `4042` |

## Dev server

```bash
PORT=3<issue#> npm run dev
# e.g. for issue #42:
PORT=3042 npm run dev
```

## Production build test

Build first, then serve on the 4xxx port:

```bash
npm run build
PORT=4<issue#> npm run start
# e.g. for issue #42:
PORT=4042 npm run start
```

## E2E tests

When running Playwright E2E tests against a production build, set `BASE_URL` to match the 4xxx port:

```bash
npm run build
PORT=4<issue#> npm run start &
BASE_URL=http://localhost:4<issue#> npm run e2e
```

> **Why?** This lets you run dev and prod servers for different issues simultaneously without port collisions, and keeps the convention consistent across CarSharing, sacred-fire-songs, and skalybr.
