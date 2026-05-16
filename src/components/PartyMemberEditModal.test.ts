import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import type { PartyMember } from '../domain';
import type { ConditionOption } from '$lib/encounter-app';
import PartyMemberEditModal from './PartyMemberEditModal.svelte';

function member(overrides: Partial<PartyMember> = {}): PartyMember {
  return {
    id: 'aric',
    name: 'Aric',
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

function options(): ConditionOption[] {
  return [
    { id: 'wounded', name: 'Wounded', value: { kind: 'valued', defaultValue: 1, maxValue: 4 } },
    { id: 'off-guard', name: 'Off-Guard', value: { kind: 'unvalued' } }
  ];
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    partyMember: null as PartyMember | null,
    conditionOptions: options(),
    existingIds: [] as string[],
    onSave: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  };
}

describe('PartyMemberEditModal — mode header and initial values', () => {
  test('renders "New Party Member" header and defaults when partyMember is null', () => {
    render(PartyMemberEditModal, { props: baseProps() });
    expect(screen.getByText('New Party Member')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Level')).toHaveValue(1);
    expect(screen.getByLabelText('AC')).toHaveValue(16);
  });

  test('renders "Edit Party Member" header and populates fields from partyMember', () => {
    render(PartyMemberEditModal, {
      props: baseProps({
        partyMember: member({ playerName: 'Mateusz', class: 'Wizard' })
      })
    });
    expect(screen.getByText('Edit Party Member')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Aric');
    expect(screen.getByLabelText('Player')).toHaveValue('Mateusz');
    expect(screen.getByLabelText('Class')).toHaveValue('Wizard');
    expect(screen.getByLabelText('AC')).toHaveValue(18);
  });
});

describe('PartyMemberEditModal — save', () => {
  test('saves a new member with a slugified id when one is not provided', async () => {
    const onSave = vi.fn();
    render(PartyMemberEditModal, { props: baseProps({ onSave }) });

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Aric Talwynd' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0] as PartyMember;
    expect(payload.id).toBe('aric-talwynd');
    expect(payload.name).toBe('Aric Talwynd');
    expect(payload.level).toBe(1);
  });

  test('appends a numeric suffix when the slugified id collides with existingIds', async () => {
    const onSave = vi.fn();
    render(PartyMemberEditModal, {
      props: baseProps({ onSave, existingIds: ['aric', 'aric-2'] })
    });

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Aric' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((onSave.mock.calls[0][0] as PartyMember).id).toBe('aric-3');
  });

  test('preserves the existing id when editing rather than generating a new one', async () => {
    const onSave = vi.fn();
    render(PartyMemberEditModal, {
      props: baseProps({ onSave, partyMember: member({ id: 'aric', name: 'Aric' }) })
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((onSave.mock.calls[0][0] as PartyMember).id).toBe('aric');
  });

  test('trims optional text fields and includes them only when non-empty', async () => {
    const onSave = vi.fn();
    render(PartyMemberEditModal, { props: baseProps({ onSave }) });

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Aric' } });
    await fireEvent.input(screen.getByLabelText('Player'), { target: { value: '  Mateusz  ' } });
    await fireEvent.input(screen.getByLabelText('Ancestry'), { target: { value: '   ' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const payload = onSave.mock.calls[0][0] as PartyMember;
    expect(payload.playerName).toBe('Mateusz');
    expect(payload.ancestry).toBeUndefined();
  });
});

// The HTML form has `required` on Name and `min="1"` on Level, so native browser
// validation gates the submit event for those cases. The JS validation inside
// handleSubmit is a defensive layer beneath that. To exercise it directly we
// dispatch the submit event on the form, which skips native validation.
describe('PartyMemberEditModal — JS-level defensive validation', () => {
  test('submitting with an empty name renders the "Name is required" alert', async () => {
    const onSave = vi.fn();
    const { container } = render(PartyMemberEditModal, { props: baseProps({ onSave }) });
    const form = container.querySelector('form') as HTMLFormElement;

    await fireEvent.submit(form);

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/name is required/i);
  });

  test('submitting with level below 1 renders the "Level must be at least 1" alert', async () => {
    const onSave = vi.fn();
    const { container } = render(PartyMemberEditModal, { props: baseProps({ onSave }) });
    const form = container.querySelector('form') as HTMLFormElement;

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Aric' } });
    await fireEvent.input(screen.getByLabelText('Level'), { target: { value: '0' } });
    await fireEvent.submit(form);

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/level must be at least 1/i);
  });

  test('the alert clears and onSave fires once the name is supplied', async () => {
    const onSave = vi.fn();
    const { container } = render(PartyMemberEditModal, { props: baseProps({ onSave }) });
    const form = container.querySelector('form') as HTMLFormElement;

    await fireEvent.submit(form);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Aric' } });
    await fireEvent.submit(form);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('PartyMemberEditModal — dynamic rows', () => {
  test('add + fill speed and skill rows are serialized into records on save', async () => {
    const onSave = vi.fn();
    render(PartyMemberEditModal, { props: baseProps({ onSave }) });

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Aric' } });

    await fireEvent.click(screen.getByRole('button', { name: '+ Speed' }));
    await fireEvent.click(screen.getByRole('button', { name: '+ Skill' }));

    const [landKey, landValue] = screen.getAllByPlaceholderText(/land|30/i);
    await fireEvent.input(landKey, { target: { value: 'land' } });
    await fireEvent.input(landValue, { target: { value: '30' } });

    const [skillKey, skillValue] = screen.getAllByPlaceholderText(/arcana|14/i);
    await fireEvent.input(skillKey, { target: { value: 'arcana' } });
    await fireEvent.input(skillValue, { target: { value: '14' } });

    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const payload = onSave.mock.calls[0][0] as PartyMember;
    expect(payload.speed).toEqual({ land: 30 });
    expect(payload.skills).toEqual({ arcana: 14 });
  });

  test('blank rows (empty key) are dropped from the serialized record', async () => {
    const onSave = vi.fn();
    render(PartyMemberEditModal, { props: baseProps({ onSave }) });

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Aric' } });
    await fireEvent.click(screen.getByRole('button', { name: '+ Speed' }));
    // leave the new row's key blank

    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const payload = onSave.mock.calls[0][0] as PartyMember;
    expect(payload.speed).toBeUndefined();
  });
});

describe('PartyMemberEditModal — persistent effects', () => {
  test('adding a valued effect captures the chosen value and renders in the list', async () => {
    const onSave = vi.fn();
    const { container } = render(PartyMemberEditModal, { props: baseProps({ onSave }) });

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Aric' } });

    // Default selection is the first option ('wounded', valued, defaultValue 1)
    const valueInput = screen.getByLabelText('Effect value');
    await fireEvent.input(valueInput, { target: { value: '2' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add Effect' }));

    const effectList = container.querySelector('ul.effect-list');
    expect(effectList).not.toBeNull();
    expect(within(effectList as HTMLElement).getByText('Wounded')).toBeInTheDocument();
    expect(within(effectList as HTMLElement).getByText('2')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const payload = onSave.mock.calls[0][0] as PartyMember;
    expect(payload.persistentEffects).toHaveLength(1);
    expect(payload.persistentEffects[0]).toMatchObject({
      effectId: 'wounded',
      value: 2,
      duration: { type: 'unlimited' }
    });
  });

  test('removing an existing persistent effect drops it from the save payload', async () => {
    const onSave = vi.fn();
    const initial = member({
      persistentEffects: [
        { instanceId: 'inst-1', effectId: 'wounded', value: 1, duration: { type: 'unlimited' } }
      ]
    });
    render(PartyMemberEditModal, { props: baseProps({ onSave, partyMember: initial }) });

    await fireEvent.click(screen.getByLabelText('Remove Wounded'));

    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const payload = onSave.mock.calls[0][0] as PartyMember;
    expect(payload.persistentEffects).toEqual([]);
  });
});

describe('PartyMemberEditModal — close', () => {
  test('clicking Cancel calls onClose and does not call onSave', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(PartyMemberEditModal, { props: baseProps({ onSave, onClose }) });

    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  test('clicking the close icon calls onClose', async () => {
    const onClose = vi.fn();
    render(PartyMemberEditModal, { props: baseProps({ onClose }) });

    await fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
