'use client';

import { useState } from 'react';
import { Play, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useHistoryStore } from '@/stores/history-store';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import type { Recording } from '@/types';

/**
 * Props for the HistoryItem component
 */
export interface HistoryItemProps {
  /** The recording to display */
  recording: Recording;
  /** Whether this item is currently selected */
  isSelected?: boolean;
  /** Handler for when the item is clicked */
  onSelect?: (id: string) => void;
  /** Handler for when the delete button is clicked */
  onDelete?: (id: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format a duration in seconds to mm:ss format
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format an ISO date string to a readable format
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Truncate text to a maximum length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Component to display a single recording history item.
 *
 * Shows timestamp, duration, and transcription preview.
 * Supports selection highlighting, playback controls, and delete with confirmation.
 */
export function HistoryItem({
  recording,
  isSelected = false,
  onSelect,
  onDelete,
  className,
}: HistoryItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Playback state and controls
  const playingRecordingId = useHistoryStore((state) => state.playingRecordingId);
  const { play, stop } = useAudioPlayback();

  // Determine if this specific recording is currently playing
  const isThisPlaying = playingRecordingId === recording.id;

  const handleClick = () => {
    if (!showDeleteConfirm) {
      onSelect?.(recording.id);
    }
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isThisPlaying) {
      stop();
    } else {
      play(recording.filePath, recording.id);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(recording.id);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        'group relative cursor-pointer rounded-lg border p-3 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-zinc-600',
        isSelected
          ? 'border-zinc-600 bg-zinc-800'
          : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/50',
        // Visual playing indicator
        isThisPlaying && 'border-l-2 border-l-blue-400',
        className
      )}
    >
      {/* Header row with timestamp and duration */}
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">
          {formatTimestamp(recording.createdAt)}
        </span>
        <span className="font-mono text-xs text-zinc-500">
          {formatDuration(recording.durationSeconds)}
        </span>
      </div>

      {/* Transcription preview */}
      <p className="text-sm text-zinc-300">
        {truncateText(recording.transcription, 80)}
      </p>

      {/* Action buttons - shows on hover or when confirming delete */}
      <div
        className={cn(
          'absolute right-2 bottom-2 flex items-center gap-1 transition-opacity',
          showDeleteConfirm ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          // Keep play/stop button visible when playing
          isThisPlaying && !showDeleteConfirm && 'opacity-100'
        )}
      >
        {showDeleteConfirm ? (
          <div className="flex items-center gap-1" role="group" aria-label="Confirm delete">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              className="h-6 px-2 text-xs"
              aria-label="Confirm delete"
            >
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelDelete}
              className="h-6 px-2 text-xs"
              aria-label="Cancel delete"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <>
            {/* Play/Stop button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePlayClick}
              className={cn(
                'h-7 w-7 text-zinc-500',
                isThisPlaying
                  ? 'text-blue-400 hover:text-blue-300'
                  : 'hover:text-zinc-400'
              )}
              aria-label={isThisPlaying ? 'Stop recording' : 'Play recording'}
            >
              {isThisPlaying ? (
                <Square className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
            {/* Delete button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteClick}
              className="h-7 w-7 text-zinc-500 hover:text-red-400"
              aria-label="Delete recording"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
