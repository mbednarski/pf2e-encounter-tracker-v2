# Cloudflare Pages Deployment + SEO Baseline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `pf2etracker.app` (apex) production-deployable via Cloudflare Pages with auto preview URLs for every branch, ship the SEO surface so the site is indexable and link-previewable, and remove all manual-deploy paths.

**Architecture:** SvelteKit `adapter-static` (already in place) emits prerendered HTML. Cloudflare Pages Git integration runs the full pre-PR gate on every push and serves the `build/` directory. CI/CD is the single deploy path — no local `wrangler` deploy. SEO surface is plain `<svelte:head>` in a new root layout plus static `robots.txt` / `sitemap.xml` / icon files.

**Tech Stack:** SvelteKit 2 (Svelte 4 syntax style despite Svelte 5 install), TypeScript strict, Vite 8, Vitest 4, `@testing-library/svelte` + jsdom, `@sveltejs/adapter-static`, Cloudflare Pages.

**Source spec:** `docs/superpowers/specs/2026-05-03-cloudflare-deployment-design.md` — read it first if anything in this plan looks underspecified.

---

## File structure

| Path | Status | Responsibility |
|---|---|---|
| `static/robots.txt` | modify | Permit crawlers, point at sitemap |
| `static/_headers` | delete | Was setting `noindex,nofollow`; no longer wanted |
| `static/sitemap.xml` | new | Two-URL hand-rolled sitemap |
| `static/favicon.svg` | new | Single-color d20 outline; primary favicon |
| `static/apple-touch-icon.png` | new | 180×180 PNG version of favicon |
| `static/og-image.svg` | new | Source SVG for the OG card (1200×630) |
| `static/og-image.png` | new | Rendered PNG of og-image.svg (Twitter/Discord need raster) |
| `src/app.html` | modify | Add `theme-color`, Cloudflare Web Analytics beacon placeholder |
| `src/routes/+layout.svelte` | new | Root layout with SEO `<svelte:head>` (title/description/OG/Twitter/canonical/icons) |
| `src/routes/layout.test.ts` | new | Verify `<svelte:head>` outputs the expected tags |
| `package.json` | modify | Remove `deploy:pages` script; remove `wrangler` devDependency |
| `package-lock.json` | modify | Auto-regenerated when `wrangler` is removed |
| `docs/cloudflare-pages.md` | modify | Delete "Manual Deploy" section; expand setup, custom domain, www redirect, analytics, rollback, OG re-render command |

---

## Pre-flight (one-off before tasks start)

- [ ] **Confirm starting state**

Run:
```powershell
git status
git branch --show-current
```

Expected: working tree clean (or only `.claude/scheduled_tasks.lock` untracked); current branch is `deploy/cloudflare-pages-setup`. The spec commit `Add Cloudflare deployment + SEO baseline design spec` should be the latest commit on this branch.

If on `master` or a different branch, switch with `git checkout deploy/cloudflare-pages-setup`. If the branch doesn't exist, the spec wasn't committed correctly and the plan should not be executed yet.

- [ ] **Confirm full pre-PR gate is green right now**

Run:
```powershell
npm run check
npm run test:run
npm run audit
npm run build
```

Each must succeed before any task begins. If anything fails, that's a pre-existing problem to surface to the user — do not start the plan with a red baseline.

---

## Task 1: Flip crawler signals (robots.txt + remove noindex)

**Why:** `static/robots.txt` currently disallows all crawlers and `static/_headers` ships `X-Robots-Tag: noindex, nofollow` on every response. Both must flip before any other SEO work means anything.

**Files:**
- Modify: `static/robots.txt`
- Delete: `static/_headers`

- [ ] **Step 1: Rewrite `static/robots.txt`**

Replace the entire file with:

```
User-agent: *
Allow: /
Sitemap: https://pf2etracker.app/sitemap.xml
```

(Trailing newline at end of file.)

- [ ] **Step 2: Delete `static/_headers`**

The file currently contains only the `noindex,nofollow` block. Delete the entire file.

```powershell
Remove-Item static\_headers
```

