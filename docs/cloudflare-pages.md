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
npx --yes @resvg/resvg-js-cli --fit-width 180 --fit-height 180 static/favicon.svg static/apple-touch-icon.png
npx --yes @resvg/resvg-js-cli --fit-width 1200 --fit-height 630 static/og-image.svg static/og-image.png
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
