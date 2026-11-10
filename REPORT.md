# How aiengineeringfromscratch.com works

Architecture notes from a browser-level teardown of
<https://aiengineeringfromscratch.com/> on 2026-11-09/10, plus the verification
of the local landing-page clone in this repository.

The short version: it is a **static, hand-authored HTML/CSS/vanilla-JS site**
deployed on Vercel, with **two serverless renderers** for lessons and
certifications, **generated data modules** built from Markdown in the GitHub
repository, and an **agent-facing layer** that serves the same content as
Markdown, JSON, and MCP. There is no React/Vue/Svelte app, no client-side router,
and no bundler in the critical path.

---

## 1. At a glance

| Property | Value |
| --- | --- |
| Frontend | Static HTML + CSS + vanilla JavaScript |
| Hosting | Vercel static output (`site/`) + Node serverless functions (`api/`) |
| Build | Node scripts run in `vercel.json`’s `buildCommand` |
| Content source | Markdown and JSON in `rohitg00/ai-engineering-from-scratch` |
| Curriculum size | 542 lessons, 20 phases, 13 learning paths |
| Reference data | 250 glossary terms, 526 reusable prompts/skills/agents |
| Search | In-memory index + Pagefind index for generated pages |
| Progress | `localStorage`, no account or server |
| Reader | `/lesson` serverless function, HTML or Markdown negotiation |
| Agent surface | `/llms.txt`, OpenAPI 3.1 at `/openapi.json`, MCP at `/mcp` |
| License | MIT (upstream code and content) |
| Upstream snapshot | commit `8c09d89`, 2026-11-09 |

The site’s own `llms.txt` describes the curriculum as “542 lessons across 20
phases” and lists the API/MCP resources. The JavaScript data snapshot used by
the clone was built at `2026-11-09T16:06:21.926Z`.

---

## 2. System architecture

```text
                         ┌──────────────────────────────┐
                         │  GitHub repository            │
                         │  phases/**/docs/en.md         │
                         │  certifications/**/docs/*.md  │
                         │  README.md, ROADMAP.md        │
                         │  glossary/terms.md            │
                         │  learning-paths/*.json        │
                         └──────────────┬───────────────┘
                                        │ build
                                        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Vercel build                                                              │
│  build.js → data.js, certification-data.js, SEO, figures, social cards    │
│  build-projects / agents / manuals / search / clean-urls / version-assets │
└───────────────┬───────────────────────────────────────────┬───────────────┘
                │ static output                              │ functions
                ▼                                            ▼
┌───────────────────────────────┐              ┌──────────────────────────────┐
│ site/                         │              │ api/                         │
│ index.html, catalog.html,     │              │ lesson.js                    │
│ lesson.html, roadmap, hubs,   │              │ certification.js             │
│ glossary, manuals, pagefind/  │              │ markdown.js, og.js, mcp.js   │
│ app.js, header.js, data.js    │              │ v1/catalog|markdown|resource │
└───────────────┬───────────────┘              └──────────────┬───────────────┘
                │                                             │
                └─────────────────────┬───────────────────────┘
                                      ▼
                             Browser / agent client
```

### Static first

Most pages are pre-built HTML in `site/`. The homepage alone carries its
page-specific layout CSS inline in `index.html`; shared tokens and components
live in `style.css`. The browser downloads:

- `style.css` (~53 KB)
- `intelligence-check.css` (~5 KB)
- `newsletter.css` (~4.6 KB, injected by `header.js`)
- `data.js` (~1.08 MB)
- twelve scripts (~216 KB uncompressed, including the inline homepage script)

Assets are content-hashed at build time by `site/version-assets.js`; the
`?v=<sha256-prefix>` on JS/CSS URLs is a cache-buster, not a build-tool artifact.

### Vercel routing

`vercel.json` defines the build and the edge behavior:

```json
{
  "buildCommand": "node site/fetch-translation-coverage.js && node site/build.js && node site/build-projects.js --strict && node site/build-agents.js && node site/build-manuals.js && node site/build-search.js && node site/clean-urls.js && node site/version-assets.js",
  "outputDirectory": "site",
  "framework": null
}
```

It has 61 rewrites, 20 redirects, 25 header rules, and 10 functions. The
important rewrites are:

- `/lesson` → `/api/lesson`
- `/certification` → `/api/certification`
- clean URLs (`/catalog`, `/roadmap`, `/glossary`, `/about`, …) → the matching
  `.html` file
- `Accept: text/markdown` variants of content pages → `agent-pages/*.md`
- manual and hub routes → nested static HTML

`clean-urls.js` runs after the build to strip `.html` from public links and
sitemap entries, so the source HTML can use both forms while deployed URLs stay
clean.

### Page structure

The site is multi-page. `header.js` is the shared shell: it injects the
announcement banner, adds navigation links, moves overflow links into a
priority bar, and loads the theme menu, TTS, UI translations, newsletter, and
star nudge on every page. `app.js` is the homepage controller. `lesson.html`
plus `lesson-*.js`/`tts.js`/`progress.js` handle the reader, and separate build
scripts generate the catalog, hubs, manuals, cheatsheets, practice, projects,
interviews, and certification pages.

There is no client-side router. Route changes are ordinary navigations; the
`isStaticPreview()` branch in `header.js` exists so the same HTML can be opened
from `file://` or `localhost` during development by rewriting clean URLs to
`.html`.

---

## 3. Content model and build pipeline

### Source of truth

Curriculum content lives in the repo, not in a CMS:

- `phases/<phase>/<lesson>/docs/en.md` — lesson bodies
- `certifications/<program>/lessons/<lesson>/docs/en.md` — certification lessons
- `README.md` — curriculum index with phase/lesson tables
- `ROADMAP.md` — prerequisite graph
- `glossary/terms.md` — glossary entries
- `learning-paths/*.json` — structured paths
- `certifications/` — programs, tracks, assessments
- `manuals/`, `cheatsheets/`, `practice/`, `projects/`, `interviews/` — generated
  or curated companion material
- `languages.json` and the `translations` branch — localization metadata

`site/build.js` (115 KB) parses these sources and writes generated modules. It
is not a general-purpose static-site generator; it is a curriculum-specific
compiler with hard-coded parsers, validation, and SEO/card generation.

### Build graph

The production build chain, in order:

1. `fetch-translation-coverage.js` — pulls translation coverage metadata.
2. `build.js` — parses README/ROADMAP/glossary/certifications, emits `data.js`,
   `certification-data.js`, `figure-manifest.js`, SEO JSON, and social-card
   metadata; syncs counts into marketing pages and README.
3. `build-projects.js --strict` — project data and pages.
4. `build-agents.js` — agent pages, `llms.txt`, OpenAPI, `server.json`, and
   related discovery files.
5. `build-manuals.js` — manual pages.
6. `build-search.js` — Pagefind index.
7. `clean-urls.js` — strips `.html` from links/sitemap.
8. `version-assets.js` — hashes JS/CSS references.

Supporting generators include `build-hubs.js`, `build-cheatsheets.js`,
`build-practice.js`, `build-interviews.js`, `build-lessons.js`,
`build-skills.js`, `build-projects.js`, and `build-manuals.js`. The dependency
set is small and build-time only: Shiki 4.5.0 (syntax highlighting), Pagefind
1.5.2 (search), and language/theme bundles. Node `>=20` is required.

### Generated globals

`data.js` declares six globals used by the browser:

| Global | Shape |
| --- | --- |
| `PHASES` | Array of 20 phases; each `{ id, name, status, desc, lessons[], hub }` |
| `ROADMAP_PREREQS` | `{ phaseId: [prerequisitePhaseIds] }` DAG |
| `LEARNING_PATHS` | 13 path objects with checkpoints, prerequisites, and metadata |
| `GLOSSARY` | 250 term objects |
| `GLOSSARY_CATEGORY_ORDER` | Category display order |
| `ARTIFACTS` | 526 reusable outputs |