If anything else has been added to `_headers` since this plan was written, do not delete the file — instead, edit it to remove only the `X-Robots-Tag: noindex, nofollow` line and the `/*` rule that scopes it. Re-check via `git diff` that no other rules are lost.

- [ ] **Step 3: Build to confirm no breakage and that robots.txt is in the build output**

Run:
```powershell
npm run build
```
Expected: build succeeds. After build, verify:
```powershell
Get-Content build\robots.txt
```
should print the new permissive content. The file `build\_headers` should not exist (or, if `_headers` was edited rather than deleted, it should no longer contain `X-Robots-Tag`).

- [ ] **Step 4: Commit**

```powershell
git add static/robots.txt static/_headers
git commit -m "Allow crawlers and remove noindex header"
```

(`git add static/_headers` correctly stages the deletion in git.)

---

## Task 2: Add static sitemap.xml

**Files:**
- Create: `static/sitemap.xml`

- [ ] **Step 1: Create `static/sitemap.xml`**

Contents:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://pf2etracker.app/</loc></url>
  <url><loc>https://pf2etracker.app/settings</loc></url>
</urlset>
```

(Trailing newline.)

- [ ] **Step 2: Build to confirm sitemap is in build output**

Run:
```powershell
npm run build
Get-Content build\sitemap.xml
```

Expected: the XML above is printed verbatim.

- [ ] **Step 3: Validate the XML is well-formed**

Run:
```powershell
[xml](Get-Content build\sitemap.xml -Raw)
```
Expected: prints the parsed XML object without error. If it errors with a parse exception, the file is malformed — fix and retry.

- [ ] **Step 4: Commit**

```powershell
git add static/sitemap.xml
git commit -m "Add sitemap.xml listing prerendered routes"
```

---

## Task 3: Hand-author favicon and OG image SVG sources

**Why:** PNG renders depend on the SVGs, so the SVGs come first. The favicon SVG doubles as the source for the apple-touch-icon raster.

**Files:**
- Create: `static/favicon.svg`
- Create: `static/og-image.svg`

- [ ] **Step 1: Create `static/favicon.svg`**

Minimal d20 silhouette — single-color, scales cleanly, ~700 bytes:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="PF2e Encounter Tracker">
  <rect width="64" height="64" rx="10" fill="#0b1020"/>
  <g fill="none" stroke="#e8ecff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
    <polygon points="32,8 56,22 56,42 32,56 8,42 8,22"/>
    <polyline points="32,8 32,28 56,42"/>
    <polyline points="32,28 8,42"/>
    <line x1="32" y1="28" x2="32" y2="56"/>
  </g>
  <text x="32" y="34" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="700" fill="#e8ecff">20</text>
</svg>
```

(Trailing newline.)

- [ ] **Step 2: Create `static/og-image.svg`**

1200×630 OG card, dark background, title + tagline. Deliberately plain — easy to replace later with real artwork.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1020"/>
      <stop offset="100%" stop-color="#1a2040"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g transform="translate(120 180)" fill="none" stroke="#e8ecff" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
    <polygon points="120,0 240,70 240,200 120,270 0,200 0,70"/>
    <polyline points="120,0 120,100 240,200"/>
    <polyline points="120,100 0,200"/>
    <line x1="120" y1="100" x2="120" y2="270"/>
  </g>
  <text x="440" y="290" font-family="ui-sans-serif, system-ui, sans-serif" font-size="76" font-weight="800" fill="#e8ecff">PF2e Encounter Tracker</text>
  <text x="440" y="360" font-family="ui-sans-serif, system-ui, sans-serif" font-size="32" font-weight="500" fill="#a8b3d9">Initiative · conditions · effects · turn prompts</text>
  <text x="440" y="410" font-family="ui-sans-serif, system-ui, sans-serif" font-size="26" font-weight="400" fill="#7d89b3">Free · browser-only · no account</text>
