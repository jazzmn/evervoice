import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsDialog } from './settings-dialog';
import { useSettingsStore } from '@/stores/settings-store';
import { DEFAULT_SETTINGS } from '@/types';

// Mock the tauri-api module
vi.mock('@/lib/tauri-api', () => ({
  isTauri: vi.fn(() => false),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

describe('SettingsDialog', () => {
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

  describe('dialog open and close', () => {
    it('should open dialog when trigger button is clicked', async () => {
      render(<SettingsDialog />);

      // Dialog content should not be visible initially
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Click the trigger button (gear icon)
      const triggerButton = screen.getByRole('button', { name: /settings/i });
      await userEvent.click(triggerButton);

      // Dialog should now be visible
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should close dialog when cancel button is clicked', async () => {
      render(<SettingsDialog />);

      // Open the dialog
      const triggerButton = screen.getByRole('button', { name: /settings/i });
      await userEvent.click(triggerButton);

      // Dialog should be visible
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Click cancel button
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      // Dialog should be closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('form validation', () => {
    it('should show validation error for non-positive duration', async () => {
      render(<SettingsDialog />);

      // Open the dialog
      const triggerButton = screen.getByRole('button', { name: /settings/i });
      await userEvent.click(triggerButton);

      // Find the duration input and clear it, then enter 0
      const durationInput = screen.getByLabelText(/max.*duration/i);
      await userEvent.clear(durationInput);
      await userEvent.type(durationInput, '0');

      // Click save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      // Validation error should be shown
      await waitFor(() => {
        expect(screen.getByText(/must be greater than 0/i)).toBeInTheDocument();
      });
    });

    it('should accept valid positive duration', async () => {
      render(<SettingsDialog />);

      // Open the dialog
      const triggerButton = screen.getByRole('button', { name: /settings/i });
      await userEvent.click(triggerButton);

      // Find the duration input and enter a valid value
      const durationInput = screen.getByLabelText(/max.*duration/i);
      await userEvent.clear(durationInput);
      await userEvent.type(durationInput, '45');

      // Save button should be enabled (no validation error visible)
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('save action', () => {
    it('should update settings store on save', async () => {
      render(<SettingsDialog />);

      // Open the dialog
      const triggerButton = screen.getByRole('button', { name: /settings/i });
      await userEvent.click(triggerButton);

      // Update duration
      const durationInput = screen.getByLabelText(/max.*duration/i);
      await userEvent.clear(durationInput);
      await userEvent.type(durationInput, '60');

      // Click save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      // Settings should be updated in store
      await waitFor(() => {
        expect(useSettingsStore.getState().settings.maxDuration).toBe(60);
      });
    });
  });

  describe('API key masking', () => {
    it('should mask API key input by default', async () => {
      // Set an API key in the store
      useSettingsStore.setState({
        settings: { ...DEFAULT_SETTINGS, apiKey: 'sk-test-secret-key' },
        isLoaded: true,
        isSaving: false,
        error: null,
      });

      render(<SettingsDialog />);

      // Open the dialog
      const triggerButton = screen.getByRole('button', { name: /settings/i });
      await userEvent.click(triggerButton);

      // API key input should be of type password (masked)
      // Password inputs don't have the textbox role, so query by ID
      const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
      expect(apiKeyInput).toBeInTheDocument();
      expect(apiKeyInput).toHaveAttribute('type', 'password');
      expect(apiKeyInput.value).toBe('sk-test-secret-key');
    });

    it('should toggle API key visibility when show/hide button is clicked', async () => {
      render(<SettingsDialog />);

      // Open the dialog
      const triggerButton = screen.getByRole('button', { name: /settings/i });
      await userEvent.click(triggerButton);

      // API key input should be of type password initially
      const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
      expect(apiKeyInput).toHaveAttribute('type', 'password');

      // Click the show/hide toggle button
      const toggleButton = screen.getByRole('button', { name: /show api key/i });
      await userEvent.click(toggleButton);

      // API key input should now be of type text (visible)
      expect(apiKeyInput).toHaveAttribute('type', 'text');
    });
  });
});
