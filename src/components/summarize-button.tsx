'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRecordingStore } from '@/stores/recording-store';
import { useHistoryStore } from '@/stores/history-store';
import { summarizeText, updateHistorySummary } from '@/lib/tauri-api';
import { cn } from '@/lib/utils';

/**
 * Props for the SummarizeButton component
 */
export interface SummarizeButtonProps {
  /** The transcription text to summarize */
  transcription: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when summary generation completes (for tab switching) */
  onSummaryComplete?: () => void;
}

/**
 * Button component that summarizes transcription text and stores in the recording store.
 *
 * - Calls OpenAI API via Tauri backend to generate markdown summary
 * - Shows loading state during API call using store's summaryState
 * - Stores summary in recording store for display in Summary tab
 * - Persists summary to history store for later retrieval
 * - Copies result to clipboard using Clipboard API
 * - Shows "Copy Summary" mode when summary already exists
 * - Displays toast notifications for success/error states
 */
export function SummarizeButton({
  transcription,
  disabled = false,
  className,
  onSummaryComplete,
}: SummarizeButtonProps) {
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const {
    summary,
    summaryState,
    setSummary,
    setSummaryState,
    setSummaryError,
  } = useRecordingStore();

  const selectedRecordingId = useHistoryStore((state) => state.selectedRecordingId);
  const loadHistory = useHistoryStore((state) => state.loadHistory);

  const isLoading = summaryState === 'loading';
  const hasSummary = summary !== null;

  const handleSummarize = async () => {
    if (!transcription || isLoading) return;

    setSummaryState('loading');
    setSummaryError(null);

    try {
      // Call the Tauri backend to summarize
      const generatedSummary = await summarizeText(transcription);

      // Store summary in the recording store with source text reference
      setSummary(generatedSummary, transcription);
      setSummaryState('success');

      // Persist summary to history if we have a selected recording
      if (selectedRecordingId) {
        try {
          await updateHistorySummary(selectedRecordingId, generatedSummary);
          // Reload history to get updated recording with summary
          await loadHistory();
        } catch (persistError) {
          // Show warning toast but don't interrupt the summary display
          toast({
            title: 'Summary not saved',
            description: 'The summary was generated but could not be saved to history.',
            variant: 'destructive',
          });
        }
      }

      // Copy to clipboard
      await navigator.clipboard.writeText(generatedSummary);

      toast({
        title: 'Summary generated and copied',
        description: 'The markdown summary has been copied to clipboard.',
        variant: 'success',
      });

      // Call the callback for tab switching
      onSummaryComplete?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to summarize text';
      setSummaryState('error');
      setSummaryError(message);
      toast({
        title: 'Summarization failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleCopySummary = async () => {
    if (!summary || isCopied) return;

    try {
      await navigator.clipboard.writeText(summary);

      setIsCopied(true);
      toast({
        title: 'Summary copied to clipboard',
        description: 'The markdown summary has been copied.',
        variant: 'success',
      });

      // Reset copied state after 2 seconds
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy summary to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handleClick = hasSummary ? handleCopySummary : handleSummarize;

  // Determine button content based on state
  const renderButtonContent = () => {
    if (isLoading) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Summarizing...</span>
        </>
      );
    }

    if (hasSummary) {
      if (isCopied) {
        return (
          <>
            <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
            <span>Copied!</span>
          </>
        );
      }
      return (
        <>
          <Copy className="h-4 w-4" aria-hidden="true" />
          <span>Copy Summary</span>
        </>
      );
    }

    return (
      <>
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <span>Summarize</span>
      </>
    );
  };

  const getAriaLabel = () => {
    if (isLoading) return 'Summarizing transcription';
    if (hasSummary) return isCopied ? 'Summary copied' : 'Copy summary to clipboard';
    return 'Summarize transcription';
  };

  return (
    <Button
      variant={hasSummary ? 'outline' : 'default'}
      size="sm"
      onClick={handleClick}
      disabled={disabled || isLoading || !transcription}
      className={cn('gap-2', className)}
      data-testid="summarize-button"
      aria-label={getAriaLabel()}
    >
      {renderButtonContent()}
    </Button>
  );
}