A lesson is:

```js
{
  name: "Dev Environment",
  status: "complete",
  type: "Build",
  lang: "Python, TypeScript, Rust",
  url: "https://github.com/.../phases/00-setup-and-tooling/01-dev-environment/",
  summary: "Your tools shape your thinking. Set them up once, set them up right.",
  keywords: "Step 1: System Foundation · Step 2: Python with uv · …"
}
```

The prerequisite map is a DAG, not a linear list: phase 0 is the root; phases
1–4 chain forward; 5–7 branch; 10–12 branch from 7/10; and the capstone phase 19
depends on 16, 17, and 18. The roadmap page renders this graph; the landing page
only uses the counts.

### Why a generated `data.js`

The homepage needs all 542 lessons available immediately for the TOC modal,
search palette, progress counts, and stat bars. Shipping one generated JS module
avoids an API call and lets the page work with JavaScript only (no backend
round-trip). The cost is a ~1 MB download; it is cached with a content hash and
revalidated separately from the HTML.

### Build-time consistency

`build.js` also keeps marketing copy honest:

- `syncCounts()` rewrites “N lessons/phases/outputs” in `index.html`,
  `catalog.html`, `lesson.html`, `roadmap.html`, `learning-paths.html`,
  `about.html`, `cmdpalette.js`, and the sponsors page.
- `syncCertificationStats()` rewrites certification program/track/lesson/question
  counts in `index.html`.
- README badges and stats are synced from the same generated numbers.

This is why the homepage copy can say 542/20/526 without a manual edit, and why
the number appears in multiple places (hero, preface, stats, modal, palette,
metadata, JSON-LD).

---

## 4. Landing page anatomy

The homepage is a long editorial page. From top to bottom:

1. **Announcement banner** — injected by `header.js`, links to the manuals page,
   dismissible with the close button. Dismissal is stored under
   `aifs:banner:dismissed` with the banner id `manuals-20261023`.
2. **Header** — logo, navigation, GitHub star count, search, and a menu that
   contains the overflow links and tools.
   - At desktop widths, only `Contents`, `Catalog`, and `Learning Paths` are in
     the priority bar; the rest move into the slide-out nav.
   - Theme, language, and TTS controls are moved into the slide-out tools row.
   - At ≤820 px the priority bar is hidden and the menu toggle becomes primary.
   - `syncCurrentPage()` marks the current page with `aria-current`.
3. **Hero** — `FIG_000` label, oversized VT323 title, lesson/phase line,
   maintainer line, two primary CTAs, GitHub star/follow buttons, and a terminal
   snippet with a copy button.
4. **Thought experiment** — `intelligence-check` card with an animated dial,
   question, “Ask the machine” button, deterministic answer pairs, and a sponsor
   link that appears after the second answer.
5. **Figure carousel** — three inline SVG plates:
   - forward pass network (edges draw layer by layer, nodes fade in, pulses
     travel)
   - AI-native lesson mock
   - learning-curve chart
   The carousel autoplays every 6.5 s on desktop when in view and motion is
   allowed, pauses offscreen/hidden/reduced-motion, and stops after one cycle.
   Previous/next buttons and dots are real controls; captions are live regions.
6. **Preface** — editorial copy, phase/lesson counts, and ASCII rule.
7. **Newsletter strip** — injected by `newsletter.js`/`newsletter.css`, posts to
   the author’s Substack (`thatdevopsguy.substack.com`).
8. **Three “Inside …” features** — AI agent, decompiler, and LLM-serving GPU.
   Each links to a dedicated machine page and swaps light/dark anatomy images
   via CSS.
