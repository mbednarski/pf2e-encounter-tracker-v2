import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import IconButton from './IconButton.svelte';

describe('IconButton', () => {
  test('renders with the required ariaLabel', () => {
    render(IconButton, { props: { ariaLabel: 'Remove condition' } });
    expect(screen.getByRole('button', { name: 'Remove condition' })).toBeInTheDocument();
  });

  test('applies the variant class', () => {
    render(IconButton, { props: { variant: 'destructive', ariaLabel: 'Delete' } });
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('icon-btn--destructive');
  });

  test('inlines the size as a CSS custom property', () => {
    render(IconButton, { props: { size: 26, ariaLabel: 'Add' } });
    const btn = screen.getByRole('button', { name: 'Add' });
    expect(btn.getAttribute('style')).toContain('--icon-btn-size: 26px');
  });

  test('fires onclick when clicked', async () => {
    const onclick = vi.fn();
    render(IconButton, { props: { ariaLabel: 'Tap', onclick } });
    await fireEvent.click(screen.getByRole('button', { name: 'Tap' }));
    expect(onclick).toHaveBeenCalledTimes(1);
  });

  test('sets the disabled attribute when disabled', () => {
    render(IconButton, { props: { ariaLabel: 'Off', disabled: true } });
    expect(screen.getByRole('button', { name: 'Off' })).toBeDisabled();
  });
});
