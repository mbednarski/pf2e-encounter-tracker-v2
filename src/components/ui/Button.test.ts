import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Button from './Button.svelte';

describe('Button', () => {
  test('renders a button element with the default primary variant', () => {
    render(Button, { props: { ariaLabel: 'Save' } });
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn.className).toContain('btn--primary');
    expect(btn.className).toContain('btn--md');
  });

  test('applies the requested variant class', () => {
    render(Button, { props: { variant: 'destructive', ariaLabel: 'Delete' } });
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('btn--destructive');
  });

  test('applies the requested size class', () => {
    render(Button, { props: { size: 'sm', ariaLabel: 'Tiny' } });
    expect(screen.getByRole('button', { name: 'Tiny' }).className).toContain('btn--sm');
  });

  test('fires onclick when clicked', async () => {
    const onclick = vi.fn();
    render(Button, { props: { ariaLabel: 'Click me', onclick } });
    await fireEvent.click(screen.getByRole('button', { name: 'Click me' }));
    expect(onclick).toHaveBeenCalledTimes(1);
  });

  test('sets the disabled attribute when disabled', () => {
    render(Button, { props: { ariaLabel: 'Off', disabled: true } });
    expect(screen.getByRole('button', { name: 'Off' })).toBeDisabled();
  });

  test('passes title through to the DOM element', () => {
    render(Button, { props: { ariaLabel: 'Save', title: 'Save the encounter' } });
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('title', 'Save the encounter');
  });
});
