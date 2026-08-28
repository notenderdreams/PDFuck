use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LibraryFolder {
    pub id: String,
    pub path: String,
    pub name: String,
    #[specta(type = f64)]
    pub imported_at: u64,
    #[specta(type = f64)]
    pub last_scanned_at: Option<u64>,
    pub pdf_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum LibraryAvailability {
    Available,
    Missing,
    Changed,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum LibrarySource {
    File,
    Folder,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LibraryDocument {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    #[specta(type = f64)]
    pub file_size: u64,
    #[specta(type = f64)]
    pub modified_at: u64,
    #[specta(type = f64)]
    pub imported_at: u64,
    #[specta(type = f64)]
    pub last_opened_at: Option<u64>,
    pub last_read_page: Option<u32>,
    pub annotation_count: Option<u32>,
    pub num_pages: Option<u32>,
    pub favorite: bool,
    pub availability: LibraryAvailability,
    pub source_type: LibrarySource,
    pub folder_id: Option<String>,
    pub folder_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySnapshot {
    pub folders: Vec<LibraryFolder>,
    pub documents: Vec<LibraryDocument>,
}
