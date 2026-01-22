'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  RecordingState,
  PermissionState,
  AudioRecorderError,
  AudioRecordingResult,
} from '@/types';

/**
 * Preferred MIME type for recording (WebM with Opus codec)
 */
const PREFERRED_MIME_TYPE = 'audio/webm;codecs=opus';

/**
 * Fallback MIME types if preferred is not supported
 */
const FALLBACK_MIME_TYPES = ['audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

/**
 * Get the best supported MIME type for MediaRecorder
 */
function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  if (MediaRecorder.isTypeSupported(PREFERRED_MIME_TYPE)) {
    return PREFERRED_MIME_TYPE;
  }

  for (const mimeType of FALLBACK_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return '';
}

/**
 * Parse MediaRecorder/getUserMedia errors into user-friendly messages
 */
function parseError(error: unknown): AudioRecorderError {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
        return {
          type: 'permission_denied',
          message: 'Microphone access denied. Please allow microphone access to record audio.',
        };
      case 'NotFoundError':
        return {
          type: 'device_not_found',
          message: 'No microphone found. Please connect a microphone and try again.',
        };
      case 'NotSupportedError':
        return {
          type: 'not_supported',
          message: 'Audio recording is not supported in this browser.',
        };
      case 'AbortError':
        return {
          type: 'recorder_error',
          message: 'Recording was aborted unexpectedly.',
        };
      default:
        return {
          type: 'unknown',
          message: `Recording error: ${error.message}`,
        };
    }
  }

  if (error instanceof Error) {
    return {
      type: 'unknown',
      message: error.message,
    };
  }

  return {
    type: 'unknown',
    message: 'An unknown error occurred while recording.',
  };
}

/**
 * Audio recorder hook state
 */
export interface UseAudioRecorderState {
  /** Current recording state */
  state: RecordingState;
  /** Current permission state for microphone access */
  permissionState: PermissionState;
  /** Error object if recording failed */
  error: AudioRecorderError | null;
  /** Recorded audio result (available after stop) */
  audioResult: AudioRecordingResult | null;
  /** Active MediaStream for waveform visualization */
  mediaStream: MediaStream | null;
}

/**
 * Audio recorder hook actions
 */
export interface UseAudioRecorderActions {
  /** Start recording from microphone */
  start: () => Promise<void>;
  /** Pause current recording */
  pause: () => void;
  /** Resume paused recording */
  resume: () => void;
  /** Stop recording and generate audio blob */
  stop: () => void;
  /** Reset recorder to idle state, clearing any recorded audio */
  reset: () => void;
  /** Retry after permission denial */
  retryPermission: () => Promise<void>;
}

export type UseAudioRecorderReturn = UseAudioRecorderState & UseAudioRecorderActions;

/**
 * Custom hook for audio recording using MediaRecorder API.
 * Handles microphone permissions, recording state transitions, and resource cleanup.
 *
 * @example
 * ```tsx
 * const { state, start, pause, resume, stop, reset, audioResult, error } = useAudioRecorder();
 *
 * // Start recording
 * await start();
 *
 * // Pause/resume
 * pause();
 * resume();
 *
 * // Stop and get audio blob
 * stop();
 * // audioResult.blob contains the recorded audio
 * ```
 */
export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<RecordingState>('idle');
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [error, setError] = useState<AudioRecorderError | null>(null);
  const [audioResult, setAudioResult] = useState<AudioRecordingResult | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Refs for MediaRecorder and collected chunks
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const pauseStartRef = useRef<number>(0);

  /**
   * Clean up all resources
   */
  const cleanup = useCallback(() => {
    // Stop all tracks on the media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    // Clear MediaRecorder reference
    if (mediaRecorderRef.current) {
      // Remove event listeners
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.onerror = null;
      mediaRecorderRef.current = null;
    }

    // Clear chunks
    chunksRef.current = [];

    // Reset timing
    startTimeRef.current = 0;
    pausedDurationRef.current = 0;
    pauseStartRef.current = 0;

    // Clear media stream state
    setMediaStream(null);
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  /**
   * Request microphone permission and initialize MediaRecorder
   */
  const start = useCallback(async () => {
    // Clear any previous error
    setError(null);

    // Check for browser support
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError({
        type: 'not_supported',
        message: 'Audio recording is not supported in this browser.',
      });
      return;
    }

    // Get supported MIME type
    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      setError({
        type: 'not_supported',
        message: 'No supported audio format found for recording.',
      });
      return;
    }

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      setMediaStream(stream);
      setPermissionState('granted');

      // Create MediaRecorder
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      // Clear previous chunks
      chunksRef.current = [];

      // Handle data available event
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle stop event
      recorder.onstop = () => {
        // Calculate total recording duration (excluding paused time)
        const totalTime = Date.now() - startTimeRef.current - pausedDurationRef.current;

        // Create blob from chunks
        const blob = new Blob(chunksRef.current, { type: mimeType });

        setAudioResult({
          blob,
          mimeType,
          duration: totalTime,
        });

        setState('stopped');
      };

      // Handle error event
      recorder.onerror = (event) => {
        const errorEvent = event as ErrorEvent;
        setError(parseError(errorEvent.error || new Error('Recording error')));
        cleanup();
        setState('idle');
      };

      // Start recording with time slices for chunked data
      recorder.start(1000);
      startTimeRef.current = Date.now();
      pausedDurationRef.current = 0;
      setState('recording');
    } catch (err) {
      const parsedError = parseError(err);
      setError(parsedError);

      if (parsedError.type === 'permission_denied') {
        setPermissionState('denied');
      }

      cleanup();
    }
  }, [cleanup]);

  /**
   * Pause recording
   */
  const pause = useCallback(() => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state === 'recording') {
      recorder.pause();
      pauseStartRef.current = Date.now();
      setState('paused');
    }
  }, []);

  /**
   * Resume recording from paused state
   */
  const resume = useCallback(() => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state === 'paused') {
      // Track paused duration
      pausedDurationRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = 0;

      recorder.resume();
      setState('recording');
    }
  }, []);

  /**
   * Stop recording and generate audio blob
   */
  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;

    if (recorder && (recorder.state === 'recording' || recorder.state === 'paused')) {
      // If paused, add paused duration before stopping
      if (recorder.state === 'paused' && pauseStartRef.current > 0) {
        pausedDurationRef.current += Date.now() - pauseStartRef.current;
      }

      recorder.stop();

      // Stop all tracks to release microphone
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }

      // Note: setState('stopped') happens in onstop handler
    }
  }, []);

  /**
   * Reset recorder to idle state
   */
  const reset = useCallback(() => {
    cleanup();
    setError(null);
    setAudioResult(null);
    setState('idle');
  }, [cleanup]);

  /**
   * Retry permission after denial
   */
  const retryPermission = useCallback(async () => {
    setError(null);
    setPermissionState('unknown');
    await start();
  }, [start]);

  return {
    state,
    permissionState,
    error,
    audioResult,
    mediaStream,
    start,
    pause,
    resume,
    stop,
    reset,
    retryPermission,
  };
}