9. **Choose the work you want to do** — a four-way learning-path figure plus six
   route cards (applications, software fundamentals, agent-assisted engineering,
   product judgment, MCP, agent skills) and certification links.
10. **Stat block** — animated bars for completed lessons, phases, languages, and
    glossary coverage.
11. **Contents / TOC** — 20 phase rows rendered from `PHASES`. Each row is a
    button-like element that opens the phase modal. Progress is read from
    `localStorage`.
12. **Phase modal** — title, description, hub link, completion bar, lesson
    search, lesson list, per-lesson “Mark done” toggles, and a reset button.
    Focus is trapped while open; Escape/overlay/close dismiss it.
13. **Books** — six volumes (`Foundations`, `Deep Learning`, `Language`, `LLMs`,
    `Agents`, `Production`) generated by an inline script. Links resolve to the
    latest GitHub release assets (`aiefs-volN-slug.epub/pdf`).
14. **Certification spotlight** — certification paths, lab/proof language,
    badge images, and links to the tutors.
15. **Colophon** — repository clone command with a copy button.
16. **Footer** — project links, secondary pages, GitHub, report link.
17. **Reader marquee** — “Read by engineers and students at” with institution
    logos. The inline marquee script duplicates the track, pauses offscreen, and
    respects reduced motion.

The clone preserves this order and all of the interactive behavior listed
above.

---

## 5. Client runtime

### Modules

| File | Size | Responsibility |
| --- | ---: | --- |
| inline homepage script | 2.5 KB | books grid generation |
| `lang-picker.js` | 9.3 KB | language menu, saved language, page reload |
| `app.js` | 30.1 KB | theme boot, summary/stats, TOC render, modal, copy, carousel, reveal observer |
| `intelligence-check.js` | 1.9 KB | deterministic “Ask the machine” replies |
| `cmdpalette.js` | 36.4 KB | ⌘K palette, in-memory index, Pagefind bridge |
| `newsletter.js` | 7.5 KB | Substack form injection and modal variant |
| `star-nudge.js` | 8.5 KB | star prompt after lesson visits |
| `theme-menu.js` | 11.0 KB | three-mode theme menu |
| `header.js` | 21.4 KB | banner, nav, star count, dynamic module loading |
| `progress.js` | 9.0 KB | local progress store |
| `ui-i18n.js` | 10.7 KB | UI string translation loader |
| `tts.js` | 67.6 KB | Web Speech narration, voice scoring, playback state |

Additional lesson-page scripts (`lesson-*.js`, `code-copy.js`, highlights,
quizzes, walkthrough) are not part of the landing snapshot but are part of the
same vanilla-JS architecture.

### Initialization order

1. The inline theme script in `app.js` runs before paint, reads
   `localStorage.theme`, falls back to `prefers-color-scheme`, and sets
   `data-theme` on `<html>` to avoid a flash.
2. `data.js` and `progress.js` load synchronously so globals and progress are
   available to later modules.
3. Deferred scripts (`header.js`, `cmdpalette.js`, `theme-menu.js`,
   `intelligence-check.js`, `lang-picker.js`) attach behavior.
4. On `DOMContentLoaded`, `app.js` populates counts/stats, renders the TOC,
   wires the modal/copy/carousel, and starts the reveal observer.
5. `header.js` creates the banner, navigation, and tool rows, then injects
   `theme-menu.js`, `tts.js`, `ui-i18n.js`, `newsletter` assets, and
   `star-nudge.js` if they are not already present.

The modules communicate through globals (`window.AIFSProgress`,
`window.AIFSThemeMenu`, `window.AIFSRouteLinks`), custom events
(`aifs:overlayopen`), and DOM attributes. There is no state library.

### Theme

- Modes: `system`, `light`, `dark`.
- Stored under `theme` only for explicit light/dark; system is the absence of a
  stored value.
- `theme-menu.js` renders a `role="menu"` popover with `menuitemradio` buttons,
  arrow-key navigation, Escape close, click-outside close, and focus return.
