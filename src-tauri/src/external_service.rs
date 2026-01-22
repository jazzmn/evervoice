//! External service proxy module for calling custom user-configured endpoints.
//!
//! This module provides functionality to POST transcription text to external
//! services configured by the user in settings.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// External service call error types
#[derive(Error, Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "message")]
pub enum ExternalServiceError {
    #[error("Invalid URL: {0}")]
    InvalidUrl(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Service error: {0}")]
    ServiceError(String),
}

impl ExternalServiceError {
    /// Convert to a user-friendly error message
    pub fn user_message(&self) -> String {
        match self {
            ExternalServiceError::InvalidUrl(url) => {
                format!(
                    "Invalid URL '{}'. URL must start with http:// or https://",
                    url
                )
            }
            ExternalServiceError::NetworkError(_) => {
                "Failed to connect to external service. Please check your internet connection."
                    .to_string()
            }
            ExternalServiceError::ServiceError(msg) => {
                format!("External service returned an error: {}", msg)
            }
        }
    }
}

/// Response from external service call
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalServiceResponse {
    /// Whether the call was successful
    pub success: bool,
    /// Response message or error description
    pub message: Option<String>,
    /// Error type if failed
    pub error_type: Option<String>,
}

impl ExternalServiceResponse {
    /// Create a success response
    pub fn success(message: Option<String>) -> Self {
        Self {
            success: true,
            message,
            error_type: None,
        }
    }

    /// Create an error response from an ExternalServiceError
    pub fn error(err: ExternalServiceError) -> Self {
        let error_type = match &err {
            ExternalServiceError::InvalidUrl(_) => "invalid_url",
            ExternalServiceError::NetworkError(_) => "network_error",
            ExternalServiceError::ServiceError(_) => "service_error",
        };

        Self {
            success: false,
            message: Some(err.user_message()),
            error_type: Some(error_type.to_string()),
        }
    }
}

/// Request body sent to external services
#[derive(Debug, Serialize)]
struct ExternalServiceRequest {
    text: String,
}

/// Validates that a URL starts with http:// or https://
pub fn validate_url(url: &str) -> Result<(), ExternalServiceError> {
    let url_lower = url.to_lowercase();
    if url_lower.starts_with("http://") || url_lower.starts_with("https://") {
        Ok(())
    } else {
        Err(ExternalServiceError::InvalidUrl(url.to_string()))
    }
}

/// Trait for HTTP client to enable testing with mocks
pub trait HttpClient: Send + Sync {
    /// POST JSON to a URL and return the response body
    fn post_json(
        &self,
        url: &str,
        body: &str,
    ) -> impl std::future::Future<Output = Result<String, ExternalServiceError>> + Send;
}

/// Real HTTP client implementation using reqwest
pub struct ReqwestClient;

impl HttpClient for ReqwestClient {
    async fn post_json(&self, url: &str, body: &str) -> Result<String, ExternalServiceError> {
        let client = reqwest::Client::new();

        let response = client
            .post(url)
            .header("Content-Type", "application/json")
            .body(body.to_string())
            .send()
            .await
            .map_err(|e| {
                if e.is_connect() || e.is_timeout() {
                    ExternalServiceError::NetworkError(e.to_string())
                } else {
                    ExternalServiceError::NetworkError(e.to_string())
                }
            })?;

        let status = response.status();

        if status.is_success() {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "OK".to_string());
            Ok(body)
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| format!("HTTP {}", status.as_u16()));
            Err(ExternalServiceError::ServiceError(error_text))
        }
    }
}

/// Call an external service with the given URL and transcription text
///
/// This function:
/// 1. Validates the URL format (must start with http:// or https://)
/// 2. POSTs JSON body `{ "text": "<transcription>" }` to the URL
/// 3. Returns success/failure with optional response message
pub async fn call_external_service_impl<C: HttpClient>(
    client: &C,
    url: &str,
    text: &str,
) -> ExternalServiceResponse {
    // Validate URL
    if let Err(e) = validate_url(url) {
        return ExternalServiceResponse::error(e);
    }

    // Build request body
    let request = ExternalServiceRequest {
        text: text.to_string(),
    };

    let body = match serde_json::to_string(&request) {
        Ok(b) => b,
        Err(e) => {
            return ExternalServiceResponse::error(ExternalServiceError::ServiceError(format!(
                "Failed to serialize request: {}",
                e
            )));
        }
    };

    // Make the POST request
    match client.post_json(url, &body).await {
        Ok(response_body) => ExternalServiceResponse::success(Some(response_body)),
        Err(e) => ExternalServiceResponse::error(e),
    }
}

