import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGlobalHotkey } from './use-global-hotkey';
import { useRecordingStore } from '@/stores/recording-store';

// Mock the tauri-api module
vi.mock('@/lib/tauri-api', () => ({
  isTauri: vi.fn(() => true),
  listenForGlobalHotkey: vi.fn(),
}));

// Mock the toast function
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

import { isTauri, listenForGlobalHotkey } from '@/lib/tauri-api';
import { toast } from '@/hooks/use-toast';

const mockIsTauri = vi.mocked(isTauri);
const mockListenForGlobalHotkey = vi.mocked(listenForGlobalHotkey);
const mockToast = vi.mocked(toast);

describe('useGlobalHotkey', () => {
  let hotkeyCallback: ((payload: { timestamp: number; hotkey: string }) => void) | null = null;
  const mockUnlisten = vi.fn();

  beforeEach(() => {
    // Reset store state
    useRecordingStore.setState({
      recordingState: 'idle',
      elapsedSeconds: 0,
      warningTriggered: false,
      audioResult: null,
      filePath: null,
      transcription: null,
      transcriptionState: 'idle',
      transcriptionError: null,
    });

    // Reset mocks
    vi.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    hotkeyCallback = null;

    // Mock listenForGlobalHotkey to capture the callback
    mockListenForGlobalHotkey.mockImplementation(async (callback) => {
      hotkeyCallback = callback;
      return mockUnlisten;
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should set up event listener in Tauri environment', async () => {
    const onStart = vi.fn();
    const onStop = vi.fn();

    renderHook(() => useGlobalHotkey(onStart, onStop));

    await waitFor(() => {
      expect(mockListenForGlobalHotkey).toHaveBeenCalledTimes(1);
    });
  });

  it('should not set up listener in non-Tauri environment', () => {
    mockIsTauri.mockReturnValue(false);
    const onStart = vi.fn();
    const onStop = vi.fn();

    renderHook(() => useGlobalHotkey(onStart, onStop));

    expect(mockListenForGlobalHotkey).not.toHaveBeenCalled();
  });

  it('should start recording when hotkey is pressed while idle', async () => {
    const onStart = vi.fn();
    const onStop = vi.fn();

    useRecordingStore.setState({ recordingState: 'idle' });

    renderHook(() => useGlobalHotkey(onStart, onStop));

    await waitFor(() => {
      expect(hotkeyCallback).not.toBeNull();
    });

    // Simulate hotkey press
    act(() => {
      hotkeyCallback!({ timestamp: Date.now(), hotkey: 'Ctrl+Shift+R' });
    });

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStop).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Recording started',
      })
    );
  });

  it('should stop recording when hotkey is pressed while recording', async () => {
    const onStart = vi.fn();
    const onStop = vi.fn();

    useRecordingStore.setState({ recordingState: 'recording' });

    renderHook(() => useGlobalHotkey(onStart, onStop));

    await waitFor(() => {
      expect(hotkeyCallback).not.toBeNull();
    });

    // Simulate hotkey press
    act(() => {
      hotkeyCallback!({ timestamp: Date.now(), hotkey: 'Ctrl+Shift+R' });
    });

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Recording stopped',
      })
    );
  });

  it('should clean up listener on unmount', async () => {
    const onStart = vi.fn();
    const onStop = vi.fn();

    const { unmount } = renderHook(() => useGlobalHotkey(onStart, onStop));

    await waitFor(() => {
      expect(mockListenForGlobalHotkey).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnlisten).toHaveBeenCalled();
  });
});
