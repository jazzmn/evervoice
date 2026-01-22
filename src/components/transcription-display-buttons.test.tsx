/**
 * Tests for TranscriptionDisplay component button integrations.
 *
 * Tests verify that CopyTextButton and CustomActionButtons render
 * correctly in both Transcription and Summary tabs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TranscriptionDisplay } from './transcription-display';
import { useSettingsStore } from '@/stores/settings-store';

// Mock the tauri-api module
vi.mock('@/lib/tauri-api', () => ({
  callExternalService: vi.fn(() => Promise.resolve({ success: true })),
  isTauri: vi.fn(() => false),
}));

describe('TranscriptionDisplay Button Integration', () => {
  beforeEach(() => {
    // Set up custom actions in the settings store
    useSettingsStore.setState({
      settings: {
        maxDuration: 5,
        apiKey: null,
        language: 'de',
        globalHotkey: null,
        customActions: [
          { id: 'action-1', name: 'Send to Notion', url: 'https://api.notion.com/v1/pages' },
          { id: 'action-2', name: 'Save to Slack', url: 'https://slack.com/api/chat.postMessage' },
        ],
      },
      isLoaded: true,
      isSaving: false,
      error: null,
    });
  });

  it('renders CopyTextButton in Transcription tab footer', () => {
    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription="Test transcription text"
        error={null}
      />
    );

    // Find the copy text button in the transcription tab
    const copyButton = screen.getByTestId('copy-text-button');
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toHaveTextContent('Copy Text');
  });

  it('renders CustomActionButtons in Transcription tab', () => {
    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription="Test transcription text"
        error={null}
      />
    );

    // Find the custom actions container
    const actionsContainer = screen.getByTestId('transcription-custom-actions');
    expect(actionsContainer).toBeInTheDocument();

    // Check that custom action buttons are rendered
    const notionButton = within(actionsContainer).getByRole('button', { name: /send to notion/i });
    const slackButton = within(actionsContainer).getByRole('button', { name: /save to slack/i });
    expect(notionButton).toBeInTheDocument();
    expect(slackButton).toBeInTheDocument();
  });

  it('renders CustomActionButtons in Summary tab with summary text', async () => {
    const user = userEvent.setup();

    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription="Test transcription text"
        error={null}
        summary="## Summary content"
        summaryState="success"
      />
    );

    // Switch to Summary tab
    const summaryTab = screen.getByRole('tab', { name: /summary/i });
    await user.click(summaryTab);

    // Find the custom actions container in summary tab
    const actionsContainer = screen.getByTestId('summary-custom-actions');
    expect(actionsContainer).toBeInTheDocument();

    // Check that custom action buttons are rendered
    const notionButton = within(actionsContainer).getByRole('button', { name: /send to notion/i });
    expect(notionButton).toBeInTheDocument();
  });

  it('custom actions in Transcription tab receive transcription text', async () => {
    const { callExternalService } = await import('@/lib/tauri-api');
    const mockCallExternalService = vi.mocked(callExternalService);
    mockCallExternalService.mockResolvedValue({ success: true });

    const user = userEvent.setup();
    const transcriptionText = 'This is the transcription text to send';

    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription={transcriptionText}
        error={null}
      />
    );

    // Click the custom action button
    const actionsContainer = screen.getByTestId('transcription-custom-actions');
    const notionButton = within(actionsContainer).getByRole('button', { name: /send to notion/i });
    await user.click(notionButton);

    // Verify the correct text was passed
    expect(mockCallExternalService).toHaveBeenCalledWith(
      'https://api.notion.com/v1/pages',
      transcriptionText
    );
  });

  it('custom actions in Summary tab receive summary text (not transcription)', async () => {
    const { callExternalService } = await import('@/lib/tauri-api');
    const mockCallExternalService = vi.mocked(callExternalService);
    mockCallExternalService.mockResolvedValue({ success: true });

    const user = userEvent.setup();
    const transcriptionText = 'This is the transcription';
    const summaryText = '## This is the summary';

    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription={transcriptionText}
        error={null}
        summary={summaryText}
        summaryState="success"
      />
    );

    // Switch to Summary tab
    const summaryTab = screen.getByRole('tab', { name: /summary/i });
    await user.click(summaryTab);

    // Click the custom action button in summary tab
    const actionsContainer = screen.getByTestId('summary-custom-actions');
    const notionButton = within(actionsContainer).getByRole('button', { name: /send to notion/i });
    await user.click(notionButton);

    // Verify the summary text was passed, not the transcription
    expect(mockCallExternalService).toHaveBeenCalledWith(
      'https://api.notion.com/v1/pages',
      summaryText
    );
  });

  it('has consistent layout between Transcription and Summary tabs', async () => {
    const user = userEvent.setup();

    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription="Test transcription"
        error={null}
        summary="## Summary"
        summaryState="success"
      />
    );

    // Transcription tab has copy button and custom actions
    const copyTextButton = screen.getByTestId('copy-text-button');
    const transcriptionActions = screen.getByTestId('transcription-custom-actions');
    expect(copyTextButton).toBeInTheDocument();
    expect(transcriptionActions).toBeInTheDocument();

    // Switch to Summary tab
    const summaryTab = screen.getByRole('tab', { name: /summary/i });
    await user.click(summaryTab);

    // Summary tab has copy button and custom actions
    const copySummaryButton = screen.getByTestId('copy-summary-button');
    const summaryActions = screen.getByTestId('summary-custom-actions');
    expect(copySummaryButton).toBeInTheDocument();
    expect(summaryActions).toBeInTheDocument();
  });
});
