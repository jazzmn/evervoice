use crate::settings::{validate_hotkey_format, DEFAULT_GLOBAL_HOTKEY};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Event name for global hotkey trigger
pub const GLOBAL_HOTKEY_EVENT: &str = "global-hotkey-triggered";

/// Payload for the global hotkey triggered event
#[derive(Clone, Serialize)]
pub struct HotkeyEventPayload {
    /// Timestamp when the hotkey was triggered (milliseconds since epoch)
    pub timestamp: u64,
    /// The hotkey combination that was pressed
    pub hotkey: String,
}

/// Error types for hotkey operations
#[derive(Debug, Clone, Serialize)]
pub enum HotkeyError {
    /// The hotkey format is invalid
    InvalidFormat(String),
    /// The hotkey conflicts with another application's shortcut
    Conflict(String),
    /// Failed to register the hotkey
    RegistrationFailed(String),
    /// Failed to unregister the hotkey
    UnregistrationFailed(String),
}

impl std::fmt::Display for HotkeyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HotkeyError::InvalidFormat(msg) => write!(f, "Invalid hotkey format: {}", msg),
            HotkeyError::Conflict(msg) => write!(f, "Hotkey conflict: {}", msg),
            HotkeyError::RegistrationFailed(msg) => write!(f, "Failed to register hotkey: {}", msg),
            HotkeyError::UnregistrationFailed(msg) => {
                write!(f, "Failed to unregister hotkey: {}", msg)
            }
        }
    }
}

impl std::error::Error for HotkeyError {}

/// Result type for hotkey operations
#[derive(Clone, Serialize)]
pub struct HotkeyResult {
    pub success: bool,
    pub message: Option<String>,
    pub error_type: Option<String>,
}

impl HotkeyResult {
    pub fn ok() -> Self {
        Self {
            success: true,
            message: None,
            error_type: None,
        }
    }

    pub fn error(error: HotkeyError) -> Self {
        let error_type = match &error {
            HotkeyError::InvalidFormat(_) => "invalid_format",
            HotkeyError::Conflict(_) => "conflict",
            HotkeyError::RegistrationFailed(_) => "registration_failed",
            HotkeyError::UnregistrationFailed(_) => "unregistration_failed",
        };

        Self {
            success: false,
            message: Some(error.to_string()),
            error_type: Some(error_type.to_string()),
        }
    }
}

/// Convert our hotkey string format to the plugin's Shortcut type
/// Our format: "Ctrl+Shift+R" -> plugin format
fn parse_hotkey_to_shortcut(hotkey: &str) -> Result<Shortcut, HotkeyError> {
    // The tauri-plugin-global-shortcut accepts strings like "ctrl+shift+r"
    // Convert our format to lowercase for the plugin
    let shortcut_str = hotkey.to_lowercase();

    shortcut_str
        .parse::<Shortcut>()
        .map_err(|e| HotkeyError::InvalidFormat(format!("Failed to parse '{}': {}", hotkey, e)))
}

/// Register a global hotkey and set up the event handler
pub fn register_global_hotkey(app: &AppHandle, hotkey: &str) -> Result<(), HotkeyError> {
    // Validate the hotkey format first
    validate_hotkey_format(hotkey)
        .map_err(|e| HotkeyError::InvalidFormat(e))?;

    let shortcut = parse_hotkey_to_shortcut(hotkey)?;
    let hotkey_clone = hotkey.to_string();
    let app_handle = app.clone();

    // Check if plugin is available
    let manager = app.global_shortcut();

    // Register the shortcut with a handler
    manager
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let timestamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);

                let payload = HotkeyEventPayload {
                    timestamp,
                    hotkey: hotkey_clone.clone(),
                };

                // Emit event to frontend
                if let Err(e) = app_handle.emit(GLOBAL_HOTKEY_EVENT, payload) {
                    log::error!("Failed to emit global-hotkey-triggered event: {}", e);
                } else {
                    log::info!("Global hotkey triggered: {}", hotkey_clone);
                }
            }
        })
        .map_err(|e| {
            let error_msg = e.to_string();
            if error_msg.contains("already") || error_msg.contains("conflict") {
                HotkeyError::Conflict(format!(
                    "The hotkey '{}' is already in use by another application",
                    hotkey
                ))
            } else {
                HotkeyError::RegistrationFailed(error_msg)
            }
        })?;

    log::info!("Registered global hotkey: {}", hotkey);
    Ok(())
}

