'use client';

import { Loader2, History, Trash2 } from 'lucide-react';
import { HistoryItem } from './history-item';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Recording } from '@/types';

/**
 * Props for the HistorySidebar component
 */
export interface HistorySidebarProps {
  /** Array of recording history items */
  recordings: Recording[];
  /** ID of the currently selected recording */
  selectedRecordingId: string | null;
  /** Whether the history is loading */
  isLoading?: boolean;
  /** Handler for when a recording is selected */
  onSelectRecording?: (id: string) => void;
  /** Handler for when a recording is deleted */
  onDeleteRecording?: (id: string) => void;
  /** Handler for clearing all recordings */
  onClearAll?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Sidebar component to display recording history.
 *
 * Shows a scrollable list of recording history items with:
 * - Fixed 280px width
 * - Header with "Recording History" title
 * - Loading state with spinner
 * - Empty state with helpful message
 * - Selectable items with delete support
 */
export function HistorySidebar({
  recordings,
  selectedRecordingId,
  isLoading = false,
  onSelectRecording,
  onDeleteRecording,
  onClearAll,
  className,
}: HistorySidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full w-[280px] flex-shrink-0 flex-col border-l border-zinc-800 bg-zinc-950',
        className
      )}
      aria-label="Recording history"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-[#F0E14A]" aria-hidden="true" />
          <h2 className="font-[family-name:var(--font-nunito)] font-bold text-[#F0E14A]">Recording History</h2>
        </div>
        {recordings.length > 0 && onClearAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400"
            aria-label="Clear all recordings"
            title="Clear all"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </header>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          /* Loading state */
          <div className="flex flex-col items-center justify-center py-8" role="status" aria-label="Loading history">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" aria-hidden="true" />
            <p className="mt-2 text-sm text-zinc-400">Loading history...</p>
          </div>
        ) : recordings.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-8 text-center" role="status">
            <History className="mb-2 h-10 w-10 text-zinc-600" aria-hidden="true" />
            <p className="text-sm font-medium text-zinc-400">No recordings yet</p>
            <p className="mt-1 text-xs text-zinc-500">
              Your transcribed recordings will appear here
            </p>
          </div>
        ) : (
          /* Recording list */
          <ul className="flex flex-col gap-2" role="listbox" aria-label="Recordings">
            {recordings.map((recording) => (
              <li key={recording.id} role="option" aria-selected={selectedRecordingId === recording.id}>
                <HistoryItem
                  recording={recording}
                  isSelected={selectedRecordingId === recording.id}
                  onSelect={onSelectRecording}
                  onDelete={onDeleteRecording}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
