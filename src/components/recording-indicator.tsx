'use client';

import type { RecordingState } from '@/types';
import { cn } from '@/lib/utils';

/**
 * Props for the RecordingIndicator component
 */
export interface RecordingIndicatorProps {
  /** Current recording state */
  state: RecordingState;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Recording state indicator component.
 * Displays a pulsing dot to indicate the current recording state:
 * - Red pulsing dot (1s) during active recording
 * - Amber pulsing dot (2s) with "PAUSED" label when paused
 * - Hidden when idle or stopped
 */
export function RecordingIndicator({
  state,
  className,
}: RecordingIndicatorProps) {
  // Only show indicator when recording or paused
  if (state !== 'recording' && state !== 'paused') {
    return null;
  }

  const isRecording = state === 'recording';
  const isPaused = state === 'paused';

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      role="status"
      aria-label={isRecording ? 'Recording in progress' : 'Recording paused'}
    >
      <span
        className={cn(
          'inline-block h-3 w-3 rounded-full',
          isRecording && 'bg-red-500 animate-pulse-recording',
          isPaused && 'bg-amber-500 animate-pulse-paused'
        )}
        aria-hidden="true"
      />
      {isPaused && (
        <span className="text-sm font-medium text-amber-400">
          PAUSED
        </span>
      )}
    </div>
  );
}