/// Unregister all global shortcuts
pub fn unregister_all_hotkeys(app: &AppHandle) -> Result<(), HotkeyError> {
    let manager = app.global_shortcut();

    manager
        .unregister_all()
        .map_err(|e| HotkeyError::UnregistrationFailed(e.to_string()))?;

    log::info!("Unregistered all global hotkeys");
    Ok(())
}

/// Unregister a specific global shortcut
pub fn unregister_hotkey(app: &AppHandle, hotkey: &str) -> Result<(), HotkeyError> {
    let shortcut = parse_hotkey_to_shortcut(hotkey)?;
    let manager = app.global_shortcut();

    manager
        .unregister(shortcut)
        .map_err(|e| HotkeyError::UnregistrationFailed(e.to_string()))?;

    log::info!("Unregistered global hotkey: {}", hotkey);
    Ok(())
}

/// Update the global hotkey (unregister old, register new)
pub fn update_global_hotkey(
    app: &AppHandle,
    old_hotkey: Option<&str>,
    new_hotkey: &str,
) -> Result<(), HotkeyError> {
    // Validate new hotkey format first
    validate_hotkey_format(new_hotkey)
        .map_err(|e| HotkeyError::InvalidFormat(e))?;

    // Unregister old hotkey if it exists
    if let Some(old) = old_hotkey {
        if let Err(e) = unregister_hotkey(app, old) {
            log::warn!("Failed to unregister old hotkey '{}': {}", old, e);
            // Continue anyway - the old hotkey might not be registered
        }
    }

    // Register the new hotkey
    register_global_hotkey(app, new_hotkey)
}

/// Initialize global hotkey on app startup
/// Reads the hotkey from settings and registers it
pub fn initialize_global_hotkey(app: &AppHandle) {
    // Get the hotkey from settings
    let hotkey = get_hotkey_from_settings(app).unwrap_or_else(|| DEFAULT_GLOBAL_HOTKEY.to_string());

    // Register the hotkey
    if let Err(e) = register_global_hotkey(app, &hotkey) {
        log::error!("Failed to register global hotkey on startup: {}", e);
        // Try to register the default hotkey as fallback
        if hotkey != DEFAULT_GLOBAL_HOTKEY {
            log::info!("Attempting to register default hotkey as fallback");
            if let Err(e2) = register_global_hotkey(app, DEFAULT_GLOBAL_HOTKEY) {
                log::error!("Failed to register default hotkey: {}", e2);
            }
        }
    }
}

/// Get the configured hotkey from settings store
fn get_hotkey_from_settings(app: &AppHandle) -> Option<String> {
    use tauri_plugin_store::StoreExt;

    let store = app.store("settings.json").ok()?;
    let settings_value = store.get("settings")?;

    let settings: crate::Settings = serde_json::from_value(settings_value.clone()).ok()?;
    settings.global_hotkey
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hotkey_error_display() {
        let err = HotkeyError::InvalidFormat("test".to_string());
        assert!(err.to_string().contains("Invalid hotkey format"));

        let err = HotkeyError::Conflict("Ctrl+R".to_string());
        assert!(err.to_string().contains("conflict"));
    }

    #[test]
    fn test_hotkey_result_ok() {
        let result = HotkeyResult::ok();
        assert!(result.success);
        assert!(result.message.is_none());
        assert!(result.error_type.is_none());
    }

    #[test]
    fn test_hotkey_result_error() {
        let error = HotkeyError::InvalidFormat("test error".to_string());
        let result = HotkeyResult::error(error);
        assert!(!result.success);
        assert!(result.message.is_some());
        assert_eq!(result.error_type, Some("invalid_format".to_string()));
    }

    #[test]
    fn test_parse_hotkey_to_shortcut_valid() {
        // These tests verify the conversion logic works for valid formats
        let result = parse_hotkey_to_shortcut("Ctrl+Shift+R");
        assert!(result.is_ok());

        let result = parse_hotkey_to_shortcut("Alt+R");
        assert!(result.is_ok());
    }
}
