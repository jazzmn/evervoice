'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { RecordingState } from '@/types';
import { useWaveformAnalyzer } from '@/hooks/use-waveform-analyzer';
import { cn } from '@/lib/utils';

/**
 * Props for the WaveformCanvas component
 */
export interface WaveformCanvasProps {
  /** MediaStream from the audio recorder for waveform analysis */
  mediaStream: MediaStream | null;
  /** Current recording state to control animation */
  state: RecordingState;
  /** Fixed height for the canvas (default: 80) */
  height?: number;
  /** Additional CSS classes for the container */
  className?: string;
}

/** Target frame rate for smooth animation */
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

/** Canvas styling constants */
const WAVEFORM_LINE_WIDTH = 2;
const WAVEFORM_COLOR = '#3b82f6'; // Blue-500
const WAVEFORM_BACKGROUND = 'transparent';

/**
 * WaveformCanvas component for real-time oscilloscope-style audio visualization.
 * Displays an amplitude wave during recording and freezes/flattens when paused.
 *
 * Features:
 * - Responsive width within container
 * - Fixed height for consistent layout
 * - 30fps minimum smooth animation
 * - Automatic cleanup of AnimationFrame on unmount
 *
 * @example
 * ```tsx
 * <WaveformCanvas
 *   mediaStream={mediaStream}
 *   state={recordingState}
 *   height={80}
 *   className="mt-4"
 * />
 * ```
 */
export function WaveformCanvas({
  mediaStream,
  state,
  height = 80,
  className,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frozenDataRef = useRef<Uint8Array | null>(null);

  const { connect, disconnect, getTimeData, isActive, dataLength } = useWaveformAnalyzer();

  /**
   * Clear the canvas completely
   */
  const clearCanvas = useCallback((ctx: CanvasRenderingContext2D, width: number) => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = WAVEFORM_BACKGROUND;
    ctx.fillRect(0, 0, width, height);
  }, [height]);

  /**
   * Draw a flat line (center line) on the canvas
   */
  const drawFlatLine = useCallback((ctx: CanvasRenderingContext2D, width: number) => {
    const centerY = height / 2;

    clearCanvas(ctx, width);

    ctx.lineWidth = WAVEFORM_LINE_WIDTH;
    ctx.strokeStyle = WAVEFORM_COLOR;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }, [height, clearCanvas]);

  /**
   * Draw waveform data on the canvas
   */
  const drawWaveform = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, width: number) => {
      clearCanvas(ctx, width);

      ctx.lineWidth = WAVEFORM_LINE_WIDTH;
      ctx.strokeStyle = WAVEFORM_COLOR;
      ctx.beginPath();

      const sliceWidth = width / data.length;
      let x = 0;

      for (let i = 0; i < data.length; i++) {
        // Normalize data value (0-255) to canvas height
        const v = data[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    },
    [height, clearCanvas]
  );

  /**
   * Animation loop for rendering waveform
   */
  const animate = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');

      if (!canvas || !ctx) {
        return;
      }

      // Throttle to target FPS
      const elapsed = timestamp - lastFrameTimeRef.current;
      if (elapsed < FRAME_INTERVAL) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTimeRef.current = timestamp;

      const width = canvas.width;

      // Get fresh time domain data
      const data = getTimeData();

      if (data) {
        drawWaveform(ctx, data, width);
      } else {
        drawFlatLine(ctx, width);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    },
    [getTimeData, drawWaveform, drawFlatLine]
  );

  /**
   * Handle canvas resize based on container width
   */
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set canvas internal size for high DPI displays
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;

    // Scale the context to match device pixel ratio
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    // Set CSS display size
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${height}px`;
  }, [height]);

  /**
   * Connect to MediaStream when available and recording starts
   */
  useEffect(() => {
    if (mediaStream && (state === 'recording' || state === 'paused')) {
      connect(mediaStream);
    }

    return () => {
      // Don't disconnect here - let the state change handler manage it
    };
  }, [mediaStream, connect, state]);

  /**
   * Start/stop animation based on recording state
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (state === 'recording' && isActive) {
      // Start animation loop
      lastFrameTimeRef.current = 0;
      animationFrameRef.current = requestAnimationFrame(animate);
    } else if (state === 'paused') {
      // Stop animation and optionally freeze or flatten
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Draw a flat line when paused
      if (canvas && ctx) {
        const dpr = window.devicePixelRatio || 1;
        const width = canvas.width / dpr;
        drawFlatLine(ctx, width);
      }
    } else if (state === 'idle' || state === 'stopped') {
      // Stop animation and cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Draw flat line for idle/stopped state
      if (canvas && ctx) {
        const dpr = window.devicePixelRatio || 1;
        const width = canvas.width / dpr;
        drawFlatLine(ctx, width);
      }

      // Disconnect analyzer when stopped or idle
      if (state === 'stopped' || (state === 'idle' && isActive)) {
        disconnect();
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [state, isActive, animate, disconnect, drawFlatLine]);

  /**
   * Handle window resize
   */
  useEffect(() => {
    updateCanvasSize();

    const handleResize = () => {
      updateCanvasSize();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [updateCanvasSize]);

  /**
   * Initial canvas setup and draw flat line
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (canvas && ctx) {
      updateCanvasSize();
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      drawFlatLine(ctx, width);
    }
  }, [updateCanvasSize, drawFlatLine]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      disconnect();
    };
  }, [disconnect]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full rounded-md border border-zinc-700 bg-zinc-900',
        className
      )}
      style={{ height: `${height}px` }}
      data-testid="waveform-container"
    >
      <canvas
        ref={canvasRef}
        className="block"
        aria-label="Audio waveform visualization"
        role="img"
        data-testid="waveform-canvas"
      />
    </div>
  );
}
