import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import EffectModal from './EffectModal.svelte';
import type {
  AppliedEffectView,
  ConditionGroup,
  ConditionOption,
  EffectModalTab
} from '$lib/encounter-app';

function makeApplied(overrides: Partial<AppliedEffectView> = {}): AppliedEffectView {
  return {
    instanceId: 'inst-1',
    effectId: 'frightened',
    name: 'Frightened',
    value: { kind: 'valued', current: 2, maxValue: 4 },
    duration: { type: 'unlimited' },
    durationLabel: 'unlimited',
    source: { kind: 'direct' },
    ...overrides
  };
}

function baseProps(overrides: Record<string, unknown> = {}) {
  const conditionGroups: ConditionGroup[] = [
    {
      label: 'Common',
      options: [
        { id: 'off-guard', name: 'Off-Guard', value: { kind: 'unvalued' } },
        { id: 'frightened', name: 'Frightened', value: { kind: 'valued', defaultValue: 1, maxValue: 4 } }
      ]
    }
  ];
  const persistentOptions: ConditionOption[] = [
    { id: 'persistent-fire', name: 'Persistent Fire', value: { kind: 'unvalued' } }
  ];
  const afflictionOptions: ConditionOption[] = [
    { id: 'ghoul-fever', name: 'Ghoul Fever', value: { kind: 'valued', defaultValue: 1, maxValue: 4 } }
  ];
  const effectOptions: ConditionOption[] = [
    { id: 'bless', name: 'Bless', value: { kind: 'unvalued' } }
  ];

  return {
    combatantName: 'Goblin Warrior',
    combatantHpLabel: '18/18 HP',
    initialTab: 'applied' as EffectModalTab,
    appliedEffects: [makeApplied()],
    conditionGroups,
    persistentOptions,
    afflictionOptions,
    effectOptions,
    otherCombatants: [
      { id: 'pc-1', name: 'Aric' },
      { id: 'pc-2', name: 'Bryn' }
    ],
    onApply: vi.fn(),
    onSetValue: vi.fn(),
    onModifyValue: vi.fn(),
    onSetDuration: vi.fn(),
    onRemove: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  };
}

