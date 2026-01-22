/**
 * Recording state enum representing the lifecycle of an audio recording
 */
export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

/**
 * Permission state for microphone access
 */
export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unknown';

/**
 * Audio recorder error types for user-friendly error handling
 */
export type AudioRecorderErrorType =
  | 'permission_denied'
  | 'not_supported'
  | 'device_not_found'
  | 'recorder_error'
  | 'file_save_failed'
  | 'unknown';

/**
 * Structured error object for audio recording
 */
export interface AudioRecorderError {
  type: AudioRecorderErrorType;
  message: string;
}

/**
 * Audio recording result containing the audio blob
 */
export interface AudioRecordingResult {
  blob: Blob;
  mimeType: string;
  duration: number;
}

/**
 * Saved recording with file path information
 */
export interface SavedRecording extends AudioRecordingResult {
  /** Full path to the saved recording file */
  filePath: string;
  /** ISO timestamp when the recording was saved */
  savedAt: string;
}

// ============================================================================
// History Types
// ============================================================================

/**
 * Recording history item stored via tauri-plugin-store
 */
export interface Recording {
  /** Unique identifier (UUID) */
  id: string;
  /** Full path to the audio file */
  filePath: string;
  /** Recording duration in seconds */
  durationSeconds: number;
  /** Transcribed text */
  transcription: string;
  /** ISO timestamp when the recording was created */
  createdAt: string;
  /** AI-generated summary (optional) */
  summary?: string;
}

/**
 * Raw history item from Rust backend (uses camelCase due to serde rename_all)
 */
export interface RawRecording {
  id: string;
  filePath: string;
  durationSeconds: number;
  transcription: string;
  createdAt: string;
  /** AI-generated summary (optional) */
  summary?: string;
}

// ============================================================================
// Transcription Types
// ============================================================================

/**
 * Transcription error types matching the Rust backend
 */
export type TranscriptionErrorType =
  | 'api_key_not_configured'
  | 'invalid_api_key'
  | 'file_not_found'
  | 'file_read_error'
  | 'invalid_audio_format'
  | 'network_error'
  | 'rate_limit_exceeded'
  | 'api_error'
  | 'unknown';

/**
 * Transcription response from the Rust backend
 */
export interface TranscriptionResponse {
  /** Whether the transcription was successful */
  success: boolean;
  /** The transcribed text (if successful) */
  text: string | null;
  /** Error type (if failed) */
  errorType: TranscriptionErrorType | null;
  /** User-friendly error message (if failed) */
  errorMessage: string | null;
  /** Whether the error is retryable */
  retryable: boolean | null;
}

/**
 * Transcription state for tracking the transcription process
 */
export type TranscriptionState = 'idle' | 'transcribing' | 'success' | 'error';

/**
 * Structured transcription error for the frontend
 */
export interface TranscriptionError {
  type: TranscriptionErrorType;
  message: string;
  retryable: boolean;
}

// ============================================================================
// Summary Types
// ============================================================================

/**
 * Summary state for tracking the AI summarization process
 */
export type SummaryState = 'idle' | 'loading' | 'success' | 'error';
