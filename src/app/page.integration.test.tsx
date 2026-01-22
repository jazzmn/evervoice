/**
 * Integration tests for the Home page with ProcessButton.
 *
 * Tests verify that ProcessButton renders correctly in place of TranscribeButton
 * and that ActionButtonsRow is no longer present.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock all the hooks
vi.mock('@/hooks', () => ({
  useAudioRecorder: vi.fn(() => ({
    state: 'stopped',
    mediaStream: null,
    audioResult: null,
    error: null,
    permissionState: 'granted',
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
    retryPermission: vi.fn(),
  })),
  useRecordingDuration: vi.fn(() => ({
    elapsedSeconds: 0,
    formattedElapsed: '0:00',
    formattedRemaining: '5:00',
    showWarning: false,
    startTimer: vi.fn(),
    pauseTimer: vi.fn(),
    resumeTimer: vi.fn(),
    stopTimer: vi.fn(),
  })),
  useFileStorage: vi.fn(() => ({
    saveRecording: vi.fn(),
    isSaving: false,
  })),
  useGlobalHotkey: vi.fn(),
}));

// Mock tauri-api
vi.mock('@/lib/tauri-api', () => ({
  isTauri: vi.fn(() => false),
  transcribeAudio: vi.fn(),
  summarizeText: vi.fn(),
  updateHistorySummary: vi.fn(),
  getHistory: vi.fn(() => Promise.resolve([])),
  getSettings: vi.fn(() => Promise.resolve({
    maxDuration: 5,
    apiKey: 'test-key',
    language: 'de',
    customActions: [],
    globalHotkey: null,
  })),
}));

// Mock stores
vi.mock('@/stores', () => ({
  useSettingsStore: vi.fn((selector) => {
    const state = {
      loadSettings: vi.fn(),
      settings: {
        maxDuration: 5,
        apiKey: 'test-key',
        language: 'de',
        customActions: [],
        globalHotkey: null,
      },
    };
    return selector(state);
  }),
  useRecordingStore: vi.fn((selector) => {
    const state = {
      recordingState: 'stopped',
      setRecordingState: vi.fn(),
      setAudioResult: vi.fn(),
      filePath: '/test/path.webm',
      setFilePath: vi.fn(),
      transcription: null,
      setTranscription: vi.fn(),
      transcriptionState: 'idle',
      setTranscriptionState: vi.fn(),
      transcriptionError: null,
      setTranscriptionError: vi.fn(),
      resetForNewRecording: vi.fn(),
      clearTranscription: vi.fn(),
      summary: null,
      summaryState: 'idle',
      summaryError: null,
      summarySourceText: null,
      setSummary: vi.fn(),
      setSummaryState: vi.fn(),
      setSummaryError: vi.fn(),
    };
    return selector(state);
  }),
  useHistoryStore: vi.fn((selector) => {
    const state = {
      recordings: [],
      selectedRecordingId: null,
      isLoading: false,
      loadHistory: vi.fn(),
      selectRecording: vi.fn(),
      deleteRecording: vi.fn(),
      addRecording: vi.fn(),
    };
    return selector(state);
  }),
  getSelectedRecording: vi.fn(() => null),
}));

// Import after mocks
import Home from './page';

describe('Home Page Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ProcessButton instead of TranscribeButton when recording is stopped', () => {
    render(<Home />);

    // ProcessButton should be present
    const processButton = screen.getByTestId('process-button');
    expect(processButton).toBeInTheDocument();
    expect(processButton).toHaveTextContent('Process');

    // TranscribeButton should NOT be present
    expect(screen.queryByText('Transcribe')).not.toBeInTheDocument();
  });

  it('ActionButtonsRow is no longer rendered', () => {
    render(<Home />);

    // ActionButtonsRow had a specific test id
    expect(screen.queryByTestId('action-buttons-row')).not.toBeInTheDocument();
  });

  it('ProcessButton receives all necessary props', () => {
    render(<Home />);

    const processButton = screen.getByTestId('process-button');

    // Button should be enabled since we have filePath and stopped state
    expect(processButton).not.toBeDisabled();
    expect(processButton).toHaveAttribute('aria-label', 'Process recording');
  });
});
