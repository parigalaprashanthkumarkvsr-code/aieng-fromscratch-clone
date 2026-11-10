# AI Engineering from Scratch — landing page study clone

A local, static reconstruction of the landing page at
<https://aiengineeringfromscratch.com/>, built to study and reuse its UI,
content model, and vanilla-JS runtime. It is not affiliated with the original
project or its maintainers.

The production site is MIT-licensed. The upstream source is
[`rohitg00/ai-engineering-from-scratch`](https://github.com/rohitg00/ai-engineering-from-scratch).
The snapshot used here is commit `8c09d89` (2026-11-09).

## Run it

No build step, package manager, or server code is required.

```bash
cd /home/johnny/Projects/aieng-fromscratch-clone
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765/>.

Serving over HTTP is recommended. The site also loads from `file://`, but the
command palette and some fetch-based enhancers expect an origin.

## What is included

- The complete landing page: banner, header, hero, thought-experiment card,
  figure carousel, preface, newsletter strip, three machine features, learning
  paths, statistics, 20-phase table of contents, phase modal, books,
  certification spotlight, colophon, footer, and reader marquee.
- The production CSS, page-specific inline CSS, and all twelve scripts captured
  from the landing page.
- A 2026-11-09 snapshot of `data.js`: 542 lessons, 20 phases, 13 learning paths,
  250 glossary terms, and 526 reusable outputs.
- Local copies of the logos, anatomy images, favicons, and the learning-path
  figure.
- Real interactions:
  - responsive navigation and mobile menu
  - three-mode theme menu (system / light / dark), persisted in `localStorage`
  - dismissible announcement banner, persisted
  - figure carousel with autoplay, arrows, dots, keyboard access, and reduced
    motion support
  - “Ask the machine” deterministic replies
  - phase modal with lesson search, local progress, “mark done”, and reset
  - copy buttons with `copied` feedback
  - `⌘K` / `Ctrl+K` command palette over lessons, phases, glossary, and learning
    paths
  - GitHub star count with a ten-minute local cache
  - newsletter form delegation to the upstream Substack publication
  - language picker and UI translation fetches (network required)

## Deliberate differences from production

| Difference | Why |
| --- | --- |
| Vercel analytics script removed | No third-party telemetry from a study copy. |
| Favicons use relative paths | Works from `file://` and from any subdirectory. |
| `clone.js` added | Routes that only exist on the production site are pointed at `https://aiengineeringfromscratch.com` so the clone has no dead local links. In-page anchors stay local. |
| No `/lesson`, `/certification`, `/api/*`, `/mcp`, or Pagefind index | Those are Vercel functions or generated indexes, not part of the landing snapshot. Lesson, certification, API, and secondary-page links open the canonical site. |
| No production headers/rewrites | The clone is plain static files; `vercel.json` is not reproduced. |
| Canonical and social metadata still point upstream | Correct attribution and no attempt to pass the copy off as the original. Do not deploy this publicly without changing them. |

One expected console message remains: focusing the command palette imports
`/pagefind/pagefind.js`, which is absent in the clone, so the browser logs a 404.
In-page search over lessons, phases, paths, and glossary still works because
`cmdpalette.js` builds that index from `data.js`. Only the Pagefind-backed
results for secondary pages are unavailable.

## Files

```
index.html                 landing page markup + page-specific CSS
style.css                  site-wide design system and layout
intelligence-check.css     thought-experiment card
newsletter.css             newsletter strip injected by header.js
app.js                     theme bootstrap, stats, TOC, modal, copy, carousel
header.js                  banner, responsive nav, stars, module loader
theme-menu.js              system/light/dark menu
cmdpalette.js              command palette and local search index
progress.js                local-only progress store (v2 + v1 migration)
tts.js                     Web Speech narration
ui-i18n.js                 UI translation loader
lang-picker.js             language picker behavior
langs.js                   generated language list
newsletter.js              Substack signup form
star-nudge.js              GitHub star prompt
intelligence-check.js      “Ask the machine” widget
data.js                    generated curriculum/glossary/artifact snapshot
clone.js                   local-clone-only route adapter
logos/ anatomy/ assets/    local images and marks
favicon.* apple-touch-icon.png
LICENSE                    upstream MIT license
REPORT.md                  architecture and reverse-engineering notes
evidence/                  screenshots and interaction checks
```

## Data snapshot

`data.js` is generated upstream by `site/build.js`; it should not be hand-edited.

| Global | Contents |
| --- | --- |
| `PHASES` | 20 phases; each has `id`, `name`, `status`, `desc`, `lessons`, `hub` |
| `ROADMAP_PREREQS` | Phase prerequisite DAG keyed by phase id |
| `LEARNING_PATHS` | 13 structured paths with checkpoints, prerequisites, and metadata |
| `GLOSSARY` | 250 terms with definitions, categories, and source links |
| `GLOSSARY_CATEGORY_ORDER` | Display order for glossary categories |
| `ARTIFACTS` | 526 reusable prompts, skills, agents, and other outputs |

Each lesson record has `name`, `status`, `type`, `lang`, `url`, `summary`, and
`keywords`. The `url` points at the canonical lesson source in GitHub; the site
derives lesson paths from it when opening the lesson reader.

## Attribution and license

Original code, content, and design: © 2026 Rohit Ghumare and contributors,
MIT licensed. The full license text is in [`LICENSE`](LICENSE).

Institution names and logos remain trademarks of their owners and are used here
only to reproduce the page for study. This repository is not endorsed by the
original project, its maintainers, or any institution shown on the page.

See [`REPORT.md`](REPORT.md) for the full architecture write-up and
[`evidence/`](evidence/) for the verification screenshots.
