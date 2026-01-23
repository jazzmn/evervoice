'use client';

import { useState, useCallback, useEffect, useRef, KeyboardEvent } from 'react';
import { AlertCircle, RefreshCw, Loader2, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { CopyTextButton } from './copy-text-button';
import { CustomActionButton } from './custom-action-button';
import { useToast } from '@/hooks/use-toast';
import { useSettingsStore } from '@/stores/settings-store';
import type { TranscriptionState, TranscriptionError, SummaryState } from '@/types';
import { cn } from '@/lib/utils';

/** Tab type for the tabbed interface */
type TabType = 'transcription' | 'summary';

/**
 * Props for the TranscriptionDisplay component
 */
export interface TranscriptionDisplayProps {
  /** Current transcription state */
  transcriptionState: TranscriptionState;
  /** Transcription text (if successful) */
  transcription: string | null;
  /** Transcription error (if failed) */
  error: TranscriptionError | null;
  /** Handler for retry button click */
  onRetry?: () => void;
  /** AI-generated summary markdown text */
  summary?: string | null;
  /** Current summary state */
  summaryState?: SummaryState;
  /** Summary error message if any */
  summaryError?: string | null;
  /** Handler for summary retry button click */
  onSummaryRetry?: () => void;
  /** Controlled active tab (for external control) */
  activeTab?: TabType;
  /** Handler for tab change */
  onTabChange?: (tab: TabType) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Component to display transcription results with tabbed interface for summary.
 *
 * Shows:
 * - Tabbed navigation between "Transcription" and "Summary" tabs
 * - Transcribed text on success
 * - Copy button and custom action buttons in transcription tab
 * - Summary tab with rendered markdown content
 * - Copy button and custom action buttons in summary tab
 * - Error message with optional retry button on failure
 * - Nothing when idle or transcribing
 */
export function TranscriptionDisplay({
  transcriptionState,
  transcription,
  error,
  onRetry,
  summary = null,
  summaryState = 'idle',
  summaryError = null,
  onSummaryRetry,
  activeTab: controlledActiveTab,
  onTabChange,
  className,
}: TranscriptionDisplayProps) {
  // Use internal state if not controlled externally
  const [internalActiveTab, setInternalActiveTab] = useState<TabType>('transcription');
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  // Get custom actions from settings store
  const customActions = useSettingsStore((state) => state.settings.customActions);

  // Tab refs for keyboard navigation
  const transcriptionTabRef = useRef<HTMLButtonElement>(null);
  const summaryTabRef = useRef<HTMLButtonElement>(null);

  // Determine which tab is active (controlled or uncontrolled)
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const setActiveTab = useCallback(
    (tab: TabType) => {
      if (onTabChange) {
        onTabChange(tab);
      } else {
        setInternalActiveTab(tab);
      }
    },
    [onTabChange]
  );

  // Reset to transcription tab when transcription changes
  useEffect(() => {
    if (transcription && !controlledActiveTab) {
      setInternalActiveTab('transcription');
    }
  }, [transcription, controlledActiveTab]);

  const hasSummary = summary !== null;
  const isSummaryDisabled = summaryState === 'idle' && !hasSummary;

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

      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy summary to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentTab: TabType) => {
    const tabs = [transcriptionTabRef, summaryTabRef];
    const currentIndex = currentTab === 'transcription' ? 0 : 1;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        if (currentIndex > 0) {
          tabs[currentIndex - 1].current?.focus();
        }
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        if (currentIndex < tabs.length - 1 && !isSummaryDisabled) {
          tabs[currentIndex + 1].current?.focus();
        }
        break;
      case 'Home':
        event.preventDefault();
        tabs[0].current?.focus();
        break;
      case 'End':
        event.preventDefault();
        if (!isSummaryDisabled) {
          tabs[1].current?.focus();
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (currentTab === 'summary' && isSummaryDisabled) return;
        setActiveTab(currentTab);
        break;
    }
  };

  // Don't render anything if idle
  if (transcriptionState === 'idle') {
    return null;
  }

  // Show processing state during transcription
  if (transcriptionState === 'transcribing') {
    return (
      <div
        className={cn(
          'rounded-lg border border-zinc-700 bg-zinc-900/50 p-6',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center justify-center gap-3">
          <Loader2
            className="h-8 w-8 animate-spin text-[#F0E14A]"
            aria-hidden="true"
          />
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-200">
              Transcribing audio...
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              This may take a moment depending on the recording length.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state for transcription
  if (transcriptionState === 'error' && error) {
    return (
      <div
        className={cn(
          'rounded-lg border border-red-900 bg-red-950 p-4',
          className
        )}
        role="alert"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-200">
              Transcription Failed
            </p>
            <p className="mt-1 text-sm text-red-300">
              {error.message}
            </p>
            {error.retryable && onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="mt-3 border-red-800 text-red-300 hover:bg-red-900"
              >
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Try Again
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show success state with tabbed interface
  if (transcriptionState === 'success' && transcription) {
    return (
      <div
        className={cn(
          'rounded-lg border border-green-900 bg-green-950/30',
          className
        )}
        role="region"
        aria-label="Transcription and summary results"
        data-testid="transcription-display"
      >
        {/* Tab navigation */}
        <div
          className="flex border-b border-green-900"
          role="tablist"
          aria-label="View transcription or summary"
        >
          <button
            ref={transcriptionTabRef}
            id="tab-transcription"
            role="tab"
            aria-selected={activeTab === 'transcription'}
            aria-controls="tabpanel-transcription"
            tabIndex={activeTab === 'transcription' ? 0 : -1}
            onClick={() => setActiveTab('transcription')}
            onKeyDown={(e) => handleTabKeyDown(e, 'transcription')}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2',
              activeTab === 'transcription'
                ? 'border-b-2 border-green-400 text-green-200'
                : 'text-zinc-400 hover:text-zinc-300'
            )}
          >
            Transcription
          </button>
          <button
            ref={summaryTabRef}
            id="tab-summary"
            role="tab"
            aria-selected={activeTab === 'summary'}
            aria-controls="tabpanel-summary"
            aria-disabled={isSummaryDisabled}
            tabIndex={activeTab === 'summary' ? 0 : -1}
            onClick={() => !isSummaryDisabled && setActiveTab('summary')}
            onKeyDown={(e) => handleTabKeyDown(e, 'summary')}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2',
              isSummaryDisabled
                ? 'cursor-not-allowed text-zinc-600'
                : activeTab === 'summary'
                  ? 'border-b-2 border-green-400 text-green-200'
                  : 'text-zinc-400 hover:text-zinc-300'
            )}
          >
            <span className="flex items-center justify-center gap-2">
              Summary
              {summaryState === 'loading' && (
                <Loader2
                  className="h-3 w-3 animate-spin text-[#F0E14A]"
                  aria-hidden="true"
                />
              )}
            </span>
          </button>
        </div>

        {/* Transcription tab panel */}
        <div
          id="tabpanel-transcription"
          role="tabpanel"
          aria-labelledby="tab-transcription"
          hidden={activeTab !== 'transcription'}
          tabIndex={0}
        >
          <div className="max-h-64 overflow-y-auto px-4 py-3">
            <p
              className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300"
              data-testid="transcription-text"
            >
              {transcription}
            </p>
          </div>

          {/* Action buttons row (Copy + Custom Actions) */}
          <div
            className="flex flex-wrap items-center gap-2 border-t border-green-900 px-4 py-2"
            role="group"
            aria-label="Actions for transcription"
            data-testid="transcription-custom-actions"
          >
            <CopyTextButton transcription={transcription} />
            {customActions.map((action) => (
              <CustomActionButton
                key={action.id}
                name={action.name}
                url={action.url}
                transcription={transcription}
              />
            ))}
          </div>
        </div>

        {/* Summary tab panel */}
        <div
          id="tabpanel-summary"
          role="tabpanel"
          aria-labelledby="tab-summary"
          aria-live="polite"
          hidden={activeTab !== 'summary'}
          tabIndex={0}
        >
          {/* Loading state */}
          {summaryState === 'loading' && (
            <div className="flex items-center justify-center px-4 py-8">
              <Loader2
                className="h-6 w-6 animate-spin text-green-400"
                aria-hidden="true"
              />
              <span className="ml-2 text-sm text-zinc-400">
                Generating summary...
              </span>
            </div>
          )}

          {/* Error state */}
          {summaryState === 'error' && summaryError && (
            <div className="px-4 py-4">
              <div className="flex items-start gap-3 rounded-md border border-red-900 bg-red-950 p-3">
                <AlertCircle
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400"
                  aria-hidden="true"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-200">
                    Summary Generation Failed
                  </p>
                  <p className="mt-1 text-sm text-red-300">
                    {summaryError}
                  </p>
                  {onSummaryRetry && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onSummaryRetry}
                      className="mt-3 border-red-800 text-red-300 hover:bg-red-900"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                      Try Again
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Summary content */}
          {summaryState === 'success' && summary && (
            <>
              <div
                className="max-h-64 overflow-y-auto px-4 py-3 text-sm leading-relaxed text-zinc-300 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_li]:text-zinc-300 [&_p]:mb-2 [&_strong]:font-semibold [&_strong]:text-zinc-200"
                data-testid="summary-content"
              >
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>

              {/* Action buttons row (Copy + Custom Actions) */}
              <div
                className="flex flex-wrap items-center gap-2 border-t border-green-900 px-4 py-2"
                role="group"
                aria-label="Actions for summary"
                data-testid="summary-custom-actions"
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopySummary}
                  disabled={isCopied}
                  className="gap-2"
                  data-testid="copy-summary-button"
                  aria-label={isCopied ? 'Summary copied' : 'Copy summary to clipboard'}
                >
                  {isCopied ? (
                    <>
                      <Check className="h-4 w-4 text-green-400" aria-hidden="true" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      <span>Copy Summary</span>
                    </>
                  )}
                </Button>
                {customActions.map((action) => (
                  <CustomActionButton
                    key={action.id}
                    name={action.name}
                    url={action.url}
                    transcription={summary}
                  />
                ))}
              </div>
            </>
          )}

          {/* Idle state - no summary generated yet */}
          {summaryState === 'idle' && !summary && (
            <div className="flex items-center justify-center px-4 py-8 text-sm text-zinc-400">
              Click &quot;Process&quot; to generate a summary of your transcription.
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
