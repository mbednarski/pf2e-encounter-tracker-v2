import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { HazardData } from '../../domain';
import HazardStatBlock from './HazardStatBlock.svelte';

function data(overrides: Partial<HazardData> = {}): HazardData {
  return {
    stealth: 28,
    stealthNote: 'DC 30 to detect; trained',
    hardness: 10,
    routine: 'The trap fires a volley of poisoned darts.',
    disable: 'Thievery DC 26 to disarm a launcher.',
    reset: 'The trap resets after one hour.',
    description: 'A gallery lined with hidden dart launchers.',
    ...overrides
  };
}

describe('HazardStatBlock', () => {
  test('renders the routine, disable, reset, and detection text blocks', () => {
    render(HazardStatBlock, { props: { data: data() } });
    expect(screen.getByText('The trap fires a volley of poisoned darts.')).toBeInTheDocument();
    expect(screen.getByText('Thievery DC 26 to disarm a launcher.')).toBeInTheDocument();
    expect(screen.getByText('The trap resets after one hour.')).toBeInTheDocument();
    expect(screen.getByText('DC 30 to detect; trained')).toBeInTheDocument();
  });

  test('labels each block', () => {
    render(HazardStatBlock, { props: { data: data() } });
    expect(screen.getByText('Routine')).toBeInTheDocument();
    expect(screen.getByText('Disable')).toBeInTheDocument();
    expect(screen.getByText('Detection')).toBeInTheDocument();
  });

  test('omits blocks whose text is absent', () => {
    render(HazardStatBlock, {
      props: { data: data({ disable: undefined, reset: undefined, description: undefined }) }
    });
    expect(screen.queryByText('Disable')).not.toBeInTheDocument();
    expect(screen.queryByText('Reset')).not.toBeInTheDocument();
    expect(screen.getByText('Routine')).toBeInTheDocument();
  });

  test('shows a fallback message when no text blocks were imported', () => {
    render(HazardStatBlock, {
      props: {
        data: {
          stealth: 20,
          stealthNote: undefined,
          routine: undefined,
          disable: undefined,
          reset: undefined,
          description: undefined
        }
      }
    });
    expect(
      screen.getByText('No routine or disable text was imported for this hazard.')
    ).toBeInTheDocument();
  });
});
