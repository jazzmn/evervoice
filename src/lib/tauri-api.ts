import type { Settings, TranscriptionResponse, TranscriptionError, Recording, RawRecording } from '@/types';

/**
 * Check if running in Tauri environment
 * In Tauri 2.x, the global is '__TAURI_INTERNALS__'
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

/**
 * Invoke a Tauri command with proper error handling
 */
async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error('Not running in Tauri environment');
  }

  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

/**
 * Get settings from the Tauri backend
 */
export async function getSettings(): Promise<Settings> {
  return invokeCommand<Settings>('get_settings');
}

/**
 * Save settings via the Tauri backend
 */
export async function saveSettings(settings: Settings): Promise<void> {
  return invokeCommand<void>('save_settings', { settings });
}

// ============================================================================
// Window Management API
// ============================================================================

/**
 * Bring the main window to the foreground and focus it.
 * Useful when triggered by global hotkey.
 */
export async function focusWindow(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const window = getCurrentWebviewWindow();

    // Show the window if minimized, then focus it
    await window.show();
    await window.unminimize();
    await window.setFocus();
  } catch (error) {
    console.error('Failed to focus window:', error);
  }
}

// ============================================================================
// Global Hotkey API
// ============================================================================

/**
 * Result from hotkey update operation
 */
export interface HotkeyUpdateResult {
  success: boolean;
  message?: string;
  errorType?: string;
}

/**
 * Raw result from Rust backend (snake_case)
 */
interface RawHotkeyUpdateResult {
  success: boolean;
  message: string | null;
  error_type: string | null;
}

/**
 * Update the global hotkey registration
 * Unregisters the old hotkey and registers the new one
 *
 * @param oldHotkey - The current hotkey to unregister (optional)
 * @param newHotkey - The new hotkey to register
 * @returns Result indicating success or failure with error details
 */
export async function updateGlobalHotkey(
  oldHotkey: string | null,
  newHotkey: string
): Promise<HotkeyUpdateResult> {
  if (!isTauri()) {
    return {
      success: false,
      message: 'Global hotkey updates are only available in the desktop app.',
      errorType: 'not_tauri',
    };
  }

  const raw = await invokeCommand<RawHotkeyUpdateResult>('update_global_hotkey_cmd', {
    oldHotkey,
    newHotkey,
  });

  return {
    success: raw.success,
    message: raw.message ?? undefined,
    errorType: raw.error_type ?? undefined,
  };
}

/**
 * Listen for global hotkey events from the backend
 *
 * @param callback - Function to call when the global hotkey is triggered
 * @returns Cleanup function to unsubscribe from the event
 */
export async function listenForGlobalHotkey(
  callback: (payload: { timestamp: number; hotkey: string }) => void
): Promise<() => void> {
  if (!isTauri()) {
    // Return a no-op cleanup function in non-Tauri environments
    return () => {};
  }

  const { listen } = await import('@tauri-apps/api/event');
  const unlisten = await listen<{ timestamp: number; hotkey: string }>(
    'global-hotkey-triggered',
    (event) => {
      callback(event.payload);
    }
  );

  return unlisten;
}

// ============================================================================
// File Storage API
// ============================================================================

/**
 * Get the platform-specific recordings directory path
 *
 * - Windows: `%APPDATA%/EverVoice/recordings/`
 * - macOS: `~/Library/Application Support/EverVoice/recordings/`
 * - Linux: `~/.config/EverVoice/recordings/`
 */
export async function getRecordingsDirectory(): Promise<string> {
  return invokeCommand<string>('get_recordings_directory');
}

/**
 * Ensure the recordings directory exists, creating it if necessary
 * Returns the directory path on success
 */
export async function ensureDirectoryExists(): Promise<string> {
  return invokeCommand<string>('ensure_directory_exists');
}

/**
 * Save a recording blob to disk and return the full file path
 *
 * The file is saved with a unique name containing an ISO timestamp and UUID:
 * `recording-{YYYY-MM-DDTHH-mm-ss}-{uuid}.webm`
 *
 * @param blob - The audio Blob from MediaRecorder
 * @returns The full file path where the recording was saved
 */