- Dark mode is a full token swap: background `#0a0d1a`, surface `#131830`,
  ink `#e8e6dc`, blueprint `#6b8eff`.
- The early boot script and the menu both resolve system preference through
  `matchMedia('(prefers-color-scheme: dark)')`.

### Local storage

| Key | Purpose |
| --- | --- |
| `theme` | explicit light/dark preference |
| `aifs:banner:dismissed` | announcement banner dismissal |
| `aifs:star-nudge` | star-prompt state and visit count |
| `gh:stars:rohitg00/ai-engineering-from-scratch` | GitHub star cache, 10-minute TTL |
| `aifs:progress:v2` | lessons, quiz answers, checkpoints, completion |
| `aifs:progress:v1` | legacy progress, migrated on read |
| `tts:voice`, `tts:voice:<lang>` | narration voice choice |
| `lang` | selected UI language |

Progress v2 is keyed by lesson path and stores:

```js
{
  schemaVersion: 2,
  lessons: {
    "<lesson-path>": {
      answers: { "<qid>": { picked, correct, t } },
      quizPassedAt: number | null,
      checkpoints: {
        readAt: number | null,
        builtAt: number | null,
        ranAt: number | null,
        evidenceAt: number | null
      },
      completedAt: number | null,
      completionSource: string,
      visitedAt: number
    }
  },
  updatedAt: number
}
```

The landing page uses `isLessonComplete()` and `extractPath()` to show phase
progress. No progress data leaves the browser.

### Search

Two search systems share one palette:

1. **In-memory index** — built once from `PHASES`, `LEARNING_PATHS`, `GLOSSARY`,
   and certification data. Scoring favors exact name matches, then prefix,
   substring, keywords, type, language, phase, and summary. Results include
   lessons, phases, glossary terms, paths, certifications, and outputs.
2. **Pagefind** — `build-search.js` extracts `<main>` content from generated
   pages (practice, cheatsheets, phase hubs, glossary hubs) and indexes it with
   Pagefind 1.5.2. The palette dynamically imports `/pagefind/pagefind.js` on
   first focus and merges those results with the in-memory results.

The palette is a `role="dialog"` with a combobox input, listbox results,
arrow-key navigation, Enter to open, Escape to close, and a visible
`⌘K`/`Ctrl+K` hint. The shortcut is handled globally; the header search button
is another trigger.

### GitHub stars

`header.js` fetches `https://api.github.com/repos/rohitg00/ai-engineering-from-scratch`
and caches the count in `localStorage` for ten minutes. The star count appears in
the header, the hero button, and the star nudge. A failed request leaves the
cached value or an ellipsis in place; it does not block the page.

### Other enhancers

- **TTS** uses `window.speechSynthesis`, scores available voices (preferring
  neural/cloud voices and skipping novelty voices), stores voice choice, and
  synchronizes narration state across page navigations. It falls back to a
  silent QA voice when no speech engine is available.
- **i18n** loads `langs.js` (generated native names) and fetches UI strings from
  `raw.githubusercontent.com/.../translations/i18n/<lang>/ui.json`. It updates
  elements marked with translation keys and can change `dir` for RTL.
- **Newsletter** injects the signup strip and a modal variant. The form is a
  normal GET to the Substack publication, so there is no first-party email
  handling.
- **Star nudge** shows a prompt after repeated lesson visits and records
  dismissal/visit state locally.
- **Copy buttons** use `navigator.clipboard.writeText()` with an
  `execCommand('copy')` fallback, set `aria-label`, and show “copied” feedback
  for 1.5 seconds.

### External requests

| Destination | Purpose |
| --- | --- |
| `fonts.googleapis.com` / `fonts.gstatic.com` | VT323, Source Serif 4, JetBrains Mono |
| `api.github.com` | star count |
| `thatdevopsguy.substack.com` | newsletter form action |
| `raw.githubusercontent.com` | UI translations |
| `images.credly.com`, `training.linuxfoundation.org` | certification badge images |
| `va.vercel-scripts.com` | Vercel analytics (removed from the clone) |

