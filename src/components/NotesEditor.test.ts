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
  test('shows the placeholder text inside the display button when value is empty', () => {
    render(NotesEditor, { props: { value: '', onCommit: vi.fn() } });
    const button = screen.getByRole('button', { name: 'Edit note' });
    expect(button).toHaveTextContent('Add note…');
  });

  test('shows the note text inside the display button when value is non-empty', () => {
    render(NotesEditor, { props: { value: 'Hiding behind the cart.', onCommit: vi.fn() } });
    const button = screen.getByRole('button', { name: 'Edit note' });
    expect(button).toHaveTextContent('Hiding behind the cart.');
  });

  test('clicking the display switches to a focused textarea seeded with the value', async () => {
    render(NotesEditor, { props: { value: 'Existing.', onCommit: vi.fn() } });
    screen.getByRole('button', { name: 'Edit note' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    expect(textarea).toBe(document.activeElement);
    expect(textarea.value).toBe('Existing.');
  });

  test('Ctrl+Enter commits the trimmed buffer', async () => {
    const onCommit = vi.fn();
    render(NotesEditor, { props: { value: '', onCommit } });
    screen.getByRole('button', { name: 'Edit note' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    await setTextareaValue(textarea, '  Watch the door.  ');
    await pressKey(textarea, { key: 'Enter', ctrlKey: true });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Watch the door.');
  });

  test('Cmd+Enter (metaKey) commits the trimmed buffer', async () => {
    const onCommit = vi.fn();
    render(NotesEditor, { props: { value: '', onCommit } });
    screen.getByRole('button', { name: 'Edit note' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    await setTextareaValue(textarea, 'Mac save.');
    await pressKey(textarea, { key: 'Enter', metaKey: true });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Mac save.');
  });

  test('plain Enter (no modifiers) does NOT commit and keeps the textarea active', async () => {
    const onCommit = vi.fn();
    render(NotesEditor, { props: { value: '', onCommit } });
    screen.getByRole('button', { name: 'Edit note' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    await setTextareaValue(textarea, 'line one');
    await pressKey(textarea, { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Edit note' })).toBeInTheDocument();
  });

  test('blur commits the trimmed buffer', async () => {
    const onCommit = vi.fn();
    render(NotesEditor, { props: { value: '', onCommit } });
    screen.getByRole('button', { name: 'Edit note' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    await setTextareaValue(textarea, 'Saved on blur.');
    await blur(textarea);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Saved on blur.');
  });

  test('Esc cancels without calling onCommit and reverts the display', async () => {
    const onCommit = vi.fn();
    render(NotesEditor, { props: { value: 'Original.', onCommit } });
    screen.getByRole('button', { name: 'Edit note' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    await setTextareaValue(textarea, 'Throwaway.');
    await pressKey(textarea, { key: 'Escape' });
    expect(onCommit).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Edit note' });
    expect(button).toHaveTextContent('Original.');
  });

  test('committing whitespace-only or empty buffer passes null', async () => {
    const onCommit = vi.fn();
    render(NotesEditor, { props: { value: 'Existing.', onCommit } });
    screen.getByRole('button', { name: 'Edit note' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    await setTextareaValue(textarea, '   ');
    await blur(textarea);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(null);
  });

  test('committing an unchanged buffer does NOT call onCommit', async () => {
    const onCommit = vi.fn();
    render(NotesEditor, { props: { value: 'Same.', onCommit } });
    screen.getByRole('button', { name: 'Edit note' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    await blur(textarea);
    expect(onCommit).not.toHaveBeenCalled();
  });

  test('committing whitespace when value is already empty does NOT call onCommit', async () => {
    const onCommit = vi.fn();
    render(NotesEditor, { props: { value: '', onCommit } });
    screen.getByRole('button', { name: 'Edit note' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    await setTextareaValue(textarea, '   ');
    await blur(textarea);
    expect(onCommit).not.toHaveBeenCalled();
  });

  test('value prop changing while editing cancels the edit and discards the buffer', async () => {
    const onCommit = vi.fn();
    const { rerender } = render(NotesEditor, { props: { value: 'A-original', onCommit } });
    screen.getByRole('button', { name: 'Edit note' }).click();
    const textarea = (await screen.findByRole('textbox', { name: 'Edit note' })) as HTMLTextAreaElement;
    await setTextareaValue(textarea, 'A-buffer');

    await rerender({ value: 'B-original', onCommit });

    expect(screen.queryByRole('textbox', { name: 'Edit note' })).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Edit note' });
    expect(button).toHaveTextContent('B-original');
    expect(onCommit).not.toHaveBeenCalled();
  });
});
