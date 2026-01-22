import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioPlayback } from './use-audio-playback';

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

// Mock Tauri convertFileSrc
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

// Create mock store state and actions
const mockStartPlayback = vi.fn();
const mockStopPlayback = vi.fn();
let mockPlayingRecordingId: string | null = null;

// Mock the history store with proper Zustand selector support
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

import { toast } from '@/hooks/use-toast';
import { convertFileSrc } from '@tauri-apps/api/core';

const mockToast = vi.mocked(toast);
const mockConvertFileSrc = vi.mocked(convertFileSrc);

// Mock Audio class
class MockAudio {
  src = '';
  onended: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();

  constructor(src?: string) {
    if (src) {
      this.src = src;
    }
  }
}

describe('useAudioPlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayingRecordingId = null;

    // Setup global Audio mock
    global.Audio = MockAudio as unknown as typeof Audio;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('play', () => {
    it('should create Audio instance and call startPlayback in store', async () => {
      const { result } = renderHook(() => useAudioPlayback());

      await act(async () => {
        result.current.play('/path/to/recording.webm', 'recording-id');
      });

      expect(mockConvertFileSrc).toHaveBeenCalledWith('/path/to/recording.webm');
      expect(mockStartPlayback).toHaveBeenCalledWith('recording-id');
    });
  });

  describe('stop', () => {
    it('should pause audio and call stopPlayback in store', async () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Start playback first
      await act(async () => {
        result.current.play('/path/to/recording.webm', 'recording-id');
      });

      // Then stop
      act(() => {
        result.current.stop();
      });

      expect(mockStopPlayback).toHaveBeenCalled();
    });
  });

  describe('ended event', () => {
    it('should trigger stopPlayback in store when audio ends', async () => {
      const { result } = renderHook(() => useAudioPlayback());

      let audioInstance: MockAudio | null = null;

      // Capture the audio instance
      const originalAudio = global.Audio;
      global.Audio = class extends MockAudio {
        constructor(src?: string) {
          super(src);
          audioInstance = this;
        }
      } as unknown as typeof Audio;

      await act(async () => {
        result.current.play('/path/to/recording.webm', 'recording-id');
      });

      // Clear the mock to only check the ended event call
      mockStopPlayback.mockClear();

      // Simulate audio ended event
      act(() => {
        if (audioInstance?.onended) {
          audioInstance.onended();
        }
      });

      expect(mockStopPlayback).toHaveBeenCalled();

      // Restore original Audio
      global.Audio = originalAudio;
    });
  });

  describe('cleanup on unmount', () => {
    it('should stop audio and clean up on unmount', async () => {
      let audioInstance: MockAudio | null = null;

      // Capture the audio instance
      const originalAudio = global.Audio;
      global.Audio = class extends MockAudio {
        constructor(src?: string) {
          super(src);
          audioInstance = this;
        }
      } as unknown as typeof Audio;

      const { result, unmount } = renderHook(() => useAudioPlayback());

      await act(async () => {
        result.current.play('/path/to/recording.webm', 'recording-id');
      });

      // Unmount the hook
      unmount();

      // Verify audio was paused
      expect(audioInstance?.pause).toHaveBeenCalled();

      // Restore original Audio
      global.Audio = originalAudio;
    });
  });
});
