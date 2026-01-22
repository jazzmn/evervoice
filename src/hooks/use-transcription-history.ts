'use client';

import { useCallback } from 'react';
import { useRecordingStore, useHistoryStore } from '@/stores';

/**
 * Hook to integrate transcription with history storage.
 *
 * Provides a function to save the current transcription to history
 * after successful transcription completes.
 */
export function useTranscriptionHistory() {
  const { filePath, elapsedSeconds, transcription, transcriptionState } = useRecordingStore();
  const { addRecording, selectRecording } = useHistoryStore();

  /**
   * Save the current transcription to history.
   * Should be called after transcription completes successfully.
   */
  const saveToHistory = useCallback(async () => {
    // Only save if transcription was successful and we have all required data
    if (transcriptionState !== 'success' || !filePath || !transcription) {
      return;
    }

    await addRecording(filePath, elapsedSeconds, transcription);
  }, [transcriptionState, filePath, elapsedSeconds, transcription, addRecording]);

  /**
   * Clear the selected recording when starting a new recording.
   * This ensures the UI shows the live transcription instead of a historical one.
   */
  const clearSelectionForNewRecording = useCallback(() => {
    selectRecording(null);
  }, [selectRecording]);

  return {
    saveToHistory,
    clearSelectionForNewRecording,
    canSave: transcriptionState === 'success' && !!filePath && !!transcription,
  };
}
