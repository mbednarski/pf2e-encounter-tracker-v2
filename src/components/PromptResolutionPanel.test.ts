import { describe, expect, test, vi, type Mock } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { combatant } from '../domain/test-support';
import type {
  CombatantState,
  EncounterPhase,
  Prompt,
  PromptResolution,
  TurnBoundarySuggestion
} from '../domain';
import PromptResolutionPanel from './PromptResolutionPanel.svelte';

type ResolveHandler = (promptId: string, resolution: PromptResolution) => void;

interface PromptOverrides {
  id?: string;
  ownerId?: string;
  targetId?: string;
  effectInstanceId?: string;
  effectName?: string;
  description?: string;
  suggestionType: TurnBoundarySuggestion;
  currentValue?: number;
  suggestedValue?: number;
  boundaryType?: 'turnEnd' | 'turnStart';
}

function makePrompt(overrides: PromptOverrides): Prompt {
  return {
    id: overrides.id ?? 'prompt-1',
    boundary: {
      type: overrides.boundaryType ?? 'turnEnd',
      ownerId: overrides.ownerId ?? 'goblin-1'
    },
    targetId: overrides.targetId ?? overrides.ownerId ?? 'goblin-1',
    effectInstanceId: overrides.effectInstanceId ?? 'instance-1',
    effectName: overrides.effectName ?? 'Frightened',
    description: overrides.description ?? 'Frightened decreases by 1 at end of turn.',
    suggestionType: overrides.suggestionType,
    currentValue: overrides.currentValue,
    suggestedValue: overrides.suggestedValue
  };
}

const goblin: CombatantState = combatant('goblin-1', { name: 'Goblin Warrior' });
const fighter: CombatantState = combatant('fighter-1', { name: 'Fighter' });
const combatants: Record<string, CombatantState> = {
  'goblin-1': goblin,
  'fighter-1': fighter
};

function renderPanel(props: {
  prompts: Prompt[];
  phase?: EncounterPhase;
  combatantsById?: Record<string, CombatantState>;
  onResolve?: Mock<ResolveHandler>;
}) {
  const onResolve: Mock<ResolveHandler> = props.onResolve ?? vi.fn<ResolveHandler>();
  const utils = render(PromptResolutionPanel, {
    props: {
      prompts: props.prompts,
      combatantsById: props.combatantsById ?? combatants,
      phase: props.phase ?? 'RESOLVING',
      onResolve: onResolve as unknown as ResolveHandler
    }
  });
  return { ...utils, onResolve };
}

describe('PromptResolutionPanel', () => {
  test('renders nothing when there are no pending prompts', () => {
    const { container } = renderPanel({ prompts: [] });
    expect(container.querySelector('aside')).toBeNull();
  });

  test('renders nothing when phase is not RESOLVING even if prompts exist', () => {
    const { container } = renderPanel({
      prompts: [makePrompt({ suggestionType: { type: 'reminder', description: 'x' } })],
      phase: 'ACTIVE'
    });
    expect(container.querySelector('aside')).toBeNull();
  });

  test('renders focused container with aria-live and the GM heading when active', () => {
    renderPanel({
      prompts: [makePrompt({ suggestionType: { type: 'reminder', description: 'x' } })]
    });
    const region = screen.getByLabelText('Awaiting GM resolution');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('heading', { level: 2, name: 'Awaiting GM resolution' })).toBeInTheDocument();
  });

  test('suggestDecrement prompt: shows owner boundary, target name, description, and four resolution controls', async () => {
    const onResolve = vi.fn<ResolveHandler>();
    renderPanel({
      prompts: [
        makePrompt({
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

    const accept = screen.getByRole('button', { name: 'Decrement by 1' });
    await fireEvent.click(accept);
    expect(onResolve).toHaveBeenCalledWith('prompt-1', { type: 'accept' });
  });

  test('suggestRemove prompt: shows Accept and Dismiss only (no Set, no Remove)', async () => {
    const onResolve = vi.fn<ResolveHandler>();
    renderPanel({
      prompts: [
        makePrompt({
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
        makePrompt({
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

  test('confirmSustained prompt: shows Confirm sustained, Dismiss, Remove effect', async () => {
    const onResolve = vi.fn<ResolveHandler>();
    renderPanel({
      prompts: [
        makePrompt({
          effectName: 'Bless (sustained)',
          suggestionType: { type: 'confirmSustained' }
        })
      ],
      onResolve
    });

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
        makePrompt({
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
        makePrompt({
          id: 'prompt-a',
          effectName: 'Frightened',
          suggestionType: { type: 'suggestDecrement', amount: 1 }
        }),
        makePrompt({
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
        makePrompt({
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
        makePrompt({
          ownerId: 'goblin-1',
          targetId: 'goblin-1',
          suggestionType: { type: 'reminder', description: 'x' }
        })
      ]
    });
    expect(screen.queryByText(/^on /)).toBeNull();
  });
});