No first-party cookies were observed in the landing capture. The site’s state
is browser-local except for these third-party requests.

---

## 6. The dynamic lesson reader

`/lesson` is the one route that cannot be a static file: it renders 542 lesson
bodies plus certification lessons, translations, and SEO variants. Vercel
rewrites `/lesson` to `api/lesson.js`.

### Inputs

The function accepts a `path` query parameter identifying a lesson, plus
`track`, `fromTrack`, `learningPath`, `lang`, `ttsTest`, and `legacy` options.
It normalizes the path, resolves the lesson entry, and loads the corresponding
`docs/<lang>.md` from the deployment bundle. Only the directories named in
`vercel.json`’s `includeFiles` are shipped to the function:

```text
site/lesson.html
site/lesson-seo.json
site/lesson-code/**
site/lesson-terms.json
site/cheatsheet-map.json
site/practice-map.json
site/lesson-markdown.js
languages.json
phases/*/*/docs/en.md
certifications/*/lessons/*/docs/en.md
lib/og-render.js
lib/og-fonts/*.json
```

`maxDuration` is 10 seconds.

### Rendering

`api/lesson.js` uses `site/lesson-markdown.js` (`parseMd`,
`prerenderedCode`) to turn Markdown into HTML. Shiki output is prerendered at
build time, so lesson code blocks do not pay a client-side highlighting cost.
The function injects:

- the lesson body into the `lesson.html` shell
- SEO metadata and a JSON-LD `LearningResource` graph
- canonical and `hreflang` alternates for translations
- Open Graph/Twitter cards, using generated OG images
- navigation context (`learningPath`, track)
- quiz/checkpoint hooks consumed by the lesson scripts

If the request sends `Accept: text/markdown`, the same function returns the
lesson as Markdown instead of HTML. This is the same content-negotiation idea
used by the agent pages: humans get the styled reader, agents get clean source.

### Translations

Localized lesson Markdown and UI strings live on the `translations` branch.
`api/lesson.js` reads the translation result, exposes it through the language
picker and `hreflang`, and noindexes non-indexed languages. `languages.json` and
`lib/lesson-translations.js` define the supported set, native names, RTL
languages, and OG locales.

### Public API and MCP

The agent-facing layer exposes the curriculum without the HTML shell:

- `GET /api/v1/catalog` — paged catalog of lessons/projects/resources
- `GET /api/v1/markdown` — Markdown representation of a resource
- `GET /api/v1/resource` — resource metadata/content
- `GET /openapi.json` — OpenAPI 3.1 contract, currently v1.3.0
- `GET /llms.txt` — ~467 KB agent curriculum index with lesson titles, paths,
  and links
- `GET /server.json` — MCP server manifest
- `POST /mcp` — Streamable HTTP MCP endpoint

The OpenAPI description states that the API is read-only, requires no
authentication, uses `/api/v1/` plus an `X-API-Version: 1` header, and follows
additive versioning with deprecation/sunset headers. The MCP manifest declares
the server as `io.github.rohitg00/ai-engineering-from-scratch` with the remote
transport at `https://aiengineeringfromscratch.com/mcp`.

This agent layer is the most distinctive part of the architecture: the same
curriculum is a designed web page for people and a typed, searchable corpus for
agents.

---

## 7. Design system

### Type

- **Display:** VT323, a pixel/terminal face, used for the masthead, section
  headings, buttons, labels, and numeric chrome.
- **Body:** Source Serif 4, used for prose and lesson text.
- **Meta:** JetBrains Mono, used for eyebrows, captions, controls, code, and
  uppercase micro-labels (`FIG_000`, `PHASE 00`, `OPEN SOURCE · MIT`).

