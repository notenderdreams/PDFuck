use super::error::{command_error, CommandResult};
use crate::library::{LegacyLibraryDocument, LibraryDocument, LibrarySnapshot, LibraryState};

#[tauri::command]
#[specta::specta]
pub fn list_library(state: tauri::State<'_, LibraryState>) -> CommandResult<LibrarySnapshot> {
    state.snapshot().map_err(command_error)
}

#[tauri::command]
#[specta::specta]
pub fn import_library_pdf_dialog(
    state: tauri::State<'_, LibraryState>,
) -> CommandResult<Option<LibraryDocument>> {
    let Some(path) = rfd::FileDialog::new()
        .add_filter("PDF Document", &["pdf"])
        .set_title("Import PDF into Library")
        .pick_file()
    else {
        return Ok(None);
    };
    state.import_file(&path).map(Some).map_err(command_error)
}

#[tauri::command]
#[specta::specta]
pub async fn import_library_folder_dialog(
    state: tauri::State<'_, LibraryState>,
) -> CommandResult<Option<LibrarySnapshot>> {
    let Some(path) = rfd::FileDialog::new()
        .set_title("Import PDF Folder into Library")
        .pick_folder()
    else {
        return Ok(None);
    };
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.import_folder(&path))
        .await
        .map_err(|error| format!("library folder task failed: {error}"))?
        .map(Some)
        .map_err(command_error)
}

#[tauri::command]
#[specta::specta]
pub async fn refresh_library(
    state: tauri::State<'_, LibraryState>,
) -> CommandResult<LibrarySnapshot> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.refresh())
        .await
        .map_err(|error| format!("library refresh task failed: {error}"))?
        .map_err(command_error)
}

#[tauri::command]
#[specta::specta]
pub fn remove_library_folder(
    folder_id: String,
    keep_documents: bool,
    state: tauri::State<'_, LibraryState>,
) -> CommandResult<LibrarySnapshot> {
    state
        .remove_folder(&folder_id, keep_documents)
        .map_err(command_error)
}

#[tauri::command]
#[specta::specta]
pub fn remove_library_document(
    document_id: String,
    state: tauri::State<'_, LibraryState>,
) -> CommandResult<()> {
    state.remove_document(&document_id).map_err(command_error)
}

#[tauri::command]
#[specta::specta]
pub fn set_library_favorite(
    document_id: String,
    favorite: bool,
    state: tauri::State<'_, LibraryState>,
) -> CommandResult<()> {
    state
        .set_favorite(&document_id, favorite)
        .map_err(command_error)
}

#[tauri::command]
#[specta::specta]
pub fn touch_library_document(
    document_id: String,
    last_read_page: Option<u32>,
    annotation_count: Option<u32>,
    state: tauri::State<'_, LibraryState>,
) -> CommandResult<()> {
    state
        .touch_document(&document_id, last_read_page, annotation_count)
        .map_err(command_error)
}

#[tauri::command]
#[specta::specta]
pub fn update_library_document_state(
    document_id: String,
    last_read_page: u32,
    annotation_count: u32,
    state: tauri::State<'_, LibraryState>,
) -> CommandResult<()> {
    state
        .update_document_state(&document_id, last_read_page, annotation_count)
        .map_err(command_error)
}

#[tauri::command]
#[specta::specta]
pub fn migrate_legacy_library(
    folders: Vec<String>,
    documents: Vec<LegacyLibraryDocument>,
    state: tauri::State<'_, LibraryState>,
) -> CommandResult<LibrarySnapshot> {
    state
        .migrate_legacy(folders, documents)
        .map_err(command_error)
}

#[tauri::command]
#[specta::specta]
pub fn relink_library_document(
    document_id: String,
    state: tauri::State<'_, LibraryState>,
) -> CommandResult<Option<LibraryDocument>> {
    let Some(path) = rfd::FileDialog::new()
        .add_filter("PDF Document", &["pdf"])
        .set_title("Locate Missing PDF")
        .pick_file()
    else {
        return Ok(None);
    };
    state
        .relink_document(&document_id, &path)
        .map(Some)
        .map_err(command_error)
}
