use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize)]
pub struct OpenFileResult {
    pub file_name: String,
    pub file_path: String,
    pub data: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
pub struct OpenImageResult {
    pub file_name: String,
    pub file_path: String,
    pub data_url: String,
}

#[derive(Serialize, Deserialize)]
pub struct SaveResult {
    pub success: bool,
    pub file_path: Option<String>,
}

#[tauri::command]
fn open_pdf_dialog() -> Option<OpenFileResult> {
    let file = rfd::FileDialog::new()
        .add_filter("PDF Document", &["pdf"])
        .set_title("Open PDF Document")
        .pick_file()?;

    let data = fs::read(&file).ok()?;
    let file_name = file
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "document.pdf".to_string());
    let file_path = file.to_string_lossy().to_string();

    Some(OpenFileResult {
        file_name,
        file_path,
        data,
    })
}

#[tauri::command]
fn open_image_dialog() -> Option<OpenImageResult> {
    let file = rfd::FileDialog::new()
        .add_filter(
            "Images",
            &["png", "jpg", "jpeg", "webp", "svg", "gif", "bmp"],
        )
        .set_title("Select Image to Attach")
        .pick_file()?;

    let bytes = fs::read(&file).ok()?;
    let ext = file
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_else(|| "png".to_string());

    let mime_type = match ext.as_str() {
        "svg" => "image/svg+xml",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/png",
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let data_url = format!("data:{};base64,{}", mime_type, b64);

    let file_name = file
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "image.png".to_string());
    let file_path = file.to_string_lossy().to_string();

    Some(OpenImageResult {
        file_name,
        file_path,
        data_url,
    })
}

#[tauri::command]
fn save_pdf_dialog(data: Vec<u8>, default_name: Option<String>) -> SaveResult {
    let mut dialog = rfd::FileDialog::new()
        .add_filter("PDF Document", &["pdf"])
        .set_title("Save PDF Document");

    let file_name = default_name.unwrap_or_else(|| "annotated_document.pdf".to_string());
    dialog = dialog.set_file_name(&file_name);

    if let Some(path) = dialog.save_file() {
        if fs::write(&path, &data).is_ok() {
            return SaveResult {
                success: true,
                file_path: Some(path.to_string_lossy().to_string()),
            };
        }
    }

    SaveResult {
        success: false,
        file_path: None,
    }
}

#[tauri::command]
fn save_json_dialog(json_string: String, default_name: Option<String>) -> SaveResult {
    let mut dialog = rfd::FileDialog::new()
        .add_filter("JSON File", &["json"])
        .set_title("Save Annotations Session");

    let file_name = default_name.unwrap_or_else(|| "annotations.json".to_string());
    dialog = dialog.set_file_name(&file_name);

    if let Some(path) = dialog.save_file() {
        if fs::write(&path, json_string.as_bytes()).is_ok() {
            return SaveResult {
                success: true,
                file_path: Some(path.to_string_lossy().to_string()),
            };
        }
    }

    SaveResult {
        success: false,
        file_path: None,
    }
}

#[tauri::command]
fn read_file_from_path(file_path: String) -> Option<OpenFileResult> {
    let path = Path::new(&file_path);
    let data = fs::read(path).ok()?;
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "document.pdf".to_string());

    Some(OpenFileResult {
        file_name,
        file_path,
        data,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_pdf_dialog,
            open_image_dialog,
            save_pdf_dialog,
            save_json_dialog,
            read_file_from_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
