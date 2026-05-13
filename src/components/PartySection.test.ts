import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import type { PartyMember } from '../domain';
import PartySection from './PartySection.svelte';

function member(id: string, name: string, overrides: Partial<PartyMember> = {}): PartyMember {
  return {
    id,
    name,
    level: 3,
    ac: 18,
    fortitude: 7,
    reflex: 8,
    will: 6,
    perception: 7,
    hp: 32,
    persistentEffects: [],
    companionIds: [],
    tags: [],
    ...overrides
  };
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    partyMembers: [] as PartyMember[],
    conditionOptions: [],
    onAddPartyMemberToEncounter: vi.fn(),
    onRemovePartyMember: vi.fn(),
    onSavePartyMember: vi.fn(),
    onImportPartyMemberYamlFiles: vi.fn(),
    ...overrides
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('PartySection — summary + collapse persistence', () => {
  test('renders the section heading and member count', () => {
    render(PartySection, {
      props: baseProps({ partyMembers: [member('a', 'Sun'), member('b', 'Moon')] })
    });
    expect(screen.getByText('Party')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('section starts open when no collapse preference is stored', () => {
    const { container } = render(PartySection, { props: baseProps() });
    expect(container.querySelector('details.party')).toHaveAttribute('open');
  });

  test('section starts collapsed when the preference is set to "1"', () => {
    localStorage.setItem('pf2e:partyCollapsed', '1');
    const { container } = render(PartySection, { props: baseProps() });
    expect(container.querySelector('details.party')).not.toHaveAttribute('open');
  });

  test('toggling open persists "0" to localStorage', async () => {
    localStorage.setItem('pf2e:partyCollapsed', '1');
    const { container } = render(PartySection, { props: baseProps() });
    const details = container.querySelector('details.party') as HTMLDetailsElement;
    details.open = true;
    await fireEvent(details, new Event('toggle'));
    expect(localStorage.getItem('pf2e:partyCollapsed')).toBe('0');
  });

  test('toggling closed persists "1" to localStorage', async () => {
    const { container } = render(PartySection, { props: baseProps() });
    const details = container.querySelector('details.party') as HTMLDetailsElement;
    details.open = false;
    await fireEvent(details, new Event('toggle'));
    expect(localStorage.getItem('pf2e:partyCollapsed')).toBe('1');
  });
});

describe('PartySection — empty state and members list', () => {
  test('shows the empty-state hint when no party members are present', () => {
    const { container } = render(PartySection, { props: baseProps() });
    const empty = container.querySelector('p.empty');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toMatch(/Click New or Import YAML to add party members/);
  });

  test('renders one row per member with name, level, and subtext', () => {
    render(PartySection, {
      props: baseProps({
        partyMembers: [
          member('a', 'Aric', { level: 5, playerName: 'Mateusz', class: 'Wizard' })
        ]
      })
    });
    expect(screen.getByLabelText('Add Aric to encounter')).toBeInTheDocument();
    expect(screen.getByLabelText('Level 5')).toBeInTheDocument();
    expect(screen.getByText('Mateusz · Wizard')).toBeInTheDocument();
  });

  test('subtext falls back to playerName/class/ancestry when only one is present', () => {
    render(PartySection, {
      props: baseProps({
        partyMembers: [member('a', 'Aric', { ancestry: 'Elf' })]
      })
    });
    expect(screen.getByText('Elf')).toBeInTheDocument();
  });

  test('clicking a member row calls onAddPartyMemberToEncounter with that member', async () => {
    const onAdd = vi.fn();
    const pm = member('a', 'Aric');
    render(PartySection, {
      props: baseProps({ partyMembers: [pm], onAddPartyMemberToEncounter: onAdd })
    });
    await fireEvent.click(screen.getByLabelText('Add Aric to encounter'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(pm);
  });

  test('clicking remove calls onRemovePartyMember with the id', async () => {
    const onRemove = vi.fn();
    render(PartySection, {
      props: baseProps({
        partyMembers: [member('a', 'Aric')],
        onRemovePartyMember: onRemove
      })
    });
    await fireEvent.click(screen.getByLabelText('Remove Aric from library'));
    expect(onRemove).toHaveBeenCalledWith('a');
  });
});

describe('PartySection — edit modal', () => {
  test('clicking New opens the modal in create mode', async () => {
    render(PartySection, { props: baseProps() });
    await fireEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('New Party Member')).toBeInTheDocument();
  });

  test('clicking edit on an existing member opens the modal in edit mode', async () => {
    render(PartySection, {
      props: baseProps({ partyMembers: [member('a', 'Aric')] })
    });
    await fireEvent.click(screen.getByLabelText('Edit Aric'));
    expect(screen.getByText('Edit Party Member')).toBeInTheDocument();
  });
});
