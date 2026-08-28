use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use uuid::Uuid;

mod migrations;
mod models;
mod scanner;
#[cfg(test)]
mod tests;
use migrations::migrations;
use models::{LibraryAvailability, LibraryFolder, LibrarySource};
pub use models::{LibraryDocument, LibrarySnapshot};
use scanner::{
    canonical_path, file_name, modified_ms, now_ms, pdf_metadata, scan_pdfs, PdfMetadata,
};

#[derive(Clone)]
pub struct LibraryState(Arc<Mutex<Connection>>);

impl LibraryState {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).with_context(|| {
                format!("failed to create library directory {}", parent.display())
            })?;
        }
        let mut connection = Connection::open(path)
            .with_context(|| format!("failed to open library database {}", path.display()))?;
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        if let Err(err) = migrations().to_latest(&mut connection) {
            eprintln!(
                "Failed to apply migrations ({err}), recreating library database at {}",
                path.display()
            );
            drop(connection);
            let _ = fs::remove_file(path);
            let _ = fs::remove_file(format!("{}-wal", path.display()));
            let _ = fs::remove_file(format!("{}-shm", path.display()));
            let mut fresh_connection = Connection::open(path).with_context(|| {
                format!(
                    "failed to open recreated library database {}",
                    path.display()
                )
            })?;
            fresh_connection.busy_timeout(std::time::Duration::from_secs(5))?;
            fresh_connection.pragma_update(None, "foreign_keys", "ON")?;
            fresh_connection.pragma_update(None, "journal_mode", "WAL")?;
            migrations().to_latest(&mut fresh_connection)?;
            return Ok(Self(Arc::new(Mutex::new(fresh_connection))));
        }
        Ok(Self(Arc::new(Mutex::new(connection))))
    }

    fn connection(&self) -> Result<std::sync::MutexGuard<'_, Connection>> {
        self.0
            .lock()
            .map_err(|_| anyhow::anyhow!("library database lock was poisoned"))
    }

    pub fn snapshot(&self) -> Result<LibrarySnapshot> {
        let connection = self.connection()?;
        snapshot(&connection)
    }

    pub fn import_file(&self, path: &Path) -> Result<LibraryDocument> {
        let metadata = pdf_metadata(path)?;
        let now = now_ms();
        let connection = self.connection()?;
        upsert_document(&connection, &metadata, None, now)?;
        document_by_path(&connection, &metadata.path)?.context("imported PDF was not found")
    }

    pub fn import_folder(&self, path: &Path) -> Result<LibrarySnapshot> {
        let canonical = canonical_path(path)?;
        if !canonical.is_dir() {
            anyhow::bail!("selected folder is not available");
        }
        let folder_path = canonical.to_string_lossy().into_owned();
        let folder_name = file_name(&canonical, "Folder");
        let now = now_ms();
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let folder_id: String = transaction
            .query_row(
                "SELECT id FROM library_folders WHERE path = ?1",
                [&folder_path],
                |row| row.get(0),
            )
            .optional()?
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        transaction.execute(
            "INSERT INTO library_folders (id, path, name, imported_at, last_scanned_at)
             VALUES (?1, ?2, ?3, ?4, ?4)
             ON CONFLICT(path) DO UPDATE SET name = excluded.name, last_scanned_at = excluded.last_scanned_at",
            params![folder_id, folder_path, folder_name, now],
        )?;
        reconcile_folder(&transaction, &folder_id, &canonical, now)?;
        transaction.commit()?;
        snapshot(&connection)
    }

    pub fn refresh(&self) -> Result<LibrarySnapshot> {
        let mut connection = self.connection()?;
        let folders = {
            let mut statement = connection.prepare("SELECT id, path FROM library_folders")?;
            let rows = statement
                .query_map([], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            rows
        };
        let now = now_ms();
        let transaction = connection.transaction()?;
        transaction.execute(
            "UPDATE library_documents SET availability = 'missing'
             WHERE id IN (SELECT document_id FROM library_document_folders)",
            [],
        )?;
        for (id, path) in folders {
            let root = PathBuf::from(path);
            if root.is_dir() {
                reconcile_folder(&transaction, &id, &root, now)?;
                transaction.execute(
                    "UPDATE library_folders SET last_scanned_at = ?1 WHERE id = ?2",
                    params![now, id],
                )?;
            }
        }
        // Standalone documents need an explicit filesystem check.
        let standalone = {
            let mut statement = transaction.prepare(
                "SELECT id, file_path, file_size, modified_at FROM library_documents WHERE source_type = 'file'",
            )?;
            let rows = statement
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, u64>(2)?,
                        row.get::<_, u64>(3)?,
                    ))
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            rows
        };
        for (id, path, old_size, old_modified) in standalone {
            let availability = match fs::metadata(&path) {
                Ok(metadata) => {
                    let size = metadata.len();
                    let modified = modified_ms(&metadata);
                    if size != old_size || modified != old_modified {
                        "changed"
                    } else {
                        "available"
                    }
                }
                Err(_) => "missing",
            };
            transaction.execute(
                "UPDATE library_documents SET availability = ?1 WHERE id = ?2",
                params![availability, id],
            )?;
        }
        transaction.commit()?;
        snapshot(&connection)
    }

    pub fn remove_folder(&self, folder_id: &str, keep_documents: bool) -> Result<LibrarySnapshot> {
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        if !keep_documents {
            transaction.execute(
                "DELETE FROM library_documents
                 WHERE id IN (SELECT document_id FROM library_document_folders WHERE folder_id = ?1)
                   AND id NOT IN (SELECT document_id FROM library_document_folders WHERE folder_id != ?1)",
                [folder_id],
            )?;
        }
        transaction.execute("DELETE FROM library_folders WHERE id = ?1", [folder_id])?;
        transaction.execute(
            "UPDATE library_documents SET source_type = 'file', folder_id = NULL
             WHERE id NOT IN (SELECT document_id FROM library_document_folders)",
            [],
        )?;
        transaction.execute(
            "UPDATE library_documents SET folder_id = (
                SELECT folder_id FROM library_document_folders WHERE document_id = library_documents.id LIMIT 1
             ) WHERE id IN (SELECT document_id FROM library_document_folders)",
            [],
        )?;
        transaction.commit()?;
        snapshot(&connection)
    }

    pub fn remove_document(&self, document_id: &str) -> Result<()> {
        self.connection()?
            .execute("DELETE FROM library_documents WHERE id = ?1", [document_id])?;
        Ok(())
    }

    pub fn relink_document(&self, document_id: &str, path: &Path) -> Result<LibraryDocument> {
        let metadata = pdf_metadata(path)?;
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let conflicting_id: Option<String> = transaction
            .query_row(
                "SELECT id FROM library_documents WHERE file_path = ?1 AND id != ?2",
                params![metadata.path, document_id],
                |row| row.get(0),
            )
            .optional()?;
        if let Some(conflicting_id) = conflicting_id {
            anyhow::bail!("that PDF is already tracked as document {conflicting_id}");
        }
        let changed = transaction.execute(
            "UPDATE library_documents SET file_path = ?1, file_name = ?2, file_size = ?3,
                    modified_at = ?4, num_pages = ?5, availability = 'available'
             WHERE id = ?6",
            params![
                metadata.path,
                metadata.name,
                metadata.size,
                metadata.modified,
                metadata.pages,
                document_id
            ],
        )?;
        if changed == 0 {
            anyhow::bail!("library document no longer exists");
        }
        transaction.commit()?;
        document_by_path(&connection, &metadata.path)?.context("relinked PDF was not found")
    }

    pub fn set_favorite(&self, document_id: &str, favorite: bool) -> Result<()> {
        self.connection()?.execute(
            "UPDATE library_documents SET favorite = ?1 WHERE id = ?2",
            params![favorite, document_id],
        )?;
        Ok(())
    }

    pub fn touch_document(
        &self,
        document_id: &str,
        last_read_page: Option<u32>,
        annotation_count: Option<u32>,
    ) -> Result<()> {
        self.connection()?.execute(
            "UPDATE library_documents SET last_opened_at = ?1,
                last_read_page = COALESCE(?2, last_read_page),
                annotation_count = COALESCE(?3, annotation_count)
             WHERE id = ?4",
            params![now_ms(), last_read_page, annotation_count, document_id],
        )?;
        Ok(())
    }

    pub fn update_document_state(
        &self,
        document_id: &str,
        last_read_page: u32,
        annotation_count: u32,
    ) -> Result<()> {
        self.connection()?.execute(
            "UPDATE library_documents SET last_read_page = ?1, annotation_count = ?2 WHERE id = ?3",
            params![last_read_page, annotation_count, document_id],
        )?;
        Ok(())
    }
}

