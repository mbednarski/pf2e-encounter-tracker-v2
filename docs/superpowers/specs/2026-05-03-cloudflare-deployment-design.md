# Cloudflare Pages Deployment + SEO Baseline — Design

**Status:** approved (brainstorming gate)
**Date:** 2026-05-03
**Scope:** one-time deployment infrastructure + SEO surface, not feature work

## Goal

Make `pf2etracker.app` (apex) the live production URL for the tracker, with automatic preview URLs for every non-`master` branch, and a baseline SEO surface so the site is indexable by search engines and renders nicely when shared.

## Non-goals

- Workers, KV, D1, R2, Pages Functions, Workers AI — explicitly forbidden by `CLAUDE.md` and `AGENTS.md`. Static assets only.
- A staging environment beyond branch previews. (Could be added later as a fixed `staging.pf2etracker.app` pointing at one branch — out of scope here.)
- Structured-data JSON-LD. The site has no public marked-up content to describe.
- Marketing landing page. The apex *is* the tracker; future smaller tools live on subdomains.
- Any local-machine deploy path. CI/CD is the only deploy gate; see "CI/CD discipline" below.

## Pre-existing context

- SvelteKit + `adapter-static` with `prerender = true, ssr = true` → real HTML files at build time. SEO concern about JS apps not indexing is solved by the existing architecture; this design just adds the SEO *surface* (titles, meta, sitemap, robots).
- `package.json` reserves Pages project name `pf2e-tracker-v2` via the `deploy:pages` script. The project itself does not yet exist in Cloudflare.
- Domain `pf2etracker.app` is registered through Cloudflare Registrar — DNS is already on Cloudflare nameservers.
- GitHub Actions CI (`.github/workflows/ci.yml`) runs `check / test:run / audit / build` on every push to `master` and every PR. It does not currently deploy.
- `docs/cloudflare-pages.md` exists with free-service constraints and a partial Pages settings block. This file gets extended, not replaced.
- `static/robots.txt` currently disallows all crawlers (`Disallow: /`). `static/_headers` currently sets `X-Robots-Tag: noindex, nofollow`. Both actively block indexing today and must be flipped.

## Topology

- **Production:** `master` → `https://pf2etracker.app` (apex).
- **Apex routing:** Cloudflare Pages attaches the apex domain directly via CNAME flattening. No A-record gymnastics needed.
- **www handling:** `www.pf2etracker.app` 301-redirects to apex via a Cloudflare Redirect Rule. Not attached to the Pages project as a second hostname (that would serve duplicate content under two URLs and split SEO signals).
- **Previews:** every branch pushed to GitHub gets a preview deployment at `https://<sanitized-branch>.pf2e-tracker-v2.pages.dev`. PRs receive an automatic Cloudflare bot comment with the link.
- **Future tools:** subdomains like `dice.pf2etracker.app` can be attached to separate Pages projects later; this design doesn't reserve or provision them.

## Build pipeline

Two builds run in parallel on every push, each with a single clear job:

| | GitHub Actions (existing) | Cloudflare Pages (new) |
|---|---|---|
| **Purpose** | PR mergeability gate | Deployment |
| **Trigger** | push to master + PRs | push to any branch |
| **Command** | `npm run check && npm run test:run && npm run audit && npm run build` | identical |
| **Output** | green check on PR | live URL (prod or preview) |
| **Node** | 22 | 22 (set via `NODE_VERSION` env var on the Pages project) |
| **Failure mode** | PR stays red, can't merge | deploy fails, previous deployment stays live |

This is intentional belt-and-suspenders. Both run identical commands. For a hobby-scale project both stay well within free tiers (CF Pages free tier: 500 builds/month + unlimited bandwidth; GH Actions: 2000 minutes/month for private repos, unlimited for public).

### Why both, not just one

- Removing GH Actions CI would mean a failing build only surfaces inside Cloudflare's UI, not as a red check on the PR. Branch protection rules can't gate on Cloudflare's status.
- Removing Cloudflare's full gate (running just `npm run build`) would mean a Cloudflare deploy could succeed on master with broken tests if someone bypassed CI. Defense in depth is cheap here.

## CI/CD discipline

Single deploy path: push branch → Cloudflare Pages builds → live. There is no manual-deploy escape hatch. Specifically:

