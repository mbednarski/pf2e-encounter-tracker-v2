import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { LogEntry, LogEntryTone } from '../domain';
import CombatLog from './CombatLog.svelte';

function entry(id: string, message: string, tone: LogEntryTone = 'info'): LogEntry {
  return { id, message, tone };
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

  test('applies tone modifier classes', () => {
    const entries = [
      entry('w', 'Watch out', 'danger'),
      entry('s', 'Hit landed', 'success'),
      entry('i', 'Turn started', 'info')
    ];
    const { container } = render(CombatLog, { props: { entries } });
    const lis = container.querySelectorAll('.entry');
    const classes = Array.from(lis).map((li) => li.className);
    expect(classes.some((c) => c.includes('entry--danger'))).toBe(true);
    expect(classes.some((c) => c.includes('entry--success'))).toBe(true);
    expect(classes.some((c) => c.includes('entry--info'))).toBe(true);
  });

  test('exposes the list via the polite log role', () => {
    render(CombatLog, { props: { entries: [entry('a', 'test')] } });
    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
  });
});
