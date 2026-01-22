mod commands;
mod external_service;
mod file_storage;
mod global_hotkey;
mod history;
mod settings;
mod summarization;
mod transcription;

pub use history::HistoryItem;
pub use settings::Settings;

use tauri::Manager;
use global_hotkey::{
    initialize_global_hotkey, unregister_all_hotkeys, update_global_hotkey, HotkeyResult,
};

/// Tauri command to update the global hotkey
/// Unregisters the old hotkey and registers the new one
#[tauri::command]
fn update_global_hotkey_cmd(
    app: tauri::AppHandle,
    old_hotkey: Option<String>,
    new_hotkey: String,
) -> HotkeyResult {
    match update_global_hotkey(&app, old_hotkey.as_deref(), &new_hotkey) {
        Ok(()) => HotkeyResult::ok(),
        Err(e) => HotkeyResult::error(e),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize global hotkey on app startup
            initialize_global_hotkey(app.handle());

            Ok(())
        })
        .on_window_event(|window, event| {
            // Unregister hotkeys when app is about to close
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle();
                if let Err(e) = unregister_all_hotkeys(app) {
                    log::error!("Failed to unregister hotkeys on close: {}", e);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::get_history,
            commands::save_recording_history,
            commands::delete_recording_history,
            commands::update_history_summary,
            commands::get_recordings_directory,
            commands::ensure_directory_exists,
            commands::save_recording,
            commands::delete_recording,
            commands::transcribe_audio,
            commands::summarize_transcription,
            external_service::call_external_service,
            update_global_hotkey_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
