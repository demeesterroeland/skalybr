<div align="center">

# 🗡️ Skalybr

### *The modern, ultra-fast self-hosted e-book server and reader for Calibre libraries.*

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_v4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![better-sqlite3](https://img.shields.io/badge/better--sqlite3-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://github.com/WiseLibs/better-sqlite3)
[![License](https://img.shields.io/badge/license-GPLv3-blue.svg?style=flat-square)](LICENSE)

[Features](#-features) • [The Story & Legacy](#-the-story--legacy) • [The Name](#-the-name) • [Architecture](#-architecture) • [Getting Started](#-getting-started) • [Roadmap](ROADMAP.md)

</div>

---

## 📖 The Story & Legacy

In **October 2006**, Kovid Goyal, a quantum physics graduate student at Caltech, purchased one of the world's first commercial E-Ink devices: the Sony Reader PRS-500. Frustrated that Sony provided only Windows software and locked books behind closed formats, Kovid reverse-engineered the device protocol on Linux and released `libprs500`.

Over the next 17 years, that humble tool evolved into **`calibre`**—the undisputed champion of digital reading sovereignty. While big tech built walled gardens, Calibre gave millions of readers total ownership of their libraries with an open, indestructible SQLite database (`metadata.db`) that has remained backward-compatible for nearly two decades.

**Skalybr** is the modern continuation of this journey. Built for the era of personal home servers, NAS devices, and mobile reading, Skalybr connects directly to your existing Calibre library to provide a lightning-fast, beautiful web app, PWA, and e-reader sync hub.

---

## 🏛️ The Self-Hosted Media Pantheon

Skalybr is designed to be the definitive, gold-standard e-book experience in modern self-hosting:

| Media Domain | Gold Standard App | Core Tech | Status |
| :--- | :--- | :--- | :--- |
| 🎬 **Movies & TV** | **Jellyfin** | .NET / C# | Active Community |
| 🎵 **Music** | **Navidrome** | Go + React | Active Community |
| 📸 **Photos** | **Immich** | TypeScript / Node | Active Community |
| 📚 **E-Books & Calibre** | **Skalybr** | Next.js / TypeScript (Go-Ready) | 🚀 MVP Released |

---

## 🗡️ What Does "Skalybr" Mean?

The name **Skalybr** is a fusion of three legendary concepts:

1. **The Skald**: In Old Norse culture, a *Skald* was the revered bard and poet whose sacred duty was to preserve sagas, knowledge, and history in written verse.
2. **Excalibur**: The mythical sword drawn from stone—a symbol of supreme craftsmanship, elegance, and liberation.
3. **Calibre**: The 17-year gold standard for digital book management.

Styled with modern European phonetic simplicity, **`Skalybr`** is your personal saga keeper.

---

## ✨ Features & Status

### 🚀 Core Engine & Performance
- ✅ **Sub-Millisecond SQLite Engine**: Powered by `better-sqlite3` and a flattened read-model (`v_books_flattened`) for instant search, filtering, and paging.
- ✅ **On-the-Fly WebP Cover Streaming**: Powered by `sharp` (libvips) for high-resolution, low-memory thumbnail resizing.
- ✅ **Multi-Library Switching**: Seamlessly toggle between multiple Calibre libraries from a single UI.

### 📚 Modern Web Experience & CRUD
- ✅ **Responsive Book Grid**: Instant search by Title, Author, Series, and Tags with dynamic custom column support (e.g. `#collection`).
- ✅ **Book Details & Metadata Management**: Clean modal view for reading blurbs, updating metadata, managing formats, and downloading e-books.
- ✅ **Contract-First OpenAPI 3.1**: Fully documented REST endpoints with interactive Scalar documentation at `/api/reference`.

### 🔄 Multi-Protocol & E-Reader Sync *(In Progress)*
- 🔄 **OPDS 1.2 Catalog**: Standard XML feed (`/opds`) for Moon+ Reader, FBReader, Thorium, and KyBook.
- 🔄 **Kobo Wireless Sync**: Direct hardware sync for Kobo e-readers (reading progress, bookmarks, shelves).
- 📋 **In-Browser E-Readers**: Fullscreen EPUB, PDF.js, and Comic canvas viewers with offline PWA caching.
- 📋 **User Shelves & Auth**: Multi-user accounts, private/public shelves, and read status tracking (`app.db`).
- 📋 **Book Ingestion & Scraping**: Multi-file upload, metadata fetching (Google Books / Goodreads), and Send-to-Kindle emailer.

*(For detailed timelines, see [ROADMAP.md](ROADMAP.md))*

---

## 🏗️ Architecture

Skalybr uses a **Modular Monolith** and **API-First (Ports & Adapters)** architecture:

```
[ Clients ]                 [ API Ingress Adapters ]            [ Shared Core Engine ]
Web App / PWA       ----->  /api/v1/* (Modern OpenAPI 3.1)  ──┐
E-Reader Apps       ----->  /opds/* (OPDS 1.2 XML Feed)     ──┼─>  FlatBookRepository + better-sqlite3
Kobo Hardware       ----->  /api/v1/kobo/* (Kobo JSON)      ──┤    (Single source of truth)
Calibre Desktop     ----->  /cdb/* (Calibre Desktop REST)   ──┘
```

> **Go-Ready Architecture**: Because all client interfaces communicate through the OpenAPI 3.1 contract, the backend engine can seamlessly be replaced by a compiled Go binary at any future stage with zero frontend rewrites.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- An existing Calibre Library directory containing `metadata.db`

### Quick Start
```bash
# Clone repository
git clone https://github.com/demeesterroeland/skalybr.git
cd skalybr

# Install dependencies
npm install

# Run unit tests against your Calibre library
npm run test

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view your library, or [http://localhost:3000/api/reference](http://localhost:3000/api/reference) for the interactive API reference.

---

## 🗺️ Project Roadmap

- [x] **Phase 1 (Core MVP)**: Multi-library selector, `v_books_flattened` query engine, responsive grid, `sharp` cover streaming, book metadata CRUD, OpenAPI 3.1 reference.
- [ ] **Phase 2 (E-Reader Sync)**: OPDS 1.2 XML feed & Kobo wireless sync JSON endpoints.
- [ ] **Phase 3 (Shelves & Auth)**: User authentication, shelves, and reading progress tracking (`app.db`).
- [ ] **Phase 4 (In-Browser Readers & PWA)**: Embedded EPUB, PDF.js, Comic viewers, and offline PWA support.
- [ ] **Phase 5 (Ingestion & Scraping)**: Book uploader, metadata scrapers (Google Books / Goodreads), and Send-to-Kindle emailer.
- [ ] **Phase 6 (Optional)**: Drop-in Go binary distribution.

👉 *See full task breakdown in [ROADMAP.md](ROADMAP.md).*

---

## 📜 License
GPL-3.0 License. Dedicated to the open-source reading community and the legacy of Calibre.
