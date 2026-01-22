use serde::{Deserialize, Serialize};
use thiserror::Error;

/// OpenAI Chat Completions API endpoint
const CHAT_API_URL: &str = "https://api.openai.com/v1/chat/completions";

/// The model to use for summarization
const SUMMARIZATION_MODEL: &str = "gpt-4o-mini";

/// System prompt template for summarization (language placeholder: {language})
fn get_summarization_prompt(language: &str) -> String {
    let language_name = match language {
        "de" => "German",
        "en" => "English",
        "es" => "Spanish",
        "fr" => "French",
        "it" => "Italian",
        "pt" => "Portuguese",
        "nl" => "Dutch",
        "pl" => "Polish",
        "ru" => "Russian",
        "ja" => "Japanese",
        "zh" => "Chinese",
        "ko" => "Korean",
        _ => "the same language as the transcription",
    };
    format!(
        "Summarize the following transcription into concise Markdown-formatted bullet points. Respond in {}.",
        language_name
    )
}

/// Summarization error types for specific error handling
#[derive(Error, Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "message")]
pub enum SummarizationError {
    #[error("API key not configured")]
    ApiKeyNotConfigured,

    #[error("Invalid API key")]
    InvalidApiKey,

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("API error: {0}")]
    ApiError(String),

    #[error("Empty transcription text")]
    EmptyText,
}

impl SummarizationError {
    /// Convert to a user-friendly error message
    pub fn user_message(&self) -> String {
        match self {
            SummarizationError::ApiKeyNotConfigured => {
                "API key not configured. Please add your OpenAI API key in Settings.".to_string()
            }
            SummarizationError::InvalidApiKey => {
                "Invalid API key. Please check your OpenAI API key in Settings.".to_string()
            }
            SummarizationError::NetworkError(_) => {
                "Summarization failed - please try again. Check your internet connection."
                    .to_string()
            }
            SummarizationError::RateLimitExceeded => {
                "Rate limit exceeded - please wait a moment and try again.".to_string()
            }
            SummarizationError::ApiError(msg) => {
                format!("Summarization failed: {}", msg)
            }
            SummarizationError::EmptyText => {
                "Cannot summarize empty text.".to_string()
            }
        }
    }
}

/// Successful summarization result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummarizationResult {
    /// The markdown summary
    pub summary: String,
}

/// OpenAI Chat Completions API request structure
#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
}

/// Chat message structure for the API request
#[derive(Debug, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

/// OpenAI Chat Completions API response structure
#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ChatResponseMessage {
    content: String,
}

/// OpenAI API error response structure
#[derive(Debug, Deserialize)]
struct OpenAIErrorResponse {
    error: OpenAIError,
}

#[derive(Debug, Deserialize)]
struct OpenAIError {
    message: String,
}

/// HTTP client trait for dependency injection in tests
#[async_trait::async_trait]
pub trait HttpClient: Send + Sync {
    async fn post_json(
        &self,
        url: &str,
        api_key: &str,
        body: &str,
    ) -> Result<(u16, String), String>;
}

/// Default HTTP client implementation using reqwest
pub struct ReqwestHttpClient;

#[async_trait::async_trait]
impl HttpClient for ReqwestHttpClient {
    async fn post_json(
        &self,
        url: &str,
        api_key: &str,
        body: &str,
    ) -> Result<(u16, String), String> {
        let client = reqwest::Client::new();

        let response = client
            .post(url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .body(body.to_string())
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = response.status().as_u16();
        let text = response.text().await.map_err(|e| e.to_string())?;

        Ok((status, text))
    }
}

/// Summarize transcription text using OpenAI Chat Completions API
///
/// This function sends the transcription to the OpenAI API and returns
/// a markdown-formatted summary in the specified language.
pub async fn summarize_text(
    text: &str,
    api_key: &str,
    language: &str,
) -> Result<SummarizationResult, SummarizationError> {
    let client = ReqwestHttpClient;
    summarize_text_with_client(text, api_key, language, &client).await
}

/// Summarize transcription text with an injectable HTTP client (for testing)
pub async fn summarize_text_with_client<C: HttpClient>(
    text: &str,
    api_key: &str,
    language: &str,
    client: &C,
) -> Result<SummarizationResult, SummarizationError> {
    // Validate input
    if text.trim().is_empty() {
        return Err(SummarizationError::EmptyText);
    }

    // Build the request with language-specific prompt
    let system_prompt = get_summarization_prompt(language);
    let request = ChatCompletionRequest {
        model: SUMMARIZATION_MODEL.to_string(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt,
            },
            ChatMessage {
                role: "user".to_string(),
                content: text.to_string(),
            },
        ],
    };

    let body = serde_json::to_string(&request)
        .map_err(|e| SummarizationError::ApiError(format!("Failed to serialize request: {}", e)))?;

    // Make the API request
    let (status, response_text) = client
        .post_json(CHAT_API_URL, api_key, &body)
        .await
        .map_err(SummarizationError::NetworkError)?;

