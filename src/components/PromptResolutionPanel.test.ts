import { describe, expect, test, vi, type Mock } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { combatant, prompt } from '../domain/test-support';
import type {
  AppliedEffect,
  CombatantState,
  EncounterPhase,
  Prompt,
  PromptResolution
} from '../domain';
import PromptResolutionPanel from './PromptResolutionPanel.svelte';

type ResolveHandler = (promptId: string, resolution: PromptResolution) => void;
type ApplyDamageHandler = (combatantId: string, amount: number, damageType: string) => void;

const goblin: CombatantState = combatant('goblin-1', { name: 'Goblin Warrior' });
const fighter: CombatantState = combatant('fighter-1', { name: 'Fighter' });
const combatants: Record<string, CombatantState> = {
  'goblin-1': goblin,
  'fighter-1': fighter
};

function withEffect(c: CombatantState, effect: AppliedEffect): CombatantState {
  return { ...c, appliedEffects: [...c.appliedEffects, effect] };
}

function renderPanel(props: {
  prompts: Prompt[];
  phase?: EncounterPhase;
  combatantsById?: Record<string, CombatantState>;
  onResolve?: Mock<ResolveHandler>;
  onApplyPersistentDamage?: Mock<ApplyDamageHandler>;
}) {
  const onResolve: Mock<ResolveHandler> = props.onResolve ?? vi.fn<ResolveHandler>();
  const onApplyPersistentDamage: Mock<ApplyDamageHandler> =
    props.onApplyPersistentDamage ?? vi.fn<ApplyDamageHandler>();
  const utils = render(PromptResolutionPanel, {
    props: {
      prompts: props.prompts,
      combatantsById: props.combatantsById ?? combatants,
      phase: props.phase ?? 'RESOLVING',
      onResolve: onResolve as unknown as ResolveHandler,
      onApplyPersistentDamage: onApplyPersistentDamage as unknown as ApplyDamageHandler
    }
  });
  return { ...utils, onResolve, onApplyPersistentDamage };
}

