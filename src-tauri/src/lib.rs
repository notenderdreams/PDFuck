use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone)]
pub struct OpenFileResult {
    pub file_name: String,
    pub file_path: String,
    pub data: Vec<u8>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct OpenImageResult {
    pub file_name: String,
    pub file_path: String,
    pub data_url: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SaveResult {
    pub success: bool,
    pub file_path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ScannedPdfResult {
    pub file_name: String,
    pub file_path: String,
    pub file_size: u64,
    pub modified_timestamp: u64,
    pub directory_path: String,
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

#[tauri::command]
fn select_directory_dialog() -> Option<String> {
    let folder = rfd::FileDialog::new()
        .set_title("Select Directory to Add to PDF Library")
        .pick_folder()?;
    Some(folder.to_string_lossy().to_string())
}

#[tauri::command]
fn scan_directory_pdfs(directory_path: String) -> Vec<ScannedPdfResult> {
    let mut results = Vec::new();
    let root = Path::new(&directory_path);
    if !root.exists() || !root.is_dir() {
        return results;
    }

    fn scan_dir(dir: &Path, base_dir: &str, results: &mut Vec<ScannedPdfResult>, depth: usize) {
        if depth > 4 {
            return;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(ext) = path.extension() {
                        if ext.to_string_lossy().to_lowercase() == "pdf" {
                            let file_name = path
                                .file_name()
                                .map(|n| n.to_string_lossy().to_string())
                                .unwrap_or_else(|| "document.pdf".to_string());
                            let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                            let modified_timestamp = entry
                                .metadata()
                                .and_then(|m| m.modified())
                                .ok()
                                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                                .map(|d| d.as_millis() as u64)
                                .unwrap_or(0);

                            results.push(ScannedPdfResult {
                                file_name,
                                file_path: path.to_string_lossy().to_string(),
                                file_size,
                                modified_timestamp,
                                directory_path: base_dir.to_string(),
                            });
                        }
                    }
                } else if path.is_dir() {
                    let dir_name = path
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    if !dir_name.starts_with('.') && dir_name != "node_modules" && dir_name != "target" {
                        scan_dir(&path, base_dir, results, depth + 1);
                    }
                }
            }
        }
    }

    scan_dir(root, &directory_path, &mut results, 0);
    results
}

#[tauri::command]
fn get_default_directories() -> Vec<String> {
    let mut dirs = Vec::new();
    if let Some(home) = dirs_home() {
        let docs = home.join("Documents");
        if docs.exists() && docs.is_dir() {
            dirs.push(docs.to_string_lossy().to_string());
        }
        let downloads = home.join("Downloads");
        if downloads.exists() && downloads.is_dir() {
            dirs.push(downloads.to_string_lossy().to_string());
        }
    }
    dirs
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

#[tauri::command]
fn copy_image_to_clipboard(png_data_url: String) -> bool {
    let b64 = if let Some(idx) = png_data_url.find(',') {
        &png_data_url[idx + 1..]
    } else {
        &png_data_url
    };

    let bytes = match base64::engine::general_purpose::STANDARD.decode(b64) {
        Ok(b) => b,
        Err(_) => return false,
    };

    let img = match image::load_from_memory(&bytes) {
        Ok(i) => i.to_rgba8(),
        Err(_) => return false,
    };

    let (width, height) = img.dimensions();
    let img_data = arboard::ImageData {
        width: width as usize,
        height: height as usize,
        bytes: img.into_raw().into(),
    };

    let mut clipboard = match arboard::Clipboard::new() {
        Ok(c) => c,
        Err(_) => return false,
    };

    clipboard.set_image(img_data).is_ok()
}

#[tauri::command]
fn copy_text_to_clipboard(text: String) -> bool {
    let mut clipboard = match arboard::Clipboard::new() {
        Ok(c) => c,
        Err(_) => return false,
    };
    clipboard.set_text(text).is_ok()
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
            select_directory_dialog,
            scan_directory_pdfs,
            get_default_directories,
            copy_image_to_clipboard,
            copy_text_to_clipboard,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
