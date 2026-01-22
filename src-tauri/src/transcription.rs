use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::Duration;
use thiserror::Error;
use tokio::time::sleep;

/// OpenAI Whisper API endpoint
const WHISPER_API_URL: &str = "https://api.openai.com/v1/audio/transcriptions";

/// Maximum retry attempts for transient failures
const MAX_RETRY_ATTEMPTS: u32 = 3;

/// Base delay in milliseconds for exponential backoff
const BASE_DELAY_MS: u64 = 1000;

/// Transcription error types for specific error handling
#[derive(Error, Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "message")]
pub enum TranscriptionError {
    #[error("API key not configured")]
    ApiKeyNotConfigured,

    #[error("Invalid API key")]
    InvalidApiKey,

    #[error("Audio file not found: {0}")]
    FileNotFound(String),

    #[error("Failed to read audio file: {0}")]
    FileReadError(String),

    #[error("Invalid audio format: {0}")]
    InvalidAudioFormat(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("API error: {0}")]
    ApiError(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl TranscriptionError {
    /// Check if this error is transient and can be retried
    pub fn is_transient(&self) -> bool {
        matches!(
            self,
            TranscriptionError::NetworkError(_) | TranscriptionError::RateLimitExceeded
        )
    }

    /// Convert to a user-friendly error message
    pub fn user_message(&self) -> String {
        match self {
            TranscriptionError::ApiKeyNotConfigured => {
                "API key not configured. Please add your OpenAI API key in Settings.".to_string()
            }
            TranscriptionError::InvalidApiKey => {
                "Invalid API key. Please check your OpenAI API key in Settings.".to_string()
            }
            TranscriptionError::FileNotFound(path) => {
                format!("Recording file not found: {}", path)
            }
            TranscriptionError::FileReadError(_) => {
                "Failed to read recording file. Please try recording again.".to_string()
            }
            TranscriptionError::InvalidAudioFormat(_) => {
                "Invalid audio format. Please try recording again.".to_string()
            }
            TranscriptionError::NetworkError(_) => {
                "Transcription failed - please try again. Check your internet connection."
                    .to_string()
            }
            TranscriptionError::RateLimitExceeded => {
                "Rate limit exceeded - please wait a moment and try again.".to_string()
            }
            TranscriptionError::ApiError(msg) => {
                format!("Transcription failed: {}", msg)
            }
            TranscriptionError::Unknown(msg) => {
                format!("An unexpected error occurred: {}", msg)
            }
        }
    }
}

/// Successful transcription result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    /// The transcribed text
    pub text: String,
}

/// OpenAI Whisper API response structure
#[derive(Debug, Deserialize)]
struct WhisperResponse {
    text: String,
}

/// OpenAI API error response structure
#[derive(Debug, Deserialize)]
struct OpenAIErrorResponse {
    error: OpenAIError,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct OpenAIError {
    message: String,
    #[serde(rename = "type")]
    error_type: Option<String>,
    code: Option<String>,
}

/// Transcribe an audio file using OpenAI Whisper API
///
/// This function reads the audio file from disk, sends it to the Whisper API,
/// and returns the transcription text. It implements exponential backoff retry
/// for transient failures.
///
/// # Arguments
/// * `file_path` - Path to the audio file
/// * `api_key` - OpenAI API key
/// * `language` - ISO 639-1 language code (e.g., "de", "en")
pub async fn transcribe_audio_file(
    file_path: &str,
    api_key: &str,
    language: &str,
) -> Result<TranscriptionResult, TranscriptionError> {
    // Read the audio file
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(TranscriptionError::FileNotFound(file_path.to_string()));
    }

    let file_data = fs::read(path).map_err(|e| TranscriptionError::FileReadError(e.to_string()))?;

    // Extract filename for the multipart request
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("recording.webm")
        .to_string();

    // Attempt transcription with retry logic
    let mut last_error = TranscriptionError::Unknown("No attempts made".to_string());