describe('EffectModal', () => {
  test('renders header with combatant info and tab labels', () => {
    render(EffectModal, { props: baseProps() });
    expect(screen.getByText('Goblin Warrior')).toBeInTheDocument();
    expect(screen.getByText('18/18 HP')).toBeInTheDocument();
    for (const label of ['Applied', 'Conditions', 'Persistent', 'Afflictions', 'Effects']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  test('Applied tab: + and - call onModifyValue with delta', async () => {
    const onModifyValue = vi.fn();
    render(EffectModal, { props: baseProps({ onModifyValue }) });

    const inc = screen.getByRole('button', { name: 'Increase Frightened' });
    const dec = screen.getByRole('button', { name: 'Decrease Frightened' });
    await fireEvent.click(inc);
    await fireEvent.click(dec);
    expect(onModifyValue).toHaveBeenNthCalledWith(1, 'inst-1', 1);
    expect(onModifyValue).toHaveBeenNthCalledWith(2, 'inst-1', -1);
  });

  test('Applied tab: × button calls onRemove with the instance id', async () => {
    const onRemove = vi.fn();
    render(EffectModal, { props: baseProps({ onRemove }) });
    await fireEvent.click(screen.getByRole('button', { name: 'Remove Frightened' }));
    expect(onRemove).toHaveBeenCalledWith('inst-1');
  });

  test('Conditions tab: search filters chips', async () => {
    const { container } = render(
      EffectModal,
      { props: baseProps({ initialTab: 'conditions' as EffectModalTab }) }
    );
    expect(container.querySelector('[data-option-id="off-guard"]')).not.toBeNull();
    expect(container.querySelector('[data-option-id="frightened"]')).not.toBeNull();

    const search = screen.getByLabelText('Filter conditions') as HTMLInputElement;
    await fireEvent.input(search, { target: { value: 'fright' } });

    expect(container.querySelector('[data-option-id="off-guard"]')).toBeNull();
    expect(container.querySelector('[data-option-id="frightened"]')).not.toBeNull();
  });

  test('Conditions tab: clicking unvalued condition calls onApply immediately', async () => {
    const onApply = vi.fn();
    const { container } = render(
      EffectModal,
      { props: baseProps({ onApply, initialTab: 'conditions' as EffectModalTab }) }
    );
    const chip = container.querySelector('[data-option-id="off-guard"]') as HTMLButtonElement;
    await fireEvent.click(chip);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ kind: 'unvalued', effectId: 'off-guard', note: undefined });
  });

  test('Conditions tab: clicking valued condition opens the value picker; commit dispatches onApply', async () => {
    const onApply = vi.fn();
    const { container } = render(
      EffectModal,
      { props: baseProps({ onApply, initialTab: 'conditions' as EffectModalTab }) }
    );
    const chip = container.querySelector('[data-option-id="frightened"]') as HTMLButtonElement;
    await fireEvent.click(chip);

    const numberInput = screen.getByLabelText('Value for Frightened') as HTMLInputElement;
    expect(numberInput).toBeInTheDocument();
    await fireEvent.input(numberInput, { target: { value: '3' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ kind: 'valued', effectId: 'frightened', value: 3, note: undefined });
  });

  test('Persistent tab: clicking a damage type opens formula popover; Apply dispatches with note', async () => {
    const onApply = vi.fn();
    const { container } = render(
      EffectModal,
      { props: baseProps({ onApply, initialTab: 'persistent' as EffectModalTab }) }
    );
    await fireEvent.click(container.querySelector('[data-option-id="persistent-fire"]') as HTMLButtonElement);
    const formula = screen.getByLabelText('Persistent Fire damage formula') as HTMLInputElement;
    await fireEvent.input(formula, { target: { value: '2d6' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ kind: 'unvalued', effectId: 'persistent-fire', note: '2d6' });
  });

  test('Persistent tab: chip strips the "Persistent" prefix from its visible label but keeps the full name as accessible name', () => {
    const { container } = render(
      EffectModal,
      { props: baseProps({ initialTab: 'persistent' as EffectModalTab }) }
    );
    const chip = container.querySelector('[data-option-id="persistent-fire"]') as HTMLButtonElement;
    expect(chip).not.toBeNull();
    expect(chip.textContent ?? '').not.toMatch(/Persistent/i);
    expect(chip.textContent ?? '').toMatch(/Fire/);
    expect(chip.getAttribute('aria-label')).toBe('Persistent Fire');
  });

  test('Escape and backdrop click both call onClose', async () => {
    const onClose = vi.fn();
    const { container } = render(EffectModal, { props: baseProps({ onClose }) });
    await fireEvent.keyDown(container.querySelector('.modal-card')!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    await fireEvent.click(screen.getByRole('button', { name: 'Close effect modal' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('EffectModal — duration editor', () => {
  test('Applied tab: edit → Save with type=unlimited dispatches onSetDuration with {type:"unlimited"}', async () => {
    const onSetDuration = vi.fn();
    render(EffectModal, { props: baseProps({ onSetDuration }) });

    await fireEvent.click(screen.getByRole('button', { name: 'Edit duration for Frightened' }));

    // Default type buffer matches the current duration ('unlimited'), so we just save.
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSetDuration).toHaveBeenCalledTimes(1);
    expect(onSetDuration).toHaveBeenCalledWith('inst-1', { type: 'unlimited' });
  });

  test('Applied tab: rounds branch dispatches {type:"rounds", count}', async () => {
    const onSetDuration = vi.fn();
    render(EffectModal, { props: baseProps({ onSetDuration }) });

    await fireEvent.click(screen.getByRole('button', { name: 'Edit duration for Frightened' }));

    const typeSelect = screen.getByLabelText('Type') as HTMLSelectElement;
    await fireEvent.change(typeSelect, { target: { value: 'rounds' } });

    const countInput = screen.getByLabelText('Round count') as HTMLInputElement;
    await fireEvent.input(countInput, { target: { value: '3' } });

    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSetDuration).toHaveBeenCalledWith('inst-1', { type: 'rounds', count: 3 });
  });

  test('Applied tab: untilTurnEnd branch dispatches {type, combatantId} from the dropdown default', async () => {
    const onSetDuration = vi.fn();
    render(EffectModal, { props: baseProps({ onSetDuration }) });

    await fireEvent.click(screen.getByRole('button', { name: 'Edit duration for Frightened' }));
    const typeSelect = screen.getByLabelText('Type') as HTMLSelectElement;
    await fireEvent.change(typeSelect, { target: { value: 'untilTurnEnd' } });

    // The combatant select defaults to the first otherCombatant ('pc-1').
    expect(
      screen.getByLabelText('Combatant whose turn anchors the duration')
    ).toHaveValue('pc-1');

    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSetDuration).toHaveBeenCalledWith('inst-1', {
      type: 'untilTurnEnd',
      combatantId: 'pc-1'
    });
  });

  test('Applied tab: conditional branch dispatches {type:"conditional", description}', async () => {
    const onSetDuration = vi.fn();
    render(EffectModal, { props: baseProps({ onSetDuration }) });

    await fireEvent.click(screen.getByRole('button', { name: 'Edit duration for Frightened' }));
    const typeSelect = screen.getByLabelText('Type') as HTMLSelectElement;
    await fireEvent.change(typeSelect, { target: { value: 'conditional' } });

    const descInput = screen.getByLabelText('Conditional description') as HTMLInputElement;
    await fireEvent.input(descInput, { target: { value: '  After dawn  ' } });

    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSetDuration).toHaveBeenCalledWith('inst-1', {
      type: 'conditional',
      description: 'After dawn'
    });
  });

  test('Applied tab: conditional with a blank description falls back to "conditional"', async () => {
    const onSetDuration = vi.fn();
    render(EffectModal, { props: baseProps({ onSetDuration }) });

    await fireEvent.click(screen.getByRole('button', { name: 'Edit duration for Frightened' }));
    const typeSelect = screen.getByLabelText('Type') as HTMLSelectElement;
    await fireEvent.change(typeSelect, { target: { value: 'conditional' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSetDuration).toHaveBeenCalledWith('inst-1', {
      type: 'conditional',
      description: 'conditional'
    });
  });

  test('Applied tab: Cancel closes the editor without calling onSetDuration', async () => {
    const onSetDuration = vi.fn();
    render(EffectModal, { props: baseProps({ onSetDuration }) });

    await fireEvent.click(screen.getByRole('button', { name: 'Edit duration for Frightened' }));
    expect(screen.getByLabelText('Type')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSetDuration).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Type')).not.toBeInTheDocument();
  });
});

describe('EffectModal — afflictions tab', () => {
  test('clicking a valued affliction opens a stage picker; Apply dispatches onApply', async () => {
    const onApply = vi.fn();
    const { container } = render(
      EffectModal,
      { props: baseProps({ onApply, initialTab: 'afflictions' as EffectModalTab }) }
    );

    const chip = container.querySelector('[data-option-id="ghoul-fever"]') as HTMLButtonElement;
    expect(chip).not.toBeNull();
    await fireEvent.click(chip);

    const stageInput = screen.getByLabelText('Stage for Ghoul Fever') as HTMLInputElement;
    await fireEvent.input(stageInput, { target: { value: '3' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({
      kind: 'valued',
      effectId: 'ghoul-fever',
      value: 3,
      note: undefined
    });
  });

  test('Cancel inside the stage picker closes it without dispatching onApply', async () => {
    const onApply = vi.fn();
    const { container } = render(
      EffectModal,
      { props: baseProps({ onApply, initialTab: 'afflictions' as EffectModalTab }) }
    );

    await fireEvent.click(container.querySelector('[data-option-id="ghoul-fever"]') as HTMLButtonElement);
    expect(screen.getByLabelText('Stage for Ghoul Fever')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Stage for Ghoul Fever')).not.toBeInTheDocument();
  });
});
