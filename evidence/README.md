# Evidence

Verification artifacts for the landing-page clone. Captured on 2026-11-10 with
Chromium 155 and REA 6.8.0. The clone was served at
`http://127.0.0.1:8765/`.

| File | What it shows |
| --- | --- |
| `original-home.png` | Live site, 1440×1200, reduced motion |
| `clone-home.png` | Local clone, same viewport and settings |
| `clone-menu.png` | Header menu open at 1440 px |
| `clone-theme-menu.png` | Theme menu open (system / light / dark) |
| `clone-dark.png` | Dark theme applied, menu closed, carousel advanced |
| `clone-ask.png` | “Ask the machine” answered, dark theme, copy feedback |
| `clone-modal.png` | Phase 00 modal with lesson search and progress controls |
| `clone-palette.png` | Command palette open over the dark landing page |
| `clone-mobile.png` | 390×844 layout |
| `clone-mobile-menu.png` | Mobile navigation open |

`original-home.png` and `clone-home.png` are byte-identical:

```text
f2835500c0aed04197001d511febb77a9acaeb1bc61ac5142b75ef9b76ea5344
```

That equality was produced with reduced motion so the figure animations cannot
freeze at different frames. `interaction-checks.json` records the individual
functional checks and the one expected console message (the missing Pagefind
bundle).