    for attempt in 0..MAX_RETRY_ATTEMPTS {
        match call_whisper_api(&file_data, &file_name, api_key, language).await {
            Ok(result) => return Ok(result),
            Err(e) => {
                last_error = e.clone();

                // Only retry on transient failures
                if !e.is_transient() {
                    return Err(e);
                }

                // Don't sleep after the last attempt
                if attempt < MAX_RETRY_ATTEMPTS - 1 {
                    let delay = Duration::from_millis(BASE_DELAY_MS * 2u64.pow(attempt));
                    log::info!(
                        "Transcription attempt {} failed, retrying in {:?}: {}",
                        attempt + 1,
                        delay,
                        e
                    );
                    sleep(delay).await;
                }
            }
        }
    }

    Err(last_error)
}

/// Make a single call to the Whisper API
async fn call_whisper_api(
    file_data: &[u8],
    file_name: &str,
    api_key: &str,
    language: &str,
) -> Result<TranscriptionResult, TranscriptionError> {
    let client = reqwest::Client::new();

    // Build multipart form
    let file_part = Part::bytes(file_data.to_vec())
        .file_name(file_name.to_string())
        .mime_str("audio/webm")
        .map_err(|e| TranscriptionError::Unknown(e.to_string()))?;

    let form = Form::new()
        .part("file", file_part)
        .text("model", "whisper-1")
        .text("language", language.to_string());

    // Make the API request
    let response = client
        .post(WHISPER_API_URL)
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| {
            if e.is_connect() || e.is_timeout() {
                TranscriptionError::NetworkError(e.to_string())
            } else {
                TranscriptionError::Unknown(e.to_string())
            }
        })?;

    let status = response.status();

    // Handle different HTTP status codes
    match status.as_u16() {
        200 => {
            // Success - parse the response
            let whisper_response: WhisperResponse = response.json().await.map_err(|e| {
                TranscriptionError::ApiError(format!("Failed to parse response: {}", e))
            })?;

            Ok(TranscriptionResult {
                text: whisper_response.text,
            })
        }
        401 => Err(TranscriptionError::InvalidApiKey),
        429 => Err(TranscriptionError::RateLimitExceeded),
        400 => {
            // Bad request - likely invalid audio
            let error_response: Result<OpenAIErrorResponse, _> = response.json().await;
            match error_response {
                Ok(err) => {
                    let message = err.error.message;
                    if message.contains("audio") || message.contains("format") {
                        Err(TranscriptionError::InvalidAudioFormat(message))
                    } else {
                        Err(TranscriptionError::ApiError(message))
                    }
                }
                Err(_) => Err(TranscriptionError::InvalidAudioFormat(
                    "Invalid audio file".to_string(),
                )),
            }
        }
        _ => {
            // Other errors
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());

            // Check if it's a server error (5xx) - these are transient
            if status.is_server_error() {
                Err(TranscriptionError::NetworkError(error_text))
            } else {
                Err(TranscriptionError::ApiError(error_text))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transient_error_detection() {
        assert!(TranscriptionError::NetworkError("connection failed".to_string()).is_transient());
        assert!(TranscriptionError::RateLimitExceeded.is_transient());
        assert!(!TranscriptionError::InvalidApiKey.is_transient());
        assert!(!TranscriptionError::ApiKeyNotConfigured.is_transient());
        assert!(!TranscriptionError::FileNotFound("test.webm".to_string()).is_transient());
        assert!(!TranscriptionError::InvalidAudioFormat("bad format".to_string()).is_transient());
    }

    #[test]
    fn test_user_messages() {
        assert!(TranscriptionError::ApiKeyNotConfigured
            .user_message()
            .contains("API key"));
        assert!(TranscriptionError::RateLimitExceeded
            .user_message()
            .contains("Rate limit"));
        assert!(TranscriptionError::NetworkError("test".to_string())
            .user_message()
            .contains("try again"));
    }

    #[test]
    fn test_transcription_result_serialization() {
        let result = TranscriptionResult {
            text: "Hello, world!".to_string(),
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("Hello, world!"));

        let deserialized: TranscriptionResult = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.text, "Hello, world!");
    }

    #[test]
    fn test_transcription_error_serialization() {
        let error = TranscriptionError::NetworkError("Connection timeout".to_string());
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("NetworkError"));
        assert!(json.contains("Connection timeout"));
    }
}
