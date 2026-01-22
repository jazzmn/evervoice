'use client';

import { Loader2, FileAudio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RecordingState, TranscriptionState } from '@/types';
import { cn } from '@/lib/utils';

/**
 * Props for the TranscribeButton component
 */
export interface TranscribeButtonProps {
  /** Current recording state */
  recordingState: RecordingState;
  /** Current transcription state */
  transcriptionState: TranscriptionState;
  /** Whether a file exists for transcription */
  hasFile: boolean;
  /** Handler for Transcribe button click */
  onTranscribe: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Transcribe button component for initiating audio transcription.
 *
 * The button is:
 * - Disabled until recording state is "stopped" and a file exists
 * - Shows "Transcribe" label normally
 * - Shows "Transcribing..." with spinner during API call
 */
export function TranscribeButton({
  recordingState,
  transcriptionState,
  hasFile,
  onTranscribe,
  className,
}: TranscribeButtonProps) {
  const isTranscribing = transcriptionState === 'transcribing';
  const canTranscribe = recordingState === 'stopped' && hasFile && !isTranscribing;

  return (
    <Button
      variant="default"
      onClick={onTranscribe}
      disabled={!canTranscribe}
      className={cn('w-full', className)}
      aria-label={isTranscribing ? 'Transcribing audio' : 'Transcribe recording'}
      aria-busy={isTranscribing}
    >
      {isTranscribing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Transcribing...</span>
        </>
      ) : (
        <>
          <FileAudio className="h-4 w-4" aria-hidden="true" />
          <span>Transcribe</span>
        </>
      )}
    </Button>
  );
}
