/**
 * Page-level layout breakpoints.
 *
 * CSS custom properties cannot parameterize @media queries, so the two
 * viewport switches live as documented literals in the few files that
 * need them (+page.svelte, EncounterHeader.svelte) and are mirrored here
 * for matchMedia-driven JS (drawer and slide-over state). Component-level
 * adaptation uses @container queries against a pane and does not need
 * these values.
 */
export const TABLET_MAX = 1180;
export const PHONE_MAX = 760;

export const TABLET_QUERY = `(max-width: ${TABLET_MAX}px)`;
export const PHONE_QUERY = `(max-width: ${PHONE_MAX}px)`;
