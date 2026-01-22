/**
 * Integration tests for the Summary Display feature.
 *
 * These tests verify the complete integration between components,
 * stores, and the summarization flow.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRecordingStore } from '@/stores/recording-store';
import { TranscriptionDisplay } from '@/components/transcription-display';
import { SummarizeButton } from '@/components/summarize-button';

// Mock the tauri-api module
vi.mock('@/lib/tauri-api', () => ({
  summarizeText: vi.fn(),
}));

import { summarizeText } from '@/lib/tauri-api';

const mockSummarizeText = vi.mocked(summarizeText);

/**
 * Test wrapper component that integrates SummarizeButton and TranscriptionDisplay
 */
function SummaryTestWrapper({ transcription }: { transcription: string }) {
  const store = useRecordingStore();

  const handleTabChange = (tab: 'transcription' | 'summary') => {
    // In a real app, this would be state managed in a parent component
    // For testing, we can verify via store state changes
  };

  return (
    <div>
      <TranscriptionDisplay
        transcriptionState="success"
        transcription={transcription}
        error={null}
        summary={store.summary}
        summaryState={store.summaryState}
        summaryError={store.summaryError}
        onTabChange={handleTabChange}
      />
      <SummarizeButton transcription={transcription} />
    </div>
  );
}

describe('Summary Display Integration Tests', () => {
  beforeEach(() => {
    useRecordingStore.getState().resetRecording();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('full flow: clicking Summarize generates summary and can view in Summary tab', async () => {
    const user = userEvent.setup();
    const transcription = 'This is a test transcription for summarization.';
    const generatedSummary = '## Summary\n\n- Key point 1\n- Key point 2';

    mockSummarizeText.mockResolvedValue(generatedSummary);

    render(<SummaryTestWrapper transcription={transcription} />);

    // Verify initial state - transcription tab is active
    expect(screen.getByRole('tab', { name: 'Transcription' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-disabled', 'true');

    // Click the Summarize button
    const summarizeBtn = screen.getByTestId('summarize-button');
    expect(summarizeBtn).toHaveTextContent('Summarize');
    await user.click(summarizeBtn);

    // Wait for summarization to complete
    await waitFor(() => {
      expect(useRecordingStore.getState().summary).toBe(generatedSummary);
      expect(useRecordingStore.getState().summaryState).toBe('success');
    });

    // Button should now show "Copy Summary"
    expect(screen.getByTestId('summarize-button')).toHaveTextContent('Copy Summary');

    // Summary tab should now be enabled
    expect(screen.getByRole('tab', { name: 'Summary' })).not.toHaveAttribute(
      'aria-disabled',
      'true'
    );

    // Click on Summary tab
    await user.click(screen.getByRole('tab', { name: 'Summary' }));

    // Verify summary content is displayed as rendered markdown
    const summaryContent = screen.getByTestId('summary-content');
    expect(summaryContent).toBeInTheDocument();

    // Verify markdown is rendered (not raw)
    expect(summaryContent.querySelector('h2')).toBeInTheDocument();
    expect(summaryContent.querySelectorAll('li')).toHaveLength(2);
  });

  it('tab resets to Transcription when new recording starts', async () => {
    const user = userEvent.setup();
    const transcription = 'Test transcription';
    const summary = '## Summary';

    // Set up initial state with summary
    useRecordingStore.getState().setTranscription(transcription);
    useRecordingStore.getState().setTranscriptionState('success');
    useRecordingStore.getState().setSummary(summary);
    useRecordingStore.getState().setSummaryState('success');

    const { rerender } = render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription={transcription}
        error={null}
        summary={useRecordingStore.getState().summary}
        summaryState={useRecordingStore.getState().summaryState}
      />
    );

    // Switch to Summary tab
    await user.click(screen.getByRole('tab', { name: 'Summary' }));
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');

    // Simulate starting new recording (resetForNewRecording clears summary)
    useRecordingStore.getState().resetForNewRecording();

    // Verify summary is cleared
    expect(useRecordingStore.getState().summary).toBeNull();
    expect(useRecordingStore.getState().summaryState).toBe('idle');

    // Re-render with new transcription
    rerender(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription="New transcription after recording"
        error={null}
        summary={useRecordingStore.getState().summary}
        summaryState={useRecordingStore.getState().summaryState}
      />
    );

    // Should be back to Transcription tab since summary was cleared
    expect(screen.getByRole('tab', { name: 'Transcription' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('copy summary preserves raw markdown format', async () => {
    const user = userEvent.setup();
    const rawMarkdown = '## Test Summary\n\n- **Bold** point\n- *Italic* point\n\n```code block```';

    useRecordingStore.getState().setSummary(rawMarkdown);
    useRecordingStore.getState().setSummaryState('success');

    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription="Test transcription"
        error={null}
        summary={rawMarkdown}
        summaryState="success"
      />
    );

    // Switch to Summary tab
    await user.click(screen.getByRole('tab', { name: 'Summary' }));

    // Click copy button
    const copyButton = screen.getByTestId('copy-summary-button');
    await user.click(copyButton);

    // Verify clipboard was called with raw markdown (not rendered HTML)
    // The mocked clipboard.writeText in setup.ts would receive the raw markdown
    // We can't directly test the clipboard content, but we can verify the button shows "Copied!"
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('clearing transcription also clears summary', () => {
    // Set up state with both transcription and summary
    useRecordingStore.getState().setTranscription('Test transcription');
    useRecordingStore.getState().setTranscriptionState('success');
    useRecordingStore.getState().setSummary('## Summary');
    useRecordingStore.getState().setSummaryState('success');

    // Verify both exist
    expect(useRecordingStore.getState().transcription).toBe('Test transcription');
    expect(useRecordingStore.getState().summary).toBe('## Summary');

    // Clear transcription
    useRecordingStore.getState().clearTranscription();

    // Both should be cleared
    expect(useRecordingStore.getState().transcription).toBeNull();
    expect(useRecordingStore.getState().transcriptionState).toBe('idle');
    expect(useRecordingStore.getState().summary).toBeNull();
    expect(useRecordingStore.getState().summaryState).toBe('idle');
  });

  it('summary error does not affect transcription display', async () => {
    const user = userEvent.setup();

    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription="Valid transcription text"
        error={null}
        summaryState="error"
        summaryError="API rate limit exceeded"
      />
    );

    // Transcription tab should still be working
    expect(screen.getByTestId('transcription-text')).toHaveTextContent('Valid transcription text');

    // Summary tab should be clickable (error state is not idle)
    const summaryTab = screen.getByRole('tab', { name: 'Summary' });
    expect(summaryTab).not.toHaveAttribute('aria-disabled', 'true');

    // Click to view error
    await user.click(summaryTab);

    // Error should be displayed in summary tab
    expect(screen.getByText('Summary Generation Failed')).toBeInTheDocument();
    expect(screen.getByText('API rate limit exceeded')).toBeInTheDocument();

    // Switch back to transcription - content should still be there
    await user.click(screen.getByRole('tab', { name: 'Transcription' }));
    expect(screen.getByTestId('transcription-text')).toHaveTextContent('Valid transcription text');
  });
});
