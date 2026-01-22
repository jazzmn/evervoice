'use client';

import { useEffect, useRef, useCallback } from 'react';
import { listenForGlobalHotkey, isTauri } from '@/lib/tauri-api';
import { useRecordingStore } from '@/stores/recording-store';
import { toast } from '@/hooks/use-toast';

/**
 * Interface for the global hotkey event payload
 */
interface HotkeyEventPayload {
  timestamp: number;
  hotkey: string;
}

/**
 * Hook that listens for global hotkey events and toggles recording state.
 *
 * This hook:
 * 1. Sets up a Tauri event listener for 'global-hotkey-triggered' events
 * 2. When triggered, toggles recording: starts if idle, stops if recording
 * 3. Shows toast notifications for feedback
 * 4. Cleans up the listener on unmount
 *
 * @param onStartRecording - Callback to start recording
 * @param onStopRecording - Callback to stop recording
 */
export function useGlobalHotkey(
  onStartRecording: () => void,
  onStopRecording: () => void
) {
  const unlistenRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef(false);

  // Get recording state from store
  const recordingState = useRecordingStore((state) => state.recordingState);

  // Use a ref to track recording state to avoid stale closures
  const recordingStateRef = useRef(recordingState);
  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  // Handle the hotkey event
  const handleHotkeyTriggered = useCallback(
    (payload: HotkeyEventPayload) => {
      const currentState = recordingStateRef.current;

      if (currentState === 'idle' || currentState === 'stopped') {
        // Start recording
        onStartRecording();
        toast({
          title: 'Recording started',
          description: `Triggered by ${payload.hotkey}`,
          duration: 2000,
        });
      } else if (currentState === 'recording' || currentState === 'paused') {
        // Stop recording
        onStopRecording();
        toast({
          title: 'Recording stopped',
          description: `Triggered by ${payload.hotkey}`,
          duration: 2000,
        });
      }
    },
    [onStartRecording, onStopRecording]
  );

  // Set up the event listener
  useEffect(() => {
    // Skip if not in Tauri environment or already initialized
    if (!isTauri() || isInitializedRef.current) {
      return;
    }

    isInitializedRef.current = true;

    // Set up the listener
    const setupListener = async () => {
      try {
        const unlisten = await listenForGlobalHotkey(handleHotkeyTriggered);
        unlistenRef.current = unlisten;
      } catch (error) {
        console.error('Failed to set up global hotkey listener:', error);
      }
    };

    setupListener();

    // Cleanup function
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, [handleHotkeyTriggered]);
}

/**
 * Hook return type for components that need to know about the hotkey state
 */
export interface UseGlobalHotkeyReturn {
  /** Whether the global hotkey listener is active */
  isListening: boolean;
}
