import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import Wrapper from './SectionLabel.test.svelte';

describe('SectionLabel', () => {
  test('renders a span by default with the supplied content', () => {
    const { container } = render(Wrapper, { props: { text: 'Defenses' } });
    const el = container.querySelector('.label');
    expect(el?.tagName).toBe('SPAN');
    expect(el?.textContent).toBe('Defenses');
  });

  test('renders the requested element via the as prop', () => {
    const { container } = render(Wrapper, { props: { text: 'Strikes', as: 'h3' } });
    const el = container.querySelector('.label');
    expect(el?.tagName).toBe('H3');
  });
});
