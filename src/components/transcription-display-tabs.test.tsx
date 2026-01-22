/**
 * Tests for TranscriptionDisplay tabbed interface.
 *
 * These tests verify the tabbed UI, accessibility, and markdown rendering.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TranscriptionDisplay } from '@/components/transcription-display';

describe('TranscriptionDisplay Tabbed Interface', () => {
  it('tabs render with correct ARIA attributes', () => {
    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription="Test transcription text"
        error={null}
      />
    );

    // Check tablist exists
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();
    expect(tablist).toHaveAttribute('aria-label', 'View transcription or summary');

    // Check transcription tab
    const transcriptionTab = screen.getByRole('tab', { name: 'Transcription' });
    expect(transcriptionTab).toBeInTheDocument();
    expect(transcriptionTab).toHaveAttribute('aria-selected', 'true');
    expect(transcriptionTab).toHaveAttribute('aria-controls', 'tabpanel-transcription');
    expect(transcriptionTab).toHaveAttribute('id', 'tab-transcription');

    // Check summary tab
    const summaryTab = screen.getByRole('tab', { name: 'Summary' });
    expect(summaryTab).toBeInTheDocument();
    expect(summaryTab).toHaveAttribute('aria-selected', 'false');
    expect(summaryTab).toHaveAttribute('aria-controls', 'tabpanel-summary');
    expect(summaryTab).toHaveAttribute('id', 'tab-summary');
    expect(summaryTab).toHaveAttribute('aria-disabled', 'true');

    // Check transcription tabpanel
    const transcriptionPanel = screen.getByRole('tabpanel');
    expect(transcriptionPanel).toHaveAttribute('aria-labelledby', 'tab-transcription');
    expect(transcriptionPanel).toHaveAttribute('id', 'tabpanel-transcription');
  });

  it('clicking Summary tab shows summary content', async () => {
    const user = userEvent.setup();
    const testSummary = '## Test Summary\n- Point 1\n- Point 2';

    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription="Test transcription text"
        error={null}
        summary={testSummary}
        summaryState="success"
      />
    );

    // Initially transcription is visible
    expect(screen.getByTestId('transcription-text')).toBeInTheDocument();

    // Click summary tab
    const summaryTab = screen.getByRole('tab', { name: 'Summary' });
    await user.click(summaryTab);

    // Summary content should be visible
    expect(screen.getByTestId('summary-content')).toBeInTheDocument();

    // Transcription panel should be hidden
    expect(screen.getByTestId('transcription-text').parentElement?.parentElement).toHaveAttribute(
      'hidden'
    );
  });

  it('Summary tab is disabled when no summary exists', () => {
    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription="Test transcription text"
        error={null}
        summaryState="idle"
      />
    );

    const summaryTab = screen.getByRole('tab', { name: 'Summary' });

    // Check that it has aria-disabled
    expect(summaryTab).toHaveAttribute('aria-disabled', 'true');

    // Check that it has the disabled styling class
    expect(summaryTab).toHaveClass('cursor-not-allowed');
  });

  it('markdown content renders formatted, not raw text', async () => {
    const user = userEvent.setup();
    const testSummary = '## Test Summary\n\n- Point 1\n- Point 2\n\n**Bold text**';

    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription="Test transcription text"
        error={null}
        summary={testSummary}
        summaryState="success"
      />
    );

    // Click summary tab
    const summaryTab = screen.getByRole('tab', { name: 'Summary' });
    await user.click(summaryTab);

    const summaryContent = screen.getByTestId('summary-content');

    // Check that markdown is rendered as HTML elements, not raw text
    // The h2 element should exist
    const heading = within(summaryContent).getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('Test Summary');

    // List items should exist
    const listItems = within(summaryContent).getAllByRole('listitem');
    expect(listItems).toHaveLength(2);

    // Bold text should be rendered with strong tag
    expect(summaryContent.querySelector('strong')).toBeInTheDocument();
    expect(summaryContent.querySelector('strong')).toHaveTextContent('Bold text');

    // Raw markdown characters should NOT be visible
    expect(summaryContent.textContent).not.toContain('##');
    expect(summaryContent.textContent).not.toContain('**');
  });

  it('shows loading state in Summary tab when summaryState is loading', async () => {
    const user = userEvent.setup();

    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription="Test transcription text"
        error={null}
        summaryState="loading"
      />
    );

    // Summary tab should be clickable when loading (not idle)
    const summaryTab = screen.getByRole('tab', { name: 'Summary' });
    expect(summaryTab).not.toHaveAttribute('aria-disabled', 'true');

    // Click to switch to summary tab
    await user.click(summaryTab);

    // Should show loading message
    expect(screen.getByText('Generating summary...')).toBeInTheDocument();
  });

  it('shows error state in Summary tab when summaryState is error', async () => {
    const user = userEvent.setup();
    const onSummaryRetry = vi.fn();

    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription="Test transcription text"
        error={null}
        summaryState="error"
        summaryError="Failed to generate summary"
        onSummaryRetry={onSummaryRetry}
      />
    );

    // Click to switch to summary tab
    const summaryTab = screen.getByRole('tab', { name: 'Summary' });
    await user.click(summaryTab);

    // Should show error message
    expect(screen.getByText('Summary Generation Failed')).toBeInTheDocument();
    expect(screen.getByText('Failed to generate summary')).toBeInTheDocument();

    // Retry button should be visible
    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    // Click retry button
    await user.click(retryButton);
    expect(onSummaryRetry).toHaveBeenCalledTimes(1);
  });

  it('keyboard navigation between tabs works correctly', async () => {
    const user = userEvent.setup();

    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription="Test transcription text"
        error={null}
        summary="## Summary"
        summaryState="success"
      />
    );

    const transcriptionTab = screen.getByRole('tab', { name: 'Transcription' });
    const summaryTab = screen.getByRole('tab', { name: 'Summary' });

    // Focus on transcription tab
    await user.click(transcriptionTab);
    expect(transcriptionTab).toHaveFocus();

    // Press right arrow to move to summary tab
    await user.keyboard('{ArrowRight}');
    expect(summaryTab).toHaveFocus();

    // Press left arrow to move back to transcription tab
    await user.keyboard('{ArrowLeft}');
    expect(transcriptionTab).toHaveFocus();

    // Press End to jump to last tab
    await user.keyboard('{End}');
    expect(summaryTab).toHaveFocus();

    // Press Home to jump to first tab
    await user.keyboard('{Home}');
    expect(transcriptionTab).toHaveFocus();
  });
});