The pairing is deliberate: a blueprint/terminal voice for the interface, a
book-like serif for reading. Fonts load from Google Fonts with preconnect hints.

### Color and surface

| Token | Light | Dark |
| --- | --- | --- |
| `--bg` | `#fafaf5` | `#0a0d1a` |
| `--bg-surface` | `#f3f1e8` | `#131830` |
| `--ink` | `#1a1a1a` | `#e8e6dc` |
| `--ink-soft` | `#4a4a4a` | `#a8a6a0` |
| `--ink-mute` | `#7a7a78` | `#7a7878` |
| `--blueprint` | `#3553ff` | `#6b8eff` |
| `--rule` | `#1a1a1a` | `#e8e6dc` |

The light theme is warm paper; the dark theme is blueprint navy. Blueprint blue
is the single accent for links, active states, focus, bars, and figure strokes.

### Layout

- A centered `.container` with generous editorial margins.
- A dotted blueprint grid background (radial-gradient dots, not an image).
- Thin rules, square corners, and hard offset shadows (`3px 3px 0`,
  `5px 5px 0`) instead of soft elevation.
- Asymmetric hero grid: text column + 360–430 px sidebar.
- Monospace caps for metadata, serif copy for reading, pixel display for
  headings.
- Sticky/offset header with a CSS variable for the banner/header height.
- Responsive breakpoints at roughly 1280 px, 820 px, and 600 px; the hero
  collapses, the figure carousel hides its desktop-only autoplay, the header
  switches to a menu, and tap targets grow to 44 px.

### Motion

Motion tokens are short and restrained:

```css
--motion-press: 160ms;
--motion-feedback: 180ms;
--motion-enter: 220ms;
--motion-drawer: 250ms;
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

The figure plates and reveal-on-scroll effects are the main exceptions; they
use longer SVG draw/fade animations. `prefers-reduced-motion: reduce` disables
animations, makes figure elements visible immediately, hides pulses, and turns
off smooth scrolling.

### Accessibility

- Skip link to `#main`.
- Semantic landmarks (`header`, `nav`, `main`, `footer`, `aside`).
- Visible `:focus-visible` rings on controls.
- `aria-haspopup`, `aria-expanded`, `aria-controls` on menus.
- Dialog focus trap, Escape close, focus return, `aria-hidden` syncing.
- Live regions for the figure caption, copy confirmation, and the intelligence
  answer.
- `aria-current="page"` in the nav.
- Decorative SVGs are `aria-hidden`; the dial/figure has text alternatives.
- The mobile menu uses 44 px targets and a scrollable panel.

---

## 8. Performance, SEO, and operations

### Performance choices

- Static HTML for every non-dynamic page.
- No client framework, hydration, or runtime router.
- Shiki highlighting prerendered at build time.
- One generated data module, content-hashed and cached.
- CSS split between shared (`style.css`) and page-specific inline CSS, avoiding
  a large global stylesheet for every page.
- Fonts preconnected; images lazy-loaded; anatomy images get explicit
  dimensions to avoid layout shift.
- Deferred scripts for non-critical enhancers.
- `content-visibility`/IntersectionObserver-style reveal work keeps offscreen
  animation cheap.

The main performance trade-off is the ~1 MB `data.js` on the homepage. It buys
instant local search, counts, and modal rendering without an API request. On the
lesson reader, content is server-rendered so the client does not need the full
dataset.

### SEO

- Per-page `<title>`, description, canonical, Open Graph, and Twitter tags.
- JSON-LD graphs for `WebSite`, `Course`, `Person`, and lesson
  `LearningResource`.
- `hreflang` alternates for translated lessons.
- `sitemap.xml` generated from the page inventory.
- `robots.txt` and `X-Robots-Tag: noindex` for private/local pages such as
  `/highlights`.
- `llms.txt` and Markdown alternates for agent consumption.

### Caching and headers