    // Handle different HTTP status codes
    match status {
        200 => {
            // Success - parse the response
            let response: ChatCompletionResponse = serde_json::from_str(&response_text)
                .map_err(|e| {
                    SummarizationError::ApiError(format!("Failed to parse response: {}", e))
                })?;

            let summary = response
                .choices
                .first()
                .map(|c| c.message.content.clone())
                .unwrap_or_default();

            Ok(SummarizationResult { summary })
        }
        401 => Err(SummarizationError::InvalidApiKey),
        429 => Err(SummarizationError::RateLimitExceeded),
        _ => {
            // Try to parse error response
            let error_msg = match serde_json::from_str::<OpenAIErrorResponse>(&response_text) {
                Ok(err) => err.error.message,
                Err(_) => response_text,
            };
            Err(SummarizationError::ApiError(error_msg))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Mock HTTP client for testing
    struct MockHttpClient {
        response: Result<(u16, String), String>,
    }

    #[async_trait::async_trait]
    impl HttpClient for MockHttpClient {
        async fn post_json(
            &self,
            _url: &str,
            _api_key: &str,
            _body: &str,
        ) -> Result<(u16, String), String> {
            self.response.clone()
        }
    }

    #[tokio::test]
    async fn test_summarize_calls_openai_api_with_correct_parameters() {
        // Create a mock client that captures the request and returns a valid response
        struct CapturingMockClient {
            captured_url: std::sync::Mutex<Option<String>>,
            captured_api_key: std::sync::Mutex<Option<String>>,
            captured_body: std::sync::Mutex<Option<String>>,
        }

        #[async_trait::async_trait]
        impl HttpClient for CapturingMockClient {
            async fn post_json(
                &self,
                url: &str,
                api_key: &str,
                body: &str,
            ) -> Result<(u16, String), String> {
                *self.captured_url.lock().unwrap() = Some(url.to_string());
                *self.captured_api_key.lock().unwrap() = Some(api_key.to_string());
                *self.captured_body.lock().unwrap() = Some(body.to_string());

                let response = r#"{"choices":[{"message":{"content":"- Bullet point"}}]}"#;
                Ok((200, response.to_string()))
            }
        }

        let client = CapturingMockClient {
            captured_url: std::sync::Mutex::new(None),
            captured_api_key: std::sync::Mutex::new(None),
            captured_body: std::sync::Mutex::new(None),
        };

        let transcription = "This is a test transcription.";
        let api_key = "test-api-key";

        let result = summarize_text_with_client(transcription, api_key, "en", &client).await;

        assert!(result.is_ok());

        // Verify the correct URL was called
        let captured_url = client.captured_url.lock().unwrap().clone().unwrap();
        assert_eq!(captured_url, "https://api.openai.com/v1/chat/completions");

        // Verify the API key was passed
        let captured_api_key = client.captured_api_key.lock().unwrap().clone().unwrap();
        assert_eq!(captured_api_key, "test-api-key");

        // Verify the request body contains correct model and messages
        let captured_body = client.captured_body.lock().unwrap().clone().unwrap();
        let request: serde_json::Value = serde_json::from_str(&captured_body).unwrap();
        assert_eq!(request["model"], "gpt-4o-mini");
        assert_eq!(request["messages"][0]["role"], "system");
        assert!(request["messages"][0]["content"]
            .as_str()
            .unwrap()
            .contains("Markdown-formatted bullet points"));
        assert_eq!(request["messages"][1]["role"], "user");
        assert_eq!(request["messages"][1]["content"], transcription);
    }

    #[tokio::test]
    async fn test_summarize_returns_markdown_summary() {
        let mock_response = r#"{"choices":[{"message":{"content":"- Point 1\n- Point 2\n- Point 3"}}]}"#;
        let client = MockHttpClient {
            response: Ok((200, mock_response.to_string())),
        };

        let result = summarize_text_with_client("Test transcription", "api-key", "en", &client).await;

        assert!(result.is_ok());
        let summary = result.unwrap().summary;
        assert!(summary.contains("- Point 1"));
        assert!(summary.contains("- Point 2"));
        assert!(summary.contains("- Point 3"));
    }

    #[tokio::test]
    async fn test_summarize_handles_api_errors_gracefully() {
        // Test network error
        let client = MockHttpClient {
            response: Err("Connection refused".to_string()),
        };

        let result = summarize_text_with_client("Test", "api-key", "en", &client).await;
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(matches!(error, SummarizationError::NetworkError(_)));
        assert!(error.user_message().contains("internet connection"));

        // Test 401 Unauthorized
        let client = MockHttpClient {
            response: Ok((401, r#"{"error":{"message":"Invalid API key"}}"#.to_string())),
        };

        let result = summarize_text_with_client("Test", "api-key", "en", &client).await;
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(matches!(error, SummarizationError::InvalidApiKey));
        assert!(error.user_message().contains("Invalid API key"));

        // Test 429 Rate Limit
        let client = MockHttpClient {
            response: Ok((429, r#"{"error":{"message":"Rate limit exceeded"}}"#.to_string())),
        };

        let result = summarize_text_with_client("Test", "api-key", "en", &client).await;
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(matches!(error, SummarizationError::RateLimitExceeded));
        assert!(error.user_message().contains("Rate limit"));

        // Test 500 Server Error
        let client = MockHttpClient {
            response: Ok((500, r#"{"error":{"message":"Internal server error"}}"#.to_string())),
        };

        let result = summarize_text_with_client("Test", "api-key", "en", &client).await;
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(matches!(error, SummarizationError::ApiError(_)));
    }

    #[test]
    fn test_user_messages_are_descriptive() {
        assert!(SummarizationError::ApiKeyNotConfigured
            .user_message()
            .contains("API key"));
        assert!(SummarizationError::InvalidApiKey
            .user_message()
            .contains("Invalid"));
        assert!(SummarizationError::NetworkError("test".to_string())
            .user_message()
            .contains("try again"));
        assert!(SummarizationError::RateLimitExceeded
            .user_message()
            .contains("wait"));
        assert!(SummarizationError::EmptyText
            .user_message()
            .contains("empty"));
    }

    #[tokio::test]
    async fn test_empty_text_returns_error() {
        let client = MockHttpClient {
            response: Ok((200, "".to_string())),
        };

        let result = summarize_text_with_client("", "api-key", "en", &client).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), SummarizationError::EmptyText));

        let result = summarize_text_with_client("   ", "api-key", "en", &client).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), SummarizationError::EmptyText));
    }
}
