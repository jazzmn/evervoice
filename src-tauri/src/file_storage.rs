use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

/// Get the platform-specific recordings directory path
///
/// - Windows: `%APPDATA%/EverVoice/recordings/`
/// - macOS: `~/Library/Application Support/EverVoice/recordings/`
/// - Linux: `~/.config/EverVoice/recordings/`
pub fn get_recordings_dir() -> Result<PathBuf, String> {
    let base_dir = dirs::data_dir()
        .or_else(|| dirs::config_dir())
        .ok_or_else(|| "Could not determine application data directory".to_string())?;

    Ok(base_dir.join("EverVoice").join("recordings"))
}

/// Ensure the recordings directory exists, creating it if necessary
pub fn ensure_recordings_dir_exists() -> Result<PathBuf, String> {
    let dir = get_recordings_dir()?;

    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create recordings directory: {}", e))?;
    }

    Ok(dir)
}

/// Generate a unique filename with ISO timestamp and UUID
///
/// Format: `recording-{YYYY-MM-DDTHH-mm-ss}-{uuid}.webm`
pub fn generate_recording_filename() -> String {
    let timestamp = chrono::Local::now().format("%Y-%m-%dT%H-%M-%S");
    let uuid = Uuid::new_v4();
    format!("recording-{}-{}.webm", timestamp, uuid)
}

/// Save recording binary data to a file and return the full file path
pub fn save_recording_to_file(data: &[u8]) -> Result<String, String> {
    let dir = ensure_recordings_dir_exists()?;
    let filename = generate_recording_filename();
    let file_path = dir.join(&filename);

    fs::write(&file_path, data)
        .map_err(|e| format!("Failed to write recording file: {}", e))?;

    file_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid file path encoding".to_string())
}

/// Delete a recording file by its path
pub fn delete_recording_file(file_path: &str) -> Result<(), String> {
    let path = PathBuf::from(file_path);

    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete recording file: {}", e))?;
    }

    Ok(())
}

/// Clean up orphaned recording files that are older than the specified duration
/// Returns the number of files cleaned up
#[allow(dead_code)]
pub fn cleanup_old_recordings(max_age_hours: u32) -> Result<u32, String> {
    let dir = get_recordings_dir()?;

    if !dir.exists() {
        return Ok(0);
    }

    let cutoff = std::time::SystemTime::now()
        - std::time::Duration::from_secs(u64::from(max_age_hours) * 3600);

    let mut cleaned = 0;

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read recordings directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("webm") {
            if let Ok(metadata) = fs::metadata(&path) {
                if let Ok(modified) = metadata.modified() {
                    if modified < cutoff {
                        if fs::remove_file(&path).is_ok() {
                            cleaned += 1;
                        }
                    }
                }
            }
        }
    }

    Ok(cleaned)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    #[test]
    fn test_get_recordings_dir_returns_valid_path() {
        let result = get_recordings_dir();
        assert!(result.is_ok());

        let path = result.unwrap();
        assert!(path.ends_with("EverVoice/recordings") || path.ends_with("EverVoice\\recordings"));
    }

    #[test]
    fn test_ensure_directory_creates_if_not_exists() {
        let result = ensure_recordings_dir_exists();
        assert!(result.is_ok());

        let dir = result.unwrap();
        assert!(dir.exists());
        assert!(dir.is_dir());
    }

    #[test]
    fn test_file_naming_convention() {
        let filename = generate_recording_filename();

        // Should start with "recording-"
        assert!(filename.starts_with("recording-"));

        // Should end with ".webm"
        assert!(filename.ends_with(".webm"));

        // Should contain timestamp pattern (YYYY-MM-DDTHH-MM-SS)
        // Format: recording-2024-01-21T14-30-00-{uuid}.webm
        let parts: Vec<&str> = filename.split('-').collect();
        assert!(parts.len() >= 7, "Filename should have expected format");

        // Year should be 4 digits
        assert_eq!(parts[1].len(), 4);

        // Month and day should be 2 digits
        assert_eq!(parts[2].len(), 2);

        // Day part contains 'T' and hour
        assert!(parts[3].contains('T'));
    }

    #[test]
    fn test_file_naming_generates_unique_names() {
        let name1 = generate_recording_filename();
        let name2 = generate_recording_filename();

        // Names should be different due to UUID
        assert_ne!(name1, name2);
    }

    #[test]
    fn test_save_recording_writes_file() {
        let test_data = b"test audio data";

        let result = save_recording_to_file(test_data);
        assert!(result.is_ok());

        let file_path = result.unwrap();
        let path = Path::new(&file_path);

        // File should exist
        assert!(path.exists());

        // File content should match
        let content = fs::read(&file_path).unwrap();
        assert_eq!(content, test_data);

        // Cleanup
        let _ = fs::remove_file(&file_path);
    }

    #[test]
    fn test_delete_recording_file() {
        // First create a test file
        let test_data = b"test data to delete";
        let file_path = save_recording_to_file(test_data).unwrap();

        // Verify it exists
        assert!(Path::new(&file_path).exists());

        // Delete it
        let result = delete_recording_file(&file_path);
        assert!(result.is_ok());

        // Verify it's gone
        assert!(!Path::new(&file_path).exists());
    }

    #[test]
    fn test_delete_nonexistent_file_succeeds() {
        // Deleting a file that doesn't exist should succeed (no-op)
        let result = delete_recording_file("/nonexistent/path/to/file.webm");
        assert!(result.is_ok());
    }
}
