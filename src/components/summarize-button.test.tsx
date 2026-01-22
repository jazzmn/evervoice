/**
 * Tests for SummarizeButton component store integration.
 *
 * These tests verify the integration between SummarizeButton and
 * the recording store's summary state management.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SummarizeButton } from '@/components/summarize-button';
import { useRecordingStore } from '@/stores/recording-store';

// Mock the tauri-api module
vi.mock('@/lib/tauri-api', () => ({
  summarizeText: vi.fn(),
}));

import { summarizeText } from '@/lib/tauri-api';

const mockSummarizeText = vi.mocked(summarizeText);

describe('SummarizeButton Store Integration', () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useRecordingStore.getState().resetRecording();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('clicking button sets summaryState to loading', async () => {
    const user = userEvent.setup();

    // Setup mock to delay so we can check loading state
    mockSummarizeText.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('## Summary'), 100))
    );

    render(<SummarizeButton transcription="Test transcription text" />);

    const button = screen.getByTestId('summarize-button');
    await user.click(button);

    // Check that summaryState is loading
    expect(useRecordingStore.getState().summaryState).toBe('loading');

    // Wait for the operation to complete
    await waitFor(() => {
      expect(useRecordingStore.getState().summaryState).toBe('success');
    });
  });

  it('successful summarization stores summary in recording store', async () => {
    const user = userEvent.setup();
    const testSummary = '## Test Summary\n- Point 1\n- Point 2';

    mockSummarizeText.mockResolvedValue(testSummary);

    render(<SummarizeButton transcription="Test transcription text" />);

    const button = screen.getByTestId('summarize-button');
    await user.click(button);

    // Wait for the operation to complete
    await waitFor(() => {
      const state = useRecordingStore.getState();
      expect(state.summary).toBe(testSummary);
      expect(state.summaryState).toBe('success');
    });
  });

  it('button shows "Copy Summary" after summary exists in store', async () => {
    const user = userEvent.setup();
    const testSummary = '## Test Summary';

    mockSummarizeText.mockResolvedValue(testSummary);

    render(<SummarizeButton transcription="Test transcription text" />);

    // Initially should show "Summarize"
    expect(screen.getByText('Summarize')).toBeInTheDocument();

    const button = screen.getByTestId('summarize-button');
    await user.click(button);

    // Wait for the operation to complete and button to update
    await waitFor(() => {
      expect(screen.getByText('Copy Summary')).toBeInTheDocument();
    });
  });

  it('clicking Copy Summary does not re-call API when summary exists', async () => {
    const user = userEvent.setup();
    const testSummary = '## Existing Summary';

    // Pre-set summary in store
    useRecordingStore.getState().setSummary(testSummary);
    useRecordingStore.getState().setSummaryState('success');

    render(<SummarizeButton transcription="Test transcription text" />);

    // Should show "Copy Summary" since summary exists
    expect(screen.getByText('Copy Summary')).toBeInTheDocument();

    const button = screen.getByTestId('summarize-button');
    await user.click(button);

    // API should not be called
    expect(mockSummarizeText).not.toHaveBeenCalled();

    // Should show "Copied!" briefly - this confirms the copy operation succeeded
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('calls onSummaryComplete callback after successful summarization', async () => {
    const user = userEvent.setup();
    const onSummaryComplete = vi.fn();

    mockSummarizeText.mockResolvedValue('## Summary');

    render(
      <SummarizeButton
        transcription="Test transcription text"
        onSummaryComplete={onSummaryComplete}
      />
    );

    const button = screen.getByTestId('summarize-button');
    await user.click(button);

    await waitFor(() => {
      expect(onSummaryComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('handles summarization error and updates store state', async () => {
    const user = userEvent.setup();
    const errorMessage = 'API error: Rate limit exceeded';

    mockSummarizeText.mockRejectedValue(new Error(errorMessage));

    render(<SummarizeButton transcription="Test transcription text" />);

    const button = screen.getByTestId('summarize-button');
    await user.click(button);

    await waitFor(() => {
      const state = useRecordingStore.getState();
      expect(state.summaryState).toBe('error');
      expect(state.summaryError).toBe(errorMessage);
    });
  });
});