- The `deploy:pages` script in `package.json` is **deleted**.
- The `wrangler` devDependency is **removed**. No local `wrangler pages deploy` path.
- The "Manual Deploy" section in `docs/cloudflare-pages.md` is **deleted**.
- Emergency rollback uses Cloudflare's "Rollback to this deployment" dashboard button, not a local deploy. See "Rollback" below.
- Fix-forward through CI is the only response to a broken production deploy. If CI itself is broken, that's the problem to solve, not a problem to bypass.

## SEO surface

### `src/app.html`

Add `<meta name="theme-color" content="#0b1020">` (or whichever dark color matches the eventual visual identity — a placeholder is fine). Leave the rest of the structure untouched.

### `src/routes/+layout.svelte` (new)

A new root layout component containing a `<svelte:head>` block with default SEO tags. Holds:

- `<title>PF2e Encounter Tracker</title>`
- `<meta name="description" content="Browser-based encounter tracker for Pathfinder 2nd Edition. Track initiative, conditions, effects, and turn prompts. Free, runs entirely in your browser, no account required.">`
- `<link rel="canonical" href="https://pf2etracker.app/">`
- Open Graph: `og:title`, `og:description`, `og:url`, `og:type=website`, `og:image=https://pf2etracker.app/og-image.png`, `og:site_name`
- Twitter Card: `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`

The layout component renders `<slot />` so route content still renders. Per-route `<svelte:head>` blocks override individual tags (e.g. `/settings` overrides `<title>` to `Settings — PF2e Encounter Tracker`).

The canonical URL needs to be route-aware to avoid every page claiming to be the homepage. The layout uses `$page.url.pathname` from `$app/stores` to build the canonical href. (Verify at implementation time that this pattern works under prerender.)

### `static/robots.txt`

Replace the existing contents:

```
User-agent: *
Allow: /
Sitemap: https://pf2etracker.app/sitemap.xml
```

### `static/_headers`

Remove the `X-Robots-Tag: noindex, nofollow` block. If the file becomes empty, delete it entirely.

### `static/sitemap.xml`

Hand-rolled, lists `/` and `/settings`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://pf2etracker.app/</loc></url>
  <url><loc>https://pf2etracker.app/settings</loc></url>
</urlset>
```

A static file is appropriate here — the route count won't change often, and a prerender-time sitemap generator is overkill for two URLs. When the route count grows, swap to a generator.

### Icons

- `static/favicon.svg` — simple SVG (a stylized d20 outline, single color). References from `+layout.svelte` via `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`.
- `static/apple-touch-icon.png` — 180×180 PNG version. References via `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`.

### OG image

- `static/og-image.svg` — source SVG, 1200×630, dark background with "PF2e Encounter Tracker" + tagline. This is the editable source.
- `static/og-image.png` — rendered PNG. Twitter and several other platforms don't accept SVG OG images, so a PNG must be present. The PNG is committed to the repo; it is not regenerated at build time.

The PNG is re-rendered manually whenever the SVG source changes. The renderer is a CLI run via `npx` (specific tool chosen at implementation — likely `@resvg/resvg-js-cli` or `sharp-cli`) so no permanent build dependency is added to `package.json`. The exact one-shot command is documented in `docs/cloudflare-pages.md` once chosen.

## Analytics

Cloudflare Web Analytics — free, cookieless, no consent banner needed. The beacon is a `<script>` tag added to `src/app.html` `<head>`. The site token is public-facing (literally embedded in the HTML), so it's hard-coded — no secret-management plumbing.

The user generates the token in the Cloudflare dashboard once the Pages project exists. Token value gets slotted into `app.html` during implementation; until then a placeholder comment marks the spot.

## Cloudflare dashboard configuration

These steps cannot live in the repo because they're account-level config. Documented in `docs/cloudflare-pages.md` so they're reproducible.

1. **Create Pages project**
   - Workers & Pages → Create → Pages → Connect to Git → select GitHub repo
   - Production branch: `master`
   - Build command: `npm run check && npm run test:run && npm run audit && npm run build`
   - Build output directory: `build`
   - Environment variables: `NODE_VERSION=22`
   - Preview deployments: leave at Cloudflare's default. The default is "all non-production branches produce preview deployments" — that is exactly what's wanted, so no changes needed.

2. **Attach custom domain**
   - Project → Custom domains → Add `pf2etracker.app`
   - Cloudflare auto-creates the DNS record (CNAME with flattening on apex). Step 2 is complete only when (a) the custom domain shows status "Active" in the Pages dashboard, AND (b) `https://pf2etracker.app` loads with a valid certificate (no browser warning).

