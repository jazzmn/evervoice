'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

/**
 * Configuration options for the waveform analyzer
 */
export interface WaveformAnalyzerOptions {
  /** FFT size for frequency resolution (power of 2, default: 2048) */
  fftSize?: number;
  /** Smoothing time constant for visual smoothness (0-1, default: 0.8) */
  smoothingTimeConstant?: number;
}

/**
 * Return type for useWaveformAnalyzer hook
 */
export interface UseWaveformAnalyzerReturn {
  /** Whether the analyzer is active and connected */
  isActive: boolean;
  /** Time domain data array for waveform visualization */
  dataArray: Uint8Array<ArrayBuffer> | null;
  /** Length of the data array (frequencyBinCount) */
  dataLength: number;
  /** Connect a MediaStream to the analyzer */
  connect: (stream: MediaStream) => void;
  /** Disconnect and cleanup the analyzer */
  disconnect: () => void;
  /** Get the current time domain data (call each animation frame) */
  getTimeData: () => Uint8Array<ArrayBuffer> | null;
}

const DEFAULT_FFT_SIZE = 2048;
const DEFAULT_SMOOTHING = 0.8;

/**
 * Custom hook for Web Audio API waveform analysis.
 * Initializes AudioContext and AnalyserNode to extract time domain data
 * for oscilloscope-style waveform visualization.
 *
 * @param options - Configuration options for the analyzer
 * @returns Waveform analyzer state and methods
 *
 * @example
 * ```tsx
 * const { connect, disconnect, getTimeData, isActive, dataLength } = useWaveformAnalyzer();
 *
 * // Connect when mediaStream is available
 * useEffect(() => {
 *   if (mediaStream) {
 *     connect(mediaStream);
 *   }
 *   return () => disconnect();
 * }, [mediaStream, connect, disconnect]);
 *
 * // In animation loop
 * const data = getTimeData();
 * // Draw data to canvas
 * ```
 */
export function useWaveformAnalyzer(
  options: WaveformAnalyzerOptions = {}
): UseWaveformAnalyzerReturn {
  const { fftSize = DEFAULT_FFT_SIZE, smoothingTimeConstant = DEFAULT_SMOOTHING } = options;

  const [isActive, setIsActive] = useState(false);
  const [dataLength, setDataLength] = useState(0);

  // Refs for audio nodes
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  /**
   * Connect a MediaStream to the analyzer
   */
  const connect = useCallback(
    (stream: MediaStream) => {
      // Clean up any existing connection
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {
          // Ignore close errors
        });
      }

      try {
        // Create new AudioContext
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        // Create AnalyserNode
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = smoothingTimeConstant;
        analyserRef.current = analyser;

        // Create data array for time domain data
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        dataArrayRef.current = dataArray;
        setDataLength(bufferLength);

        // Create source from MediaStream and connect to analyser
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceRef.current = source;

        // Note: We don't connect to destination to avoid audio feedback
        // The analyser can still analyze the audio without playing it

        setIsActive(true);
      } catch (error) {
        console.error('Failed to initialize waveform analyzer:', error);
        setIsActive(false);
      }
    },
    [fftSize, smoothingTimeConstant]
  );

  /**
   * Disconnect and cleanup the analyzer
   */
  const disconnect = useCallback(() => {
    // Disconnect source node
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    // Clean up analyser
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {
        // Ignore close errors
      });
      audioContextRef.current = null;
    }

    // Clear data array
    dataArrayRef.current = null;
    setDataLength(0);
    setIsActive(false);
  }, []);

  /**
   * Get the current time domain data for waveform visualization.
   * Call this function each animation frame to get fresh data.
   */
  const getTimeData = useCallback((): Uint8Array<ArrayBuffer> | null => {
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;

    if (!analyser || !dataArray) {
      return null;
    }

    // Fill the data array with current time domain data
    analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isActive,
    dataArray: dataArrayRef.current,
    dataLength,
    connect,
    disconnect,
    getTimeData,
  };
}
