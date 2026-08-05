import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import ActionGlyph from './ActionGlyph.svelte';

describe('ActionGlyph', () => {
  test.each([
    [1, '◆', '1 action'],
    [2, '◆◆', '2 actions'],
    [3, '◆◆◆', '3 actions'],
    ['free', '◇', 'Free action'],
    ['reaction', '↺', 'Reaction']
  ] as const)('renders the glyph and label for cost %s', (cost, glyph, aria) => {
    const { container } = render(ActionGlyph, { props: { cost } });
    const el = container.querySelector('.action-glyph');
    expect(el?.textContent).toBe(glyph);
    expect(el?.getAttribute('aria-label')).toBe(aria);
  });

  test('renders nothing when cost is undefined', () => {
    const { container } = render(ActionGlyph, { props: { cost: undefined } });
    expect(container.querySelector('.action-glyph')).toBeNull();
  });
});
