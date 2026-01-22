use crate::file_storage;
use crate::history::{sort_history_descending, truncate_history, HistoryItem};
use crate::settings::Settings;
use crate::summarization::{summarize_text, SummarizationError, SummarizationResult};
use crate::transcription::{transcribe_audio_file, TranscriptionError, TranscriptionResult};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

/// The settings store file name
const SETTINGS_STORE_FILE: &str = "settings.json";
/// The key used to store settings in the store
const SETTINGS_KEY: &str = "settings";
/// The key used to store history in the store
const HISTORY_KEY: &str = "history";

/// Retrieves settings from the store, returning defaults if not found.
/// Automatically migrates old settings formats by re-saving with all fields.
#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<Settings, String> {
    let store = app
        .store(SETTINGS_STORE_FILE)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    match store.get(SETTINGS_KEY) {
        Some(value) => {
            // Try to parse settings - serde(default) will fill in missing fields
            let settings: Settings = serde_json::from_value(value.clone())
                .map_err(|e| format!("Failed to parse settings: {}", e))?;

            // Re-save to ensure all fields are persisted (migration for old formats)
            let updated_value = serde_json::to_value(&settings)
                .map_err(|e| format!("Failed to serialize settings: {}", e))?;
            store.set(SETTINGS_KEY, updated_value);
            let _ = store.save(); // Ignore save errors during migration

            Ok(settings)
        }
        None => Ok(Settings::default()),
    }
}

