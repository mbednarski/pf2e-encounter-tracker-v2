import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import Wrapper from './Modal.test.svelte';

async function openModal() {
  await fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
  const dialog = screen.getByRole('dialog', { name: 'Test dialog' });
  await waitFor(() => expect(dialog.contains(document.activeElement) || document.activeElement === dialog).toBe(true));
  return dialog;
}

describe('Modal', () => {
  test('renders header, body, and footer slots inside the dialog', async () => {
    render(Wrapper);
    const dialog = await openModal();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Test header' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'First' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last' })).toBeInTheDocument();
  });

  test('focuses the dialog on mount and restores focus to the trigger on close', async () => {
    render(Wrapper);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    trigger.focus();
    const dialog = await openModal();
    expect(document.activeElement).toBe(dialog);

    await fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  test('focuses the initialFocusSelector match on mount', async () => {
    render(Wrapper, { props: { initialFocusSelector: 'button' } });
    await openModal();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }))
    );
  });

  test('Escape reports reason "escape"', async () => {
    const onCloseSpy = vi.fn();
    render(Wrapper, { props: { onCloseSpy } });
    const dialog = await openModal();
    await fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onCloseSpy).toHaveBeenCalledWith('escape');
  });

  test('backdrop click reports reason "backdrop"', async () => {
    const onCloseSpy = vi.fn();
    render(Wrapper, { props: { onCloseSpy } });
    await openModal();
    await fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onCloseSpy).toHaveBeenCalledWith('backdrop');
  });

  test('backdrop click is ignored when closeOnBackdrop is false', async () => {
    const onCloseSpy = vi.fn();
    render(Wrapper, { props: { onCloseSpy, closeOnBackdrop: false } });
    await openModal();
    await fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onCloseSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('Tab wraps from the last focusable back to the first', async () => {
    render(Wrapper);
    const dialog = await openModal();
    const last = screen.getByRole('button', { name: 'Last' });
    last.focus();
    await fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
  });

  test('Shift+Tab wraps from the first focusable to the last', async () => {
    render(Wrapper);
    const dialog = await openModal();
    const first = screen.getByRole('button', { name: 'First' });
    first.focus();
    await fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last' }));
  });

  test('locks body scroll while open and restores it on close', async () => {
    render(Wrapper);
    const dialog = await openModal();
    expect(document.body.style.overflow).toBe('hidden');
    await fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(document.body.style.overflow).toBe(''));
  });
});
