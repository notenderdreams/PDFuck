use anyhow::{Context, Result};
use base64::Engine;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::UNIX_EPOCH;

static IS_PDF_DIALOG_OPEN: AtomicBool = AtomicBool::new(false);
static IS_IMAGE_DIALOG_OPEN: AtomicBool = AtomicBool::new(false);
static IS_SAVE_PDF_DIALOG_OPEN: AtomicBool = AtomicBool::new(false);
static IS_SAVE_JSON_DIALOG_OPEN: AtomicBool = AtomicBool::new(false);
static IS_JSON_DIALOG_OPEN: AtomicBool = AtomicBool::new(false);
static IS_DIRECTORY_DIALOG_OPEN: AtomicBool = AtomicBool::new(false);

struct DialogGuard<'a>(&'a AtomicBool);

impl<'a> DialogGuard<'a> {
    fn try_acquire(flag: &'a AtomicBool) -> Option<Self> {
        if flag.swap(true, Ordering::SeqCst) {
            None
        } else {
            Some(Self(flag))
        }
    }
}

impl<'a> Drop for DialogGuard<'a> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

const MAX_SCAN_DEPTH: usize = 4;

#[derive(Serialize, Deserialize, Clone, Type)]
pub struct OpenFileResult {
    pub file_name: String,
    pub file_path: String,
    pub data: Vec<u8>,
}

#[derive(Serialize, Deserialize, Clone, Type)]
pub struct OpenImageResult {
    pub file_name: String,
    pub file_path: String,
    pub data_url: String,
}

#[derive(Serialize, Deserialize, Clone, Type)]
pub struct SaveResult {
    pub success: bool,
    pub file_path: Option<String>,
}

impl SaveResult {
    fn failed() -> Self {
        Self {
            success: false,
            file_path: None,
        }
    }

    fn saved(path: &Path) -> Self {
        Self {
            success: true,
            file_path: Some(path.to_string_lossy().into_owned()),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Type)]
pub struct ScannedPdfResult {
    pub file_name: String,
    pub file_path: String,
    #[specta(type = f64)]
    pub file_size: u64,
    #[specta(type = f64)]
    pub modified_timestamp: u64,
    pub directory_path: String,
    pub num_pages: Option<u32>,
}

#[tauri::command]
#[specta::specta]
pub fn open_pdf_dialog() -> Option<OpenFileResult> {
    let _guard = DialogGuard::try_acquire(&IS_PDF_DIALOG_OPEN)?;
    let file = rfd::FileDialog::new()
        .add_filter("PDF Document", &["pdf"])
        .set_title("Open PDF Document")
        .pick_file()?;
    read_file(&file).map_err(log_error).ok()
}

#[tauri::command]
#[specta::specta]
pub fn open_image_dialog() -> Option<OpenImageResult> {
    let _guard = DialogGuard::try_acquire(&IS_IMAGE_DIALOG_OPEN)?;
    let file = rfd::FileDialog::new()
        .add_filter(
            "Images",
            &["png", "jpg", "jpeg", "webp", "svg", "gif", "bmp"],
        )
        .set_title("Select Image to Attach")
        .pick_file()?;
    let bytes = fs::read(&file)
        .with_context(|| format!("failed to read image {}", file.display()))
        .map_err(log_error)
        .ok()?;
    let mime_type = image_mime_type(&file);
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);

    Some(OpenImageResult {
        file_name: file_name(&file, "image.png"),
        file_path: file.to_string_lossy().into_owned(),
        data_url: format!("data:{mime_type};base64,{encoded}"),
    })
}

#[tauri::command]
#[specta::specta]
pub fn save_pdf_dialog(data: Vec<u8>, default_name: Option<String>) -> SaveResult {
    let _guard = match DialogGuard::try_acquire(&IS_SAVE_PDF_DIALOG_OPEN) {
        Some(guard) => guard,
        None => return SaveResult::failed(),
    };
    let path = rfd::FileDialog::new()
        .add_filter("PDF Document", &["pdf"])
        .set_title("Save PDF Document")
        .set_file_name(default_name.as_deref().unwrap_or("annotated_document.pdf"))
        .save_file();
    save_to_selected_path(path, &data)
}

#[tauri::command]
#[specta::specta]
pub fn write_pdf_file(file_path: String, data: Vec<u8>) -> SaveResult {
    let path = PathBuf::from(&file_path);
    let is_pdf = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("pdf"));

    if !is_pdf || !path.is_file() {
        return SaveResult::failed();
    }
    save_file(&path, &data)
}

#[tauri::command]
#[specta::specta]
pub fn save_json_dialog(json_string: String, default_name: Option<String>) -> SaveResult {
    let _guard = match DialogGuard::try_acquire(&IS_SAVE_JSON_DIALOG_OPEN) {
        Some(guard) => guard,
        None => return SaveResult::failed(),
    };
    let path = rfd::FileDialog::new()
        .add_filter("Annotations", &["json"])
        .set_title("Save Annotations")
        .set_file_name(default_name.as_deref().unwrap_or("annotations.json"))
        .save_file();
    save_to_selected_path(path, json_string.as_bytes())
}

#[tauri::command]
#[specta::specta]
pub fn open_json_dialog() -> Option<OpenFileResult> {
    let _guard = DialogGuard::try_acquire(&IS_JSON_DIALOG_OPEN)?;
    let file = rfd::FileDialog::new()
        .add_filter("Annotations", &["json"])
        .set_title("Import Annotations")
        .pick_file()?;
    read_file(&file).map_err(log_error).ok()
}

