import { create } from 'zustand';
import type { Recording } from '@/types';
import {
  getHistory,
  saveRecordingHistory,
  deleteRecordingHistory,
  isTauri,
} from '@/lib/tauri-api';
import { useRecordingStore } from './recording-store';

/**
 * History store state interface
 */
interface HistoryStoreState {
  /** Array of recording history items */
  recordings: Recording[];
  /** Currently selected recording ID for display */
  selectedRecordingId: string | null;
  /** Currently playing recording ID for audio playback */
  playingRecordingId: string | null;
  /** Loading state for async operations */
  isLoading: boolean;
  /** Error message from history operations */
  error: string | null;
}

/**
 * History store actions interface
 */
interface HistoryStoreActions {
  /** Load all recording history from store */
  loadHistory: () => Promise<void>;
  /** Select a recording by ID for display */
  selectRecording: (id: string | null) => void;
  /** Add a new recording to history and persist */
  addRecording: (filePath: string, durationSeconds: number, transcription: string) => Promise<void>;
  /** Delete a recording from history and persist */
  deleteRecording: (id: string) => Promise<void>;
  /** Delete all recordings from history */
  clearAllRecordings: () => Promise<void>;
  /** Clear any error state */
  clearError: () => void;
  /** Start playback of a recording by ID */
  startPlayback: (id: string) => void;
  /** Stop the currently playing recording */
  stopPlayback: () => void;
}

export type HistoryStore = HistoryStoreState & HistoryStoreActions;

/**
 * Initial state for the history store
 */
const initialState: HistoryStoreState = {
  recordings: [],
  selectedRecordingId: null,
  playingRecordingId: null,
  isLoading: false,
  error: null,
};

/**
 * Zustand store for managing recording history
 */
export const useHistoryStore = create<HistoryStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Actions
  loadHistory: async () => {
    // Skip if not in Tauri environment
    if (!isTauri()) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const recordings = await getHistory();
      set({ recordings, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load history';
      set({ error: message, isLoading: false });
    }
  },

  selectRecording: (id: string | null) => {
    set({ selectedRecordingId: id });

    // Get recording store actions
    const recordingStore = useRecordingStore.getState();

    if (id === null) {
      // Deselecting - clear summary state
      recordingStore.clearSummary();
      return;
    }

    // Find the selected recording
    const recording = get().recordings.find((r) => r.id === id);

    if (recording?.summary) {
      // Recording has a saved summary - load it into recording store
      recordingStore.setSummary(recording.summary, recording.transcription);
      recordingStore.setSummaryState('success');
    } else {
      // No summary exists - clear summary state to show idle
      recordingStore.clearSummary();
    }
  },

  addRecording: async (filePath: string, durationSeconds: number, transcription: string) => {
    // Skip if not in Tauri environment
    if (!isTauri()) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // Save and get the new recording ID
      const newId = await saveRecordingHistory(filePath, durationSeconds, transcription);
      // Refresh the list to get the new recording with its server-generated ID
      await get().loadHistory();
      // Auto-select the new recording so summary can be persisted
      set({ selectedRecordingId: newId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save recording to history';
      set({ error: message, isLoading: false });
    }
  },

  deleteRecording: async (id: string) => {
    // Skip if not in Tauri environment
    if (!isTauri()) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      await deleteRecordingHistory(id);
      // Clear selection if the deleted recording was selected
      const { selectedRecordingId, playingRecordingId } = get();
      if (selectedRecordingId === id) {
        set({ selectedRecordingId: null });
        // Also clear summary state when deleting selected recording
        useRecordingStore.getState().clearSummary();
      }
      // Stop playback if the deleted recording was playing
      if (playingRecordingId === id) {
        set({ playingRecordingId: null });
      }
      // Refresh the list
      await get().loadHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete recording';
      set({ error: message, isLoading: false });
    }
  },

  clearAllRecordings: async () => {
    // Skip if not in Tauri environment
    if (!isTauri()) {
      return;
    }

    const { recordings } = get();
    if (recordings.length === 0) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // Delete all recordings one by one
      for (const recording of recordings) {
        await deleteRecordingHistory(recording.id);
      }
      // Clear selection and playback state
      set({ selectedRecordingId: null, playingRecordingId: null });
      useRecordingStore.getState().clearSummary();
      // Refresh the list
      await get().loadHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear history';
      set({ error: message, isLoading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  startPlayback: (id: string) => {
    set({ playingRecordingId: id });
  },

  stopPlayback: () => {
    set({ playingRecordingId: null });
  },
}));

/**
 * Get the currently selected recording object
 */
export function getSelectedRecording(state: HistoryStore): Recording | null {
  if (!state.selectedRecordingId) {
    return null;
  }
  return state.recordings.find((r) => r.id === state.selectedRecordingId) ?? null;
}
