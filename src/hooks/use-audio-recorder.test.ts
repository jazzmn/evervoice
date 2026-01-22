import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAudioRecorder } from './use-audio-recorder';

// Mock MediaStream track
const createMockTrack = () => ({
  stop: vi.fn(),
  kind: 'audio',
  id: 'mock-track-id',
  enabled: true,
  muted: false,
  readyState: 'live',
});

// Mock MediaStream
const createMockStream = () => {
  const track = createMockTrack();
  return {
    getTracks: vi.fn(() => [track]),
    getAudioTracks: vi.fn(() => [track]),
    getVideoTracks: vi.fn(() => []),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    clone: vi.fn(),
    id: 'mock-stream-id',
    active: true,
  } as unknown as MediaStream;
};

// Mock MediaRecorder
class MockMediaRecorder {
  static isTypeSupported = vi.fn((type: string) => type.includes('webm'));

  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  stream: MediaStream;

  constructor(stream: MediaStream) {
    this.stream = stream;
  }

  start = vi.fn(() => {
    this.state = 'recording';
  });

  pause = vi.fn(() => {
    this.state = 'paused';
  });

  resume = vi.fn(() => {
    this.state = 'recording';
  });

  stop = vi.fn(() => {
    this.state = 'inactive';
    // Trigger ondataavailable with mock blob
    if (this.ondataavailable) {
      const blob = new Blob(['mock audio data'], { type: 'audio/webm' });
      this.ondataavailable({ data: blob } as BlobEvent);
    }
    // Trigger onstop
    if (this.onstop) {
      this.onstop();
    }
  });
}

// Store reference to mock functions
let mockGetUserMedia: ReturnType<typeof vi.fn>;
let mockStream: MediaStream;

describe('useAudioRecorder', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create fresh mock stream
    mockStream = createMockStream();

    // Mock getUserMedia
    mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);

    // Setup navigator.mediaDevices mock
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: mockGetUserMedia,
      },
      writable: true,
      configurable: true,
    });

    // Setup MediaRecorder mock
    global.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with idle state and no audio result', () => {
      const { result } = renderHook(() => useAudioRecorder());

      expect(result.current.state).toBe('idle');
      expect(result.current.audioResult).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.permissionState).toBe('unknown');
    });
  });

  describe('state transitions', () => {
    it('should transition from idle to recording when start is called', async () => {
      const { result } = renderHook(() => useAudioRecorder());

      await act(async () => {
        await result.current.start();
      });

      expect(result.current.state).toBe('recording');
      expect(result.current.permissionState).toBe('granted');
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    });

    it('should transition from recording to paused when pause is called', async () => {
      const { result } = renderHook(() => useAudioRecorder());

      await act(async () => {
        await result.current.start();
      });

      act(() => {
        result.current.pause();
      });

      expect(result.current.state).toBe('paused');
    });

    it('should transition from paused to recording when resume is called', async () => {
      const { result } = renderHook(() => useAudioRecorder());

      await act(async () => {
        await result.current.start();
      });

      act(() => {
        result.current.pause();
      });

      expect(result.current.state).toBe('paused');

      act(() => {
        result.current.resume();
      });

      expect(result.current.state).toBe('recording');
    });

    it('should transition to stopped and generate audio blob when stop is called', async () => {
      const { result } = renderHook(() => useAudioRecorder());

      await act(async () => {
        await result.current.start();
      });

      act(() => {
        result.current.stop();
      });

      await waitFor(() => {
        expect(result.current.state).toBe('stopped');
      });

      expect(result.current.audioResult).not.toBeNull();
      expect(result.current.audioResult?.blob).toBeInstanceOf(Blob);
      expect(result.current.audioResult?.mimeType).toContain('webm');
    });

    it('should reset to idle state when reset is called', async () => {
      const { result } = renderHook(() => useAudioRecorder());

      await act(async () => {
        await result.current.start();
      });

      act(() => {
        result.current.stop();
      });

      await waitFor(() => {
        expect(result.current.state).toBe('stopped');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.state).toBe('idle');
      expect(result.current.audioResult).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('audio blob generation', () => {
    it('should generate audio blob in WebM format on stop', async () => {
      const { result } = renderHook(() => useAudioRecorder());

      await act(async () => {
        await result.current.start();
      });

      act(() => {
        result.current.stop();
      });

      await waitFor(() => {
        expect(result.current.audioResult).not.toBeNull();
      });

      const audioResult = result.current.audioResult;
      expect(audioResult?.blob).toBeInstanceOf(Blob);
      expect(audioResult?.mimeType).toContain('webm');
      expect(audioResult?.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cleanup on unmount', () => {
    it('should stop all media tracks and cleanup resources on unmount', async () => {
      const { result, unmount } = renderHook(() => useAudioRecorder());

      await act(async () => {
        await result.current.start();
      });

      // Verify stream was set
      expect(result.current.mediaStream).not.toBeNull();

      // Unmount the hook
      unmount();

      // Verify tracks were stopped
      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled();
    });
  });

  describe('permission handling', () => {
    it('should handle permission denial with user-friendly error message', async () => {
      // Mock getUserMedia to throw NotAllowedError
      const permissionError = new DOMException('Permission denied', 'NotAllowedError');
      mockGetUserMedia.mockRejectedValueOnce(permissionError);

      const { result } = renderHook(() => useAudioRecorder());

      await act(async () => {
        await result.current.start();
      });

      expect(result.current.state).toBe('idle');
      expect(result.current.permissionState).toBe('denied');
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.type).toBe('permission_denied');
      expect(result.current.error?.message).toContain('Microphone access denied');
    });

    it('should allow retry after permission denial', async () => {
      // First call: permission denied
      const permissionError = new DOMException('Permission denied', 'NotAllowedError');
      mockGetUserMedia.mockRejectedValueOnce(permissionError);

      const { result } = renderHook(() => useAudioRecorder());

      await act(async () => {
        await result.current.start();
      });

      expect(result.current.permissionState).toBe('denied');
      expect(result.current.error?.type).toBe('permission_denied');

      // Second call: permission granted
      mockGetUserMedia.mockResolvedValueOnce(mockStream);

      await act(async () => {
        await result.current.retryPermission();
      });

      expect(result.current.state).toBe('recording');
      expect(result.current.permissionState).toBe('granted');
      expect(result.current.error).toBeNull();
    });

    it('should handle device not found error', async () => {
      const notFoundError = new DOMException('No device', 'NotFoundError');
      mockGetUserMedia.mockRejectedValueOnce(notFoundError);

      const { result } = renderHook(() => useAudioRecorder());

      await act(async () => {
        await result.current.start();
      });

      expect(result.current.error?.type).toBe('device_not_found');
      expect(result.current.error?.message).toContain('No microphone found');
    });
  });
});
