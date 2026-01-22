import { create } from 'zustand';
import type { Settings, CustomAction } from '@/types';
import { DEFAULT_SETTINGS, DEFAULT_GLOBAL_HOTKEY } from '@/types';
import { getSettings, saveSettings, isTauri, updateGlobalHotkey } from '@/lib/tauri-api';

interface SettingsState {
  /** Current settings values */
  settings: Settings;
  /** Whether settings have been loaded from persistence */
  isLoaded: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Last error message from settings operations */
  error: string | null;
}

interface SettingsActions {
  /** Load settings from Tauri backend on app start */
  loadSettings: () => Promise<void>;
  /** Update max duration setting */
  setMaxDuration: (maxDuration: number) => Promise<void>;
  /** Update API key setting */
  setApiKey: (apiKey: string | null) => Promise<void>;
  /** Update global hotkey setting */
  setGlobalHotkey: (hotkey: string | null) => Promise<{ success: boolean; error?: string }>;
  /** Update all settings at once */
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  /** Add a custom action - generates unique id */
  addCustomAction: (name: string, url: string) => Promise<void>;
  /** Remove a custom action by id */
  removeCustomAction: (id: string) => Promise<void>;
  /** Clear any error state */
  clearError: () => void;
  /** Get the effective global hotkey (user setting or default) */
  getEffectiveGlobalHotkey: () => string;
}

export type SettingsStore = SettingsState & SettingsActions;

/**
 * Generate a unique ID for custom actions
 * Uses crypto.randomUUID when available, falls back to timestamp-based ID
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  // Initial state
  settings: DEFAULT_SETTINGS,
  isLoaded: false,
  isSaving: false,
  error: null,

  // Actions
  loadSettings: async () => {
    // Skip if not in Tauri environment (e.g., during SSR or testing)
    if (!isTauri()) {
      set({ isLoaded: true });
      return;
    }

    try {
      const settings = await getSettings();
      // Ensure customActions array exists for backward compatibility
      const normalizedSettings: Settings = {
        ...settings,
        customActions: settings.customActions ?? [],
        globalHotkey: settings.globalHotkey ?? null,
      };
      set({ settings: normalizedSettings, isLoaded: true, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load settings';
      set({ error: message, isLoaded: true });
    }
  },

  setMaxDuration: async (maxDuration: number) => {
    const { settings } = get();
    const newSettings = { ...settings, maxDuration };
    await get().updateSettings(newSettings);
  },

  setApiKey: async (apiKey: string | null) => {
    const { settings } = get();
    const newSettings = { ...settings, apiKey };
    await get().updateSettings(newSettings);
  },

  setGlobalHotkey: async (hotkey: string | null) => {
    const { settings } = get();
    const oldHotkey = settings.globalHotkey;

    // Skip persistence if not in Tauri environment
    if (!isTauri()) {
      set({ settings: { ...settings, globalHotkey: hotkey }, error: null });
      return { success: true };
    }

    set({ isSaving: true, error: null });

    try {
      // First, try to update the hotkey in the backend
      const effectiveNewHotkey = hotkey ?? DEFAULT_GLOBAL_HOTKEY;
      const result = await updateGlobalHotkey(oldHotkey, effectiveNewHotkey);

      if (!result.success) {
        set({ error: result.message || 'Failed to update hotkey', isSaving: false });
        return { success: false, error: result.message };
      }

      // Then save the settings
      const newSettings = { ...settings, globalHotkey: hotkey };
      await saveSettings(newSettings);
      set({ settings: newSettings, isSaving: false });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update hotkey';
      set({ error: message, isSaving: false });
      return { success: false, error: message };
    }
  },

  updateSettings: async (newSettings: Partial<Settings>) => {
    const { settings } = get();
    const mergedSettings = { ...settings, ...newSettings };

    // Validate max duration on the client side
    if (mergedSettings.maxDuration <= 0) {
      set({ error: 'Max duration must be greater than 0' });
      return;
    }
    if (mergedSettings.maxDuration > 180) {
      set({ error: 'Max duration cannot exceed 180 minutes' });
      return;
    }

    // Skip persistence if not in Tauri environment
    if (!isTauri()) {
      set({ settings: mergedSettings, error: null });
      return;
    }

    set({ isSaving: true, error: null });

    try {
      await saveSettings(mergedSettings);
      set({ settings: mergedSettings, isSaving: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save settings';
      set({ error: message, isSaving: false });
    }
  },

  addCustomAction: async (name: string, url: string) => {
    const { settings } = get();
    const newAction: CustomAction = {
      id: generateId(),
      name,
      url,
    };
    const updatedActions = [...settings.customActions, newAction];
    await get().updateSettings({ customActions: updatedActions });
  },

  removeCustomAction: async (id: string) => {
    const { settings } = get();
    const updatedActions = settings.customActions.filter((action) => action.id !== id);
    await get().updateSettings({ customActions: updatedActions });
  },

  clearError: () => {
    set({ error: null });
  },

  getEffectiveGlobalHotkey: () => {
    const { settings } = get();
    return settings.globalHotkey ?? DEFAULT_GLOBAL_HOTKEY;
  },
}));
