import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import Wrapper from './Chip.test.svelte';

describe('Chip', () => {
  test('renders the slot content as text', () => {
    const { container } = render(Wrapper, { props: { label: 'PC' } });
    expect(container.textContent).toContain('PC');
  });

  test('applies the variant class', () => {
    const { container } = render(Wrapper, { props: { label: 'Frightened', variant: 'warning' } });
    const chip = container.querySelector('.chip');
    expect(chip?.className).toContain('chip--warning');
  });

  test('applies the selected modifier class', () => {
    const { container } = render(Wrapper, { props: { label: 'Selected', selected: true } });
    const chip = container.querySelector('.chip');
    expect(chip?.className).toContain('chip--selected');
  });
});
