import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsDialog } from './settings-dialog';
import { useSettingsStore } from '@/stores/settings-store';
import { DEFAULT_SETTINGS } from '@/types';
import type { CustomAction } from '@/types';

// Mock the tauri-api module
vi.mock('@/lib/tauri-api', () => ({
  isTauri: vi.fn(() => false),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

describe('SettingsDialog Custom Actions', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSettingsStore.setState({
      settings: DEFAULT_SETTINGS,
      isLoaded: true,
      isSaving: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render existing custom actions in the list', async () => {
    // Set up store with existing custom actions
    const customActions: CustomAction[] = [
      { id: '1', name: 'Slack Notification', url: 'https://hooks.slack.com/test' },
      { id: '2', name: 'Discord Webhook', url: 'https://discord.com/api/webhooks/test' },
    ];

    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, customActions },
      isLoaded: true,
      isSaving: false,
      error: null,
    });

    render(<SettingsDialog />);

    // Open the dialog
    const triggerButton = screen.getByRole('button', { name: /settings/i });
    await userEvent.click(triggerButton);

    // Both custom actions should be rendered
    expect(screen.getByText('Slack Notification')).toBeInTheDocument();
    expect(screen.getByText('https://hooks.slack.com/test')).toBeInTheDocument();
    expect(screen.getByText('Discord Webhook')).toBeInTheDocument();
    expect(screen.getByText('https://discord.com/api/webhooks/test')).toBeInTheDocument();
  });

  it('should create a new custom action when form is submitted', async () => {
    render(<SettingsDialog />);

    // Open the dialog
    const triggerButton = screen.getByRole('button', { name: /settings/i });
    await userEvent.click(triggerButton);

    // Click "Add Action" button to show the form
    const addButton = screen.getByRole('button', { name: /add.*action/i });
    await userEvent.click(addButton);

    // Fill in the form
    const nameInput = screen.getByLabelText(/action name/i);
    const urlInput = screen.getByLabelText(/url/i);

    await userEvent.type(nameInput, 'My API Service');
    await userEvent.type(urlInput, 'https://api.example.com/webhook');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /add action/i });
    await userEvent.click(submitButton);

    // The new action should be added to the store
    await waitFor(() => {
      const state = useSettingsStore.getState();
      expect(state.settings.customActions).toHaveLength(1);
      expect(state.settings.customActions[0].name).toBe('My API Service');
      expect(state.settings.customActions[0].url).toBe('https://api.example.com/webhook');
    });
  });

  it('should remove a custom action when delete is confirmed', async () => {
    // Set up store with a custom action
    const customActions: CustomAction[] = [
      { id: 'action-1', name: 'Test Action', url: 'https://test.example.com' },
    ];

    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, customActions },
      isLoaded: true,
      isSaving: false,
      error: null,
    });

    render(<SettingsDialog />);

    // Open the dialog
    const triggerButton = screen.getByRole('button', { name: /settings/i });
    await userEvent.click(triggerButton);

    // Click the delete button
    const deleteButton = screen.getByRole('button', { name: /delete test action/i });
    await userEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
    await userEvent.click(confirmButton);

    // The action should be removed from the store
    await waitFor(() => {
      const state = useSettingsStore.getState();
      expect(state.settings.customActions).toHaveLength(0);
    });
  });

  it('should show validation error for invalid URL', async () => {
    render(<SettingsDialog />);

    // Open the dialog
    const triggerButton = screen.getByRole('button', { name: /settings/i });
    await userEvent.click(triggerButton);

    // Click "Add Action" button to show the form
    const addButton = screen.getByRole('button', { name: /add.*action/i });
    await userEvent.click(addButton);

    // Fill in the form with invalid URL
    const nameInput = screen.getByLabelText(/action name/i);
    const urlInput = screen.getByLabelText(/url/i);

    await userEvent.type(nameInput, 'Invalid Action');
    await userEvent.type(urlInput, 'not-a-valid-url');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /add action/i });
    await userEvent.click(submitButton);

    // Validation error should be shown
    await waitFor(() => {
      expect(screen.getByText(/URL must start with http:\/\/ or https:\/\//i)).toBeInTheDocument();
    });

    // The action should NOT be added to the store
    const state = useSettingsStore.getState();
    expect(state.settings.customActions).toHaveLength(0);
  });
});
