import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import SettingsPage from './+page.svelte';
import { clearApiKey, loadApiKey, saveApiKey } from '$lib/storage/settings';

beforeEach(async () => {
  await clearApiKey();
});

afterEach(async () => {
  await clearApiKey();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('settings page — initial state', () => {
  test('shows "No key configured" and disables Clear when no key is stored', async () => {
    render(SettingsPage);
    await waitFor(() => {
      expect(screen.getByText('No key configured')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  test('shows "Key set" after a key has been saved', async () => {
    await saveApiKey('sk-secret-shhh');
    render(SettingsPage);
    await waitFor(() => {
      expect(screen.getByText('Key set')).toBeInTheDocument();
    });
  });

  test('the stored key never appears in the DOM (presence-only contract)', async () => {
    const SECRET = 'sk-this-must-never-render-abc123';
    await saveApiKey(SECRET);
    render(SettingsPage);
    await waitFor(() => {
      expect(screen.getByText('Key set')).toBeInTheDocument();
    });

    // The key text must not appear anywhere in the rendered DOM,
    // and the input must not be pre-populated with it.
    expect(document.body.textContent).not.toContain(SECRET);
    const input = screen.getByLabelText('API key') as HTMLInputElement;
    expect(input.value).toBe('');
  });
});

describe('settings page — Save', () => {
  test('Save is disabled while input is empty', async () => {
    render(SettingsPage);
    await waitFor(() => {
      expect(screen.getByText('No key configured')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  test('Save is disabled when input is whitespace-only', async () => {
    render(SettingsPage);
    await waitFor(() => {
      expect(screen.getByText('No key configured')).toBeInTheDocument();
    });
    const input = screen.getByLabelText('API key') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  test('Save persists the trimmed key, clears the input, and shows success feedback', async () => {
    render(SettingsPage);
    await waitFor(() => {
      expect(screen.getByText('No key configured')).toBeInTheDocument();
    });
    const input = screen.getByLabelText('API key') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '  sk-fresh-key  ' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Saved.')).toBeInTheDocument();
    });
    expect(input.value).toBe('');
    expect(screen.getByText('Key set')).toBeInTheDocument();
    expect(await loadApiKey()).toBe('sk-fresh-key');
  });
});

describe('settings page — Clear', () => {
  test('Clear with confirm=false does NOT clear the key', async () => {
    await saveApiKey('keep-me');
    render(SettingsPage);
    await waitFor(() => {
      expect(screen.getByText('Key set')).toBeInTheDocument();
    });

    vi.stubGlobal('confirm', vi.fn(() => false));
    await fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(await loadApiKey()).toBe('keep-me');
    expect(screen.getByText('Key set')).toBeInTheDocument();
  });

  test('Clear with confirm=true removes the key and shows success feedback', async () => {
    await saveApiKey('byebye');
    render(SettingsPage);
    await waitFor(() => {
      expect(screen.getByText('Key set')).toBeInTheDocument();
    });

    vi.stubGlobal('confirm', vi.fn(() => true));
    await fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(screen.getByText('Cleared.')).toBeInTheDocument();
    });
    expect(await loadApiKey()).toBeNull();
    expect(screen.getByText('No key configured')).toBeInTheDocument();
  });
});

describe('settings page — Show/Hide toggle', () => {
  test('input starts as type="password" and toggles between password and text', async () => {
    render(SettingsPage);
    const input = screen.getByLabelText('API key') as HTMLInputElement;
    expect(input.type).toBe('password');

    await fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(input.type).toBe('text');

    await fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(input.type).toBe('password');
  });
});

describe('settings page — IndexedDB unavailable', () => {
  test('shows an error alert at mount and disables Save and Clear', async () => {
    vi.stubGlobal('indexedDB', undefined);
    render(SettingsPage);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/IndexedDB is unavailable/i);
    });

    // Even with valid input, Save must stay disabled because storage is gone —
    // otherwise the user could click Save and silently lose their key.
    const input = screen.getByLabelText('API key') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'should-not-save' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });
});
