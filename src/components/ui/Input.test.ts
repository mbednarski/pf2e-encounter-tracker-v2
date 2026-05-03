import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Input from './Input.svelte';

describe('Input', () => {
  test('renders with the required ariaLabel', () => {
    render(Input, { props: { ariaLabel: 'Search bestiary' } });
    expect(screen.getByRole('textbox', { name: 'Search bestiary' })).toBeInTheDocument();
  });

  test('reflects the initial value', () => {
    render(Input, { props: { ariaLabel: 'Name', value: 'Kael' } });
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Kael');
  });

  test('fires oninput with the new string when typed', async () => {
    const oninput = vi.fn();
    render(Input, { props: { ariaLabel: 'Name', oninput } });
    const input = screen.getByRole('textbox', { name: 'Name' });
    await fireEvent.input(input, { target: { value: 'Kael' } });
    expect(oninput).toHaveBeenCalledWith('Kael');
  });

  test('renders the placeholder', () => {
    render(Input, { props: { ariaLabel: 'Name', placeholder: 'Search…' } });
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
  });

  test('honors the type prop for search inputs', () => {
    render(Input, { props: { ariaLabel: 'Search', type: 'search' } });
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument();
  });
});
