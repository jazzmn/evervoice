import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useSettingsStore } from './settings-store';
import { DEFAULT_SETTINGS, DEFAULT_GLOBAL_HOTKEY } from '@/types';

// Mock the tauri-api module
vi.mock('@/lib/tauri-api', () => ({
  isTauri: vi.fn(() => true),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  updateGlobalHotkey: vi.fn(),
}));

// Import mocked functions for assertions
import { getSettings, saveSettings, isTauri, updateGlobalHotkey } from '@/lib/tauri-api';
const mockGetSettings = vi.mocked(getSettings);
const mockSaveSettings = vi.mocked(saveSettings);
const mockIsTauri = vi.mocked(isTauri);
const mockUpdateGlobalHotkey = vi.mocked(updateGlobalHotkey);

describe('Settings Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSettingsStore.setState({
      settings: DEFAULT_SETTINGS,
      isLoaded: false,
      isSaving: false,
      error: null,
    });

    // Clear all mocks
    vi.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockUpdateGlobalHotkey.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialization and persistence', () => {
    it('should initialize with default settings', () => {
      const state = useSettingsStore.getState();
      expect(state.settings).toEqual(DEFAULT_SETTINGS);
      expect(state.settings.maxDuration).toBe(5);
      expect(state.settings.apiKey).toBeNull();
      expect(state.settings.customActions).toEqual([]);
      expect(state.settings.globalHotkey).toBeNull();
      expect(state.isLoaded).toBe(false);
    });

    it('should load settings from backend on loadSettings call', async () => {
      const savedSettings = {
        maxDuration: 60,
        apiKey: 'test-api-key',
        language: 'de',
        customActions: [],
        globalHotkey: 'Alt+R',
      };
      mockGetSettings.mockResolvedValue(savedSettings);

      await useSettingsStore.getState().loadSettings();

      expect(mockGetSettings).toHaveBeenCalled();
      expect(useSettingsStore.getState().settings).toEqual(savedSettings);
      expect(useSettingsStore.getState().isLoaded).toBe(true);
    });

    it('should persist settings via save command', async () => {
      mockSaveSettings.mockResolvedValue(undefined);

      const newSettings = { maxDuration: 45, apiKey: 'new-key', language: 'de', customActions: [], globalHotkey: null };
      await useSettingsStore.getState().updateSettings(newSettings);

      expect(mockSaveSettings).toHaveBeenCalledWith(newSettings);
      expect(useSettingsStore.getState().settings).toEqual(newSettings);
    });
  });

  describe('max duration setting', () => {
    it('should update max duration and persist', async () => {
      mockSaveSettings.mockResolvedValue(undefined);

      await useSettingsStore.getState().setMaxDuration(60);

      expect(mockSaveSettings).toHaveBeenCalledWith({
        ...DEFAULT_SETTINGS,
        maxDuration: 60,
      });
      expect(useSettingsStore.getState().settings.maxDuration).toBe(60);
    });

    it('should reject invalid max duration (zero)', async () => {
      await useSettingsStore.getState().setMaxDuration(0);

      expect(mockSaveSettings).not.toHaveBeenCalled();
      expect(useSettingsStore.getState().error).toBe('Max duration must be greater than 0');
    });

    it('should reject max duration exceeding limit', async () => {
      await useSettingsStore.getState().setMaxDuration(200);

      expect(mockSaveSettings).not.toHaveBeenCalled();
      expect(useSettingsStore.getState().error).toBe('Max duration cannot exceed 180 minutes');
    });
  });

  describe('API key setting', () => {
    it('should update API key and persist', async () => {
      mockSaveSettings.mockResolvedValue(undefined);

      await useSettingsStore.getState().setApiKey('sk-test-key');

      expect(mockSaveSettings).toHaveBeenCalledWith({
        ...DEFAULT_SETTINGS,
        apiKey: 'sk-test-key',
      });
      expect(useSettingsStore.getState().settings.apiKey).toBe('sk-test-key');
    });

    it('should allow setting API key to null', async () => {
      // First set a key
      mockSaveSettings.mockResolvedValue(undefined);
      await useSettingsStore.getState().setApiKey('test-key');

      // Then clear it
      await useSettingsStore.getState().setApiKey(null);

      expect(useSettingsStore.getState().settings.apiKey).toBeNull();
    });
  });

  describe('global hotkey setting', () => {
    it('should update global hotkey and persist', async () => {
      mockUpdateGlobalHotkey.mockResolvedValue({ success: true });
      mockSaveSettings.mockResolvedValue(undefined);

      const result = await useSettingsStore.getState().setGlobalHotkey('Alt+R');

      expect(result.success).toBe(true);
      expect(mockUpdateGlobalHotkey).toHaveBeenCalledWith(null, 'Alt+R');
      expect(mockSaveSettings).toHaveBeenCalledWith({
        ...DEFAULT_SETTINGS,
        globalHotkey: 'Alt+R',
      });
      expect(useSettingsStore.getState().settings.globalHotkey).toBe('Alt+R');
    });

    it('should handle hotkey update failure', async () => {
      mockUpdateGlobalHotkey.mockResolvedValue({
        success: false,
        message: 'Hotkey conflict',
      });

      const result = await useSettingsStore.getState().setGlobalHotkey('Ctrl+C');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Hotkey conflict');
      expect(mockSaveSettings).not.toHaveBeenCalled();
    });

    it('should use default when setting hotkey to null', async () => {
      // First set a custom hotkey
      mockUpdateGlobalHotkey.mockResolvedValue({ success: true });
      mockSaveSettings.mockResolvedValue(undefined);
      await useSettingsStore.getState().setGlobalHotkey('Alt+R');

      // Then reset to null (should use default)
      await useSettingsStore.getState().setGlobalHotkey(null);

      expect(mockUpdateGlobalHotkey).toHaveBeenLastCalledWith('Alt+R', DEFAULT_GLOBAL_HOTKEY);
    });

    it('should return effective global hotkey', async () => {
      // When null, should return default
      expect(useSettingsStore.getState().getEffectiveGlobalHotkey()).toBe(DEFAULT_GLOBAL_HOTKEY);

      // When set, should return the set value
      mockUpdateGlobalHotkey.mockResolvedValue({ success: true });
      mockSaveSettings.mockResolvedValue(undefined);
      await useSettingsStore.getState().setGlobalHotkey('Alt+R');

      expect(useSettingsStore.getState().getEffectiveGlobalHotkey()).toBe('Alt+R');
    });
  });

  describe('custom actions', () => {
    it('should persist customActions array when adding and removing actions', async () => {
      mockSaveSettings.mockResolvedValue(undefined);

      // Add a custom action
      await useSettingsStore.getState().addCustomAction('My Action', 'https://api.example.com/webhook');

      // Verify the action was added
      const { customActions } = useSettingsStore.getState().settings;
      expect(customActions).toHaveLength(1);
      expect(customActions[0].name).toBe('My Action');
      expect(customActions[0].url).toBe('https://api.example.com/webhook');
      expect(customActions[0].id).toBeDefined();

      // Verify persistence was called with customActions
      expect(mockSaveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          customActions: expect.arrayContaining([
            expect.objectContaining({
              name: 'My Action',
              url: 'https://api.example.com/webhook',
            }),
          ]),
        })
      );

      // Remove the action
      const actionId = customActions[0].id;
      await useSettingsStore.getState().removeCustomAction(actionId);

      // Verify the action was removed
      expect(useSettingsStore.getState().settings.customActions).toHaveLength(0);
    });
  });

  describe('default values', () => {
    it('should return defaults when settings are not found', async () => {
      // Simulate backend returning default settings
      mockGetSettings.mockResolvedValue(DEFAULT_SETTINGS);

      await useSettingsStore.getState().loadSettings();

      expect(useSettingsStore.getState().settings.maxDuration).toBe(5);
      expect(useSettingsStore.getState().settings.apiKey).toBeNull();
      expect(useSettingsStore.getState().settings.customActions).toEqual([]);
      expect(useSettingsStore.getState().settings.globalHotkey).toBeNull();
    });

    it('should handle error loading settings gracefully', async () => {
      mockGetSettings.mockRejectedValue(new Error('Store not found'));

      await useSettingsStore.getState().loadSettings();

      // Should still mark as loaded even on error
      expect(useSettingsStore.getState().isLoaded).toBe(true);
      expect(useSettingsStore.getState().error).toBe('Store not found');
      // Should retain default settings on error
      expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('non-Tauri environment', () => {
    it('should work without Tauri backend', async () => {
      mockIsTauri.mockReturnValue(false);

      await useSettingsStore.getState().loadSettings();
      expect(mockGetSettings).not.toHaveBeenCalled();
      expect(useSettingsStore.getState().isLoaded).toBe(true);

      await useSettingsStore.getState().setMaxDuration(45);
      expect(mockSaveSettings).not.toHaveBeenCalled();
      expect(useSettingsStore.getState().settings.maxDuration).toBe(45);
    });

    it('should update hotkey in non-Tauri environment without backend call', async () => {
      mockIsTauri.mockReturnValue(false);

      const result = await useSettingsStore.getState().setGlobalHotkey('Alt+R');

      expect(result.success).toBe(true);
      expect(mockUpdateGlobalHotkey).not.toHaveBeenCalled();
      expect(mockSaveSettings).not.toHaveBeenCalled();
      expect(useSettingsStore.getState().settings.globalHotkey).toBe('Alt+R');
    });
  });
});