3. **Configure www → apex redirect**
   - Domain → Rules → Redirect Rules → Create new rule
   - When: `(http.host eq "www.pf2etracker.app")`
   - Then: 301 redirect to `concat("https://pf2etracker.app", http.request.uri.path)`
   - This avoids attaching `www.pf2etracker.app` as a second Pages hostname (which would serve identical content under two URLs and split SEO signal).

4. **Enable Web Analytics**
   - Analytics & Logs → Web Analytics → Add a site → `pf2etracker.app`
   - Copy the JS snippet token. Slot into `app.html`.

## Rollback

Cloudflare Pages retains every deployment. To roll back:

- Pages dashboard → project → Deployments tab → pick a previous deployment → "Rollback to this deployment".
- Free, instant, no git revert required.
- The rollback creates a new deployment record pointing at the older build artifact. The next push to master deploys forward again from current code.

For broken-CI scenarios, the platform rollback button is the answer. There is intentionally no local deploy fallback (see "CI/CD discipline").

## What lands in the repo

- **Modified:** `src/app.html` (theme-color, analytics beacon)
- **New:** `src/routes/+layout.svelte` (SEO `<svelte:head>`)
- **Modified:** `static/robots.txt` (allow all)
- **Modified or deleted:** `static/_headers` (remove noindex)
- **New:** `static/sitemap.xml`
- **New:** `static/favicon.svg`
- **New:** `static/apple-touch-icon.png`
- **New:** `static/og-image.svg`, `static/og-image.png`
- **Modified:** `package.json` (delete `deploy:pages` script, remove `wrangler` devDependency)
- **Modified:** `package-lock.json` (regenerated)
- **Modified:** `docs/cloudflare-pages.md` (delete "Manual Deploy" section; expand with full dashboard setup, custom domain, www redirect, analytics, rollback)
- **New:** this spec at `docs/superpowers/specs/2026-05-03-cloudflare-deployment-design.md`

## Implementation order (rough)

The detailed plan follows in writing-plans. Sketch:

1. Spec committed (this document) on branch `deploy/cloudflare-pages-setup`.
2. SEO file changes: robots.txt, _headers, sitemap, layout, app.html theme-color, favicon, OG image.
3. Remove `deploy:pages` script and `wrangler` devDependency. Regenerate lockfile. Verify `npm run check && npm run test:run && npm run audit && npm run build` still passes.
4. Update `docs/cloudflare-pages.md` with full setup playbook.
5. PR to master. Merge after review.
6. *User-side, manual:* execute the four dashboard steps above. Verify live deploy on `pf2etracker.app`. Verify a feature branch produces a preview URL. Test the rollback button by deploying a no-op commit and rolling back.
7. *Optional follow-up:* a separate small PR slots the real Web Analytics token into `app.html` once it's been generated.

## Open questions

None blocking. Possible follow-ups (not in scope for this design):

- Real OG image artwork (placeholder is fine for v1).
- Real favicon artwork.
- Whether to add a `<meta name="robots" content="index,follow">` explicit tag in addition to the permissive robots.txt. Default behavior already permits indexing; explicit tag is belt-and-suspenders. Skipping for now.
- Whether to add a Cloudflare Page Rule for `/sitemap.xml` to set a longer cache TTL. The default is fine.

## Verification checklist (post-implementation)

- `npm run check && npm run test:run && npm run audit && npm run build` passes locally.
- After merge: `https://pf2etracker.app` loads, shows the tracker.
- After merge: `https://www.pf2etracker.app` 301-redirects to `https://pf2etracker.app/`.
- `https://pf2etracker.app/robots.txt` returns the new permissive content.
- `https://pf2etracker.app/sitemap.xml` returns valid XML with both URLs.
- Inspecting `view-source:https://pf2etracker.app/` shows `<title>`, `<meta description>`, OG tags, canonical link, theme-color.
- Pushing to a non-master branch produces a preview URL within ~3 minutes.
- A PR triggered by that branch gets a Cloudflare bot comment with the preview URL.
- Cloudflare Web Analytics dashboard shows page views from a manual visit.
- Rollback drill: deploy a no-op commit to master, click "Rollback to this deployment" on the previous one, verify the live site reverts within ~30 seconds.
- Google Search Console: site can be verified, sitemap accepted, no "blocked by robots.txt" warnings.