describe('PromptResolutionPanel', () => {
  test('renders nothing when there are no pending prompts', () => {
    const { container } = renderPanel({ prompts: [] });
    expect(container.querySelector('aside')).toBeNull();
  });

  test('renders nothing when phase is not RESOLVING even if prompts exist', () => {
    const { container } = renderPanel({
      prompts: [prompt({ suggestionType: { type: 'reminder', description: 'x' } })],
      phase: 'ACTIVE'
    });
    expect(container.querySelector('aside')).toBeNull();
  });

  test('renders focused container with aria-live and the GM heading when active', () => {
    renderPanel({
      prompts: [prompt({ suggestionType: { type: 'reminder', description: 'x' } })]
    });
    const region = screen.getByLabelText('Awaiting GM resolution');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('heading', { level: 2, name: 'Awaiting GM resolution' })).toBeInTheDocument();
  });

  test('suggestDecrement prompt: shows owner boundary, target name, description, and four resolution controls', async () => {
    const onResolve = vi.fn<ResolveHandler>();
    renderPanel({
      prompts: [
        prompt({
          ownerId: 'goblin-1',
          targetId: 'fighter-1',
          effectName: 'Frightened',
          description: 'Frightened decreases by 1.',
          suggestionType: { type: 'suggestDecrement', amount: 1 },
          currentValue: 2,
          suggestedValue: 1
        })
      ],
      onResolve
    });

    expect(screen.getByText("End of Goblin Warrior's turn")).toBeInTheDocument();
    expect(screen.getByText('Frightened')).toBeInTheDocument();
    expect(screen.getByText('on Fighter')).toBeInTheDocument();
    expect(screen.getByText('Frightened decreases by 1.')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Decrement by 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove effect' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Decrement by 1' }));
    expect(onResolve).toHaveBeenCalledWith('prompt-1', { type: 'accept' });
  });

  test('suggestRemove prompt: shows Accept and Dismiss only (no Set, no Remove)', async () => {
    const onResolve = vi.fn<ResolveHandler>();
    renderPanel({
      prompts: [
        prompt({
          effectName: 'Slowed',
          suggestionType: { type: 'suggestRemove', description: 'Duration expired.' }
        })
      ],
      onResolve
    });

    expect(screen.getByRole('button', { name: 'Remove (expires)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove effect' })).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Remove (expires)' }));
    expect(onResolve).toHaveBeenCalledWith('prompt-1', { type: 'accept' });
  });

  test('reminder prompt: shows only Dismiss', async () => {
    const onResolve = vi.fn<ResolveHandler>();
    renderPanel({
      prompts: [
        prompt({
          effectName: 'Persistent fire',
          suggestionType: { type: 'reminder', description: 'Roll a flat check.' }
        })
      ],
      onResolve
    });

    expect(screen.queryByRole('button', { name: /Decrement|Accept|Confirm|Remove/ })).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    await fireEvent.click(dismiss);
    expect(onResolve).toHaveBeenCalledWith('prompt-1', { type: 'dismiss' });
  });

  test('confirmSustained prompt: shows turnStart boundary, Confirm sustained, Dismiss, Remove effect', async () => {
    const onResolve = vi.fn<ResolveHandler>();
    renderPanel({
      prompts: [
        prompt({
          boundaryType: 'turnStart',
          effectName: 'Bless (sustained)',
          suggestionType: { type: 'confirmSustained' }
        })
      ],
      onResolve
    });

    expect(screen.getByText("Start of Goblin Warrior's turn")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm sustained' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove effect' })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Remove effect' }));
    expect(onResolve).toHaveBeenCalledWith('prompt-1', { type: 'remove' });
  });

  test('setValue flow: input pre-fills from suggestedValue and Set dispatches setValue', async () => {
    const onResolve = vi.fn<ResolveHandler>();
    renderPanel({
      prompts: [
        prompt({
          id: 'prompt-set',
          effectName: 'Frightened',
          suggestionType: { type: 'suggestDecrement', amount: 1 },
          currentValue: 3,
          suggestedValue: 2
        })
      ],
      onResolve
    });

    const input = screen.getByRole('spinbutton', { name: 'Set value for Frightened' }) as HTMLInputElement;
    expect(input.value).toBe('2');

    await fireEvent.input(input, { target: { value: '0' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    expect(onResolve).toHaveBeenCalledWith('prompt-set', { type: 'setValue', value: 0 });
  });

  test('renders multiple prompts in pendingPrompts order', () => {
    renderPanel({
      prompts: [
        prompt({
          id: 'prompt-a',
          effectName: 'Frightened',
          suggestionType: { type: 'suggestDecrement', amount: 1 }
        }),
        prompt({
          id: 'prompt-b',
          effectName: 'Persistent fire',
          suggestionType: { type: 'reminder', description: 'Roll flat check.' }
        })
      ]
    });

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Frightened');
    expect(items[1]).toHaveTextContent('Persistent fire');
  });

  test('Remove effect button on suggestDecrement dispatches resolution { type: remove }', async () => {
    const onResolve = vi.fn<ResolveHandler>();
    renderPanel({
      prompts: [
        prompt({
          suggestionType: { type: 'suggestDecrement', amount: 1 },
          currentValue: 1,
          suggestedValue: 0
        })
      ],
      onResolve
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Remove effect' }));
    expect(onResolve).toHaveBeenCalledWith('prompt-1', { type: 'remove' });
  });

  test('hides "on <target>" when target equals boundary owner', () => {
    renderPanel({
      prompts: [
        prompt({
          ownerId: 'goblin-1',
          targetId: 'goblin-1',
          suggestionType: { type: 'reminder', description: 'x' }
        })
      ]
    });
    expect(screen.queryByText(/^on /)).toBeNull();
  });

  test('promptResolution prompt: shows Accept (default label), Set, Dismiss, Remove and dispatches setValue', async () => {
    const onResolve = vi.fn<ResolveHandler>();
    renderPanel({
      prompts: [
        prompt({
          id: 'prompt-pr',
          effectName: 'Persistent fire',
          suggestionType: { type: 'promptResolution', description: 'Roll a flat check.' },
          currentValue: 4,
          suggestedValue: 4
        })
      ],
      onResolve
    });

    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove effect' })).toBeInTheDocument();

    const input = screen.getByRole('spinbutton', { name: 'Set value for Persistent fire' }) as HTMLInputElement;
    expect(input.value).toBe('4');

    await fireEvent.input(input, { target: { value: '2' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    expect(onResolve).toHaveBeenCalledWith('prompt-pr', { type: 'setValue', value: 2 });
  });

  test('clearing the input snaps back to the default value (reconciliation restores suggestedValue)', async () => {
    const onResolve = vi.fn<ResolveHandler>();
    renderPanel({
      prompts: [
        prompt({
          suggestionType: { type: 'suggestDecrement', amount: 1 },
          currentValue: 2,
          suggestedValue: 1
        })
      ],
      onResolve
    });

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '' } });
    expect(input.value).toBe('1');
    await fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    expect(onResolve).toHaveBeenCalledWith('prompt-1', { type: 'setValue', value: 1 });
  });

  test('setValue input falls back to currentValue when suggestedValue is undefined', () => {
    renderPanel({
      prompts: [
        prompt({
          suggestionType: { type: 'promptResolution', description: 'Roll.' },
          currentValue: 3
        })
      ]
    });

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('3');
  });

  test('setValue input falls back to 0 when both suggestedValue and currentValue are undefined', () => {
    renderPanel({
      prompts: [
        prompt({
          suggestionType: { type: 'promptResolution', description: 'Roll.' }
        })
      ]
    });

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('0');
  });

  describe('persistent-damage prompts', () => {
    function persistentEffect(overrides: Partial<AppliedEffect> = {}): AppliedEffect {
      return {
        instanceId: 'instance-1',
        effectId: 'persistent-fire',
        duration: { type: 'unlimited' },
        note: '1d6',
        ...overrides
      };
    }

    function persistentPrompt(overrides: Parameters<typeof prompt>[0] = {}): Prompt {
      return prompt({
        id: 'prompt-pd',
        ownerId: 'goblin-1',
        targetId: 'goblin-1',
        effectInstanceId: 'instance-1',
        effectName: 'Persistent Fire',
        suggestionType: { type: 'promptResolution', description: 'Take 1d6 fire damage.' },
        ...overrides
      });
    }

    test('renders Roll, damage field, Apply damage, Dismiss, Remove effect (no Accept, no Set)', () => {
      renderPanel({
        prompts: [persistentPrompt()],
        combatantsById: {
          'goblin-1': withEffect(goblin, persistentEffect())
        }
      });

      expect(screen.getByRole('button', { name: 'Roll 1d6' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Apply damage' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove effect' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Set' })).toBeNull();
      expect(screen.getByText('fire')).toBeInTheDocument();
    });

    test('Roll fills the damage field with a deterministic value', async () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5); // mid roll
      try {
        renderPanel({
          prompts: [persistentPrompt()],
          combatantsById: {
            'goblin-1': withEffect(goblin, persistentEffect({ note: '1d6' }))
          }
        });

        const input = screen.getByRole('spinbutton', {
          name: 'Damage amount for Persistent Fire'
        }) as HTMLInputElement;
        expect(input.value).toBe('');

        await fireEvent.click(screen.getByRole('button', { name: 'Roll 1d6' }));
        expect(input.value).toBe('4');
      } finally {
        spy.mockRestore();
      }
    });

    test('Apply damage dispatches onApplyPersistentDamage with combatantId, amount and damage type', async () => {
      const onApplyPersistentDamage = vi.fn<ApplyDamageHandler>();
      renderPanel({
        prompts: [persistentPrompt()],
        combatantsById: {
          'goblin-1': withEffect(goblin, persistentEffect({ effectId: 'persistent-bleed', note: '1d8' }))
        },
        onApplyPersistentDamage
      });

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: '7' } });
      await fireEvent.click(screen.getByRole('button', { name: 'Apply damage' }));

      expect(onApplyPersistentDamage).toHaveBeenCalledWith('goblin-1', 7, 'bleed');
    });

    test('Apply damage with no value or zero is ignored', async () => {
      const onApplyPersistentDamage = vi.fn<ApplyDamageHandler>();
      renderPanel({
        prompts: [persistentPrompt()],
        combatantsById: {
          'goblin-1': withEffect(goblin, persistentEffect())
        },
        onApplyPersistentDamage
      });

      await fireEvent.click(screen.getByRole('button', { name: 'Apply damage' }));
      expect(onApplyPersistentDamage).not.toHaveBeenCalled();

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: '0' } });
      await fireEvent.click(screen.getByRole('button', { name: 'Apply damage' }));
      expect(onApplyPersistentDamage).not.toHaveBeenCalled();
    });

    test('Manual entry: GM types a value without rolling and applies it', async () => {
      const onApplyPersistentDamage = vi.fn<ApplyDamageHandler>();
      renderPanel({
        prompts: [persistentPrompt()],
        combatantsById: {
          'goblin-1': withEffect(goblin, persistentEffect())
        },
        onApplyPersistentDamage
      });

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: '5' } });
      await fireEvent.click(screen.getByRole('button', { name: 'Apply damage' }));
      expect(onApplyPersistentDamage).toHaveBeenCalledWith('goblin-1', 5, 'fire');
    });

    test('formula-less effect: no Roll button; manual-only', () => {
      renderPanel({
        prompts: [persistentPrompt()],
        combatantsById: {
          'goblin-1': withEffect(goblin, persistentEffect({ note: undefined }))
        }
      });

      expect(screen.queryByRole('button', { name: /^Roll/ })).toBeNull();
      expect(screen.getByRole('button', { name: 'Apply damage' })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    test('Apply damage does not auto-resolve the prompt; Remove effect still works', async () => {
      const onResolve = vi.fn<ResolveHandler>();
      const onApplyPersistentDamage = vi.fn<ApplyDamageHandler>();
      renderPanel({
        prompts: [persistentPrompt()],
        combatantsById: {
          'goblin-1': withEffect(goblin, persistentEffect())
        },
        onResolve,
        onApplyPersistentDamage
      });

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: '4' } });
      await fireEvent.click(screen.getByRole('button', { name: 'Apply damage' }));
      expect(onApplyPersistentDamage).toHaveBeenCalled();
      expect(onResolve).not.toHaveBeenCalled();

      await fireEvent.click(screen.getByRole('button', { name: 'Remove effect' }));
      expect(onResolve).toHaveBeenCalledWith('prompt-pd', { type: 'remove' });
    });

    test('non-persistent promptResolution prompts still get the legacy Accept/Set controls', () => {
      renderPanel({
        prompts: [
          prompt({
            id: 'prompt-dying',
            effectName: 'Dying',
            suggestionType: { type: 'promptResolution', description: 'Recovery check.' },
            currentValue: 1,
            suggestedValue: 1
          })
        ],
        combatantsById: combatants
      });

      expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Set' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Roll/ })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Apply damage' })).toBeNull();
    });
  });

  test('preserves typed drafts across re-renders and drops drafts for resolved prompts', async () => {
    const promptA = prompt({
      id: 'prompt-a',
      effectName: 'Frightened',
      suggestionType: { type: 'suggestDecrement', amount: 1 },
      currentValue: 3,
      suggestedValue: 2
    });
    const promptB = prompt({
      id: 'prompt-b',
      effectName: 'Persistent fire',
      suggestionType: { type: 'promptResolution', description: 'Roll.' },
      currentValue: 4,
      suggestedValue: 4
    });

    const baseProps = {
      combatantsById: combatants,
      phase: 'RESOLVING' as EncounterPhase,
      onResolve: vi.fn<ResolveHandler>() as unknown as ResolveHandler
    };

    const { rerender } = render(PromptResolutionPanel, {
      props: { ...baseProps, prompts: [promptA] }
    });

    const inputA = screen.getByRole('spinbutton', { name: 'Set value for Frightened' }) as HTMLInputElement;
    await fireEvent.input(inputA, { target: { value: '5' } });
    expect(inputA.value).toBe('5');

    await rerender({ ...baseProps, prompts: [promptA, promptB] });

    const preservedA = screen.getByRole('spinbutton', { name: 'Set value for Frightened' }) as HTMLInputElement;
    expect(preservedA.value).toBe('5');
    const newB = screen.getByRole('spinbutton', { name: 'Set value for Persistent fire' }) as HTMLInputElement;
    expect(newB.value).toBe('4');

    await rerender({ ...baseProps, prompts: [promptB] });

    expect(screen.queryByRole('spinbutton', { name: 'Set value for Frightened' })).toBeNull();
    const stillB = screen.getByRole('spinbutton', { name: 'Set value for Persistent fire' }) as HTMLInputElement;
    expect(stillB.value).toBe('4');
  });
});
