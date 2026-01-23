import { create } from 'zustand';
import type {
  RecordingState,
  AudioRecordingResult,
  TranscriptionState,
  TranscriptionError,
  SummaryState,
} from '@/types';

/**
 * Recording store state interface
 */
interface RecordingStoreState {
  /** Current recording state */
  recordingState: RecordingState;
  /** Elapsed recording time in seconds (excluding paused time) */
  elapsedSeconds: number;
  /** Whether the 80% duration warning has been triggered */
  warningTriggered: boolean;
  /** Audio blob reference when available */
  audioResult: AudioRecordingResult | null;
  /** File path after save */
  filePath: string | null;
  /** Transcription text after Whisper API call */
  transcription: string | null;
  /** Current transcription state */
  transcriptionState: TranscriptionState;
  /** Transcription error if any */
  transcriptionError: TranscriptionError | null;
  /** AI-generated summary markdown text */
  summary: string | null;
  /** Current summary state */
  summaryState: SummaryState;
  /** Summary error message if any */
  summaryError: string | null;
  /** The transcription text that was used to generate the current summary */
  summarySourceText: string | null;
}

/**
 * Recording store actions interface
 */
interface RecordingStoreActions {
  /** Set the recording state */
  setRecordingState: (state: RecordingState) => void;
  /** Increment elapsed seconds by 1 (called by timer) */
  incrementElapsedSeconds: () => void;
  /** Set warning triggered state */
  setWarningTriggered: (triggered: boolean) => void;
  /** Set the audio result after recording stops */
  setAudioResult: (result: AudioRecordingResult | null) => void;
  /** Set the file path after saving */
  setFilePath: (path: string | null) => void;
  /** Set the transcription text */
  setTranscription: (text: string | null) => void;
  /** Set the transcription state */
  setTranscriptionState: (state: TranscriptionState) => void;
  /** Set the transcription error */
  setTranscriptionError: (error: TranscriptionError | null) => void;
  /** Set the summary text and its source transcription */
  setSummary: (summary: string | null, sourceText?: string | null) => void;
  /** Set the summary state */
  setSummaryState: (state: SummaryState) => void;
  /** Set the summary error message */
  setSummaryError: (error: string | null) => void;
  /** Clear all summary state to initial values */
  clearSummary: () => void;
  /** Reset all recording state to initial values */
  resetRecording: () => void;
  /** Reset recording state but keep transcription (after successful transcribe) */
  resetForNewRecording: () => void;
  /** Clear transcription state only (for retry) */
  clearTranscription: () => void;
  /** Reset elapsed seconds to zero */
  resetElapsedSeconds: () => void;
}

export type RecordingStore = RecordingStoreState & RecordingStoreActions;

/**
 * Initial state for the recording store
 */
const initialState: RecordingStoreState = {
  recordingState: 'idle',
  elapsedSeconds: 0,
  warningTriggered: false,
  audioResult: null,
  filePath: null,
  transcription: null,
  transcriptionState: 'idle',
  transcriptionError: null,
  summary: null,
  summaryState: 'idle',
  summaryError: null,
  summarySourceText: null,
};

/**
 * Zustand store for managing recording state, duration tracking,
 * transcription state, summary state, and max duration enforcement.
 */
export const useRecordingStore = create<RecordingStore>((set) => ({
  // Initial state
  ...initialState,

  // Actions
  setRecordingState: (recordingState: RecordingState) => {
    set({ recordingState });
  },

  incrementElapsedSeconds: () => {
    set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 }));
  },

  setWarningTriggered: (warningTriggered: boolean) => {
    set({ warningTriggered });
  },

  setAudioResult: (audioResult: AudioRecordingResult | null) => {
    set({ audioResult });
  },

  setFilePath: (filePath: string | null) => {
    set({ filePath });
  },

  setTranscription: (transcription: string | null) => {
    set({ transcription });
  },

  setTranscriptionState: (transcriptionState: TranscriptionState) => {
    set({ transcriptionState });
  },

  setTranscriptionError: (transcriptionError: TranscriptionError | null) => {
    set({ transcriptionError });
  },

  setSummary: (summary: string | null, sourceText?: string | null) => {
    set({ summary, summarySourceText: sourceText ?? null });
  },

  setSummaryState: (summaryState: SummaryState) => {
    set({ summaryState });
  },

  setSummaryError: (summaryError: string | null) => {
    set({ summaryError });
  },

  clearSummary: () => {
    set({
      summary: null,
      summaryState: 'idle',
      summaryError: null,
      summarySourceText: null,
    });
  },

  resetRecording: () => {
    set(initialState);
  },

  resetForNewRecording: () => {
    set({
      recordingState: 'idle',
      elapsedSeconds: 0,
      warningTriggered: false,
      audioResult: null,
      filePath: null,
      // Keep transcription state so the green box stays visible
      // Clear summary state when starting new recording
      summary: null,
      summaryState: 'idle',
      summaryError: null,
      summarySourceText: null,
    });
  },

  clearTranscription: () => {
    set({
      transcription: null,
      transcriptionState: 'idle',
      transcriptionError: null,
      // Also clear summary when clearing transcription
      summary: null,
      summaryState: 'idle',
      summaryError: null,
      summarySourceText: null,
    });
  },

  resetElapsedSeconds: () => {
    set({ elapsedSeconds: 0, warningTriggered: false });
  },
}));
