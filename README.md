# skills-overview-kit

Single source of truth for the design system + reusable JS behind the four
auto-updating skills overview sites:

| Site | Domain | Brand |
|------|--------|-------|
| gstack | gstack-status.vercel.app | blue |
| compound-engineering | compound-status.vercel.app | green |
| marketing skills | marskills.vercel.app | pink |
| my skills | (personal) | violet |

Each site repo pulls this kit in as a git submodule at `kit/` and runs
`node kit/build/assemble.mjs` to produce a **fully self-contained `index.html`**
(all CSS/JS inlined, no runtime dependency beyond Google Fonts). Edit the design
once here; every site rebuilds.

## What's in the kit

- `theme.css` — all design tokens (dark default + `[data-theme="light"]`) and every
  shared component's CSS. Brand hue is injected per-site via `--accent`; the
  semantic `--c-*` scale (workflow stages / categories) is stable everywhere.
- `js/reveal.js` — scroll-in animation.
- `js/theme-toggle.js` — light/dark toggle (localStorage + `prefers-color-scheme`).
- `js/catalog.js` — searchable, filterable card grid from `window.__CATALOG__`.
- `js/engine.js` — interactive "what's my next move" graph from `window.__ENGINE__`.
- `build/assemble.mjs` — the only writer of `index.html`.

## A site repo

```
<site>/
  kit/                 # this repo, as a submodule
  site.json            # config (below)
  template.html        # page skeleton with directives
  version.json         # stamped values (written by update-doc.mjs / scan-skills.mjs)
  data/
    catalog.json       # cats + per-skill meta (category + description) — hand-authored
    skills.json        # live versions {name:{v,u}}  OR  full records [{name,v,u,cat,d,lib,repo}]
    engine.json        # optional: stages/cmds/order/start for the next-move graph
    overlaps.json      # optional: cross-library routing rows
    recipes.json       # optional: multi-skill recipe chains
  scripts/update-doc.mjs   # fetches upstream version + writes version.json + data/skills.json
  index.html           # BUILD ARTIFACT — never hand-edit; assemble.mjs owns it
```

### template.html directives

- `{{KEY}}` — token from context (NAME, VERSION, VERSION_PILL, UPDATED, CHECKED,
  COUNT, HEADLINE, WHATSNEW_HREF, WHATSNEW_ARROW, REPO_URL, REPO_LABEL, DOMAIN, YEAR…)
- `<!--@head-theme-->` — no-flash theme boot (put in `<head>`, first thing)
- `<!--@style-->` — `<style>` with theme.css + brand overrides
- `<!--@component:nav-->` `<!--@component:footer-->` `<!--@component:family-->`
  `<!--@component:overlap-->` `<!--@component:recipes-->`
- `<!--@scripts-->` — data globals + selected modules, inlined (put before `</body>`)

Anything else in `template.html` is bespoke per-site content (the engine section
markup, stage references, install blocks, etc.).

### site.json (shape)

```json
{
  "id": "marketing",
  "name": "marketing skills",
  "brandMark": "◆",
  "title": "marketing skills — the full library, always current",
  "metaDescription": "…",
  "brand": { "accent": "#f472b6", "accentSoft": "#f472b622", "accentLine": "#7a3a5c",
             "accentPillBg": "#241019", "accentPillLine": "#5a2740",
             "accentPillBgLight": "#fde8f2", "accentPillLineLight": "#f6c9de" },
  "navLinks": [{ "href": "#skills", "label": "▸ Browse skills", "hot": true }],
  "modules": ["catalog"],
  "whatsNewHref": "https://github.com/…/VERSIONS.md",
  "whatsNewArrow": "versions →",
  "repo": { "url": "https://github.com/…", "label": "github.com/…" },
  "domain": "marskills.vercel.app",
  "license": "MIT",
  "autoNote": "auto-checks daily at 5pm CT",
  "footerBig": "Marketing, as a skill set.",
  "footerNote": "…",
  "siblings": [
    { "id": "gstack", "name": "gstack", "url": "https://gstack-status.vercel.app",
      "domain": "gstack-status.vercel.app", "color": "#6ea8ff",
      "blurb": "AI engineering team as slash commands." }
  ]
}
```

## Build

```
git submodule update --init           # in a site repo
node kit/build/assemble.mjs           # writes index.html for the cwd site
```

The GitHub Action (or local launchd job for my-skills) runs
`node scripts/update-doc.mjs` (fetch upstream → version.json + data/skills.json)
then `node kit/build/assemble.mjs`, commits, and pushes — the commit is the
Vercel deploy trigger (there is no deploy hook).