</svg>
```

(Trailing newline.)

- [ ] **Step 3: Open both SVGs in a browser to sanity-check**

```powershell
start static\favicon.svg
start static\og-image.svg
```

The favicon should render as a small d20 with "20" inside. The OG image should render at 1200×630 with the title and taglines clearly readable. If text is clipped or positioning is off, fix the XML before proceeding to PNG render.

- [ ] **Step 4: Commit**

```powershell
git add static/favicon.svg static/og-image.svg
git commit -m "Add favicon and OG image SVG sources"
```

---

## Task 4: Render the PNG icons (apple-touch-icon + og-image)

**Why:** Twitter, Discord, iMessage, and several other link-preview surfaces don't accept SVG as `og:image`; iOS home-screen icons require PNG. We commit the rendered PNGs and re-render only when the SVG sources change. No permanent build dep is added (per spec discipline).

**Files:**
- Create: `static/apple-touch-icon.png` (180×180 PNG, rendered from `favicon.svg`)
- Create: `static/og-image.png` (1200×630 PNG, rendered from `og-image.svg`)

- [ ] **Step 1: Render `apple-touch-icon.png` from `favicon.svg` at 180×180**

Run:
```powershell
npx --yes @resvg/resvg-js-cli static/favicon.svg --width 180 --height 180 --output static/apple-touch-icon.png
```

Expected: file appears at `static/apple-touch-icon.png`. Open it (`start static\apple-touch-icon.png`) to verify it looks like the favicon.

If `@resvg/resvg-js-cli` doesn't exist on npm or fails to run, fall back to:
```powershell
npx --yes sharp-cli -i static/favicon.svg -o static/apple-touch-icon.png --resize 180 180
```
Pick whichever works. Do NOT install either as a project dependency — `npx --yes` runs them ephemerally.

- [ ] **Step 2: Render `og-image.png` from `og-image.svg` at 1200×630**

Run:
```powershell
npx --yes @resvg/resvg-js-cli static/og-image.svg --width 1200 --height 630 --output static/og-image.png
```

(Same fallback to `sharp-cli` if needed.)

Verify by opening `static\og-image.png` in an image viewer — title should be sharp, dark background readable, no clipped text. If the SVG looks fine in a browser but the PNG render is missing text or misaligned, the renderer probably doesn't support a font or feature — try the fallback tool.

- [ ] **Step 3: Sanity-check file sizes**

Run:
```powershell
Get-Item static\apple-touch-icon.png, static\og-image.png | Select-Object Name, Length
```

Expected: `apple-touch-icon.png` is small (a few KB to ~20 KB). `og-image.png` should be in the 30–200 KB range. If `og-image.png` is megabytes large, it's likely PNG-encoded with no compression — that's fine functionally but worth flagging; a follow-up could squeeze it. If either file is 0 bytes, the render failed silently — re-run the command and inspect stderr.

- [ ] **Step 4: Commit**

```powershell
git add static/apple-touch-icon.png static/og-image.png
git commit -m "Render apple-touch-icon and og-image PNGs from SVG sources"
```

The exact `npx` command used is recorded in `docs/cloudflare-pages.md` later (Task 9) so future re-renders are reproducible.

---

## Task 5: Add SEO root layout (with tests)

**Why:** The `+layout.svelte` is the single source of truth for site-wide head tags — title, description, canonical, Open Graph, Twitter Card, icons. Per-route `<svelte:head>` blocks override individual tags later as needed. Tests verify the head actually contains these tags after render.

**Files:**
- Create: `src/routes/+layout.svelte`
- Create: `src/routes/layout.test.ts`

- [ ] **Step 1: Write the failing test first**

Create `src/routes/layout.test.ts` with:

```ts
import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import Layout from './+layout.svelte';

function metaContent(name: string): string | null {
  const el = document.head.querySelector(`meta[name="${name}"]`);
  return el?.getAttribute('content') ?? null;
}

function ogContent(property: string): string | null {
  const el = document.head.querySelector(`meta[property="${property}"]`);
  return el?.getAttribute('content') ?? null;
}

