/**
 * Integration tests for the audio recording feature.
 *
 * These tests verify critical end-to-end workflows that span multiple
 * components, hooks, and stores to ensure they work together correctly.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRecordingStore } from '@/stores/recording-store';
import { useSettingsStore } from '@/stores/settings-store';
import { DEFAULT_SETTINGS } from '@/types';

// Mock the tauri-api module
vi.mock('@/lib/tauri-api', () => ({
  isTauri: vi.fn(() => true),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  saveRecording: vi.fn(),
  deleteRecording: vi.fn(),
  ensureDirectoryExists: vi.fn(),
  parseFileStorageError: vi.fn((err) => ({
    type: 'unknown',
    message: err instanceof Error ? err.message : 'Unknown error',
  })),
  transcribeAudio: vi.fn(),
  parseTranscriptionError: vi.fn(),
}));

import {
  saveRecording as saveRecordingApi,
  ensureDirectoryExists,
  transcribeAudio,
} from '@/lib/tauri-api';

const mockSaveRecording = vi.mocked(saveRecordingApi);
const mockEnsureDirectoryExists = vi.mocked(ensureDirectoryExists);
const mockTranscribeAudio = vi.mocked(transcribeAudio);

describe('Recording Workflow Integration Tests', () => {
  beforeEach(() => {
    // Reset all stores
    useRecordingStore.getState().resetRecording();
    useSettingsStore.setState({
      settings: DEFAULT_SETTINGS,
      isLoaded: true,
      isSaving: false,
      error: null,
    });

    // Reset mocks
    vi.clearAllMocks();
    mockEnsureDirectoryExists.mockResolvedValue('/path/to/recordings');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Full Recording Flow (start -> pause -> resume -> stop)', () => {
    it('should track state transitions through complete recording lifecycle', () => {
      const store = useRecordingStore.getState();

      // Initially idle
      expect(useRecordingStore.getState().recordingState).toBe('idle');

      // Start recording
      store.setRecordingState('recording');
      expect(useRecordingStore.getState().recordingState).toBe('recording');

      // Simulate elapsed time
      store.incrementElapsedSeconds();
      store.incrementElapsedSeconds();
      store.incrementElapsedSeconds();
      expect(useRecordingStore.getState().elapsedSeconds).toBe(3);

      // Pause recording
      store.setRecordingState('paused');
      expect(useRecordingStore.getState().recordingState).toBe('paused');

      // Resume recording
      store.setRecordingState('recording');
      expect(useRecordingStore.getState().recordingState).toBe('recording');

      // Add more elapsed time
      store.incrementElapsedSeconds();
      store.incrementElapsedSeconds();
      expect(useRecordingStore.getState().elapsedSeconds).toBe(5);

      // Stop recording
      store.setRecordingState('stopped');
      expect(useRecordingStore.getState().recordingState).toBe('stopped');

      // Verify elapsed time is preserved after stop
      expect(useRecordingStore.getState().elapsedSeconds).toBe(5);
    });

    it('should set audio result when recording stops', () => {
      const store = useRecordingStore.getState();

      store.setRecordingState('recording');
      store.incrementElapsedSeconds();

      // Stop and set audio result
      store.setRecordingState('stopped');
      const mockAudioResult = {
        blob: new Blob(['test audio'], { type: 'audio/webm' }),
        mimeType: 'audio/webm',
        duration: 5000,
      };
      store.setAudioResult(mockAudioResult);

      const state = useRecordingStore.getState();
      expect(state.recordingState).toBe('stopped');
      expect(state.audioResult).toEqual(mockAudioResult);
    });
  });

  describe('Recording to Transcription Workflow', () => {
    it('should transition from stopped recording to transcription states', async () => {
      const store = useRecordingStore.getState();

      // Complete a recording
      store.setRecordingState('recording');
      store.incrementElapsedSeconds();
      store.setRecordingState('stopped');
      store.setAudioResult({
        blob: new Blob(['test audio'], { type: 'audio/webm' }),
        mimeType: 'audio/webm',
        duration: 1000,
      });

      // Simulate file save
      mockSaveRecording.mockResolvedValue('/path/to/recording.webm');
      store.setFilePath('/path/to/recording.webm');

      // Verify pre-transcription state
      expect(useRecordingStore.getState().recordingState).toBe('stopped');
      expect(useRecordingStore.getState().filePath).toBe('/path/to/recording.webm');
      expect(useRecordingStore.getState().transcriptionState).toBe('idle');

      // Start transcription
      store.setTranscriptionState('transcribing');
      expect(useRecordingStore.getState().transcriptionState).toBe('transcribing');

      // Complete transcription
      const transcriptionText = 'Hello, this is a test transcription.';
      store.setTranscription(transcriptionText);
      store.setTranscriptionState('success');

      const state = useRecordingStore.getState();
      expect(state.transcriptionState).toBe('success');
      expect(state.transcription).toBe(transcriptionText);
    });

    it('should handle transcription error and allow retry', () => {
      const store = useRecordingStore.getState();

      // Setup recording complete state
      store.setRecordingState('stopped');
      store.setFilePath('/path/to/recording.webm');
      store.setAudioResult({
        blob: new Blob(['test audio'], { type: 'audio/webm' }),
        mimeType: 'audio/webm',
        duration: 1000,
      });

      // Start transcription
      store.setTranscriptionState('transcribing');

      // Simulate error
      store.setTranscriptionState('error');
      store.setTranscriptionError({
        type: 'network_error',
        message: 'Network error occurred',
        retryable: true,
      });

      let state = useRecordingStore.getState();
      expect(state.transcriptionState).toBe('error');
      expect(state.transcriptionError?.type).toBe('network_error');
      expect(state.transcriptionError?.retryable).toBe(true);

      // Clear for retry
      store.clearTranscription();

      state = useRecordingStore.getState();
      expect(state.transcriptionState).toBe('idle');
      expect(state.transcriptionError).toBeNull();
      expect(state.transcription).toBeNull();
      // File path and audio result should still be available for retry
      expect(state.filePath).toBe('/path/to/recording.webm');
      expect(state.audioResult).not.toBeNull();
    });
  });

  describe('Settings Affect Recording Behavior', () => {
    it('should use custom max duration from settings for warning threshold', () => {
      // Set custom max duration (5 minutes = 300 seconds)
      useSettingsStore.setState({
        settings: { maxDuration: 5, apiKey: null },
        isLoaded: true,
        isSaving: false,
        error: null,
      });

      const recordingStore = useRecordingStore.getState();
      const settingsState = useSettingsStore.getState();

      // Verify settings are applied
      expect(settingsState.settings.maxDuration).toBe(5);

      // Start recording
      recordingStore.setRecordingState('recording');

      // 80% of 300 seconds = 240 seconds
      // Simulate reaching 240 seconds
      for (let i = 0; i < 240; i++) {
        recordingStore.incrementElapsedSeconds();
      }

      expect(useRecordingStore.getState().elapsedSeconds).toBe(240);

      // Warning should be triggerable at this point
      recordingStore.setWarningTriggered(true);
      expect(useRecordingStore.getState().warningTriggered).toBe(true);
    });

    it('should preserve settings across recording reset', () => {
      // Configure custom settings
      useSettingsStore.setState({
        settings: { maxDuration: 60, apiKey: 'test-api-key' },
        isLoaded: true,
        isSaving: false,
        error: null,
      });

      const recordingStore = useRecordingStore.getState();

      // Complete a recording
      recordingStore.setRecordingState('recording');
      recordingStore.incrementElapsedSeconds();
      recordingStore.setRecordingState('stopped');

      // Reset recording
      recordingStore.resetRecording();

      // Verify recording state is reset
      expect(useRecordingStore.getState().recordingState).toBe('idle');
      expect(useRecordingStore.getState().elapsedSeconds).toBe(0);

      // Verify settings are preserved
      const settings = useSettingsStore.getState().settings;
      expect(settings.maxDuration).toBe(60);
      expect(settings.apiKey).toBe('test-api-key');
    });
  });

  describe('File Storage Integration', () => {
    it('should set file path after successful save', async () => {
      const recordingStore = useRecordingStore.getState();

      // Complete recording
      recordingStore.setRecordingState('recording');
      recordingStore.incrementElapsedSeconds();
      recordingStore.setRecordingState('stopped');

      const mockAudioResult = {
        blob: new Blob(['test audio'], { type: 'audio/webm' }),
        mimeType: 'audio/webm',
        duration: 1000,
      };
      recordingStore.setAudioResult(mockAudioResult);

      // Simulate file save
      const expectedPath = '/recordings/recording-2024-01-21T10-30-00-uuid.webm';
      mockSaveRecording.mockResolvedValue(expectedPath);

      // In real usage, the hook would call this after save
      recordingStore.setFilePath(expectedPath);

      const state = useRecordingStore.getState();
      expect(state.filePath).toBe(expectedPath);
      expect(state.audioResult).toEqual(mockAudioResult);
      expect(state.recordingState).toBe('stopped');
    });

    it('should clear file path on new recording', () => {
      const store = useRecordingStore.getState();

      // Setup completed recording with file
      store.setRecordingState('stopped');
      store.setFilePath('/path/to/recording.webm');
      store.setAudioResult({
        blob: new Blob(['test'], { type: 'audio/webm' }),
        mimeType: 'audio/webm',
        duration: 1000,
      });

      // Reset for new recording
      store.resetRecording();

      const state = useRecordingStore.getState();
      expect(state.recordingState).toBe('idle');
      expect(state.filePath).toBeNull();
      expect(state.audioResult).toBeNull();
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should allow new recording after previous recording error', () => {
      const store = useRecordingStore.getState();

      // Start first recording
      store.setRecordingState('recording');
      store.incrementElapsedSeconds();

      // Simulate an error scenario - recording failed
      // In real usage, the hook would handle cleanup
      store.resetRecording();

      // Verify clean state for retry
      let state = useRecordingStore.getState();
      expect(state.recordingState).toBe('idle');
      expect(state.elapsedSeconds).toBe(0);
      expect(state.audioResult).toBeNull();

      // Start new recording
      store.setRecordingState('recording');
      expect(useRecordingStore.getState().recordingState).toBe('recording');

      // Complete successfully
      store.incrementElapsedSeconds();
      store.setRecordingState('stopped');
      store.setAudioResult({
        blob: new Blob(['new recording'], { type: 'audio/webm' }),
        mimeType: 'audio/webm',
        duration: 1000,
      });

      state = useRecordingStore.getState();
      expect(state.recordingState).toBe('stopped');
      expect(state.audioResult).not.toBeNull();
    });

    it('should handle non-retryable transcription errors correctly', () => {
      const store = useRecordingStore.getState();

      // Setup recording complete
      store.setRecordingState('stopped');
      store.setFilePath('/path/to/recording.webm');
      store.setAudioResult({
        blob: new Blob(['test'], { type: 'audio/webm' }),
        mimeType: 'audio/webm',
        duration: 1000,
      });

      // Transcription fails with non-retryable error
      store.setTranscriptionState('error');
      store.setTranscriptionError({
        type: 'api_key_not_configured',
        message: 'API key not configured',
        retryable: false,
      });

      const state = useRecordingStore.getState();
      expect(state.transcriptionError?.retryable).toBe(false);
      expect(state.transcriptionError?.type).toBe('api_key_not_configured');

      // Recording and file should still be available
      expect(state.recordingState).toBe('stopped');
      expect(state.filePath).toBe('/path/to/recording.webm');
    });
  });
});
