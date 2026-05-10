import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import type { Creature } from '../domain';
import LibraryManageModal from './LibraryManageModal.svelte';

function creature(id: string, name: string, traits: string[] = [], level = 1): Creature {
  return {
    id,
    name,
    level,
    traits,
    size: 'medium',
    rarity: 'common',
    ac: 16,
    fortitude: 5,
    reflex: 5,
    will: 5,
    perception: 5,
    hp: 20,
    immunities: [],
    resistances: [],
    weaknesses: [],
    speed: { land: 25 },
    attacks: [],
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: [],
    skills: {},
    source: 'test',
    tags: []
  };
}

describe('LibraryManageModal', () => {
  test('lists every creature passed in', () => {
    render(LibraryManageModal, {
      props: {
        creatures: [
          creature('a', 'Goblin Warrior', ['goblin'], 1),
          creature('b', 'Cave Wolf', ['animal'], 2)
        ],
        onRemove: vi.fn(),
        onClose: vi.fn()
      }
    });
    expect(screen.getByText('Goblin Warrior')).toBeInTheDocument();
    expect(screen.getByText('Cave Wolf')).toBeInTheDocument();
  });

  test('shows the empty-library message when no creatures are passed', () => {
    render(LibraryManageModal, {
      props: { creatures: [], onRemove: vi.fn(), onClose: vi.fn() }
    });
    expect(
      screen.getByText('Your library is empty. Import a YAML file to add creatures.')
    ).toBeInTheDocument();
  });

  test('Remove button does not immediately call onRemove — requires inline confirm', async () => {
    const onRemove = vi.fn();
    render(LibraryManageModal, {
      props: {
        creatures: [creature('a', 'Goblin Warrior', ['goblin'], 1)],
        onRemove,
        onClose: vi.fn()
      }
    });
    await fireEvent.click(
      screen.getByRole('button', { name: 'Remove Goblin Warrior from library' })
    );
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByText('Delete?')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onRemove).toHaveBeenCalledWith('a');
  });

  test('Cancel during inline confirm aborts the removal', async () => {
    const onRemove = vi.fn();
    render(LibraryManageModal, {
      props: {
        creatures: [creature('a', 'Goblin Warrior', ['goblin'], 1)],
        onRemove,
        onClose: vi.fn()
      }
    });
    await fireEvent.click(
      screen.getByRole('button', { name: 'Remove Goblin Warrior from library' })
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
  });

  test('Escape closes the modal when no inline confirm is open', async () => {
    const onClose = vi.fn();
    render(LibraryManageModal, {
      props: {
        creatures: [creature('a', 'Goblin Warrior', ['goblin'], 1)],
        onRemove: vi.fn(),
        onClose
      }
    });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  test('Escape cancels an open inline confirm before closing the modal', async () => {
    const onClose = vi.fn();
    const onRemove = vi.fn();
    render(LibraryManageModal, {
      props: {
        creatures: [creature('a', 'Goblin Warrior', ['goblin'], 1)],
        onRemove,
        onClose
      }
    });
    await fireEvent.click(
      screen.getByRole('button', { name: 'Remove Goblin Warrior from library' })
    );
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
  });

  test('Done button calls onClose', async () => {
    const onClose = vi.fn();
    render(LibraryManageModal, {
      props: {
        creatures: [creature('a', 'Goblin Warrior', ['goblin'], 1)],
        onRemove: vi.fn(),
        onClose
      }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });
});