export async function saveRecording(blob: Blob): Promise<string> {
  // Convert Blob to ArrayBuffer, then to Uint8Array for Tauri
  const arrayBuffer = await blob.arrayBuffer();
  const data = Array.from(new Uint8Array(arrayBuffer));

  return invokeCommand<string>('save_recording', { data });
}

/**
 * Delete a recording file by its full path
 *
 * Used for cleaning up partial or incomplete recordings on error
 *
 * @param filePath - The full path to the recording file to delete
 */
export async function deleteRecording(filePath: string): Promise<void> {
  return invokeCommand<void>('delete_recording', { filePath });
}

/**
 * File storage error types for user-friendly error handling
 */
export type FileStorageErrorType =
  | 'directory_creation_failed'
  | 'file_write_failed'
  | 'file_delete_failed'
  | 'not_tauri'
  | 'unknown';

/**
 * Structured error object for file storage operations
 */
export interface FileStorageError {
  type: FileStorageErrorType;
  message: string;
}

/**
 * Parse file storage errors into user-friendly messages
 */
export function parseFileStorageError(error: unknown): FileStorageError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('not running in tauri')) {
      return {
        type: 'not_tauri',
        message: 'File storage is only available in the desktop app.',
      };
    }

    if (message.includes('create') && message.includes('directory')) {
      return {
        type: 'directory_creation_failed',
        message: 'Failed to create recordings directory. Please check disk permissions.',
      };
    }

    if (message.includes('write') || message.includes('save')) {
      return {
        type: 'file_write_failed',
        message: 'Failed to save recording. Please check available disk space.',
      };
    }

    if (message.includes('delete') || message.includes('remove')) {
      return {
        type: 'file_delete_failed',
        message: 'Failed to delete recording file.',
      };
    }

    return {
      type: 'unknown',
      message: error.message,
    };
  }

  return {
    type: 'unknown',
    message: 'An unknown error occurred during file operation.',
  };
}

// ============================================================================
// Transcription API
// ============================================================================

/**
 * Raw transcription response from Rust backend (uses snake_case)
 */
interface RawTranscriptionResponse {
  success: boolean;
  text: string | null;
  error_type: string | null;
  error_message: string | null;
  retryable: boolean | null;
}

/**
 * Transcribe an audio file using OpenAI Whisper API
 *
 * This function calls the Rust backend to:
 * 1. Read the audio file from disk
 * 2. Retrieve the API key from settings
 * 3. Call OpenAI Whisper API with exponential backoff retry
 * 4. Return the transcription text or a structured error
 *
 * @param filePath - Full path to the audio file to transcribe
 * @returns A TranscriptionResponse containing either the transcribed text or error details
 */
export async function transcribeAudio(filePath: string): Promise<TranscriptionResponse> {
  if (!isTauri()) {
    return {
      success: false,
      text: null,
      errorType: 'unknown',
      errorMessage: 'Transcription is only available in the desktop app.',
      retryable: false,
    };
  }

  const raw = await invokeCommand<RawTranscriptionResponse>('transcribe_audio', { filePath });

  // Convert snake_case from Rust to camelCase for TypeScript
  return {
    success: raw.success,
    text: raw.text,
    errorType: raw.error_type as TranscriptionResponse['errorType'],
    errorMessage: raw.error_message,
    retryable: raw.retryable,
  };
}

/**
 * Parse a TranscriptionResponse into a TranscriptionError object
 *
 * @param response - The transcription response from the backend
 * @returns A structured TranscriptionError object
 */
export function parseTranscriptionError(response: TranscriptionResponse): TranscriptionError {
  return {
    type: response.errorType ?? 'unknown',
    message: response.errorMessage ?? 'An unknown error occurred during transcription.',
    retryable: response.retryable ?? false,
  };
}

/**
 * Get user-friendly error message based on transcription error type
 */