describe('root layout — SEO head tags', () => {
  test('sets the document title to the site default', () => {
    render(Layout);
    expect(document.title).toBe('PF2e Encounter Tracker');
  });

  test('sets a meta description that mentions Pathfinder 2e', () => {
    render(Layout);
    const description = metaContent('description');
    expect(description).not.toBeNull();
    expect(description!.toLowerCase()).toContain('pathfinder');
  });

  test('sets a canonical link', () => {
    render(Layout);
    const link = document.head.querySelector('link[rel="canonical"]');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toMatch(/^https:\/\/pf2etracker\.app/);
  });

  test('sets Open Graph title, description, type, url, and image', () => {
    render(Layout);
    expect(ogContent('og:title')).toBe('PF2e Encounter Tracker');
    expect(ogContent('og:description')).not.toBeNull();
    expect(ogContent('og:type')).toBe('website');
    expect(ogContent('og:url')).toMatch(/^https:\/\/pf2etracker\.app/);
    expect(ogContent('og:image')).toBe('https://pf2etracker.app/og-image.png');
  });

  test('sets Twitter Card meta as summary_large_image', () => {
    render(Layout);
    const card = document.head.querySelector('meta[name="twitter:card"]');
    expect(card?.getAttribute('content')).toBe('summary_large_image');
  });

  test('links the SVG favicon and apple-touch-icon', () => {
    render(Layout);
    const svgIcon = document.head.querySelector('link[rel="icon"][type="image/svg+xml"]');
    expect(svgIcon?.getAttribute('href')).toBe('/favicon.svg');
    const apple = document.head.querySelector('link[rel="apple-touch-icon"]');
    expect(apple?.getAttribute('href')).toBe('/apple-touch-icon.png');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run:
```powershell
npx vitest run src/routes/layout.test.ts
```

Expected: FAIL — Vitest can't resolve `./+layout.svelte` (file does not exist yet).

- [ ] **Step 3: Implement `src/routes/+layout.svelte`**

Create the file with:

```svelte
<script lang="ts">
  import { page } from '$app/stores';

  const SITE_TITLE = 'PF2e Encounter Tracker';
  const SITE_DESCRIPTION =
    'Browser-based encounter tracker for Pathfinder 2nd Edition. Track initiative, conditions, effects, and turn prompts. Free, runs entirely in your browser, no account required.';
  const SITE_ORIGIN = 'https://pf2etracker.app';
  const OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;

  $: pathname = $page?.url?.pathname ?? '/';
  $: canonicalUrl = `${SITE_ORIGIN}${pathname}`;
</script>

<svelte:head>
  <title>{SITE_TITLE}</title>
  <meta name="description" content={SITE_DESCRIPTION} />
  <link rel="canonical" href={canonicalUrl} />

  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

  <meta property="og:site_name" content={SITE_TITLE} />
  <meta property="og:title" content={SITE_TITLE} />
  <meta property="og:description" content={SITE_DESCRIPTION} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={OG_IMAGE} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={SITE_TITLE} />
  <meta name="twitter:description" content={SITE_DESCRIPTION} />
  <meta name="twitter:image" content={OG_IMAGE} />
</svelte:head>

<slot />
```

Notes for the implementer:
- This file uses Svelte 4 syntax (`$: ...` reactive declarations, `<slot />`) to match the rest of the codebase, even though Svelte 5 runes are available.
- `$page` is the SvelteKit page store. Under prerender, `pathname` is resolved per-route at build time, so each route's prerendered HTML carries a route-correct canonical URL.
- The `?? '/'` fallback handles standalone test rendering where `$page.url` may be undefined.

- [ ] **Step 4: Run the test to confirm it passes**

Run:
```powershell
npx vitest run src/routes/layout.test.ts
```

Expected: all 6 tests pass. If any fail, do not move on — debug them first. Common causes:
- Test runs in a stale jsdom that already has prior test's head tags. Confirm tests are isolated; each `render(Layout)` should produce fresh head content.
- `$page` store throws because no SvelteKit context. The `?? '/'` fallback in the layout handles this.

- [ ] **Step 5: Run the full check + test suite to confirm nothing else regressed**

Run:
```powershell
npm run check
npm run test:run
```

Expected: both pass. `npm run check` validates that `+layout.svelte` is type-correct under the project's strict TypeScript + svelte-check config.

- [ ] **Step 6: Run the build and inspect the prerendered HTML**

Run:
```powershell
npm run build
Get-Content build\index.html
```

Expected: the printed HTML contains `<title>PF2e Encounter Tracker</title>`, `<meta name="description" content="...Pathfinder...">`, `<link rel="canonical" href="https://pf2etracker.app/">`, the OG and Twitter tags, and both icon link tags.

If the canonical href is `https://pf2etracker.app//` (double slash) or otherwise wrong, fix the path concatenation in the layout before proceeding.

- [ ] **Step 7: Commit**

```powershell
git add src/routes/+layout.svelte src/routes/layout.test.ts
git commit -m "Add SEO root layout with title, meta, OG, and Twitter tags"
```

---

## Task 6: Update `src/app.html` (theme-color + analytics placeholder)

**Why:** `theme-color` controls the browser chrome color on mobile. The Cloudflare Web Analytics beacon snippet needs a token that doesn't exist yet — leave a placeholder comment so a follow-up PR can drop in the real token without restructuring.

**Files:**
- Modify: `src/app.html`

- [ ] **Step 1: Edit `src/app.html`**

Replace the file contents with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0b1020" />
    <!--
      Cloudflare Web Analytics beacon goes here once the site token is generated.
      Replace this comment with the snippet copied from the Cloudflare dashboard:
      <script defer src="https://static.cloudflareinsights.com/beacon.min.js"
        data-cf-beacon='{"token": "REPLACE_ME"}'></script>
    -->
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div>%sveltekit.body%</div>
  </body>
</html>
```

Note: `theme-color` lives in `app.html` (not `+layout.svelte`) because it's site-wide and there's no need to make it route-overridable.

- [ ] **Step 2: Build and inspect**

Run:
```powershell
npm run build
Get-Content build\index.html
```

Expected: the rendered HTML contains the theme-color meta tag and the analytics-placeholder HTML comment. The placeholder comment is intentionally visible in the prerendered HTML; that's a feature, not a leak — it tells anyone view-sourcing the site that analytics is intentionally absent until configured.

- [ ] **Step 3: Run the full pre-PR gate to confirm no regressions**

Run:
```powershell
npm run check
npm run test:run
npm run audit
npm run build
```

All four must succeed.

- [ ] **Step 4: Commit**

```powershell
git add src/app.html
git commit -m "Add theme-color and Cloudflare Web Analytics placeholder to app.html"
```

---

## Task 7: Remove the `deploy:pages` script and `wrangler` devDependency

**Why:** Per the spec's CI/CD discipline, the only deploy path is push → Cloudflare Pages Git integration. Local `wrangler` and the `deploy:pages` script are dead weight that would invite gate-bypass under pressure. Removing them eliminates the foot-gun.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (regenerated)

- [ ] **Step 1: Remove the `deploy:pages` script from `package.json`**

Edit `package.json`. Delete the line:

```json
"deploy:pages": "npm run build && wrangler pages deploy build --project-name pf2e-tracker-v2"
```

(And the trailing comma on the `audit:low` line above it, since it was the last script.)

After edit, the `scripts` block should be:

```json
"scripts": {
  "dev": "vite dev",
  "build": "vite build",
  "preview": "vite preview",
  "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json && tsc -p tsconfig.domain.json --noEmit",
  "test:run": "vitest run",
  "audit": "npm audit --audit-level=moderate",
  "audit:low": "npm audit --audit-level=low"
}
```

- [ ] **Step 2: Remove `wrangler` from devDependencies**

In the same `package.json`, delete the line:

```json
"wrangler": "^4.86.0"
```

(And the trailing comma adjustment as needed.)

- [ ] **Step 3: Regenerate `package-lock.json`**

Run:
```powershell
npm install
```

This prunes `wrangler` and its transitive deps from the lockfile. Verify:

```powershell
Select-String -Path package-lock.json -Pattern '"wrangler"' -SimpleMatch
```

Expected: no matches in `package-lock.json`. If matches remain, something else still depends on it (unlikely) — investigate before continuing.

- [ ] **Step 4: Confirm full pre-PR gate still passes after dep removal**

Run:
```powershell
npm run check
npm run test:run
npm run audit
npm run build
```

All four must succeed. The `audit` step matters specifically here — removing a dep could (in theory) reveal vulnerabilities that were previously masked or shift transitive resolutions.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json
git commit -m "Remove wrangler and deploy:pages script (CI/CD is the only deploy path)"
```

---

## Task 8: Update `docs/cloudflare-pages.md` with the full setup playbook

**Why:** The Cloudflare dashboard configuration cannot live in the repo as code, but it has to be reproducible. Future-you needs to know how to set up the Pages project, attach the apex domain, configure the www→apex redirect, enable analytics, and roll back. The existing doc has only a stub.

**Files:**
- Modify: `docs/cloudflare-pages.md`

- [ ] **Step 1: Replace the entire contents of `docs/cloudflare-pages.md`**

Write the full playbook:

```markdown
# Cloudflare Pages Deployment

This project deploys as static assets to Cloudflare Pages. Production lives at `https://pf2etracker.app`. Every non-`master` branch produces an automatic preview deployment.

## Free-Service Constraint

V2 must remain browser-only unless the architecture changes explicitly. The deployable app does not require:

- Pages Functions
- Workers
- KV
- D1
- R2
- Workers AI
- Cloudflare-hosted secrets or server storage

User data lives in browser storage (IndexedDB). LLM parsing calls go directly from the browser to the provider using the user's own API key (see architecture spec).

## Deploy path

CI/CD is the **only** deploy path. There is no local `wrangler pages deploy` escape hatch — `wrangler` has been removed from `devDependencies` and the `deploy:pages` script has been removed from `package.json` on purpose. Emergency rollback uses Cloudflare's "Rollback to this deployment" button, not a local deploy.

When code is pushed to GitHub:
- Push to `master` → Cloudflare builds and deploys to `https://pf2etracker.app`.
- Push to any other branch → Cloudflare builds and deploys a preview at `https://<sanitized-branch>.pf2e-tracker-v2.pages.dev`. PRs get an automatic Cloudflare bot comment with the URL.

In parallel, GitHub Actions CI (`.github/workflows/ci.yml`) runs the same gate as a PR mergeability check. Both run `npm run check && npm run test:run && npm run audit && npm run build`.

## One-time Cloudflare dashboard setup

Run these once to wire the project up. Subsequent deploys are automatic.

### 1. Create the Pages project

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Select the GitHub repository.
3. Set:
   - **Project name:** `pf2e-tracker-v2`
   - **Production branch:** `master`
   - **Build command:** `npm run check && npm run test:run && npm run audit && npm run build`
   - **Build output directory:** `build`
   - **Root directory:** repository root
   - **Environment variables:** `NODE_VERSION=22`
4. Preview deployments: leave Cloudflare's default (all non-production branches deploy as previews).
5. Save and trigger the first build.

### 2. Attach the apex custom domain

1. Project → Custom domains → Add custom domain → `pf2etracker.app`.
2. Cloudflare auto-creates the DNS record (CNAME with flattening, since `pf2etracker.app` is on Cloudflare Registrar).
3. Wait until both:
   - The custom domain shows status **Active** in the Pages dashboard, AND
   - `https://pf2etracker.app` loads in a browser with a valid TLS certificate (no warning).

Only then is step 2 complete.

### 3. Configure www → apex redirect

`www.pf2etracker.app` is intentionally not attached as a second Pages hostname (that would split SEO signals across two URLs). Instead, redirect it.

1. Domain `pf2etracker.app` → Rules → Redirect Rules → Create rule.
2. **When:** `(http.host eq "www.pf2etracker.app")`
3. **Then:** Dynamic redirect, status 301, target expression:
   `concat("https://pf2etracker.app", http.request.uri.path)`
4. Save and verify by visiting `https://www.pf2etracker.app/settings` — it should 301 to `https://pf2etracker.app/settings`.

### 4. Enable Cloudflare Web Analytics

1. Cloudflare dashboard → Analytics & Logs → Web Analytics → Add a site.
2. Hostname: `pf2etracker.app`.
3. Copy the JS snippet shown — it includes a site token.
4. Open `src/app.html` in this repo. Locate the `<!-- Cloudflare Web Analytics beacon goes here ... -->` comment. Replace the comment with the actual snippet.
5. Commit, push, let it deploy.
6. Visit the live site, then return to the Web Analytics dashboard — the visit should appear within a few minutes.

The site token is public-facing (it's literally embedded in the HTML), so committing it to the repo is intentional, not a leak.

## Rollback

To roll back a bad deploy:

1. Cloudflare dashboard → Pages → `pf2e-tracker-v2` → Deployments tab.
2. Find the last known-good deployment.
3. Click ⋯ → "Rollback to this deployment".
4. Cloudflare creates a new deployment record pointing at the older build artifact. Live traffic shifts within ~30 seconds.
5. The next push to `master` deploys forward again from current HEAD.

If CI is broken on `master`, the platform rollback is the right tool — fix-forward through CI is the only path to deploy new changes; there is no local-deploy fallback.

## Re-rendering OG image / apple-touch-icon PNGs

The PNG files in `static/` are committed renders of their SVG sources. Re-render them whenever the SVG changes:

```powershell
npx --yes @resvg/resvg-js-cli static/favicon.svg --width 180 --height 180 --output static/apple-touch-icon.png
npx --yes @resvg/resvg-js-cli static/og-image.svg --width 1200 --height 630 --output static/og-image.png
```

If `@resvg/resvg-js-cli` is unavailable, the fallback is `npx --yes sharp-cli`. Neither is added to `devDependencies` — both run ephemerally via `npx`, on purpose, to avoid a permanent build dep for one image.

## Verification checklist (after a deploy)

After production deploys, sanity-check:

- `https://pf2etracker.app/` loads, shows the tracker.
- `https://www.pf2etracker.app/` 301-redirects to apex.
- `https://pf2etracker.app/robots.txt` → `Allow: /` and the sitemap line.
- `https://pf2etracker.app/sitemap.xml` → valid XML listing both routes.
- View-source on the homepage shows: `<title>`, `<meta name="description">`, OG tags, Twitter Card tags, canonical link, theme-color, both icon link tags.
- Cloudflare Web Analytics dashboard shows page views from a manual visit.
- Pushing to a feature branch produces a preview URL within ~3 minutes; PRs get a Cloudflare bot comment.
- Rollback drill: deploy a no-op commit, click "Rollback to this deployment" on the previous one, verify revert within ~30 seconds.
```

(Note: the implementer should literally replace the existing `docs/cloudflare-pages.md` contents with the markdown above. The fenced code block above ends after the verification checklist; everything inside the fence is the new file content.)

- [ ] **Step 2: Run build to confirm docs change doesn't affect anything**

Run:
```powershell
npm run build
```

Expected: succeeds (the docs change is purely informational; just confirming the gate didn't break).

- [ ] **Step 3: Commit**

```powershell
git add docs/cloudflare-pages.md
git commit -m "Document full Cloudflare Pages dashboard setup, redirects, analytics, rollback"
```

---

## Task 9: Final pre-PR gate verification

**Why:** Each task ran the gates locally, but a fresh full-gate run on the final state catches any subtle interaction. Cloudflare will run the same command as part of the deploy, so a green run here means a green deploy.

- [ ] **Step 1: Run all four gates from a clean state**

```powershell
npm run check
npm run test:run
npm run audit
npm run build
```

Expected: all four pass. If any fails, fix before opening the PR.

- [ ] **Step 2: Inspect the build output for the SEO surface**

```powershell
Get-Item build\robots.txt, build\sitemap.xml, build\favicon.svg, build\apple-touch-icon.png, build\og-image.svg, build\og-image.png | Select-Object Name, Length
Get-Content build\index.html | Select-String -Pattern 'theme-color|og:title|twitter:card|canonical|Pathfinder'
```

Expected:
- All six static files exist and are non-zero size.
- The grep finds at least one match each for `theme-color`, `og:title`, `twitter:card`, `canonical`, and `Pathfinder` in the prerendered `index.html`.

- [ ] **Step 3: Confirm `_headers` is no longer in the build output**

```powershell
Test-Path build\_headers
```

Expected: `False`. If `True`, the file was edited rather than deleted in Task 1 — verify it no longer contains `X-Robots-Tag: noindex, nofollow`. (If `_headers` legitimately needs to ship for some other reason, this isn't a problem; just confirm the noindex is gone.)

- [ ] **Step 4: Confirm `wrangler` is gone**

```powershell
Select-String -Path package.json -Pattern 'wrangler|deploy:pages'
Select-String -Path package-lock.json -Pattern '"wrangler"' -SimpleMatch
```

Expected: no matches in either file.

- [ ] **Step 5: View the commit graph**

```powershell
git log master..HEAD --oneline
```

Expected: one spec commit + eight implementation commits (or similar), all with clear imperative messages. If something looks wrong (squashed accidentally, duplicate commits, etc.), fix before pushing.

---

## Task 10: Push branch and open PR

- [ ] **Step 1: Push the branch to origin**

```powershell
git push -u origin deploy/cloudflare-pages-setup
```

- [ ] **Step 2: Open the PR**

Run:
```powershell
gh pr create --title "Cloudflare Pages deployment + SEO baseline" --body @'
## Summary

- Production hosting on Cloudflare Pages via Git integration: master → `https://pf2etracker.app`, every other branch → preview URL automatically.
- SEO surface: `<title>`, meta description, canonical, Open Graph, Twitter Card, `robots.txt` (now permissive), `sitemap.xml`, favicon, apple-touch-icon, OG image.
- Removed `wrangler` devDependency and `deploy:pages` script — CI/CD is the only deploy path.
- Full Cloudflare dashboard setup playbook in `docs/cloudflare-pages.md` (one-time manual steps for project creation, custom domain, www→apex redirect, Web Analytics, rollback).
- Design rationale in `docs/superpowers/specs/2026-05-03-cloudflare-deployment-design.md`.

## Test plan

- [ ] CI green on this PR (`check`, `test:run`, `audit`, `build`)
- [ ] After merge, manually execute the four dashboard steps in `docs/cloudflare-pages.md`:
  - [ ] Create the Pages project
  - [ ] Attach `pf2etracker.app` (verify HTTPS + Active status)
  - [ ] Configure www → apex 301 redirect (verify with curl/browser)
  - [ ] Enable Web Analytics, slot the token into `app.html` in a follow-up PR
- [ ] Verify against the live site:
  - [ ] `https://pf2etracker.app/` loads
  - [ ] `https://www.pf2etracker.app/` 301-redirects to apex
  - [ ] `/robots.txt` is permissive, `/sitemap.xml` is valid
  - [ ] view-source shows full SEO meta surface
  - [ ] Web Analytics records the visit
- [ ] Rollback drill: deploy a no-op commit, click "Rollback to this deployment", confirm revert
- [ ] Submit `https://pf2etracker.app/sitemap.xml` to Google Search Console; verify no robots blockers
'@
```

(PowerShell here-string syntax: `@'` opens, `'@` closes at column 0 on its own line. Single quotes mean no `$` expansion.)

- [ ] **Step 3: Print the PR URL**

The `gh pr create` output includes the URL. Capture it for the user.

---

## What the user must do AFTER this PR merges

This plan only covers the in-repo work. Once the PR merges to `master`, the user (not the implementer) executes the four numbered steps in `docs/cloudflare-pages.md` § "One-time Cloudflare dashboard setup". Until those run, the apex domain doesn't point anywhere and the deploy doesn't go live.

The implementer's responsibility ends at the merged PR + green CI on master. The "live on `pf2etracker.app`" milestone is owned by the user.

---

## Self-review notes (for the planner — keep below for traceability)

**Spec coverage check:**
- §Topology (apex prod, branch previews, www→apex redirect): covered by Task 8 (docs).
- §Build pipeline: existing CI is unchanged; CF pipeline is configured by the user via Task 8 docs.
- §CI/CD discipline (no manual deploy): covered by Task 7 (script + dep removal).
- §SEO surface (every sub-bullet): Tasks 1, 2, 3, 4, 5, 6.
- §Analytics: covered by Task 6 (placeholder) + Task 8 (setup docs).
- §Cloudflare dashboard configuration: covered by Task 8 (docs).
- §Rollback: covered by Task 8 (docs).
- §What lands in the repo: every file in the table is touched by some task.
- §Implementation order: matches Task 1–10 ordering.
- §Verification checklist: covered by Task 9 + Task 10 PR test plan.

**No gaps found.** Open question in spec ("real OG artwork later") is intentionally deferred — placeholder ships in Task 3+4.