#[tauri::command]
#[specta::specta]
pub fn read_file_from_path(file_path: String) -> Option<OpenFileResult> {
    read_file(Path::new(&file_path)).map_err(log_error).ok()
}

#[tauri::command]
#[specta::specta]
pub fn select_directory_dialog() -> Option<String> {
    let _guard = DialogGuard::try_acquire(&IS_DIRECTORY_DIALOG_OPEN)?;
    rfd::FileDialog::new()
        .set_title("Select Directory to Add to PDF Library")
        .pick_folder()
        .map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
#[specta::specta]
pub async fn scan_directory_pdfs(directory_path: String) -> Vec<ScannedPdfResult> {
    match tauri::async_runtime::spawn_blocking(move || scan_directory(&directory_path)).await {
        Ok(results) => results,
        Err(error) => {
            log::error!("directory scan task failed: {error}");
            Vec::new()
        }
    }
}

fn read_file(path: &Path) -> Result<OpenFileResult> {
    Ok(OpenFileResult {
        file_name: file_name(path, "document.pdf"),
        file_path: path.to_string_lossy().into_owned(),
        data: fs::read(path).with_context(|| format!("failed to read PDF {}", path.display()))?,
    })
}

fn save_to_selected_path(path: Option<PathBuf>, data: &[u8]) -> SaveResult {
    let Some(path) = path else {
        return SaveResult::failed();
    };
    save_file(&path, data)
}

fn save_file(path: &Path, data: &[u8]) -> SaveResult {
    match fs::write(path, data).with_context(|| format!("failed to save {}", path.display())) {
        Ok(()) => SaveResult::saved(path),
        Err(error) => {
            log_error(error);
            SaveResult::failed()
        }
    }
}

fn log_error(error: anyhow::Error) {
    log::error!("{error:#}");
}

fn image_mime_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("svg") => "image/svg+xml",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("bmp") => "image/bmp",
        _ => "image/png",
    }
}

fn file_name(path: &Path, fallback: &str) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| fallback.to_string())
}

fn pdf_page_count(path: &Path) -> Option<u32> {
    lopdf::Document::load_metadata(path)
        .ok()
        .map(|metadata| metadata.page_count)
}

fn scan_directory(directory_path: &str) -> Vec<ScannedPdfResult> {
    let root = Path::new(directory_path);
    if !root.is_dir() {
        return Vec::new();
    }
    let mut results = Vec::new();
    scan_directory_at(root, directory_path, &mut results, 0);
    results
}

fn scan_directory_at(
    directory: &Path,
    base_directory: &str,
    results: &mut Vec<ScannedPdfResult>,
    depth: usize,
) {
    if depth > MAX_SCAN_DEPTH {
        return;
    }
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = file_name(&path, "");
            if !name.starts_with('.') && name != "node_modules" && name != "target" {
                scan_directory_at(&path, base_directory, results, depth + 1);
            }
            continue;
        }
        if !is_pdf(&path) {
            continue;
        }

        let metadata = entry.metadata().ok();
        let file_size = metadata.as_ref().map(|value| value.len()).unwrap_or(0);
        let modified_timestamp = metadata
            .and_then(|value| value.modified().ok())
            .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
            .map(|value| value.as_millis() as u64)
            .unwrap_or(0);
        results.push(ScannedPdfResult {
            file_name: file_name(&path, "document.pdf"),
            file_path: path.to_string_lossy().into_owned(),
            file_size,
            modified_timestamp,
            directory_path: base_directory.to_string(),
            num_pages: pdf_page_count(&path),
        });
    }
}

fn is_pdf(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("pdf"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::{dictionary, Document, Object};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_path(name: &str, extension: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "pdfuck-{name}-{}-{}.{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos(),
            extension
        ))
    }

    #[test]
    fn page_changes_are_written_to_the_source_file() {
        let path = temporary_path("page-persistence-test", "pdf");
        fs::write(&path, b"original pdf bytes").unwrap();

        let result = write_pdf_file(
            path.to_string_lossy().into_owned(),
            b"pdf bytes after page deletion".to_vec(),
        );

        assert!(result.success);
        assert_eq!(fs::read(&path).unwrap(), b"pdf bytes after page deletion");
        let _ = fs::remove_file(path);
    }

    #[test]
    fn page_count_comes_from_pdf_metadata() {
        let path = temporary_path("metadata-test", "pdf");
        let mut document = Document::with_version("1.5");
        let pages_id = document.new_object_id();
        let page_ids = (0..3)
            .map(|_| {
                document.add_object(dictionary! {
                    "Type" => "Page",
                    "Parent" => pages_id,
                    "MediaBox" => vec![0.into(), 0.into(), 100.into(), 100.into()],
                })
            })
            .collect::<Vec<_>>();
        document.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => page_ids.iter().copied().map(Object::Reference).collect::<Vec<_>>(),
                "Count" => 3,
            }),
        );
        let catalog_id = document.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        document.trailer.set("Root", catalog_id);
        document.save(&path).unwrap();

        assert_eq!(pdf_page_count(&path), Some(3));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn scanner_skips_non_pdf_files() {
        let directory = temporary_path("scan-test", "dir");
        fs::create_dir(&directory).unwrap();
        fs::write(directory.join("notes.txt"), b"not a pdf").unwrap();

        assert!(scan_directory(&directory.to_string_lossy()).is_empty());
        let _ = fs::remove_dir_all(directory);
    }
}
