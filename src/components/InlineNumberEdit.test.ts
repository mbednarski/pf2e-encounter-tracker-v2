import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import InlineNumberEdit from './InlineNumberEdit.svelte';

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    value: 12,
    ariaLabel: 'Edit HP',
    onCommit: vi.fn(),
    ...overrides
  };
}

async function startEditing(displayName = 'Edit HP'): Promise<HTMLInputElement> {
  screen.getByRole('button', { name: displayName }).click();
  await tick();
  return screen.getByRole('textbox', { name: 'Edit HP' }) as HTMLInputElement;
}

function inputGone(): boolean {
  return screen.queryByRole('textbox', { name: 'Edit HP' }) === null;
}

describe('InlineNumberEdit display button', () => {
  test('renders the numeric value as a button labelled by ariaLabel', () => {
    render(InlineNumberEdit, { props: baseProps({ value: 17 }) });
    const button = screen.getByRole('button', { name: 'Edit HP' });
    expect(button).toHaveTextContent('17');
  });

  test('uses displayAriaLabel for the display button when provided', () => {
    render(InlineNumberEdit, {
      props: baseProps({ ariaLabel: 'Edit HP', displayAriaLabel: 'Current HP, click to edit' })
    });
    expect(
      screen.getByRole('button', { name: 'Current HP, click to edit' })
    ).toBeInTheDocument();
  });

  test('renders emptyDisplay text when value is 0 and emptyDisplay is provided', () => {
    render(InlineNumberEdit, { props: baseProps({ value: 0, emptyDisplay: '—' }) });
    expect(screen.getByRole('button', { name: 'Edit HP' })).toHaveTextContent('—');
  });

  test('renders "0" when value is 0 and emptyDisplay is not provided', () => {
    render(InlineNumberEdit, { props: baseProps({ value: 0 }) });
    expect(screen.getByRole('button', { name: 'Edit HP' })).toHaveTextContent('0');
  });
});

describe('InlineNumberEdit edit mode transitions', () => {
  test('clicking the display switches to an input seeded with the current value', async () => {
    render(InlineNumberEdit, { props: baseProps({ value: 42 }) });
    const input = await startEditing();
    expect(input.value).toBe('42');
    expect(input.getAttribute('inputmode')).toBe('numeric');
  });

  test('Escape cancels editing without calling onCommit', async () => {
    const onCommit = vi.fn();
    render(InlineNumberEdit, { props: baseProps({ onCommit }) });
    const input = await startEditing();
    await fireEvent.input(input, { target: { value: '99' } });
    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(inputGone()).toBe(true);
    expect(screen.getByRole('button', { name: 'Edit HP' })).toHaveTextContent('12');
  });

  test('blur cancels editing without calling onCommit (unlike NotesEditor)', async () => {
    const onCommit = vi.fn();
    render(InlineNumberEdit, { props: baseProps({ onCommit }) });
    const input = await startEditing();
    await fireEvent.input(input, { target: { value: '99' } });
    await fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(inputGone()).toBe(true);
  });

  test('empty buffer + Enter cancels (parses as kind=cancel)', async () => {
    const onCommit = vi.fn();
    render(InlineNumberEdit, { props: baseProps({ onCommit }) });
    const input = await startEditing();
    await fireEvent.input(input, { target: { value: '' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(inputGone()).toBe(true);
  });
});

describe('InlineNumberEdit commit', () => {
  test('Enter with a plain integer commits a "set" parsed edit', async () => {
    const onCommit = vi.fn();
    render(InlineNumberEdit, { props: baseProps({ onCommit }) });
    const input = await startEditing();
    await fireEvent.input(input, { target: { value: '25' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ kind: 'set', n: 25 });
  });

  test('Enter with +N commits an "add" parsed edit', async () => {
    const onCommit = vi.fn();
    render(InlineNumberEdit, { props: baseProps({ onCommit }) });
    const input = await startEditing();
    await fireEvent.input(input, { target: { value: '+3' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith({ kind: 'add', n: 3 });
  });

  test('Enter with -N commits a "sub" parsed edit', async () => {
    const onCommit = vi.fn();
    render(InlineNumberEdit, { props: baseProps({ onCommit }) });
    const input = await startEditing();
    await fireEvent.input(input, { target: { value: '-5' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith({ kind: 'sub', n: 5 });
  });

  test('a successful commit leaves the display showing the unchanged value (parent owns updates)', async () => {
    const onCommit = vi.fn();
    render(InlineNumberEdit, { props: baseProps({ value: 12, onCommit }) });
    const input = await startEditing();
    await fireEvent.input(input, { target: { value: '+5' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(inputGone()).toBe(true);
    expect(screen.getByRole('button', { name: 'Edit HP' })).toHaveTextContent('12');
  });
});

describe('InlineNumberEdit invalid input', () => {
  test('invalid expression keeps editing open and marks the input invalid', async () => {
    const onCommit = vi.fn();
    render(InlineNumberEdit, { props: baseProps({ onCommit }) });
    const input = await startEditing();
    await fireEvent.input(input, { target: { value: 'abc' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(/use 42/);
  });

  test('correcting an invalid expression then pressing Enter commits successfully', async () => {
    const onCommit = vi.fn();
    render(InlineNumberEdit, { props: baseProps({ onCommit }) });
    const input = await startEditing();

    await fireEvent.input(input, { target: { value: 'abc' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveAttribute('aria-invalid', 'true');

    await fireEvent.input(input, { target: { value: '7' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith({ kind: 'set', n: 7 });
  });
});
