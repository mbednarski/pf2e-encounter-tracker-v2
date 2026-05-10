import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import StatRollButton from './StatRollButton.svelte';

describe('StatRollButton', () => {
  test('renders the label and signed modifier', () => {
    render(StatRollButton, { props: { label: 'FORT', modifier: 12 } });
    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent('FORT');
    expect(btn).toHaveTextContent('+12');
  });

  test('renders a negative modifier with a minus sign', () => {
    render(StatRollButton, { props: { label: 'WILL', modifier: -1 } });
    expect(screen.getByRole('button')).toHaveTextContent('-1');
  });

  test('default aria-label combines label and signed modifier', () => {
    render(StatRollButton, { props: { label: 'REF', modifier: 9 } });
    expect(screen.getByRole('button', { name: 'Roll REF (+9)' })).toBeInTheDocument();
  });

  test('honors a custom ariaLabel override', () => {
    render(StatRollButton, {
      props: { label: 'FORT', modifier: 12, ariaLabel: 'Roll Fortitude save plus 12' }
    });
    expect(
      screen.getByRole('button', { name: 'Roll Fortitude save plus 12' })
    ).toBeInTheDocument();
  });

  test('forwards click coordinates to onRoll', async () => {
    const onRoll = vi.fn();
    render(StatRollButton, {
      props: { label: 'FORT', modifier: 12, onRoll }
    });
    await fireEvent.click(screen.getByRole('button'), { clientX: 123, clientY: 456 });
    expect(onRoll).toHaveBeenCalledTimes(1);
    expect(onRoll).toHaveBeenCalledWith({ x: 123, y: 456 });
  });

  test('disables the button when disabled is true', () => {
    render(StatRollButton, { props: { label: 'FORT', modifier: 12, disabled: true } });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  test('applies the requested tone class', () => {
    render(StatRollButton, { props: { label: 'FORT', modifier: 12, tone: 'pc' } });
    expect(screen.getByRole('button').className).toContain('stat-roll--pc');
  });
});
