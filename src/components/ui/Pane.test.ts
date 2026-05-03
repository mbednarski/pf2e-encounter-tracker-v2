import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Wrapper from './Pane.test.svelte';

describe('Pane', () => {
  test('renders the section with the supplied aria-label', () => {
    render(Wrapper, { props: { ariaLabel: 'Library' } });
    expect(screen.getByRole('region', { name: 'Library' })).toBeInTheDocument();
  });

  test('renders header, footer, and body slot content', () => {
    render(Wrapper, { props: { ariaLabel: 'Details' } });
    expect(screen.getByText('Header content')).toBeInTheDocument();
    expect(screen.getByText('Footer content')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  test('applies the scrollable modifier when scrollable=true', () => {
    const { container } = render(Wrapper, { props: { ariaLabel: 'Scroll', scrollable: true } });
    expect(container.querySelector('.pane__body--scrollable')).not.toBeNull();
  });
});
