import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecordingDuration, formatDuration } from './use-recording-duration';
import { useRecordingStore } from '@/stores/recording-store';
import { useSettingsStore } from '@/stores/settings-store';
import { DEFAULT_SETTINGS } from '@/types';

describe('useRecordingDuration', () => {
  beforeEach(() => {
    // Reset stores before each test
    useRecordingStore.getState().resetRecording();
    useSettingsStore.setState({
      settings: DEFAULT_SETTINGS,
      isLoaded: true,
      isSaving: false,
      error: null,
    });

    // Use fake timers for timer testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatDuration', () => {
    it('should format seconds as MM:SS', () => {
      expect(formatDuration(0)).toBe('00:00');
      expect(formatDuration(30)).toBe('00:30');
      expect(formatDuration(60)).toBe('01:00');
      expect(formatDuration(90)).toBe('01:30');
      expect(formatDuration(600)).toBe('10:00');
      expect(formatDuration(1800)).toBe('30:00');
    });
  });

  describe('initial state', () => {
    it('should initialize with zero elapsed time', () => {
      const { result } = renderHook(() => useRecordingDuration());

      expect(result.current.elapsedSeconds).toBe(0);
      expect(result.current.formattedElapsed).toBe('00:00');
    });

    it('should calculate remaining time based on max duration', () => {
      const { result } = renderHook(() => useRecordingDuration());

      // Default max duration is 30 minutes = 1800 seconds
      expect(result.current.remainingSeconds).toBe(1800);
      expect(result.current.formattedRemaining).toBe('30:00');
    });
  });

  describe('duration tracking', () => {
    it('should increment elapsed seconds when timer is started', () => {
      const { result } = renderHook(() => useRecordingDuration());

      act(() => {
        result.current.startTimer();
      });

      // Advance timer by 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.elapsedSeconds).toBe(3);
      expect(result.current.formattedElapsed).toBe('00:03');

      // Stop timer
      act(() => {
        result.current.stopTimer();
      });
    });

    it('should pause timer and stop incrementing', () => {
      const { result } = renderHook(() => useRecordingDuration());

      act(() => {
        result.current.startTimer();
      });

      // Advance timer by 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.elapsedSeconds).toBe(2);

      // Pause
      act(() => {
        result.current.pauseTimer();
      });

      // Advance timer by 3 more seconds while paused
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Should still be 2 seconds
      expect(result.current.elapsedSeconds).toBe(2);

      // Stop timer
      act(() => {
        result.current.stopTimer();
      });
    });

    it('should resume timer after pause', () => {
      const { result } = renderHook(() => useRecordingDuration());

      act(() => {
        result.current.startTimer();
      });

      // Advance 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Pause
      act(() => {
        result.current.pauseTimer();
      });

      // Advance 3 seconds while paused
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Resume
      act(() => {
        result.current.resumeTimer();
      });

      // Advance 2 more seconds after resume
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Should be 4 seconds (2 before pause + 2 after resume)
      expect(result.current.elapsedSeconds).toBe(4);

      // Stop timer
      act(() => {
        result.current.stopTimer();
      });
    });
  });

  describe('80% warning threshold', () => {
    it('should not show warning before 80% threshold', () => {
      const { result } = renderHook(() => useRecordingDuration());

      // Default is 30 min = 1800s, 80% = 1440s
      // Set elapsed to 1400s (below threshold)
      act(() => {
        for (let i = 0; i < 1400; i++) {
          useRecordingStore.getState().incrementElapsedSeconds();
        }
      });

      expect(result.current.showWarning).toBe(false);
    });

    it('should show warning at 80% threshold', () => {
      const { result } = renderHook(() => useRecordingDuration());

      // Default is 30 min = 1800s, 80% = 1440s
      // Set elapsed to 1440s (at threshold)
      act(() => {
        for (let i = 0; i < 1440; i++) {
          useRecordingStore.getState().incrementElapsedSeconds();
        }
      });

      expect(result.current.showWarning).toBe(true);
    });

    it('should set warningTriggered in store at 80% threshold', () => {
      renderHook(() => useRecordingDuration());

      // Default is 30 min = 1800s, 80% = 1440s
      // Set elapsed to 1440s (at threshold)
      act(() => {
        for (let i = 0; i < 1440; i++) {
          useRecordingStore.getState().incrementElapsedSeconds();
        }
      });

      // After the act block, the effect should have run
      expect(useRecordingStore.getState().warningTriggered).toBe(true);
    });
  });

  describe('auto-stop at max duration', () => {
    it('should indicate max duration reached', () => {
      const { result } = renderHook(() => useRecordingDuration());

      // Set elapsed to max duration (1800s)
      act(() => {
        for (let i = 0; i < 1800; i++) {
          useRecordingStore.getState().incrementElapsedSeconds();
        }
      });

      expect(result.current.maxDurationReached).toBe(true);
      expect(result.current.remainingSeconds).toBe(0);
    });

    it('should call onAutoStop when max duration reached', () => {
      const onAutoStop = vi.fn();
      const { result } = renderHook(() => useRecordingDuration(onAutoStop));

      // Start timer
      act(() => {
        result.current.startTimer();
      });

      // Set elapsed to max duration
      act(() => {
        for (let i = 0; i < 1800; i++) {
          useRecordingStore.getState().incrementElapsedSeconds();
        }
      });

      // The effect should have triggered after the act block
      expect(onAutoStop).toHaveBeenCalledTimes(1);
    });

    it('should only call onAutoStop once even with additional increments', () => {
      const onAutoStop = vi.fn();
      const { result } = renderHook(() => useRecordingDuration(onAutoStop));

      // Start timer
      act(() => {
        result.current.startTimer();
      });

      // Set elapsed to max duration
      act(() => {
        for (let i = 0; i < 1800; i++) {
          useRecordingStore.getState().incrementElapsedSeconds();
        }
      });

      expect(onAutoStop).toHaveBeenCalledTimes(1);

      // Try to increment more (should not trigger again)
      act(() => {
        for (let i = 0; i < 10; i++) {
          useRecordingStore.getState().incrementElapsedSeconds();
        }
      });

      // Should still be called only once
      expect(onAutoStop).toHaveBeenCalledTimes(1);
    });

    it('should respect custom max duration from settings', () => {
      // Set max duration to 1 minute
      act(() => {
        useSettingsStore.setState({
          settings: { maxDuration: 1, apiKey: null },
          isLoaded: true,
          isSaving: false,
          error: null,
        });
      });

      const onAutoStop = vi.fn();
      const { result } = renderHook(() => useRecordingDuration(onAutoStop));

      // Start timer
      act(() => {
        result.current.startTimer();
      });

      // With 1 minute max, 80% = 48 seconds
      // Set elapsed to 48s
      act(() => {
        for (let i = 0; i < 48; i++) {
          useRecordingStore.getState().incrementElapsedSeconds();
        }
      });

      expect(result.current.showWarning).toBe(true);
      expect(onAutoStop).not.toHaveBeenCalled();

      // Set elapsed to 60s (max)
      act(() => {
        for (let i = 0; i < 12; i++) {
          useRecordingStore.getState().incrementElapsedSeconds();
        }
      });

      expect(result.current.maxDurationReached).toBe(true);
      expect(onAutoStop).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('should clear timer on unmount', () => {
      const { result, unmount } = renderHook(() => useRecordingDuration());

      act(() => {
        result.current.startTimer();
      });

      // Advance 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.elapsedSeconds).toBe(2);

      // Unmount
      unmount();

      // Advance 3 more seconds after unmount
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Store should still be at 2 (no more increments after unmount)
      expect(useRecordingStore.getState().elapsedSeconds).toBe(2);
    });
  });
});
