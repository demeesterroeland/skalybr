# Changelog

## [0.3.0](https://github.com/demeesterroeland/skalybr/compare/v0.2.0...v0.3.0) (2026-09-21)


### ✨ New features

* **auth:** implement phase 2 auth and acl database migrations and daos ([f922c66](https://github.com/demeesterroeland/skalybr/commit/f922c660a59e12a55a09795c3a73f65072e418c0))
* **auth:** implement phase 3 authentication engine and api endpoints ([4365148](https://github.com/demeesterroeland/skalybr/commit/43651487d3c99c7202575c9dfc905cd6f0848a90))
* **auth:** implement phase 4 cascading acl resolution and route guards ([047fa59](https://github.com/demeesterroeland/skalybr/commit/047fa595cf940920ed429967ceaf9b21b062be89))
* **auth:** phase 5 — frontend auth ui, admin panel & dev quickswitch ([a6e1466](https://github.com/demeesterroeland/skalybr/commit/a6e14667b01f487991f3cdc9a2133e202516e139))
* **db:** implement phase 1 migration infrastructure and ci validation ([95cde75](https://github.com/demeesterroeland/skalybr/commit/95cde75c7a78db54706b9c71a0f55fe7b07f00a0))
* **demo:** add 10K-book large demo generator script ([3c87901](https://github.com/demeesterroeland/skalybr/commit/3c87901aa1bc7142c9b36e2b3a4106935f1dd326))
* **e2e:** phase 6 — playwright e2e suite, ci job & v0.3.0 release ([b293226](https://github.com/demeesterroeland/skalybr/commit/b293226250eb7598f27b9420efe9ea9922c36f12))


### 🐛 Bug fixes

* **release:** bump package.json to 0.3.0 and stabilize E2E test suite ([d9eab18](https://github.com/demeesterroeland/skalybr/commit/d9eab18fec8fc33fc647cb111f6d3f91c171de94))


### 📖 Documentation

* add explicit references to Auth & Cascading ACL plan in master_plan.md ([395f1f2](https://github.com/demeesterroeland/skalybr/commit/395f1f213f9b7e1c0e35721f06c01efcce75c569))
* modernize README with concise subtitle, Docker Compose, and ACL architecture ([84a50e2](https://github.com/demeesterroeland/skalybr/commit/84a50e2c8af995ad0d15fc1415fab8cf047fb88b))
* **plan:** mark phase 5 completed (a6e1466) ([50dfb08](https://github.com/demeesterroeland/skalybr/commit/50dfb0857613f7ac701a41b72e5c304ba4e75a7c))
* **plan:** update roadmap marking phase 4 completed ([09e9970](https://github.com/demeesterroeland/skalybr/commit/09e9970a66935d21f93007ee7b9c19bc581ea76b))
* reorganize ROADMAP.md into versioned milestones and updated status ([be7aaad](https://github.com/demeesterroeland/skalybr/commit/be7aaada97aed8521c2ce35371a88724a8d77755))

## [0.2.0](https://github.com/demeesterroeland/skalybr/compare/v0.1.0...v0.2.0) (2026-09-20)


### ✨ New features

* add complete library management with ZIP upload, rename, hide/show, download ZIP, and safe delete modal ([41ad602](https://github.com/demeesterroeland/skalybr/commit/41ad6023c260c87148fdc62cd594768410699c2b))
* add curated non-fiction demo library generator (489 books across 10 disciplines) ([7c876d1](https://github.com/demeesterroeland/skalybr/commit/7c876d186bc2905d6ed68001e52281d1dae7d4ed))
* add has_cover facet filter for sidebar and command bar ([b1c6151](https://github.com/demeesterroeland/skalybr/commit/b1c615151e16c0cdf76e08aabe256f6e1c3f6bc0))
* add view switcher for Gallery (covers grid) and Table (details list) ([8cdb8cf](https://github.com/demeesterroeland/skalybr/commit/8cdb8cf9dbebb82c567cb2f7dfe1be211fa9f976))
* **branding:** add favicon assets matching top-left logo ([e133a4a](https://github.com/demeesterroeland/skalybr/commit/e133a4a97691391e217a534fccec13cf3ad727d1))
* **db:** clean up orphaned records and reassign default library on deletion ([0f2159c](https://github.com/demeesterroeland/skalybr/commit/0f2159c1ccb6a11fa3a8550c5eb910c24d104206))
* **db:** introduce skalybr.db with libraries, reading_progress, shelves, and calibre-web migration ([2d25230](https://github.com/demeesterroeland/skalybr/commit/2d2523062816fd260c97104d1b6aedd215bf84f6))
* display MAX file size limit badge and dynamic size feedback in upload screen ([6bbc6e3](https://github.com/demeesterroeland/skalybr/commit/6bbc6e3f0b49898fa2001e5dc3119e69a78adbee))
* display unified app version in header and footer ([f783561](https://github.com/demeesterroeland/skalybr/commit/f783561cc11a21b38bc9583eaef3d5a82ed9bae0))
* enable interactive column sorting in Table view ([b1ffff4](https://github.com/demeesterroeland/skalybr/commit/b1ffff4f8d132b166e14fcd6d5e1add2bb088da2))
* ensure active library parameter is always included in URL on load and switch ([c182e21](https://github.com/demeesterroeland/skalybr/commit/c182e2199681dddcc4ab0b2d8027b92f4c6e4374))
* **filters:** add Pattern B Command-Bar Popovers and dual-layout switcher ([88d3be6](https://github.com/demeesterroeland/skalybr/commit/88d3be69a3bd9ba7366abc223ae3dc4f91146a02))
* **filters:** add responsive Calibre multi-select OR filter sidebar with dual-density facets ([8fc7d15](https://github.com/demeesterroeland/skalybr/commit/8fc7d1570010773eab1c20ceda4927587eb29253))
* **filters:** align facet category ordering with Calibre Desktop across both patterns ([4e5dd43](https://github.com/demeesterroeland/skalybr/commit/4e5dd4384151a5ac7d1ba51ff62ca1495df11991))
* implement generative art placeholders inspired by Stefan Bohacek ([df871bb](https://github.com/demeesterroeland/skalybr/commit/df871bbd471293d76d28aad53f9ac7f7816c86ed))
* implement infinite scrolling and lazy loading instead of paging ([5464748](https://github.com/demeesterroeland/skalybr/commit/5464748241379e023415c9faabdfc8914929085f))
* increase max library upload and download filesize limit to 1GB ([6afc591](https://github.com/demeesterroeland/skalybr/commit/6afc5912a642bed11a12f8b794217526d3f6246b))
* initial Skalybr MVP with flattened Calibre repository, sharp cover streaming, and master architectural plan ([13c9e79](https://github.com/demeesterroeland/skalybr/commit/13c9e79b831b8ac97ad93f679c35e5fd69791350))
* **libraries:** support CALIBRE_LIBRARIES and nested sub-directory discovery (e.g. demo-library/demo) ([2fe872d](https://github.com/demeesterroeland/skalybr/commit/2fe872dcca30d29048329fbc0066f61d7c9531ed))
* live URL inspection for reachability, filename, filesize and permissions ([2d8b3bf](https://github.com/demeesterroeland/skalybr/commit/2d8b3bfc597c4c1d2a92915560717243265a5164))
* **progress:** add live progress bar for cloud downloads and local file uploads ([b037bf2](https://github.com/demeesterroeland/skalybr/commit/b037bf2dd4a1ae6db5cf6b83c33d1ad6ea41cc8a))
* render dynamic typographic fallback covers when has_cover=0 ([e24441d](https://github.com/demeesterroeland/skalybr/commit/e24441d170b2d7ba623572a16af6bdc5d92758ff))
* support importing Calibre library ZIP from remote cloud URL ([10f1939](https://github.com/demeesterroeland/skalybr/commit/10f1939025d6b20a189d463bb620cf4fb7f6b58d))
* support OneDrive links, pre-download HEAD size check, and disk size display ([96e57d5](https://github.com/demeesterroeland/skalybr/commit/96e57d5ab6140b90b1b28967bac8da6a62366ef7))
* sync state to URL search parameters with bookmark and refresh support ([2ba6c98](https://github.com/demeesterroeland/skalybr/commit/2ba6c98f599edf99df4131a15646de79b0621e98))
* **ui:** add Add Library action to zero-state onboarding and redirect to /libraries on active library deletion ([c7b8776](https://github.com/demeesterroeland/skalybr/commit/c7b8776efd119ca74466464aab782de6b48f490e))
* **ui:** make search, controls, and horizontal filters sticky on scroll ([136fc18](https://github.com/demeesterroeland/skalybr/commit/136fc180abb6e51fa1127adfb67ff05a31ec7230))
* **ui:** unify library cards with shared LibraryCard component, avatar artwork, and centered layout ([9b8e228](https://github.com/demeesterroeland/skalybr/commit/9b8e228c6601b9f5721fb762bbb7a3c03637d1f3))


### 🐛 Bug fixes

* auto-populate folder name and display title when selecting zip archive ([f6800f0](https://github.com/demeesterroeland/skalybr/commit/f6800f00a4d80fd5f6492f9452c99f5fb005809b))
* **ci:** add test environment setup to seed demo library for clean checkouts ([89c7135](https://github.com/demeesterroeland/skalybr/commit/89c713558d0bf25ed61853b6449b49d69df61e8d))
* **covers:** add book uuid cache busters to cover image URLs ([c30aff9](https://github.com/demeesterroeland/skalybr/commit/c30aff97193ecb533f280ea8bf3b71a8461ffeac))
* **docker:** allow demo-library in docker build context ([1dbcef2](https://github.com/demeesterroeland/skalybr/commit/1dbcef2d59a9861601a1afa4ca219595a8a7fc75))
* **docs:** add explicit HTML anchor targets for markdown TOC navigation ([3222443](https://github.com/demeesterroeland/skalybr/commit/3222443cb39f38d0590368736ab97d32a7a5eb96))
* **docs:** align demo_catalog.md TOC slugs and numbered headings with master_plan.md structure ([90c45e4](https://github.com/demeesterroeland/skalybr/commit/90c45e46ca728207caf8b428d7cbf3db3b530cd8))
* **docs:** clean heading text to use standard native markdown anchor slugs ([9ab229d](https://github.com/demeesterroeland/skalybr/commit/9ab229d5dc029ae5b7d576552835dbd3aea3ae9c))
* **docs:** rollback to clean GFM markdown headings ([f90c215](https://github.com/demeesterroeland/skalybr/commit/f90c215e4d36fc12b4441dd3d18722e0f9ab1d70))
* **docs:** use explicit HTML h2 id attributes for Apostrophe/Pandoc markdown viewer compatibility ([81aa1f1](https://github.com/demeesterroeland/skalybr/commit/81aa1f1b3e8ec071e3e2d8f4b59419612ae283c2))
* ensure library uploads and resolution strictly target ./libraries subfolder ([a3a4f06](https://github.com/demeesterroeland/skalybr/commit/a3a4f0679c3b2058c9eae7ceba191b213b70de90))
* **onedrive:** resolve modern 1drv.ms links via session cookies and direct download stream ([28cace6](https://github.com/demeesterroeland/skalybr/commit/28cace6c434fe2519297a6f4b12247077b422791))
* resolve Google Drive large-file virus warning to retrieve actual 910MB file and size ([4bacb8a](https://github.com/demeesterroeland/skalybr/commit/4bacb8a7cc696d0ec4c577f44368f98f9ab95ac3))
* show &lt; select a library &gt; when no library is selected and remove invalid all books default ([b314811](https://github.com/demeesterroeland/skalybr/commit/b314811775c39fa469d64481b77c1975f1605863))
* **ui:** disable modal form inputs and actions during library import ([ffc7bf3](https://github.com/demeesterroeland/skalybr/commit/ffc7bf31bece7925aa52e025d5dde63a263c147b))
* update cache busting key to force reload synthesized fallback covers ([0093052](https://github.com/demeesterroeland/skalybr/commit/00930524b0feb21eb9e5e0d084b8c9f071bde826))


### 📖 Documentation

* expand Section 5.1 evaluation to include future Go backend comparison ([9cdda36](https://github.com/demeesterroeland/skalybr/commit/9cdda36818b7b73ea1fee4180e654ca8aff43763))
* generate full markdown catalog of 489 demo books and link in master plan ([1d16412](https://github.com/demeesterroeland/skalybr/commit/1d164124e6e19d1f19f1a019ddb7ed8fb1b5b0ee))
* make Section 5.1 architectural evaluation objective, balanced, and nuanced ([ebd6923](https://github.com/demeesterroeland/skalybr/commit/ebd6923ae5decd202aff59965b1b6c4ddb318405))
* reorder roadmap early in master plan and detail flattened view lifecycle limits ([9803a40](https://github.com/demeesterroeland/skalybr/commit/9803a40cbe9e3180feb9202bc4f978b57ae0180d))
