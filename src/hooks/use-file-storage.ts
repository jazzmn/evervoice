'use client';

import { useState, useCallback } from 'react';
import {
  saveRecording as saveRecordingApi,
  deleteRecording as deleteRecordingApi,
  ensureDirectoryExists,
  isTauri,
  parseFileStorageError,
  type FileStorageError,
} from '@/lib/tauri-api';
import type { AudioRecordingResult, SavedRecording } from '@/types';

/**
 * State for the file storage hook
 */
export interface UseFileStorageState {
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Whether a delete operation is in progress */
  isDeleting: boolean;
  /** Last saved recording information */
  savedRecording: SavedRecording | null;
  /** Error from the last file operation */
  error: FileStorageError | null;
}

/**
 * Actions provided by the file storage hook
 */
export interface UseFileStorageActions {
  /** Save an audio recording to disk */
  saveRecording: (recording: AudioRecordingResult) => Promise<SavedRecording | null>;
  /** Delete a recording by file path */
  deleteRecording: (filePath: string) => Promise<boolean>;
  /** Clear the last error */
  clearError: () => void;
  /** Clear saved recording state */
  clearSavedRecording: () => void;
}

export type UseFileStorageReturn = UseFileStorageState & UseFileStorageActions;

/**
 * Custom hook for saving and managing audio recordings on disk.
 *
 * Handles:
 * - Ensuring the recordings directory exists
 * - Converting Blob data to binary for Tauri
 * - Saving recordings with unique filenames (ISO timestamp + UUID)
 * - Deleting recordings (for cleanup on error)
 * - Error handling with user-friendly messages
 *
 * @example
 * ```tsx
 * const { saveRecording, deleteRecording, isSaving, savedRecording, error } = useFileStorage();
 *
 * // After recording stops, save the audio
 * if (audioResult) {
 *   const saved = await saveRecording(audioResult);
 *   if (saved) {
 *     console.log('Saved to:', saved.filePath);
 *   }
 * }
 *
 * // Clean up on error
 * if (savedRecording && hasError) {
 *   await deleteRecording(savedRecording.filePath);
 * }
 * ```
 */
export function useFileStorage(): UseFileStorageReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [savedRecording, setSavedRecording] = useState<SavedRecording | null>(null);
  const [error, setError] = useState<FileStorageError | null>(null);

  /**
   * Save an audio recording to disk
   */
  const saveRecording = useCallback(
    async (recording: AudioRecordingResult): Promise<SavedRecording | null> => {
      // Clear any previous error
      setError(null);

      // Check if running in Tauri environment
      if (!isTauri()) {
        setError({
          type: 'not_tauri',
          message: 'File storage is only available in the desktop app.',
        });
        return null;
      }

      setIsSaving(true);

      try {
        // Ensure the recordings directory exists
        await ensureDirectoryExists();

        // Save the recording and get the file path
        const filePath = await saveRecordingApi(recording.blob);

        // Create the saved recording object
        const saved: SavedRecording = {
          ...recording,
          filePath,
          savedAt: new Date().toISOString(),
        };

        setSavedRecording(saved);
        return saved;
      } catch (err) {
        const parsedError = parseFileStorageError(err);
        setError(parsedError);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  /**
   * Delete a recording file by path
   * Used for cleaning up partial recordings on error
   */
  const deleteRecording = useCallback(async (filePath: string): Promise<boolean> => {
    // Clear any previous error
    setError(null);

    // Check if running in Tauri environment
    if (!isTauri()) {
      // In non-Tauri environment, just return true (no-op)
      return true;
    }

    setIsDeleting(true);

    try {
      await deleteRecordingApi(filePath);

      // If we deleted the current saved recording, clear it
      setSavedRecording((current) => {
        if (current?.filePath === filePath) {
          return null;
        }
        return current;
      });

      return true;
    } catch (err) {
      const parsedError = parseFileStorageError(err);
      setError(parsedError);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  /**
   * Clear the last error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clear saved recording state
   */
  const clearSavedRecording = useCallback(() => {
    setSavedRecording(null);
  }, []);

  return {
    isSaving,
    isDeleting,
    savedRecording,
    error,
    saveRecording,
    deleteRecording,
    clearError,
    clearSavedRecording,
  };
}
