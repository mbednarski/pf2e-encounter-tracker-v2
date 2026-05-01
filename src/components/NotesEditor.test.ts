import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import NotesEditor from './NotesEditor.svelte';

async function setTextareaValue(textarea: HTMLElement, value: string) {
  await fireEvent.input(textarea, { target: { value } });
}

async function blur(el: HTMLElement) {
  await fireEvent.blur(el);
}

async function pressKey(el: HTMLElement, init: KeyboardEventInit) {
  await fireEvent.keyDown(el, init);
  await tick();
}

describe('NotesEditor', () => {
  test('shows the placeholder button when value is empty', () => {
    render(NotesEditor, { props: { value: '', onCommit: vi.fn() } });
    expect(screen.getByRole('button', { name: 'Add note…' })).toBeInTheDocument();
  });

  test('shows the note text inside the display button when value is non-empty', () => {
    render(NotesEditor, { props: { value: 'Hiding behind the cart.', onCommit: vi.fn() } });
    expect(screen.getByRole('button', { name: 'Hiding behind the cart.' })).toBeInTheDocument();
  });

  test('clicking the display switches to a focused textarea seeded with the value', async () => {
    render(NotesEditor, { props: { value: 'Existing.', onCommit: vi.fn() } });
    screen.getByRole('button', { name: 'Existing.' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    expect(textarea).toBe(document.activeElement);
    expect(textarea.value).toBe('Existing.');
  });

  test('Ctrl+Enter commits the trimmed buffer', async () => {
    const onCommit = vi.fn();
    render(NotesEditor, { props: { value: '', onCommit } });
    screen.getByRole('button', { name: 'Add note…' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    await setTextareaValue(textarea, '  Watch the door.  ');
    await pressKey(textarea, { key: 'Enter', ctrlKey: true });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Watch the door.');
  });

  test('blur commits the trimmed buffer', async () => {
    const onCommit = vi.fn();
    render(NotesEditor, { props: { value: '', onCommit } });
    screen.getByRole('button', { name: 'Add note…' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    await setTextareaValue(textarea, 'Saved on blur.');
    await blur(textarea);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Saved on blur.');
  });

  test('Esc cancels without calling onCommit and reverts the display', async () => {
    const onCommit = vi.fn();
    render(NotesEditor, { props: { value: 'Original.', onCommit } });
    screen.getByRole('button', { name: 'Original.' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    await setTextareaValue(textarea, 'Throwaway.');
    await pressKey(textarea, { key: 'Escape' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Original.' })).toBeInTheDocument();
  });

  test('committing whitespace-only or empty buffer passes null', async () => {
    const onCommit = vi.fn();
    render(NotesEditor, { props: { value: 'Existing.', onCommit } });
    screen.getByRole('button', { name: 'Existing.' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    await setTextareaValue(textarea, '   ');
    await blur(textarea);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(null);
  });

  test('committing an unchanged buffer does NOT call onCommit', async () => {
    const onCommit = vi.fn();
    render(NotesEditor, { props: { value: 'Same.', onCommit } });
    screen.getByRole('button', { name: 'Same.' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    await blur(textarea);
    expect(onCommit).not.toHaveBeenCalled();
  });

  test('committing whitespace when value is already empty does NOT call onCommit', async () => {
    const onCommit = vi.fn();
    render(NotesEditor, { props: { value: '', onCommit } });
    screen.getByRole('button', { name: 'Add note…' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    await setTextareaValue(textarea, '   ');
    await blur(textarea);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
