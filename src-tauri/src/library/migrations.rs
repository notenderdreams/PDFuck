use rusqlite_migration::{Migrations, M};

pub(super) fn migrations() -> Migrations<'static> {
    Migrations::new(vec![M::up(
        "CREATE TABLE library_folders (
            id TEXT PRIMARY KEY NOT NULL,
            path TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            imported_at INTEGER NOT NULL,
            last_scanned_at INTEGER
        );
        CREATE TABLE library_documents (
            id TEXT PRIMARY KEY NOT NULL,
            file_path TEXT NOT NULL UNIQUE,
            file_name TEXT NOT NULL,
            file_size INTEGER NOT NULL DEFAULT 0,
            modified_at INTEGER NOT NULL DEFAULT 0,
            imported_at INTEGER NOT NULL,
            last_opened_at INTEGER,
            last_read_page INTEGER,
            annotation_count INTEGER,
            num_pages INTEGER,
            favorite INTEGER NOT NULL DEFAULT 0,
            availability TEXT NOT NULL DEFAULT 'available',
            source_type TEXT NOT NULL DEFAULT 'file',
            folder_id TEXT REFERENCES library_folders(id) ON DELETE SET NULL
        );
        CREATE TABLE library_document_folders (
            document_id TEXT NOT NULL REFERENCES library_documents(id) ON DELETE CASCADE,
            folder_id TEXT NOT NULL REFERENCES library_folders(id) ON DELETE CASCADE,
            PRIMARY KEY (document_id, folder_id)
        );
        CREATE INDEX library_documents_folder_idx ON library_documents(folder_id);
        CREATE INDEX library_documents_recent_idx ON library_documents(last_opened_at DESC);
        CREATE TABLE library_metadata (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
        );",
    )])
}
