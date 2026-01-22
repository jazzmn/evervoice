'use client';

import { Mic, Pause, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RecordingState } from '@/types';
import { cn } from '@/lib/utils';

/**
 * Props for the RecordingControls component
 */
export interface RecordingControlsProps {
  /** Current recording state */
  state: RecordingState;
  /** Handler for Start/Resume button click */
  onStart: () => void;
  /** Handler for Pause button click */
  onPause: () => void;
  /** Handler for Stop button click */
  onStop: () => void;
  /** Whether the component is disabled (e.g., during initialization) */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Recording controls component with Start/Resume, Pause, and Stop buttons.
 * Button states change based on the current recording state:
 * - Start: enabled when idle, shows "Resume" when paused
 * - Pause: enabled only during active recording
 * - Stop: enabled when recording or paused
 */
export function RecordingControls({
  state,
  onStart,
  onPause,
  onStop,
  disabled = false,
  className,
}: RecordingControlsProps) {
  const isIdle = state === 'idle';
  const isRecording = state === 'recording';
  const isPaused = state === 'paused';
  const isStopped = state === 'stopped';

  // Start/Resume button logic
  const startButtonLabel = isPaused ? 'Resume' : 'Start';
  const startButtonDisabled =
    disabled || isRecording || isStopped;

  // Pause button logic
  const pauseButtonDisabled = disabled || !isRecording;

  // Stop button logic
  const stopButtonDisabled = disabled || isIdle || isStopped;

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      role="group"
      aria-label="Recording controls"
    >
      <Button
        variant="outline"
        onClick={onStart}
        disabled={startButtonDisabled}
        aria-label={startButtonLabel}
      >
        <Mic className="h-4 w-4" aria-hidden="true" />
        <span>{startButtonLabel}</span>
      </Button>

      <Button
        variant="outline"
        onClick={onPause}
        disabled={pauseButtonDisabled}
        aria-label="Pause"
      >
        <Pause className="h-4 w-4" aria-hidden="true" />
        <span>Pause</span>
      </Button>

      <Button
        variant="outline"
        onClick={onStop}
        disabled={stopButtonDisabled}
        aria-label="Stop"
      >
        <Square className="h-4 w-4" aria-hidden="true" />
        <span>Stop</span>
      </Button>
    </div>
  );
}
