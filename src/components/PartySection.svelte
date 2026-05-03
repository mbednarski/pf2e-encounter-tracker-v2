<script lang="ts">
  import SectionLabel from './ui/SectionLabel.svelte';
</script>

<section class="party" aria-labelledby="party-label">
  <SectionLabel as="h3" id="party-label">Party</SectionLabel>
  <p class="empty">
    PCs become first-class entities once issue
    <a href="https://github.com/mbednarski/pf2e-encounter-tracker-v2/issues/52" target="_blank" rel="noopener">#52</a>
    lands. For now, party members are added via the Bestiary or as custom combatants below.
  </p>
</section>

<style>
  .party {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-thin);
  }

  .empty {
    margin: 0;
    color: var(--color-ink-soft);
    font-size: var(--text-base);
    line-height: var(--leading-snug);
  }

  .empty a {
    color: var(--color-blue);
    text-decoration: underline dotted;
  }
</style>
