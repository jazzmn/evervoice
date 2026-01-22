'use client';

import { useRef, useCallback, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useHistoryStore } from '@/stores/history-store';
import { toast } from '@/hooks/use-toast';

/**
 * Hook for managing audio playback of recordings.
 *
 * Provides play/stop functionality and integrates with the history store
 * to track which recording is currently playing.
 */
export function useAudioPlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playingRecordingId = useHistoryStore((state) => state.playingRecordingId);
  const startPlayback = useHistoryStore((state) => state.startPlayback);
  const stopPlayback = useHistoryStore((state) => state.stopPlayback);

  /**
   * Stop any existing playback and clean up the Audio instance
   */
  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
  }, []);

  /**
   * Stop the currently playing audio
   */
  const stop = useCallback(() => {
    cleanupAudio();
    stopPlayback();
  }, [cleanupAudio, stopPlayback]);

  /**
   * Play an audio recording
   *
   * @param filePath - The local file path to the audio file
   * @param recordingId - The recording ID to track in the store
   */
  const play = useCallback(
    async (filePath: string, recordingId: string) => {
      // Stop any existing playback
      cleanupAudio();

      try {
        // Convert local file path to Tauri asset URL
        const assetUrl = convertFileSrc(filePath);

        // Create new Audio instance
        const audio = new Audio(assetUrl);
        audioRef.current = audio;

        // Handle audio ended event
        audio.onended = () => {
          cleanupAudio();
          stopPlayback();
        };

        // Handle audio error event
        audio.onerror = () => {
          cleanupAudio();
          stopPlayback();
          toast({
            title: 'Playback Error',
            description: 'Failed to play recording. The file may be missing or corrupted.',
            variant: 'destructive',
          });
        };

        // Start playback
        await audio.play();
        startPlayback(recordingId);
      } catch (error) {
        cleanupAudio();
        stopPlayback();
        toast({
          title: 'Playback Error',
          description: 'Failed to play recording. The file may be missing or corrupted.',
          variant: 'destructive',
        });
      }
    },
    [cleanupAudio, startPlayback, stopPlayback]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  return {
    play,
    stop,
    isPlaying: playingRecordingId !== null,
  };
}