`vercel.json` sets long-lived immutable caching for Pagefind fragments and
images, revalidation for JS/CSS, no-cache for `certification-data.js`, and
`X-Robots-Tag` on pages that should not be indexed. The content-hashed `?v=`
query strings let JS/CSS be cached aggressively while still rolling forward on
each deploy.

### Testing

The upstream GitHub Actions curriculum workflow runs a large Node test suite
against the browser modules: theme menu, overlays, TTS navigation, lesson
walkthrough, quiz placement, agent/decompiler/GPU machine simulations,
highlights, practice, projects, and more. The build is treated as a product
artifact, not an afterthought.

---

## 9. Privacy and licensing

- Learning progress, theme, language, banner dismissal, and star state are
  browser-local. No account, login, or progress server exists.
- The production page loads Vercel analytics. The clone removes it.
- Newsletter signup is delegated to Substack; the site does not store email
  addresses itself.
- The GitHub star widget calls the public GitHub API from the browser.
- Translation strings are fetched from the repository’s `translations` branch.
- Content and code are MIT licensed, © 2026 Rohit Ghumare. The full text is in
  `LICENSE`. Institution marks and logos remain their owners’ trademarks.
- The clone is for study and is not affiliated with or endorsed by the original
  project. Do not deploy it publicly with the upstream canonical metadata.

---

## 10. Clone notes and verification

### What was captured

The landing page was captured through a Chromium DevTools Protocol session with
REA:

- rendered screenshot and accessibility tree
- DOM and resource inventory
- network requests, console output, and storage keys
- twelve script sources
- a browser scenario that opened the mobile menu, theme menu, carousel, thought
  experiment, phase modal, copy button, and command palette

The live HTML, CSS, data module, fonts, logos, anatomy images, figure SVG,
favicons, and license were downloaded. The clone keeps the runtime scripts
verbatim except for the deliberate differences documented in `README.md`.

### Verification

Served with `python3 -m http.server` at `http://127.0.0.1:8765/`:

- **Pixel parity:** at 1440×1200 with reduced motion, the live screenshot and
  the clone screenshot are byte-identical:
  `f2835500c0aed04197001d511febb77a9acaeb1bc61ac5142b75ef9b76ea5344`.
  The comparison reports 0 differing pixels.
- **Theme:** menu opens, “Dark” applies `data-theme="dark"`, state persists in
  `localStorage`, and the dark token set renders correctly.
- **Figure carousel:** Next advances the caption to
  “Plate 2 of 3. The first AI-native course: …”; the SVG plate changes.
- **Ask the machine:** the card moves to `data-state="answered"` and shows
  “Define ‘here’.” / “In the meantime, build something.”
- **Phase modal:** clicking Phase 00 opens the modal with title
  “Setup & Tooling”, 13 lessons, search, and per-lesson “Mark done” controls.
- **Copy:** the terminal copy button shows the `copied` state.
- **Command palette:** opens with `class="cp-open"`, `aria-hidden="false"`, the
  expected combobox/listbox roles, and the summary “Search 542 lessons, 13
  focused learning paths, 526 outputs, and 250 glossary terms.”
- **Mobile:** at 390×844 the layout collapses correctly and the menu exposes all
  navigation links with 44 px targets.

The only console error is the expected Pagefind 404 described in `README.md`.

### Why the clone is landing-only

The lesson reader, certification renderer, MCP server, and Pagefind index are
serverless/generation-time features. Rebuilding them would mean shipping the
entire curriculum Markdown tree and a Node runtime. The clone therefore keeps
the landing page self-contained and points those routes at the canonical site
through `clone.js`.

### Files of interest

- `index.html` — captured landing markup and page CSS
- `style.css` — shared design system
- `app.js` / `header.js` — homepage and shell behavior
- `data.js` — generated curriculum snapshot
- `clone.js` — local-only route adapter
- `evidence/` — screenshots and interaction checks
- `LICENSE` — upstream MIT license
