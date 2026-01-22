import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TranscriptionDisplay } from './transcription-display';
import { SummarizeButton } from './summarize-button';
import { CustomActionButton } from './custom-action-button';
import { useRecordingStore } from '@/stores/recording-store';
import * as tauriApi from '@/lib/tauri-api';

// Mock the Tauri API
vi.mock('@/lib/tauri-api', () => ({
  summarizeText: vi.fn(),
  callExternalService: vi.fn(),
  isTauri: vi.fn(() => true),
}));

// Mock the settings store
vi.mock('@/stores/settings-store', () => ({
  useSettingsStore: vi.fn((selector) => {
    const state = {
      settings: {
        customActions: [
          { id: '1', name: 'Send to Notion', url: 'https://api.notion.com/v1/pages' },
          { id: '2', name: 'Save to Slack', url: 'https://slack.com/api/chat.postMessage' },
        ],
      },
    };
    return selector(state);
  }),
}));

// Mock the useToast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
    toasts: [],
    dismiss: vi.fn(),
  }),
}));

describe('TranscriptionDisplay', () => {
  it('renders transcription text with styling when state is success', () => {
    const transcription = 'This is a test transcription with multiple words for testing.';

    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription={transcription}
        error={null}
      />
    );

    // Check that the transcription text is displayed
    expect(screen.getByTestId('transcription-text')).toHaveTextContent(transcription);

    // Check for "Transcription Complete" header
    expect(screen.getByText('Transcription Complete')).toBeInTheDocument();

    // Check for character count
    expect(screen.getByTestId('char-count')).toHaveTextContent(`${transcription.length} characters`);

    // Check for word count (10 words in the test transcription)
    expect(screen.getByTestId('word-count')).toHaveTextContent('10 words');

    // Check the container has scrollable styling
    const container = screen.getByTestId('transcription-display');
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute('role', 'region');
  });

  it('renders nothing when state is idle', () => {
    const { container } = render(
      <TranscriptionDisplay
        transcriptionState="idle"
        transcription={null}
        error={null}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when state is transcribing', () => {
    const { container } = render(
      <TranscriptionDisplay
        transcriptionState="transcribing"
        transcription={null}
        error={null}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});

describe('SummarizeButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the recording store to initial state
    useRecordingStore.getState().resetRecording();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows loading state and calls summarize API on click', async () => {
    vi.mocked(tauriApi.summarizeText).mockResolvedValueOnce('## Summary\n- Point 1\n- Point 2');

    const user = userEvent.setup();

    render(<SummarizeButton transcription="Test transcription text" />);

    const button = screen.getByTestId('summarize-button');
    // Updated: Button now shows "Summarize" instead of "Summarize & Copy"
    expect(button).toHaveTextContent('Summarize');
    expect(button).not.toBeDisabled();

    // Click the button
    await user.click(button);

    // Check that summarize API was called with the transcription
    expect(tauriApi.summarizeText).toHaveBeenCalledWith('Test transcription text');

    // Wait for the async operation to complete and verify success toast
    // Updated: Toast message changed to reflect summary generation
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Summary generated and copied',
          variant: 'success',
        })
      );
    });
  });

  it('handles errors with error toast', async () => {
    vi.mocked(tauriApi.summarizeText).mockRejectedValueOnce(new Error('API error occurred'));

    const user = userEvent.setup();

    render(<SummarizeButton transcription="Test transcription text" />);

    const button = screen.getByTestId('summarize-button');
    await user.click(button);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Summarization failed',
          description: 'API error occurred',
          variant: 'destructive',
        })
      );
    });
  });

  it('is disabled when no transcription is provided', () => {
    render(<SummarizeButton transcription="" />);

    const button = screen.getByTestId('summarize-button');
    expect(button).toBeDisabled();
  });
});

describe('CustomActionButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('posts to configured URL and shows success toast', async () => {
    vi.mocked(tauriApi.callExternalService).mockResolvedValueOnce({
      success: true,
      message: 'Successfully sent to Notion',
    });

    const user = userEvent.setup();

    render(
      <CustomActionButton
        name="Send to Notion"
        url="https://api.notion.com/v1/pages"
        transcription="Test transcription text"
      />
    );

    const button = screen.getByTestId('custom-action-button-send-to-notion');
    expect(button).toHaveTextContent('Send to Notion');

    await user.click(button);

    expect(tauriApi.callExternalService).toHaveBeenCalledWith(
      'https://api.notion.com/v1/pages',
      'Test transcription text'
    );

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Send to Notion completed',
          variant: 'success',
        })
      );
    });
  });

  it('shows error toast on failure', async () => {
    vi.mocked(tauriApi.callExternalService).mockResolvedValueOnce({
      success: false,
      message: 'Network error',
    });

    const user = userEvent.setup();

    render(
      <CustomActionButton
        name="Send to API"
        url="https://api.example.com"
        transcription="Test text"
      />
    );

    const button = screen.getByTestId('custom-action-button-send-to-api');
    await user.click(button);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Send to API failed',
          description: 'Network error',
          variant: 'destructive',
        })
      );
    });
  });
});