fn reconcile_folder(
    transaction: &Transaction<'_>,
    folder_id: &str,
    root: &Path,
    now: u64,
) -> Result<()> {
    let mut files = Vec::new();
    scan_pdfs(root, &mut files, 0);
    for path in files {
        if let Ok(metadata) = pdf_metadata(&path) {
            upsert_document(transaction, &metadata, Some(folder_id), now)?;
        }
    }
    Ok(())
}

fn upsert_document(
    connection: &Connection,
    pdf: &PdfMetadata,
    folder_id: Option<&str>,
    now: u64,
) -> Result<()> {
    let id = Uuid::new_v4().to_string();
    connection.execute(
        "INSERT INTO library_documents
         (id, file_path, file_name, file_size, modified_at, imported_at, num_pages, availability, source_type, folder_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'available', ?8, ?9)
         ON CONFLICT(file_path) DO UPDATE SET
           file_name = excluded.file_name, file_size = excluded.file_size,
           modified_at = excluded.modified_at, num_pages = COALESCE(excluded.num_pages, library_documents.num_pages),
           availability = CASE
             WHEN library_documents.file_size != excluded.file_size OR library_documents.modified_at != excluded.modified_at THEN 'changed'
             ELSE 'available'
           END,
           source_type = CASE WHEN excluded.folder_id IS NULL THEN library_documents.source_type ELSE 'folder' END,
           folder_id = COALESCE(excluded.folder_id, library_documents.folder_id)",
        params![id, pdf.path, pdf.name, pdf.size, pdf.modified, now, pdf.pages, if folder_id.is_some() { "folder" } else { "file" }, folder_id],
    )?;
    if let Some(folder_id) = folder_id {
        connection.execute(
            "INSERT OR IGNORE INTO library_document_folders (document_id, folder_id)
             SELECT id, ?1 FROM library_documents WHERE file_path = ?2",
            params![folder_id, pdf.path],
        )?;
    }
    Ok(())
}

