mod ai;
mod clipboard;
mod documents;
mod error;
mod platform;

pub use ai::AiRunnerState;

/// Builds the complete native command interface shared by Tauri and Specta.
pub fn specta_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new().commands(tauri_specta::collect_commands![
        documents::open_pdf_dialog,
        documents::open_image_dialog,
        documents::save_pdf_dialog,
        documents::write_pdf_file,
        documents::save_json_dialog,
        documents::read_file_from_path,
        documents::select_directory_dialog,
        documents::scan_directory_pdfs,
        platform::get_default_directories,
        clipboard::copy_image_to_clipboard,
        clipboard::copy_text_to_clipboard,
        ai::get_ai_provider_status,
        ai::set_ai_provider_executable,
        ai::run_ai_explanation,
        ai::cancel_ai_explanation,
        platform::open_url,
        platform::toggle_fullscreen_window,
        platform::exit_fullscreen_window,
    ])
}