/// Tauri command to call an external service
///
/// # Arguments
/// * `url` - The URL to POST to (must start with http:// or https://)
/// * `text` - The transcription text to send
///
/// # Returns
/// An `ExternalServiceResponse` indicating success or failure
#[tauri::command]
pub async fn call_external_service(url: String, text: String) -> ExternalServiceResponse {
    let client = ReqwestClient;
    call_external_service_impl(&client, &url, &text).await
}

#[cfg(test)]
mod tests {
    use super::*;

    // Test 1: URL validation
    #[test]
    fn test_url_validation() {
        // Valid URLs
        assert!(validate_url("http://example.com").is_ok());
        assert!(validate_url("https://example.com").is_ok());
        assert!(validate_url("HTTP://example.com").is_ok());
        assert!(validate_url("HTTPS://example.com").is_ok());

        // Invalid URLs
        assert!(validate_url("ftp://example.com").is_err());
        assert!(validate_url("example.com").is_err());
        assert!(validate_url("").is_err());
        assert!(validate_url("file:///path").is_err());
    }

    // Test 2: call_external_service POSTs to correct URL with JSON body
    #[tokio::test]
    async fn test_call_external_service_posts_correct_json_body() {
        use std::sync::{Arc, Mutex};

        // Track what was sent
        struct MockClient {
            captured_url: Arc<Mutex<String>>,
            captured_body: Arc<Mutex<String>>,
        }

        impl HttpClient for MockClient {
            async fn post_json(
                &self,
                url: &str,
                body: &str,
            ) -> Result<String, ExternalServiceError> {
                *self.captured_url.lock().unwrap() = url.to_string();
                *self.captured_body.lock().unwrap() = body.to_string();
                Ok("OK".to_string())
            }
        }

        let captured_url = Arc::new(Mutex::new(String::new()));
        let captured_body = Arc::new(Mutex::new(String::new()));

        let client = MockClient {
            captured_url: captured_url.clone(),
            captured_body: captured_body.clone(),
        };

        let response =
            call_external_service_impl(&client, "https://api.example.com/webhook", "Hello world")
                .await;

        assert!(response.success);
        assert_eq!(
            *captured_url.lock().unwrap(),
            "https://api.example.com/webhook"
        );

        // Verify JSON body format
        let body: serde_json::Value =
            serde_json::from_str(&captured_body.lock().unwrap()).unwrap();
        assert_eq!(body["text"], "Hello world");
    }

    // Test 3: call_external_service returns success response
    #[tokio::test]
    async fn test_call_external_service_returns_success_response() {
        struct MockClient;

        impl HttpClient for MockClient {
            async fn post_json(
                &self,
                _url: &str,
                _body: &str,
            ) -> Result<String, ExternalServiceError> {
                Ok("Request processed successfully".to_string())
            }
        }

        let client = MockClient;
        let response =
            call_external_service_impl(&client, "https://api.example.com/action", "Test text")
                .await;

        assert!(response.success);
        assert_eq!(
            response.message,
            Some("Request processed successfully".to_string())
        );
        assert!(response.error_type.is_none());
    }

    // Test 4: call_external_service handles network errors
    #[tokio::test]
    async fn test_call_external_service_handles_network_errors() {
        struct MockClient;

        impl HttpClient for MockClient {
            async fn post_json(
                &self,
                _url: &str,
                _body: &str,
            ) -> Result<String, ExternalServiceError> {
                Err(ExternalServiceError::NetworkError(
                    "Connection refused".to_string(),
                ))
            }
        }

        let client = MockClient;
        let response =
            call_external_service_impl(&client, "https://api.example.com/action", "Test text")
                .await;

        assert!(!response.success);
        assert_eq!(response.error_type, Some("network_error".to_string()));
        assert!(response.message.is_some());
        assert!(response
            .message
            .unwrap()
            .contains("Failed to connect to external service"));
    }

    // Test 5: Invalid URL returns validation error
    #[tokio::test]
    async fn test_call_external_service_invalid_url_returns_error() {
        struct MockClient;

        impl HttpClient for MockClient {
            async fn post_json(
                &self,
                _url: &str,
                _body: &str,
            ) -> Result<String, ExternalServiceError> {
                // Should not be called for invalid URL
                panic!("Should not make request for invalid URL");
            }
        }

        let client = MockClient;
        let response =
            call_external_service_impl(&client, "ftp://invalid.example.com", "Test text").await;

        assert!(!response.success);
        assert_eq!(response.error_type, Some("invalid_url".to_string()));
        assert!(response.message.is_some());
        assert!(response
            .message
            .unwrap()
            .contains("must start with http:// or https://"));
    }
}
