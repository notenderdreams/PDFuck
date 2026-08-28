use anyhow::{Context, Result};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const MAX_SCAN_DEPTH: usize = 16;
const MAX_SCAN_FILES: usize = 10_000;

pub(super) struct PdfMetadata {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub modified: u64,
    pub pages: Option<u32>,
}

pub(super) fn pdf_metadata(path: &Path) -> Result<PdfMetadata> {
    let canonical = canonical_path(path)?;
    if !is_pdf(&canonical) {
        anyhow::bail!("selected file is not a PDF");
    }
    let metadata = fs::metadata(&canonical)
        .with_context(|| format!("failed to read metadata for {}", canonical.display()))?;
    Ok(PdfMetadata {
        path: canonical.to_string_lossy().into_owned(),
        name: file_name(&canonical, "document.pdf"),
        size: metadata.len(),
        modified: modified_ms(&metadata),
        pages: lopdf::Document::load_metadata(&canonical)
            .ok()
            .map(|value| value.page_count),
    })
}

pub(super) fn canonical_path(path: &Path) -> Result<PathBuf> {
    fs::canonicalize(path).with_context(|| format!("path is not available: {}", path.display()))
}

pub(super) fn scan_pdfs(directory: &Path, results: &mut Vec<PathBuf>, depth: usize) {
    if depth > MAX_SCAN_DEPTH || results.len() >= MAX_SCAN_FILES {
        return;
    }
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };
    for entry in entries.flatten() {
        if results.len() >= MAX_SCAN_FILES {
            break;
        }
        let path = entry.path();
        if path.is_dir() {
            let name = file_name(&path, "");
            if !name.starts_with('.') && name != "node_modules" && name != "target" {
                scan_pdfs(&path, results, depth + 1);
            }
        } else if is_pdf(&path) {
            results.push(path);
        }
    }
}

pub(super) fn file_name(path: &Path, fallback: &str) -> String {
    path.file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| fallback.into())
}

pub(super) fn modified_ms(metadata: &fs::Metadata) -> u64 {
    metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_millis() as u64)
        .unwrap_or(0)
}

fn is_pdf(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("pdf"))
}

pub(super) fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
