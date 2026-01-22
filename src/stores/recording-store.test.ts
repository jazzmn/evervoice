import { describe, it, expect, beforeEach } from 'vitest';
import { useRecordingStore } from './recording-store';

describe('Recording Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useRecordingStore.getState().resetRecording();
  });

  describe('recording state tracking', () => {
    it('should initialize with idle state', () => {
      const state = useRecordingStore.getState();
      expect(state.recordingState).toBe('idle');
      expect(state.elapsedSeconds).toBe(0);
      expect(state.warningTriggered).toBe(false);
      expect(state.audioResult).toBeNull();
      expect(state.filePath).toBeNull();
      expect(state.transcription).toBeNull();
    });

    it('should update recording state correctly', () => {
      const store = useRecordingStore.getState();

      store.setRecordingState('recording');
      expect(useRecordingStore.getState().recordingState).toBe('recording');

      store.setRecordingState('paused');
      expect(useRecordingStore.getState().recordingState).toBe('paused');

      store.setRecordingState('stopped');
      expect(useRecordingStore.getState().recordingState).toBe('stopped');

      store.setRecordingState('idle');
      expect(useRecordingStore.getState().recordingState).toBe('idle');
    });

    it('should track all recording states in sequence', () => {
      const store = useRecordingStore.getState();

      // Simulate full recording lifecycle
      store.setRecordingState('recording');
      expect(useRecordingStore.getState().recordingState).toBe('recording');

      store.setRecordingState('paused');
      expect(useRecordingStore.getState().recordingState).toBe('paused');

      store.setRecordingState('recording');
      expect(useRecordingStore.getState().recordingState).toBe('recording');

      store.setRecordingState('stopped');
      expect(useRecordingStore.getState().recordingState).toBe('stopped');
    });
  });

  describe('duration countdown logic', () => {
    it('should increment elapsed seconds', () => {
      const store = useRecordingStore.getState();

      expect(useRecordingStore.getState().elapsedSeconds).toBe(0);

      store.incrementElapsedSeconds();
      expect(useRecordingStore.getState().elapsedSeconds).toBe(1);

      store.incrementElapsedSeconds();
      expect(useRecordingStore.getState().elapsedSeconds).toBe(2);

      store.incrementElapsedSeconds();
      expect(useRecordingStore.getState().elapsedSeconds).toBe(3);
    });

    it('should reset elapsed seconds on resetRecording', () => {
      const store = useRecordingStore.getState();

      // Simulate some elapsed time
      store.incrementElapsedSeconds();
      store.incrementElapsedSeconds();
      store.incrementElapsedSeconds();
      expect(useRecordingStore.getState().elapsedSeconds).toBe(3);

      store.resetRecording();
      expect(useRecordingStore.getState().elapsedSeconds).toBe(0);
    });
  });

  describe('warning threshold trigger', () => {
    it('should track warning triggered state', () => {
      const store = useRecordingStore.getState();

      expect(useRecordingStore.getState().warningTriggered).toBe(false);

      store.setWarningTriggered(true);
      expect(useRecordingStore.getState().warningTriggered).toBe(true);

      store.setWarningTriggered(false);
      expect(useRecordingStore.getState().warningTriggered).toBe(false);
    });

    it('should reset warning state on resetRecording', () => {
      const store = useRecordingStore.getState();

      store.setWarningTriggered(true);
      expect(useRecordingStore.getState().warningTriggered).toBe(true);

      store.resetRecording();
      expect(useRecordingStore.getState().warningTriggered).toBe(false);
    });
  });

  describe('audio result and file path tracking', () => {
    it('should store audio result after recording', () => {
      const store = useRecordingStore.getState();
      const mockAudioResult = {
        blob: new Blob(['test'], { type: 'audio/webm' }),
        mimeType: 'audio/webm',
        duration: 5000,
      };

      store.setAudioResult(mockAudioResult);
      expect(useRecordingStore.getState().audioResult).toEqual(mockAudioResult);
    });

    it('should store file path after save', () => {
      const store = useRecordingStore.getState();
      const mockPath = '/path/to/recording.webm';

      store.setFilePath(mockPath);
      expect(useRecordingStore.getState().filePath).toBe(mockPath);
    });

    it('should store transcription text', () => {
      const store = useRecordingStore.getState();
      const mockTranscription = 'Hello, this is a test transcription.';

      store.setTranscription(mockTranscription);
      expect(useRecordingStore.getState().transcription).toBe(mockTranscription);
    });

    it('should clear all recording data on reset', () => {
      const store = useRecordingStore.getState();

      // Set up state
      store.setRecordingState('stopped');
      store.setAudioResult({
        blob: new Blob(['test'], { type: 'audio/webm' }),
        mimeType: 'audio/webm',
        duration: 5000,
      });
      store.setFilePath('/path/to/file.webm');
      store.setTranscription('Test transcription');
      store.setWarningTriggered(true);

      // Reset
      store.resetRecording();

      // Verify all reset
      const state = useRecordingStore.getState();
      expect(state.recordingState).toBe('idle');
      expect(state.elapsedSeconds).toBe(0);
      expect(state.warningTriggered).toBe(false);
      expect(state.audioResult).toBeNull();
      expect(state.filePath).toBeNull();
      expect(state.transcription).toBeNull();
    });
  });
});
