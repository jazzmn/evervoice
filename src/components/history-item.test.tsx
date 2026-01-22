import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryItem } from './history-item';
import type { Recording } from '@/types';

// Mock the history store
const mockStartPlayback = vi.fn();
const mockStopPlayback = vi.fn();
let mockPlayingRecordingId: string | null = null;

vi.mock('@/stores/history-store', () => ({
  useHistoryStore: vi.fn((selector: (state: unknown) => unknown) => {
    const state = {
      playingRecordingId: mockPlayingRecordingId,
      startPlayback: mockStartPlayback,
      stopPlayback: mockStopPlayback,
    };
    return selector(state);
  }),
}));

// Mock the audio playback hook
const mockPlay = vi.fn();
const mockStop = vi.fn();

vi.mock('@/hooks/use-audio-playback', () => ({
  useAudioPlayback: vi.fn(() => ({
    play: mockPlay,
    stop: mockStop,
    isPlaying: mockPlayingRecordingId !== null,
  })),
}));

const mockRecording: Recording = {
  id: 'test-rec-1',
  filePath: '/path/to/test.webm',
  durationSeconds: 90,
  transcription: 'This is a test transcription for playback feature.',
  createdAt: '2024-03-20T14:30:00.000Z',
};

describe('HistoryItem Playback UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayingRecordingId = null;
  });

  describe('play button rendering', () => {
    it('should render play button with Play icon when not playing', () => {
      render(<HistoryItem recording={mockRecording} />);

      const playButton = screen.getByRole('button', { name: 'Play recording' });
      expect(playButton).toBeInTheDocument();
    });

    it('should render play button with Square (stop) icon when this recording is playing', () => {
      mockPlayingRecordingId = 'test-rec-1';

      render(<HistoryItem recording={mockRecording} />);

      const stopButton = screen.getByRole('button', { name: 'Stop recording' });
      expect(stopButton).toBeInTheDocument();
    });
  });

  describe('play button interactions', () => {
    it('should call play() from hook when clicking play button', async () => {
      const user = userEvent.setup();
      mockPlayingRecordingId = null;

      render(<HistoryItem recording={mockRecording} />);

      const playButton = screen.getByRole('button', { name: 'Play recording' });
      await user.click(playButton);

      expect(mockPlay).toHaveBeenCalledWith('/path/to/test.webm', 'test-rec-1');
    });

    it('should call stop() from hook when clicking stop button', async () => {
      const user = userEvent.setup();
      mockPlayingRecordingId = 'test-rec-1';

      render(<HistoryItem recording={mockRecording} />);

      const stopButton = screen.getByRole('button', { name: 'Stop recording' });
      await user.click(stopButton);

      expect(mockStop).toHaveBeenCalled();
    });
  });

  describe('visual playing indicator', () => {
    it('should show visual playing indicator when recording is playing', () => {
      mockPlayingRecordingId = 'test-rec-1';

      const { container } = render(<HistoryItem recording={mockRecording} />);

      // Check for the playing indicator border class
      const historyItem = container.querySelector('[role="button"]');
      expect(historyItem).toHaveClass('border-l-2');
      expect(historyItem).toHaveClass('border-l-blue-500');
    });
  });
});
