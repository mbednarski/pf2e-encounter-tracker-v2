import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { FeedbackEntry } from '$lib/encounter-app';
import CombatLog from './CombatLog.svelte';

function entry(id: string, message: string, severity: FeedbackEntry['severity'] = 'info'): FeedbackEntry {
  return { id, commandId: id, severity, message };
}

describe('CombatLog', () => {
  test('renders the empty-state message when no entries are provided', () => {
    render(CombatLog, { props: { entries: [] } });
    expect(screen.getByText('Combat events will appear here.')).toBeInTheDocument();
  });

  test('renders one list item per entry in reverse-chronological order', () => {
    const entries = [
      entry('a', 'First entry'),
      entry('b', 'Second entry'),
      entry('c', 'Third entry')
    ];
    render(CombatLog, { props: { entries } });
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent?.trim())).toEqual([
      'Third entry',
      'Second entry',
      'First entry'
    ]);
  });

  test('applies severity modifier classes', () => {
    const entries = [
      entry('w', 'Watch out', 'warn'),
      entry('s', 'Hit landed', 'success'),
      entry('i', 'Turn started', 'info')
    ];
    const { container } = render(CombatLog, { props: { entries } });
    const lis = container.querySelectorAll('.entry');
    const classes = Array.from(lis).map((li) => li.className);
    expect(classes.some((c) => c.includes('entry--warn'))).toBe(true);
    expect(classes.some((c) => c.includes('entry--success'))).toBe(true);
    expect(classes.some((c) => c.includes('entry--info'))).toBe(true);
  });

  test('exposes the list via the polite log role', () => {
    render(CombatLog, { props: { entries: [entry('a', 'test')] } });
    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
  });
});
