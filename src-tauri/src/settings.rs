use serde::{Deserialize, Serialize};

/// Default maximum recording duration in minutes
pub const DEFAULT_MAX_DURATION_MINUTES: u32 = 5;

/// Default language for transcription (ISO 639-1 code)
pub const DEFAULT_LANGUAGE: &str = "de";

/// Default global hotkey for recording toggle
pub const DEFAULT_GLOBAL_HOTKEY: &str = "Ctrl+Shift+R";

/// Custom action configuration for external service integration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomAction {
    /// Unique identifier for the action
    pub id: String,
    /// Display name for the action button
    pub name: String,
    /// API endpoint URL to POST transcription text to
    pub url: String,
}

/// Application settings stored via tauri-plugin-store
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// Maximum recording duration in minutes
    pub max_duration: u32,
    /// OpenAI API key for Whisper transcription
    pub api_key: Option<String>,
    /// Language for transcription (ISO 639-1 code, e.g., "de", "en")
    #[serde(default = "default_language")]
    pub language: String,
    /// Custom action buttons for external service integration
    #[serde(default)]
    pub custom_actions: Vec<CustomAction>,
    /// Global hotkey for toggling recording (e.g., "Ctrl+Shift+R")
    #[serde(default)]
    pub global_hotkey: Option<String>,
}

fn default_language() -> String {
    DEFAULT_LANGUAGE.to_string()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            max_duration: DEFAULT_MAX_DURATION_MINUTES,
            api_key: None,
            language: DEFAULT_LANGUAGE.to_string(),
            custom_actions: Vec::new(),
            global_hotkey: None,
        }
    }
}

impl Settings {
    /// Validates the settings values
    pub fn validate(&self) -> Result<(), String> {
        if self.max_duration == 0 {
            return Err("Max duration must be greater than 0".to_string());
        }
        if self.max_duration > 180 {
            return Err("Max duration cannot exceed 180 minutes".to_string());
        }
        // Validate global hotkey if provided
        if let Some(ref hotkey) = self.global_hotkey {
            validate_hotkey_format(hotkey)?;
        }
        Ok(())
    }

    /// Returns the effective global hotkey (user setting or default)
    pub fn effective_global_hotkey(&self) -> &str {
        self.global_hotkey
            .as_deref()
            .unwrap_or(DEFAULT_GLOBAL_HOTKEY)
    }
}

/// Validates that a hotkey string is in the correct format
/// Format: Modifier+Modifier+Key (e.g., "Ctrl+Shift+R")
/// At least one modifier (Ctrl, Alt, Shift, Meta) is required
pub fn validate_hotkey_format(hotkey: &str) -> Result<(), String> {
    if hotkey.is_empty() {
        return Err("Hotkey cannot be empty".to_string());
    }

    let parts: Vec<&str> = hotkey.split('+').collect();
    if parts.len() < 2 {
        return Err("Hotkey must have at least one modifier and a key".to_string());
    }

    let valid_modifiers = ["Ctrl", "Alt", "Shift", "Meta"];
    let mut has_modifier = false;
    let mut has_key = false;

    for (i, part) in parts.iter().enumerate() {
        let part = part.trim();
        if part.is_empty() {
            return Err("Hotkey contains empty segment".to_string());
        }

        if valid_modifiers.contains(&part) {
            has_modifier = true;
        } else if i == parts.len() - 1 {
            // Last part should be the key
            if part.len() == 1 || is_valid_special_key(part) {
                has_key = true;
            } else {
                return Err(format!("Invalid key: {}", part));
            }
        } else {
            return Err(format!("Invalid modifier: {}", part));
        }
    }

    if !has_modifier {
        return Err("Hotkey must have at least one modifier (Ctrl, Alt, Shift, Meta)".to_string());
    }

    if !has_key {
        return Err("Hotkey must end with a valid key".to_string());
    }

    Ok(())
}

/// Check if a key name is a valid special key
fn is_valid_special_key(key: &str) -> bool {
    let valid_special_keys = [
        "Space", "Tab", "Enter", "Escape", "Backspace", "Delete", "Insert",
        "Home", "End", "PageUp", "PageDown",
        "Up", "Down", "Left", "Right",
        "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
    ];
    valid_special_keys.contains(&key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings() {
        let settings = Settings::default();
        assert_eq!(settings.max_duration, 5);
        assert!(settings.api_key.is_none());
        assert_eq!(settings.language, "de");
        assert!(settings.custom_actions.is_empty());
        assert!(settings.global_hotkey.is_none());
    }

    #[test]
    fn test_validate_valid_settings() {
        let settings = Settings {
            max_duration: 30,
            api_key: Some("test-key".to_string()),
            language: "en".to_string(),
            custom_actions: Vec::new(),
            global_hotkey: Some("Ctrl+Shift+R".to_string()),
        };
        assert!(settings.validate().is_ok());
    }

    #[test]
    fn test_validate_zero_duration() {
        let settings = Settings {
            max_duration: 0,
            api_key: None,
            language: "de".to_string(),
            custom_actions: Vec::new(),
            global_hotkey: None,
        };
        assert!(settings.validate().is_err());
    }

    #[test]
    fn test_validate_excessive_duration() {
        let settings = Settings {
            max_duration: 200,
            api_key: None,
            language: "de".to_string(),
            custom_actions: Vec::new(),
            global_hotkey: None,
        };
        assert!(settings.validate().is_err());
    }

    #[test]
    fn test_effective_global_hotkey_with_custom() {
        let settings = Settings {
            max_duration: 5,
            api_key: None,
            language: "de".to_string(),
            custom_actions: Vec::new(),
            global_hotkey: Some("Alt+R".to_string()),
        };
        assert_eq!(settings.effective_global_hotkey(), "Alt+R");
    }

    #[test]
    fn test_effective_global_hotkey_with_default() {
        let settings = Settings::default();
        assert_eq!(settings.effective_global_hotkey(), DEFAULT_GLOBAL_HOTKEY);
    }

    #[test]
    fn test_validate_hotkey_format_valid() {
        assert!(validate_hotkey_format("Ctrl+Shift+R").is_ok());
        assert!(validate_hotkey_format("Alt+R").is_ok());
        assert!(validate_hotkey_format("Ctrl+Alt+Shift+V").is_ok());
        assert!(validate_hotkey_format("Meta+Space").is_ok());
        assert!(validate_hotkey_format("Ctrl+F1").is_ok());
    }

    #[test]
    fn test_validate_hotkey_format_invalid() {
        // No modifier
        assert!(validate_hotkey_format("R").is_err());
        // Empty string
        assert!(validate_hotkey_format("").is_err());
        // Invalid modifier
        assert!(validate_hotkey_format("Control+R").is_err());
        // No key
        assert!(validate_hotkey_format("Ctrl+").is_err());
    }
}