fn snapshot(connection: &Connection) -> Result<LibrarySnapshot> {
    let documents = {
        let mut statement = connection.prepare(
            "SELECT d.id, d.file_path, d.file_name, d.file_size, d.modified_at, d.imported_at,
                    d.last_opened_at, d.last_read_page, d.annotation_count, d.num_pages, d.favorite,
                    d.availability, d.source_type, d.folder_id,
                    GROUP_CONCAT(s.folder_id, char(31))
             FROM library_documents d
             LEFT JOIN library_document_folders s ON s.document_id = d.id
             GROUP BY d.id ORDER BY d.imported_at DESC",
        )?;
        let rows = statement
            .query_map([], document_from_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows
    };
    let folders = {
        let mut statement = connection.prepare(
            "SELECT f.id, f.path, f.name, f.imported_at, f.last_scanned_at, COUNT(d.id)
             FROM library_folders f LEFT JOIN library_document_folders s ON s.folder_id = f.id
             LEFT JOIN library_documents d ON d.id = s.document_id
             GROUP BY f.id ORDER BY f.imported_at",
        )?;
        let rows = statement
            .query_map([], |row| {
                Ok(LibraryFolder {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    name: row.get(2)?,
                    imported_at: row.get(3)?,
                    last_scanned_at: row.get(4)?,
                    pdf_count: row.get(5)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows
    };
    Ok(LibrarySnapshot { folders, documents })
}

fn document_by_path(connection: &Connection, path: &str) -> Result<Option<LibraryDocument>> {
    connection
        .query_row(
            "SELECT d.id, d.file_path, d.file_name, d.file_size, d.modified_at, d.imported_at,
                d.last_opened_at, d.last_read_page, d.annotation_count, d.num_pages, d.favorite,
                d.availability, d.source_type, d.folder_id, GROUP_CONCAT(s.folder_id, char(31))
             FROM library_documents d LEFT JOIN library_document_folders s ON s.document_id = d.id
             WHERE d.file_path = ?1 GROUP BY d.id",
            [path],
            document_from_row,
        )
        .optional()
        .map_err(Into::into)
}

fn document_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<LibraryDocument> {
    Ok(LibraryDocument {
        id: row.get(0)?,
        file_path: row.get(1)?,
        file_name: row.get(2)?,
        file_size: row.get(3)?,
        modified_at: row.get(4)?,
        imported_at: row.get(5)?,
        last_opened_at: row.get(6)?,
        last_read_page: row.get(7)?,
        annotation_count: row.get(8)?,
        num_pages: row.get(9)?,
        favorite: row.get(10)?,
        availability: match row.get::<_, String>(11)?.as_str() {
            "missing" => LibraryAvailability::Missing,
            "changed" => LibraryAvailability::Changed,
            _ => LibraryAvailability::Available,
        },
        source_type: match row.get::<_, String>(12)?.as_str() {
            "folder" => LibrarySource::Folder,
            _ => LibrarySource::File,
        },
        folder_id: row.get(13)?,
        folder_ids: row
            .get::<_, Option<String>>(14)?
            .map(|value| value.split('\u{1f}').map(str::to_owned).collect())
            .unwrap_or_default(),
    })
}
