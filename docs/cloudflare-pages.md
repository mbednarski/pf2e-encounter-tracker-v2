# Cloudflare Pages Deployment

This project is designed to deploy as static assets on Cloudflare Pages.

## Free-Service Constraint

V2 must remain browser-only unless the architecture changes explicitly. The deployable app should not require:

- Pages Functions
- Workers
- KV
- D1
- R2
- Workers AI
- Cloudflare-hosted secrets or server storage

User data remains in browser storage. Future LLM parsing calls should go directly from the browser to the provider using the user's own API key, as specified in the architecture docs.

## Pages Settings

Use these settings for Git-backed Pages deployment:

- Framework preset: SvelteKit, or no preset with the values below
- Build command: `npm run check && npm run test:run && npm run audit && npm run build`
- Build output directory: `build`
- Root directory: repository root

## Manual Deploy

After authenticating Wrangler with Cloudflare:

```powershell
npm run deploy:pages
```

This runs the static build and uploads the `build` directory to a Pages project named `pf2e-tracker-v2`.
