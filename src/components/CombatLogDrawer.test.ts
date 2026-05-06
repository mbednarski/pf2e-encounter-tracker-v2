import { describe, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import type { LogEntry } from '../domain';
import CombatLogDrawer from './CombatLogDrawer.svelte';

function entry(id: string, message: string): LogEntry {
  return { id, message, tone: 'info' };
}

describe('CombatLogDrawer', () => {
  test('renders the entry count in the header', () => {
    render(CombatLogDrawer, {
      props: { entries: [entry('a', 'A'), entry('b', 'B')] }
    });
    expect(screen.getByText('2 entries')).toBeInTheDocument();
  });

  test('starts open and reveals the embedded log body', () => {
    render(CombatLogDrawer, { props: { entries: [entry('a', 'Visible entry')] } });
    expect(screen.getByText('Visible entry')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /combat log/i })).toHaveAttribute('aria-expanded', 'true');
  });

  test('clicking the header toggles open/closed and hides the body when collapsed', async () => {
    render(CombatLogDrawer, { props: { entries: [entry('a', 'Hidden when closed')] } });
    const header = screen.getByRole('button', { name: /combat log/i });
    await fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Hidden when closed')).not.toBeInTheDocument();
    await fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Hidden when closed')).toBeInTheDocument();
  });
});
