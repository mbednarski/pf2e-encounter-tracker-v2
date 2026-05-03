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