export function getTranscriptionErrorMessage(errorType: string | null): string {
  switch (errorType) {
    case 'api_key_not_configured':
      return 'API key not configured. Please add your OpenAI API key in Settings.';
    case 'invalid_api_key':
      return 'Invalid API key. Please check your OpenAI API key in Settings.';
    case 'file_not_found':
      return 'Recording file not found. Please try recording again.';
    case 'file_read_error':
      return 'Failed to read recording file. Please try recording again.';
    case 'invalid_audio_format':
      return 'Invalid audio format. Please try recording again.';
    case 'network_error':
      return 'Transcription failed - please try again. Check your internet connection.';
    case 'rate_limit_exceeded':
      return 'Rate limit exceeded - please wait a moment and try again.';
    case 'api_error':
      return 'Transcription service error. Please try again later.';
    default:
      return 'An unexpected error occurred during transcription.';
  }
}

// ============================================================================
// History API
// ============================================================================

/**
 * Convert raw recording from Rust backend to TypeScript Recording type
 */
function convertRawRecording(raw: RawRecording): Recording {
  return {
    id: raw.id,
    filePath: raw.filePath,
    durationSeconds: raw.durationSeconds,
    transcription: raw.transcription,
    createdAt: raw.createdAt,
    summary: raw.summary,
  };
}

/**
 * Get all recording history from the store
 * Returns recordings ordered by createdAt DESC (newest first)
 */
export async function getHistory(): Promise<Recording[]> {
  if (!isTauri()) {
    return [];
  }

  const rawRecordings = await invokeCommand<RawRecording[]>('get_history');
  return rawRecordings.map(convertRawRecording);
}

/**
 * Save a new recording to history
 *
 * @param filePath - Full path to the audio file
 * @param durationSeconds - Recording duration in seconds
 * @param transcription - Transcribed text
 * @returns The ID of the newly created recording
 */
export async function saveRecordingHistory(
  filePath: string,
  durationSeconds: number,
  transcription: string
): Promise<string> {
  return invokeCommand<string>('save_recording_history', {
    filePath,
    durationSeconds,
    transcription,
  });
}

/**
 * Delete a recording from history by ID
 *
 * @param id - The UUID of the recording to delete
 */
export async function deleteRecordingHistory(id: string): Promise<void> {
  return invokeCommand<void>('delete_recording_history', { id });
}

/**
 * Update the summary field of a history item
 *
 * @param id - The UUID of the history item to update
 * @param summary - The AI-generated summary text to save
 */
export async function updateHistorySummary(id: string, summary: string): Promise<void> {
  if (!isTauri()) {
    return;
  }

  return invokeCommand<void>('update_history_summary', { id, summary });
}

// ============================================================================
// Summarization API
// ============================================================================

/**
 * Raw summarization response from Rust backend
 */
interface RawSummarizationResponse {
  success: boolean;
  summary: string | null;
  error_type: string | null;
  error_message: string | null;
}

/**
 * Summarize transcription text using OpenAI GPT API
 *
 * @param text - The transcription text to summarize
 * @returns Markdown-formatted summary
 * @throws Error if summarization fails
 */
export async function summarizeText(text: string): Promise<string> {
  if (!isTauri()) {
    throw new Error('Summarization is only available in the desktop app.');
  }

  const response = await invokeCommand<RawSummarizationResponse>('summarize_transcription', { text });

  if (response.success && response.summary) {
    return response.summary;
  }

  // Throw error with user-friendly message
  throw new Error(response.error_message || 'Summarization failed');
}

// ============================================================================
// External Service API
// ============================================================================

/**
 * Response from external service call
 */
export interface ExternalServiceResponse {
  success: boolean;
  message?: string;
}

/**
 * Call an external service with transcription text
 *
 * @param url - The API endpoint URL to POST to
 * @param text - The transcription text to send
 * @returns Response indicating success or failure with optional message
 */
export async function callExternalService(url: string, text: string): Promise<ExternalServiceResponse> {
  if (!isTauri()) {
    return {
      success: false,
      message: 'External service calls are only available in the desktop app.',
    };
  }

  return invokeCommand<ExternalServiceResponse>('call_external_service', { url, text });
}
