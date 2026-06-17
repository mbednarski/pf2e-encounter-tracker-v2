import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import GameClock from './GameClock.svelte';

describe('GameClock', () => {
  test('renders the formatted time', () => {
    render(GameClock, { props: { minutes: 14 * 60 + 30, onChange: () => {} } });
    expect(screen.getByText('Day 1 · 14:30')).toBeInTheDocument();
  });

  test('step buttons emit the new total minutes', async () => {
    const onChange = vi.fn();
    render(GameClock, { props: { minutes: 0, onChange } });

    await fireEvent.click(screen.getByRole('button', { name: 'Plus one hour' }));
    expect(onChange).toHaveBeenCalledWith(60);

    await fireEvent.click(screen.getByRole('button', { name: 'Plus one day' }));
    expect(onChange).toHaveBeenCalledWith(24 * 60);
  });

  test('decrement never goes below zero', async () => {
    const onChange = vi.fn();
    render(GameClock, { props: { minutes: 5, onChange } });

    await fireEvent.click(screen.getByRole('button', { name: 'Minus one hour' }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  test('clicking the value lets you set it directly', async () => {
    const onChange = vi.fn();
    render(GameClock, { props: { minutes: 0, onChange } });

    await fireEvent.click(screen.getByRole('button', { name: /Set time, currently/ }));
    await fireEvent.input(screen.getByLabelText('Day'), { target: { value: '3' } });
    await fireEvent.input(screen.getByLabelText('Hour'), { target: { value: '8' } });
    await fireEvent.input(screen.getByLabelText('Minute'), { target: { value: '15' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Set time' }));

    expect(onChange).toHaveBeenCalledWith(2 * 24 * 60 + 8 * 60 + 15);
  });
});
