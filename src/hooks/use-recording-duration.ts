'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRecordingStore } from '@/stores/recording-store';
import { useSettingsStore } from '@/stores/settings-store';
import type { RecordingState } from '@/types';

/**
 * Threshold percentage for displaying remaining time warning
 */
const WARNING_THRESHOLD_PERCENT = 0.8;

/**
 * Return type for the useRecordingDuration hook
 */
export interface UseRecordingDurationReturn {
  /** Current elapsed time in seconds */
  elapsedSeconds: number;
  /** Remaining time in seconds (based on max duration) */
  remainingSeconds: number;
  /** Whether the warning threshold has been passed */
  showWarning: boolean;
  /** Whether the max duration has been reached */
  maxDurationReached: boolean;
  /** Formatted elapsed time as MM:SS */
  formattedElapsed: string;
  /** Formatted remaining time as MM:SS */
  formattedRemaining: string;
  /** Start the duration timer */
  startTimer: () => void;
  /** Pause the duration timer */
  pauseTimer: () => void;
  /** Resume the duration timer */
  resumeTimer: () => void;
  /** Stop and reset the duration timer */
  stopTimer: () => void;
}

/**
 * Format seconds as MM:SS string
 */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Custom hook for managing recording duration with auto-stop logic.
 *
 * Features:
 * - Tracks elapsed time during recording
 * - Pauses timer when recording is paused
 * - Triggers warning at 80% of max duration
 * - Auto-stops recording when max duration is reached
 *
 * @param onAutoStop - Callback invoked when max duration is reached
 * @returns Duration state and control functions
 */
export function useRecordingDuration(
  onAutoStop?: () => void
): UseRecordingDurationReturn {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPausedRef = useRef(false);
  const autoStopTriggeredRef = useRef(false);

  // Get state from stores
  const elapsedSeconds = useRecordingStore((state) => state.elapsedSeconds);
  const warningTriggered = useRecordingStore((state) => state.warningTriggered);
  const incrementElapsedSeconds = useRecordingStore((state) => state.incrementElapsedSeconds);
  const setWarningTriggered = useRecordingStore((state) => state.setWarningTriggered);
  const resetRecording = useRecordingStore((state) => state.resetRecording);

  const maxDuration = useSettingsStore((state) => state.settings.maxDuration);

  // Calculate derived values
  const maxDurationSeconds = maxDuration * 60;
  const remainingSeconds = Math.max(0, maxDurationSeconds - elapsedSeconds);
  const warningThresholdSeconds = maxDurationSeconds * WARNING_THRESHOLD_PERCENT;
  const showWarning = elapsedSeconds >= warningThresholdSeconds;
  const maxDurationReached = elapsedSeconds >= maxDurationSeconds;

  // Format times for display
  const formattedElapsed = formatDuration(elapsedSeconds);
  const formattedRemaining = formatDuration(remainingSeconds);

  /**
   * Clear the interval timer
   */
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * Start the duration timer
   */
  const startTimer = useCallback(() => {
    // Clear any existing timer
    clearTimer();

    // Reset state for new recording
    isPausedRef.current = false;
    autoStopTriggeredRef.current = false;

    // Start interval that increments every second
    timerRef.current = setInterval(() => {
      if (!isPausedRef.current) {
        incrementElapsedSeconds();
      }
    }, 1000);
  }, [clearTimer, incrementElapsedSeconds]);

  /**
   * Pause the duration timer
   */
  const pauseTimer = useCallback(() => {
    isPausedRef.current = true;
  }, []);

  /**
   * Resume the duration timer
   */
  const resumeTimer = useCallback(() => {
    isPausedRef.current = false;
  }, []);

  /**
   * Stop and reset the duration timer
   */
  const stopTimer = useCallback(() => {
    clearTimer();
    isPausedRef.current = false;
  }, [clearTimer]);

  /**
   * Check for warning threshold and auto-stop
   */
  useEffect(() => {
    // Trigger warning at 80% threshold (only once)
    if (showWarning && !warningTriggered) {
      setWarningTriggered(true);
    }

    // Auto-stop when max duration reached (only once)
    if (maxDurationReached && !autoStopTriggeredRef.current) {
      autoStopTriggeredRef.current = true;
      clearTimer();
      onAutoStop?.();
    }
  }, [
    showWarning,
    warningTriggered,
    maxDurationReached,
    setWarningTriggered,
    clearTimer,
    onAutoStop,
  ]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    elapsedSeconds,
    remainingSeconds,
    showWarning,
    maxDurationReached,
    formattedElapsed,
    formattedRemaining,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
  };
}
