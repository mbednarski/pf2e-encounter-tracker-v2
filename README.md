# PF2e Encounter Tracker v2

PF2e Encounter Tracker v2 is a browser-only Pathfinder 2e combat tracker. Canonical specs are the root-level `pf2e-*-spec.md` files.

Start with `pf2e-tracker-v2-architecture-spec.md`, especially the canonical specification index in section 19.2. Treat transcript-style `.txt` exports and scratch `Untitled-*.txt` files as non-canonical.

## Development

```powershell
npm install
npm run dev
npm run check
npm run test:run
npm run audit
npm run build
```

The first implementation slice is intentionally domain-first. `src/domain/` is pure TypeScript and must not import Svelte, SvelteKit, browser storage, or UI modules.

## Cloudflare Pages

The app is configured for static Cloudflare Pages hosting using `@sveltejs/adapter-static`.

- Pages project: `pf2e-tracker-v2`
- Production branch: `master`
- Build command: `npm run check && npm run test:run && npm run audit && npm run build`
- Output directory: `build`
- Node version: `22`
- Custom domain: `pf2etracker.app`
- Runtime services required: none

Keep the deployed app within Cloudflare's free static hosting model by avoiding Pages Functions, Workers, KV, D1, R2, Workers AI, and server-side endpoints unless a future task explicitly changes the architecture.

The initial deployment is intended to be unlisted, not access-gated. `static/_headers` sends `X-Robots-Tag: noindex, nofollow`, and `static/robots.txt` asks crawlers not to index the app while it is only being shared directly with friends.

Create the production deployment through Cloudflare Pages Git integration:

- Connect Cloudflare Pages to `mbednarski/pf2e-encounter-tracker-v2`.
- Set the production branch to `master`.
- Disable preview branch deployments for now.
- Attach `pf2etracker.app` as the custom domain.

Manual deployment after Cloudflare login:

```powershell
npm run deploy:pages
```
