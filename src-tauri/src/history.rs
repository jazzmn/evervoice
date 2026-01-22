use serde::{Deserialize, Serialize};

/// Maximum number of history items to keep in storage
pub const MAX_HISTORY_ITEMS: usize = 100;

/// A recording history item stored in the application data
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    /// Unique identifier (UUID)
    pub id: String,
    /// Full path to the recording file
    pub file_path: String,
    /// Duration of the recording in seconds
    pub duration_seconds: f64,
    /// Transcription text
    pub transcription: String,
    /// ISO 8601 timestamp when the recording was created
    pub created_at: String,
    /// AI-generated summary (optional, for backward compatibility)
    #[serde(default)]
    pub summary: Option<String>,
}

impl HistoryItem {
    /// Creates a new history item with a generated UUID and current timestamp
    pub fn new(file_path: String, duration_seconds: f64, transcription: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            file_path,
            duration_seconds,
            transcription,
            created_at: chrono::Utc::now().to_rfc3339(),
            summary: None,
        }
    }
}

/// Sorts history items by created_at in descending order (newest first)
pub fn sort_history_descending(items: &mut Vec<HistoryItem>) {
    items.sort_by(|a, b| b.created_at.cmp(&a.created_at));
}

/// Truncates history to the maximum allowed items
pub fn truncate_history(items: &mut Vec<HistoryItem>) {
    if items.len() > MAX_HISTORY_ITEMS {
        items.truncate(MAX_HISTORY_ITEMS);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_history_item_new_generates_uuid() {
        let item = HistoryItem::new(
            "/path/to/file.webm".to_string(),
            60.0,
            "Test transcription".to_string(),
        );

        // UUID should be 36 characters (with hyphens)
        assert_eq!(item.id.len(), 36);
        assert!(item.id.contains('-'));
    }

    #[test]
    fn test_history_item_new_sets_timestamp() {
        let item = HistoryItem::new(
            "/path/to/file.webm".to_string(),
            60.0,
            "Test transcription".to_string(),
        );

        // Should be an ISO 8601 timestamp
        assert!(item.created_at.contains('T'));
        assert!(item.created_at.contains(':'));
    }

    #[test]
    fn test_history_item_serialization() {
        let item = HistoryItem {
            id: "test-uuid".to_string(),
            file_path: "/path/to/file.webm".to_string(),
            duration_seconds: 120.5,
            transcription: "Hello world".to_string(),
            created_at: "2024-01-21T10:30:00Z".to_string(),
            summary: None,
        };

        let json = serde_json::to_string(&item).unwrap();

        // Should use camelCase
        assert!(json.contains("filePath"));
        assert!(json.contains("durationSeconds"));
        assert!(json.contains("createdAt"));
    }

    #[test]
    fn test_history_item_with_summary_serializes_correctly() {
        let item = HistoryItem {
            id: "test-uuid".to_string(),
            file_path: "/path/to/file.webm".to_string(),
            duration_seconds: 120.5,
            transcription: "Hello world".to_string(),
            created_at: "2024-01-21T10:30:00Z".to_string(),
            summary: Some("This is a test summary.".to_string()),
        };

        let json = serde_json::to_string(&item).unwrap();

        // Should contain summary field with camelCase
        assert!(json.contains("\"summary\":\"This is a test summary.\""));
    }

    #[test]
    fn test_history_item_without_summary_deserializes_with_none() {
        // JSON without summary field (simulating old history items)
        let json = r#"{
            "id": "test-uuid",
            "filePath": "/path/to/file.webm",
            "durationSeconds": 120.5,
            "transcription": "Hello world",
            "createdAt": "2024-01-21T10:30:00Z"
        }"#;

        let item: HistoryItem = serde_json::from_str(json).unwrap();

        // Summary should be None due to serde(default)
        assert_eq!(item.summary, None);
        assert_eq!(item.id, "test-uuid");
        assert_eq!(item.transcription, "Hello world");
    }

    #[test]
    fn test_sort_history_descending_orders_by_created_at() {
        let mut items = vec![
            HistoryItem {
                id: "1".to_string(),
                file_path: "/path/1.webm".to_string(),
                duration_seconds: 60.0,
                transcription: "First".to_string(),
                created_at: "2024-01-21T10:00:00Z".to_string(),
                summary: None,
            },
            HistoryItem {
                id: "3".to_string(),
                file_path: "/path/3.webm".to_string(),
                duration_seconds: 60.0,
                transcription: "Third".to_string(),
                created_at: "2024-01-21T12:00:00Z".to_string(),
                summary: None,
            },
            HistoryItem {
                id: "2".to_string(),
                file_path: "/path/2.webm".to_string(),
                duration_seconds: 60.0,
                transcription: "Second".to_string(),
                created_at: "2024-01-21T11:00:00Z".to_string(),
                summary: None,
            },
        ];

        sort_history_descending(&mut items);

        // Should be sorted newest first (descending by created_at)
        assert_eq!(items[0].id, "3"); // 12:00 - newest
        assert_eq!(items[1].id, "2"); // 11:00
        assert_eq!(items[2].id, "1"); // 10:00 - oldest
    }

    #[test]
    fn test_truncate_history_limits_to_max_items() {
        // Create 105 items (more than MAX_HISTORY_ITEMS)
        let mut items: Vec<HistoryItem> = (0..105)
            .map(|i| HistoryItem {
                id: format!("item-{}", i),
                file_path: format!("/path/{}.webm", i),
                duration_seconds: 60.0,
                transcription: format!("Transcription {}", i),
                created_at: format!("2024-01-21T{:02}:00:00Z", i % 24),
                summary: None,
            })
            .collect();

        assert_eq!(items.len(), 105);

        truncate_history(&mut items);

        // Should be limited to MAX_HISTORY_ITEMS (100)
        assert_eq!(items.len(), MAX_HISTORY_ITEMS);
        assert_eq!(items.len(), 100);
    }

    #[test]
    fn test_truncate_history_does_not_truncate_small_list() {
        let mut items: Vec<HistoryItem> = (0..50)
            .map(|i| HistoryItem {
                id: format!("item-{}", i),
                file_path: format!("/path/{}.webm", i),
                duration_seconds: 60.0,
                transcription: format!("Transcription {}", i),
                created_at: format!("2024-01-21T{:02}:00:00Z", i % 24),
                summary: None,
            })
            .collect();

        truncate_history(&mut items);

        // Should remain at 50 items
        assert_eq!(items.len(), 50);
    }

}