/// Saves settings to the store after validation
#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    // Validate settings before saving
    settings.validate()?;

    let store = app
        .store(SETTINGS_STORE_FILE)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    let value = serde_json::to_value(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    store.set(SETTINGS_KEY, value);

    store
        .save()
        .map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

// ============================================================================
// History Commands
// ============================================================================

/// Retrieves all history items from the store, ordered by createdAt DESC (newest first)
#[tauri::command]
pub fn get_history(app: AppHandle) -> Result<Vec<HistoryItem>, String> {
    let store = app
        .store(SETTINGS_STORE_FILE)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    match store.get(HISTORY_KEY) {
        Some(value) => {
            let mut items: Vec<HistoryItem> = serde_json::from_value(value.clone())
                .map_err(|e| format!("Failed to parse history: {}", e))?;

            // Sort by createdAt descending (newest first)
            sort_history_descending(&mut items);

            Ok(items)
        }
        None => Ok(Vec::new()),
    }
}

/// Saves a new recording to history
///
/// Creates a new history item with a generated UUID and timestamp,
/// adds it to the history, and limits the total to MAX_HISTORY_ITEMS.
///
/// # Arguments
/// * `file_path` - Full path to the recording file
/// * `duration_seconds` - Duration of the recording in seconds
/// * `transcription` - The transcribed text
///
/// # Returns
/// The ID of the newly created history item
#[tauri::command]
pub fn save_recording_history(
    app: AppHandle,
    file_path: String,
    duration_seconds: f64,
    transcription: String,
) -> Result<String, String> {
    let store = app
        .store(SETTINGS_STORE_FILE)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    // Get existing history or create empty array
    let mut history: Vec<HistoryItem> = match store.get(HISTORY_KEY) {
        Some(value) => serde_json::from_value(value.clone())
            .map_err(|e| format!("Failed to parse history: {}", e))?,
        None => Vec::new(),
    };

    // Create new history item
    let new_item = HistoryItem::new(file_path, duration_seconds, transcription);
    let new_id = new_item.id.clone();

    // Add new item at the beginning (newest first)
    history.insert(0, new_item);

    // Limit to MAX_HISTORY_ITEMS
    truncate_history(&mut history);

    // Save back to store
    let value = serde_json::to_value(&history)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;

    store.set(HISTORY_KEY, value);

    store
        .save()
        .map_err(|e| format!("Failed to save history: {}", e))?;

    Ok(new_id)
}

/// Deletes a recording from history by its ID and removes the associated audio file
///
/// # Arguments
/// * `id` - The UUID of the history item to delete
#[tauri::command]
pub fn delete_recording_history(app: AppHandle, id: String) -> Result<(), String> {
    let store = app
        .store(SETTINGS_STORE_FILE)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    // Get existing history
    let mut history: Vec<HistoryItem> = match store.get(HISTORY_KEY) {
        Some(value) => serde_json::from_value(value.clone())
            .map_err(|e| format!("Failed to parse history: {}", e))?,
        None => return Ok(()), // Nothing to delete
    };

    // Find the item to get its file path before removing
    if let Some(item) = history.iter().find(|item| item.id == id) {
        let file_path = std::path::Path::new(&item.file_path);
        if file_path.exists() {
            if let Err(e) = std::fs::remove_file(file_path) {
                // Log error but continue with history removal
                eprintln!("Warning: Failed to delete audio file {}: {}", item.file_path, e);
            }
        }
    }

    // Remove item with matching ID
    history.retain(|item| item.id != id);

    // Save back to store
    let value = serde_json::to_value(&history)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;

    store.set(HISTORY_KEY, value);

    store
        .save()
        .map_err(|e| format!("Failed to save history: {}", e))?;

    Ok(())
}

/// Updates the summary field of a history item
///
/// # Arguments
/// * `id` - The UUID of the history item to update
/// * `summary` - The AI-generated summary text to save
#[tauri::command]
pub fn update_history_summary(app: AppHandle, id: String, summary: String) -> Result<(), String> {
    let store = app
        .store(SETTINGS_STORE_FILE)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    // Get existing history
    let mut history: Vec<HistoryItem> = match store.get(HISTORY_KEY) {
        Some(value) => serde_json::from_value(value.clone())
            .map_err(|e| format!("Failed to parse history: {}", e))?,
        None => return Err("History not found".to_string()),
    };

    // Find and update the item with matching ID
    let item = history
        .iter_mut()
        .find(|item| item.id == id)
        .ok_or_else(|| format!("History item not found: {}", id))?;

    item.summary = Some(summary);

    // Save back to store
    let value = serde_json::to_value(&history)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;

    store.set(HISTORY_KEY, value);

    store
        .save()
        .map_err(|e| format!("Failed to save history: {}", e))?;

    Ok(())
}

// ============================================================================
// File Storage Commands
// ============================================================================

/// Returns the platform-specific recordings directory path
///
/// - Windows: `%APPDATA%/EverVoice/recordings/`
/// - macOS: `~/Library/Application Support/EverVoice/recordings/`
/// - Linux: `~/.config/EverVoice/recordings/`
#[tauri::command]
pub fn get_recordings_directory() -> Result<String, String> {
    let dir = file_storage::get_recordings_dir()?;
    dir.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid path encoding".to_string())
}

/// Ensures the recordings directory exists, creating it if necessary
/// Returns the directory path on success
#[tauri::command]
pub fn ensure_directory_exists() -> Result<String, String> {
    let dir = file_storage::ensure_recordings_dir_exists()?;
    dir.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid path encoding".to_string())
}

/// Saves a recording from binary data and returns the full file path
///
/// The file is saved with a unique name containing an ISO timestamp and UUID:
/// `recording-{YYYY-MM-DDTHH-mm-ss}-{uuid}.webm`
#[tauri::command]
pub fn save_recording(data: Vec<u8>) -> Result<String, String> {
    file_storage::save_recording_to_file(&data)
}

/// Deletes a recording file by its full path
///
/// Used for cleaning up partial or incomplete recordings on error
#[tauri::command]
pub fn delete_recording(file_path: String) -> Result<(), String> {
    file_storage::delete_recording_file(&file_path)
}

// ============================================================================
// Transcription Commands
// ============================================================================

/// Transcription response returned to the frontend
#[derive(serde::Serialize)]
pub struct TranscriptionResponse {
    /// Whether the transcription was successful
    pub success: bool,
    /// The transcribed text (if successful)
    pub text: Option<String>,
    /// Error type (if failed)
    pub error_type: Option<String>,
    /// User-friendly error message (if failed)
    pub error_message: Option<String>,
    /// Whether the error is retryable
    pub retryable: Option<bool>,
}

impl From<Result<TranscriptionResult, TranscriptionError>> for TranscriptionResponse {
    fn from(result: Result<TranscriptionResult, TranscriptionError>) -> Self {
        match result {
            Ok(transcription) => TranscriptionResponse {
                success: true,
                text: Some(transcription.text),
                error_type: None,
                error_message: None,
                retryable: None,
            },
            Err(error) => {
                let error_type = match &error {
                    TranscriptionError::ApiKeyNotConfigured => "api_key_not_configured",
                    TranscriptionError::InvalidApiKey => "invalid_api_key",
                    TranscriptionError::FileNotFound(_) => "file_not_found",
                    TranscriptionError::FileReadError(_) => "file_read_error",
                    TranscriptionError::InvalidAudioFormat(_) => "invalid_audio_format",
                    TranscriptionError::NetworkError(_) => "network_error",
                    TranscriptionError::RateLimitExceeded => "rate_limit_exceeded",
                    TranscriptionError::ApiError(_) => "api_error",
                    TranscriptionError::Unknown(_) => "unknown",
                };

                TranscriptionResponse {
                    success: false,
                    text: None,
                    error_type: Some(error_type.to_string()),
                    error_message: Some(error.user_message()),
                    retryable: Some(error.is_transient()),
                }
            }
        }
    }
}

/// Transcribes an audio file using OpenAI Whisper API
///
/// This command:
/// 1. Reads the audio file from the specified path
/// 2. Retrieves the API key from settings
/// 3. Calls OpenAI Whisper API with exponential backoff retry
/// 4. Returns the transcription text or a structured error
///
/// # Arguments
/// * `app` - Tauri app handle for accessing settings
/// * `file_path` - Full path to the audio file to transcribe
///
/// # Returns
/// A `TranscriptionResponse` containing either the transcribed text or error details
#[tauri::command]
pub async fn transcribe_audio(app: AppHandle, file_path: String) -> TranscriptionResponse {
    // Get settings for API key and language
    let settings = match get_settings_internal(&app) {
        Ok(s) => s,
        Err(e) => {
            return TranscriptionResponse::from(Err(TranscriptionError::Unknown(e)));
        }
    };

    // Check if API key is set
    let api_key = match settings.api_key {
        Some(key) if !key.trim().is_empty() => key,
        _ => {
            return TranscriptionResponse::from(Err(TranscriptionError::ApiKeyNotConfigured));
        }
    };

    // Call transcription function with language
    let result = transcribe_audio_file(&file_path, &api_key, &settings.language).await;

    TranscriptionResponse::from(result)
}

// ============================================================================
// Summarization Commands
// ============================================================================

/// Summarization response returned to the frontend
#[derive(serde::Serialize)]
pub struct SummarizationResponse {
    /// Whether the summarization was successful
    pub success: bool,
    /// The markdown summary (if successful)
    pub summary: Option<String>,
    /// Error type (if failed)
    pub error_type: Option<String>,
    /// User-friendly error message (if failed)
    pub error_message: Option<String>,
}

impl From<Result<SummarizationResult, SummarizationError>> for SummarizationResponse {
    fn from(result: Result<SummarizationResult, SummarizationError>) -> Self {
        match result {
            Ok(summarization) => SummarizationResponse {
                success: true,
                summary: Some(summarization.summary),
                error_type: None,
                error_message: None,
            },
            Err(error) => {
                let error_type = match &error {
                    SummarizationError::ApiKeyNotConfigured => "api_key_not_configured",
                    SummarizationError::InvalidApiKey => "invalid_api_key",
                    SummarizationError::NetworkError(_) => "network_error",
                    SummarizationError::RateLimitExceeded => "rate_limit_exceeded",
                    SummarizationError::ApiError(_) => "api_error",
                    SummarizationError::EmptyText => "empty_text",
                };

                SummarizationResponse {
                    success: false,
                    summary: None,
                    error_type: Some(error_type.to_string()),
                    error_message: Some(error.user_message()),
                }
            }
        }
    }
}

/// Summarizes transcription text using OpenAI Chat Completions API
///
/// This command:
/// 1. Retrieves the API key from settings
/// 2. Calls OpenAI Chat Completions API (gpt-4o-mini) with a system prompt
/// 3. Returns the markdown-formatted summary or a structured error
///
/// # Arguments
/// * `app` - Tauri app handle for accessing settings
/// * `text` - The transcription text to summarize
///
/// # Returns
/// A `SummarizationResponse` containing either the markdown summary or error details
#[tauri::command]
pub async fn summarize_transcription(app: AppHandle, text: String) -> SummarizationResponse {
    // Get settings for API key and language
    let settings = match get_settings_internal(&app) {
        Ok(s) => s,
        Err(e) => {
            return SummarizationResponse::from(Err(SummarizationError::ApiError(e)));
        }
    };

    // Check if API key is set
    let api_key = match settings.api_key {
        Some(key) if !key.trim().is_empty() => key,
        _ => {
            return SummarizationResponse::from(Err(SummarizationError::ApiKeyNotConfigured));
        }
    };

    // Call summarization function with language
    let result = summarize_text(&text, &api_key, &settings.language).await;

    SummarizationResponse::from(result)
}

/// Helper function to retrieve settings from store
fn get_settings_internal(app: &AppHandle) -> Result<Settings, String> {
    let store = app
        .store(SETTINGS_STORE_FILE)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    match store.get(SETTINGS_KEY) {
        Some(value) => {
            // serde(default) will fill in missing fields
            serde_json::from_value(value.clone())
                .map_err(|e| format!("Failed to parse settings: {}", e))
        }
        None => Ok(Settings::default()),
    }
}

/// Helper function to retrieve the API key from settings
fn get_api_key(app: &AppHandle) -> Result<Option<String>, String> {
    let settings = get_settings_internal(app)?;

    // Check if API key is set and not empty
    match settings.api_key {
        Some(key) if !key.trim().is_empty() => Ok(Some(key)),
        _ => Ok(None),
    }
}
