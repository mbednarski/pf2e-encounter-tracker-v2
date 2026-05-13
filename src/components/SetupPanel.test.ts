import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import SetupPanel from './SetupPanel.svelte';

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    canStart: false,
    onAddManual: vi.fn(),
    onStart: vi.fn(),
    onReset: vi.fn(),
    ...overrides
  };
}

describe('SetupPanel — Start Encounter button', () => {
  test('Start is disabled when canStart=false', () => {
    render(SetupPanel, { props: baseProps({ canStart: false }) });
    expect(screen.getByRole('button', { name: 'Start Encounter' })).toBeDisabled();
  });

  test('Start is enabled and calls onStart when canStart=true', async () => {
    const onStart = vi.fn();
    render(SetupPanel, { props: baseProps({ canStart: true, onStart }) });
    const button = screen.getByRole('button', { name: 'Start Encounter' });
    expect(button).not.toBeDisabled();
    await fireEvent.click(button);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  test('Reset Local button calls onReset', async () => {
    const onReset = vi.fn();
    render(SetupPanel, { props: baseProps({ onReset }) });
    await fireEvent.click(screen.getByRole('button', { name: 'Reset Local' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe('SetupPanel — Custom Combatant form', () => {
  test('submitting the form with defaults calls onAddManual with the seeded values', async () => {
    const onAddManual = vi.fn();
    const { container } = render(SetupPanel, { props: baseProps({ onAddManual }) });
    const form = container.querySelector('form.manual-form') as HTMLFormElement;
    await fireEvent.submit(form);
    expect(onAddManual).toHaveBeenCalledTimes(1);
    expect(onAddManual).toHaveBeenCalledWith({
      name: 'Goblin Warrior',
      maxHp: 18,
      ac: 16,
      fortitude: 6,
      reflex: 8,
      will: 5,
      perception: 7,
      speed: 25
    });
  });

  test('blank name falls back to "Combatant"', async () => {
    const onAddManual = vi.fn();
    const { container } = render(SetupPanel, { props: baseProps({ onAddManual }) });
    const nameInput = screen.getByLabelText(/^Name/) as HTMLInputElement;
    await fireEvent.input(nameInput, { target: { value: '   ' } });

    const form = container.querySelector('form.manual-form') as HTMLFormElement;
    await fireEvent.submit(form);

    expect(onAddManual).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Combatant' })
    );
  });

  test('trimmed name is passed through', async () => {
    const onAddManual = vi.fn();
    const { container } = render(SetupPanel, { props: baseProps({ onAddManual }) });
    const nameInput = screen.getByLabelText(/^Name/) as HTMLInputElement;
    await fireEvent.input(nameInput, { target: { value: '  Cave Wolf  ' } });

    await fireEvent.submit(container.querySelector('form.manual-form') as HTMLFormElement);

    expect(onAddManual).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Cave Wolf' })
    );
  });

  test('non-finite numeric inputs fall back to their per-field defaults', async () => {
    // Svelte binds numeric inputs as NaN when the field is cleared. numberOrDefault
    // is the guard that prevents NaN from leaking into the payload.
    const onAddManual = vi.fn();
    const { container } = render(SetupPanel, { props: baseProps({ onAddManual }) });

    const hpInput = screen.getByLabelText(/^HP/) as HTMLInputElement;
    const acInput = screen.getByLabelText(/^AC/) as HTMLInputElement;
    await fireEvent.input(hpInput, { target: { value: '' } });
    await fireEvent.input(acInput, { target: { value: '' } });

    await fireEvent.submit(container.querySelector('form.manual-form') as HTMLFormElement);

    expect(onAddManual).toHaveBeenCalledWith(
      expect.objectContaining({ maxHp: 1, ac: 10 })
    );
  });

  test('truncates fractional inputs (e.g. 18.7 → 18)', async () => {
    const onAddManual = vi.fn();
    const { container } = render(SetupPanel, { props: baseProps({ onAddManual }) });

    const hpInput = screen.getByLabelText(/^HP/) as HTMLInputElement;
    await fireEvent.input(hpInput, { target: { value: '18.7' } });

    await fireEvent.submit(container.querySelector('form.manual-form') as HTMLFormElement);

    expect(onAddManual).toHaveBeenCalledWith(
      expect.objectContaining({ maxHp: 18 })
    );
  });
});
