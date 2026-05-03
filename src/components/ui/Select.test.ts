import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Wrapper from './Select.test.svelte';

describe('Select', () => {
  test('renders with the required ariaLabel and selected option', () => {
    render(Wrapper, { props: { value: 'frightened' } });
    const select = screen.getByRole('combobox', { name: 'Condition' }) as HTMLSelectElement;
    expect(select.value).toBe('frightened');
  });

  test('fires onchange with the new value when the selection changes', async () => {
    const onchange = vi.fn();
    render(Wrapper, { props: { value: 'frightened', onchange } });
    const select = screen.getByRole('combobox', { name: 'Condition' }) as HTMLSelectElement;
    select.value = 'stunned';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onchange).toHaveBeenCalledWith('stunned');
  });
});
