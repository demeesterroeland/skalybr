<div align="center">

# 🗡️ Skalybr

### Modern self-hosted book server for Calibre libraries

[![GitHub Release](https://img.shields.io/github/v/release/demeesterroeland/skalybr?style=flat-square&color=blue)](https://github.com/demeesterroeland/skalybr/releases)
[![CI Status](https://img.shields.io/github/actions/workflow/status/demeesterroeland/skalybr/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/demeesterroeland/skalybr/actions/workflows/ci.yml)
[![Docker Image](https://img.shields.io/badge/docker-GHCR-blue?style=flat-square&logo=docker&logoColor=white)](https://github.com/demeesterroeland/skalybr/pkgs/container/skalybr)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![better-sqlite3](https://img.shields.io/badge/better--sqlite3-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://github.com/WiseLibs/better-sqlite3)
[![License](https://img.shields.io/badge/license-GPLv3-green.svg?style=flat-square)](LICENSE)

**[Features](#-key-features)** • **[Quick Start](#-quick-start)** • **[Access Control](#-cascading-access-control)** • **[Architecture](#-architecture)** • **[API Reference](#-api--integration)** • **[The Story](#-the-story--legacy)** • **[Roadmap](ROADMAP.md)**

</div>

---

**Skalybr** is an open-source, high-performance web server and reading portal designed for Calibre e-book libraries. Inspired by modern self-hosted media servers like **Jellyfin**, **Navidrome**, and **Immich**, Skalybr connects directly to your existing Calibre libraries to provide instant search, multi-library switching, Google Drive-style cascading permissions, and seamless digital reading without vendor lock-in.

---

## 🏛️ The Self-Hosted Media Pantheon

Skalybr is built to complete the modern self-hosted home media suite:

| Media Domain | Gold Standard Server | Technology | Community |
| :--- | :--- | :--- | :--- |
| 🎬 **Movies & TV** | **[Jellyfin](https://jellyfin.org/)** | .NET / C# | Active Community |
| 🎵 **Music** | **[Navidrome](https://www.navidrome.org/)** | Go + React | Active Community |
| 📸 **Photos** | **[Immich](https://immich.app/)** | TypeScript / Node | Active Community |
| 📚 **Books & Calibre** | **Skalybr** | Next.js / TypeScript | 🚀 Active Development |

---

## ✨ Key Features

- ⚡ **Sub-Millisecond Engine**: Query millions of records in under 1ms via a flattened SQLite read model (`better-sqlite3`) and zero-lag indexing.
- 📚 **Multi-Library by Design**: Host unlimited Calibre libraries side-by-side with a Netflix-style library gateway and instant live switching.
- 🖼️ **On-the-Fly WebP Cover Streaming**: Low-memory, high-fidelity cover generation and resizing powered by `sharp` (libvips).
- 🛡️ **Cascading ACL ("Ripple-Down")**: Google Drive-style hierarchical permissions (`Global` $\rightarrow$ `Library` $\rightarrow$ `Shelf`) with `Guest`, `Reader`, `Curator`, and `Admin` roles.
- 👥 **Open Signups with Admin Approval**: Self-service user registration with pending queues and administrative approval flows.
- 🔍 **Instant Faceted Search**: Multi-field filtering by title, author, series, tags, formats, and custom Calibre columns (`#collection`, etc.).
- 🔒 **Safe & Non-Destructive**: Reads directly from standard Calibre `metadata.db` files without altering your files, directories, or metadata structures.
- 🔌 **API-First & Extensible**: Fully typed OpenAPI 3.1 specification with an embedded, interactive Scalar documentation suite at `/api/reference`.
- 📖 **Modern Reading & Sync (In Progress)**: OPDS 1.2 catalog feeds, Kobo wireless hardware sync, and in-browser reading with per-user progress.

---

## 🚀 Quick Start

### Option A: Docker Compose (Recommended)

Create a `docker-compose.yml` file:

```yaml
services:
  skalybr:
    image: ghcr.io/demeesterroeland/skalybr:v0.2.0
    container_name: skalybr
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - HOSTNAME=0.0.0.0
      - NODE_ENV=production
      - DATA_DIR=/app/data
      - CALIBRE_BASE_DIR=/app/libraries
      - SESSION_SECRET=replace_with_a_secure_random_string_at_least_32_chars
    volumes:
      # Persistent app data (users, ACL grants, reading progress, settings)
      - ./data:/app/data
      # Your existing Calibre library folder(s)
      - /path/to/calibre/libraries:/app/libraries
```

Start the container:

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The first registered user automatically becomes the system administrator!

---

### Option B: Docker Run

```bash
docker run -d \
  --name skalybr \
  -p 3000:3000 \
  -v ./data:/app/data \
  -v /path/to/calibre/libraries:/app/libraries \
  -e SESSION_SECRET="your-secure-random-string-min-32-chars" \
  ghcr.io/demeesterroeland/skalybr:v0.2.0
```

---

### Option C: Local Development

```bash
# Clone repository
git clone https://github.com/demeesterroeland/skalybr.git
cd skalybr

# Install dependencies
npm install

# Run automated tests
npm test

# Start development server
npm run dev
```

---

## 🔐 Cascading Access Control

Skalybr implements an intuitive cascading permissions model:

```
[ Global Scope: * ]
        │
        ▼
[ Library Scope: library:<name> ]
        │
        ▼
[ Shelf Scope: shelf:<uuid> ]
```

### Roles & Hierarchy

| Role | Weight | Rights |
| :--- | :---: | :--- |
| **Admin** | `3` | Full instance control, user approval, library creation/deletion, global overrides. |
| **Curator** | `2` | Update book metadata, organize shelves, manage reading lists within granted scope. |
| **Reader** | `1` | Browse catalog, read books online, and download book files. |
| **None** | `0` | Explicit denial (overrides higher-level grants to restrict specific resources). |
| **Guest** | `-` | Unauthenticated access limited exclusively to libraries marked `is_public = 1`. |

- **Inheritance**: A user granted `Reader` globally inherits read access to all libraries and shelves, unless an explicit `None` grant is assigned to a specific child resource.
- **Elevation**: A user with `Reader` globally can be elevated to `Curator` on a specific library.

---

## 🏗️ Architecture

Skalybr is built as a **Modular Monolith** adhering to Ports & Adapters (Hexagonal Architecture):

```
┌───────────────────────────────────────────────────────────────┐
│                      Clients & Protocols                      │
│   Web App (Next.js)  │  OPDS 1.2 Clients  │  Kobo e-Readers   │
└───────────────┬──────────────────────┬────────────────────────┘
                │                      │
                ▼                      ▼
┌───────────────────────────────────────────────────────────────┐
│                     Ingress Adapters                          │
│   REST API (/api/v1/*)  │  OPDS Feed (/opds)  │  Kobo Sync    │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                     Core Engine & Storage                     │
│  FlatBookRepository (better-sqlite3) │ Sharp Image Pipeline   │
│  metadata.db (Calibre)               │ skalybr.db (App State) │
└───────────────────────────────────────────────────────────────┘
```

- **Calibre Isolation**: Calibre's `metadata.db` remains intact and safe from proprietary schema mutations.
- **Central Application State**: User accounts, cascading ACL grants, shelves, and reading progress reside in an independent, auto-migrated SQLite database (`skalybr.db`).
- **Engine Swappability**: Because client adapters communicate through the OpenAPI 3.1 specification, backend engine modules can easily transition to a compiled binary (e.g., Go) in the future without frontend modifications.

---

## 🔌 API & Integration

Skalybr is contract-first. An interactive API playground powered by **Scalar** is hosted directly within every running instance:

- **Interactive Reference**: `http://localhost:3000/api/reference`
- **OpenAPI 3.1 Specification**: `http://localhost:3000/api/openapi.json`

---

## 📖 The Story & Legacy

In **October 2006**, Kovid Goyal, a quantum physics graduate student at Caltech, purchased one of the world's first commercial E-Ink devices: the Sony Reader PRS-500. Frustrated that Sony provided only Windows software and locked books behind closed formats, Kovid reverse-engineered the device protocol on Linux and released `libprs500`.

Over the next nearly two decades, that project evolved into **Calibre**—the gold standard of digital reading sovereignty. While major tech companies built walled gardens, Calibre gave readers total ownership of their digital libraries with an open SQLite database (`metadata.db`) that has remained backward-compatible across generations.

**Skalybr** is the modern continuation of this philosophy: honoring the durability of Calibre while delivering the polish, speed, and cloud-native self-hosting experience expected of modern software.

---

## 🗡️ The Name

The name **Skalybr** draws inspiration from three elements:

1. **The Skald**: In Old Norse culture, the *Skald* was the revered bard and poet whose duty was to preserve history, sagas, and wisdom in verse.
2. **Excalibur**: The legendary sword drawn from stone—a symbol of precision craftsmanship and liberation from walled gardens.
3. **Calibre**: The enduring cornerstone of open digital book management.

---

## 🗺️ Roadmap

- [x] **Phase 1: High-Performance MVP** (`v0.1.0`): FlatBookRepository, sub-millisecond SQLite queries, `sharp` WebP cover streaming, multi-library switcher, OpenAPI 3.1 specification.
- [x] **Phase 2: RESTful Refactor & Onboarding** (`v0.2.0`): RESTful path routing (`/api/v1/libraries/[library]/...`), Netflix-style library gateway, demo library onboarding, Calibre-Web migration tool.
- [x] **Phase 3: Database Migrations & Auth Backend**: Zero-downtime atomic migration engine, `iron-session` authentication, bcrypt password hashing, and user DAOs.
- [x] **Phase 4: Cascading ACL & Route Guards**: Google Drive-style permission hierarchy, protected API route guards, admin user and grant management APIs.
- [ ] **Phase 5: Frontend Authentication & Admin Panel**: User profile dropdown, login/register modal, admin user approval drawer, cascading permission drawer, and dev `QuickSwitch` persona bar.
- [ ] **Phase 6: E-Reader Sync & Readers**: OPDS 1.2 catalog feed, Kobo wireless hardware sync, fullscreen browser EPUB/PDF reader, and offline PWA support.

See [ROADMAP.md](ROADMAP.md) for detailed task breakdowns and progress.

---

## 📜 License

Distributed under the **GNU General Public License v3.0** (`GPL-3.0`). Dedicated to the open-source reading community and the legacy of Calibre.
