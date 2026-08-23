import type { Annotation, DashboardPdfItem, SavedDirectory, ThemeSettings, ViewMode } from './types';

const STORAGE_KEYS = {
  THEME_SETTINGS: 'pdfuck_theme_settings',
  VIEW_MODE: 'pdfuck_view_mode',
  ZOOM_LEVEL: 'pdfuck_zoom_level',
  RECENT_DOCS: 'pdfuck_recent_docs',
  SAVED_DIRS: 'pdfuck_saved_directories',
  FAVORITES: 'pdfuck_favorite_doc_ids',
  PDF_PAGE_COUNTS: 'pdfuck_pdf_page_counts',
  ANNOTATIONS_PREFIX: 'pdfuck_annotations_',
  LAST_PAGE_PREFIX: 'pdfuck_last_page_',
};

interface PdfPageCountCacheEntry {
  modifiedTimestamp: number;
  numPages: number;
}

type PdfPageCountCache = Record<string, PdfPageCountCacheEntry>;

export function loadCachedPdfPageCount(filePath: string, modifiedTimestamp: number): number | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PDF_PAGE_COUNTS);
    const cache = raw ? (JSON.parse(raw) as PdfPageCountCache) : {};
    const entry = cache[filePath];
    return entry?.modifiedTimestamp === modifiedTimestamp ? entry.numPages : undefined;
  } catch {
    return undefined;
  }
}

export function cachePdfPageCount(filePath: string, modifiedTimestamp: number, numPages: number): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PDF_PAGE_COUNTS);
    const cache = raw ? (JSON.parse(raw) as PdfPageCountCache) : {};
    cache[filePath] = { modifiedTimestamp, numPages };
    localStorage.setItem(STORAGE_KEYS.PDF_PAGE_COUNTS, JSON.stringify(cache));
  } catch (error) {
    console.warn('Failed to cache PDF page count', error);
  }
}

// --- IndexedDB Engine for Large Annotation Payloads (Images, Stickers, Ink) ---
const IDB_NAME = 'pdfuck_database';
const IDB_VERSION = 1;
const IDB_STORE_ANNOTATIONS = 'annotations_store';

export interface StoredAnnotationRecord {
  annotations: Annotation[];
  updatedAt: number;
}

let lastAnnotationSaveTimestamp = 0;

const nextAnnotationSaveTimestamp = (): number => {
  lastAnnotationSaveTimestamp = Math.max(Date.now(), lastAnnotationSaveTimestamp + 1);
  return lastAnnotationSaveTimestamp;
};

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_ANNOTATIONS)) {
        db.createObjectStore(IDB_STORE_ANNOTATIONS, { keyPath: 'docKey' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbSaveAnnotations(
  docKey: string,
  annotations: Annotation[],
  updatedAt = nextAnnotationSaveTimestamp()
): Promise<boolean> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE_ANNOTATIONS, 'readwrite');
    const store = tx.objectStore(IDB_STORE_ANNOTATIONS);
    const existingRequest = store.get(docKey);
    existingRequest.onsuccess = () => {
      const existing = parseStoredAnnotationRecord(existingRequest.result);
      if (!existing || existing.updatedAt <= updatedAt) {
        store.put({ docKey, annotations, updatedAt });
      }
    };
    existingRequest.onerror = () => {
      store.put({ docKey, annotations, updatedAt });
    };

    return await new Promise<boolean>((resolve) => {
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

export async function idbLoadAnnotationRecord(docKey: string): Promise<StoredAnnotationRecord | null> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE_ANNOTATIONS, 'readonly');
    const store = tx.objectStore(IDB_STORE_ANNOTATIONS);
    const req = store.get(docKey);
    return await new Promise<StoredAnnotationRecord | null>((resolve) => {
      req.onsuccess = () => {
        db.close();
        resolve(parseStoredAnnotationRecord(req.result));
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

export async function idbLoadAnnotations(docKey: string): Promise<Annotation[] | null> {
  return (await idbLoadAnnotationRecord(docKey))?.annotations ?? null;
}

// --- Theme Settings Storage ---
export function saveThemeSettings(settings: ThemeSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save theme settings to localStorage', e);
  }
}

export function loadThemeSettings(): ThemeSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.THEME_SETTINGS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(STORAGE_KEYS.VIEW_MODE, mode);
  } catch (e) {
    console.warn('Failed to save view mode', e);
  }
}

export function loadViewMode(): ViewMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VIEW_MODE);
    if (raw === 'continuous' || raw === 'single' || raw === 'spread') {
      return raw;
    }
  } catch {}
  return 'continuous';
}

// --- Unified Annotations Auto-Save Engine ---

export function filterPersistableAnnotations(annotations: Annotation[]): Annotation[] {
  return annotations;
}

export function parseStoredAnnotationRecord(value: unknown): StoredAnnotationRecord | null {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) {
      return { annotations: filterPersistableAnnotations(parsed as Annotation[]), updatedAt: 0 };
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { annotations?: unknown }).annotations)
    ) {
      const record = parsed as { annotations: Annotation[]; updatedAt?: unknown };
      const updatedAt =
        typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
          ? record.updatedAt
          : 0;
      lastAnnotationSaveTimestamp = Math.max(lastAnnotationSaveTimestamp, updatedAt);
      return {
        annotations: filterPersistableAnnotations(record.annotations),
        updatedAt,
      };
    }
  } catch {}
  return null;
}

export function selectNewestAnnotationRecord(
  records: Array<StoredAnnotationRecord | null>
): StoredAnnotationRecord | null {
  return records.reduce<StoredAnnotationRecord | null>((newest, record) => {
    if (!record) return newest;
    if (!newest || record.updatedAt > newest.updatedAt) return record;
    return newest;
  }, null);
}

const annotationStorageKeys = (docKey: string, fallbackKeys: string[]): string[] =>
  [...new Set([docKey, ...fallbackKeys].filter(Boolean))];

export async function saveAnnotationsForDoc(
  docKey: string,
  annotations: Annotation[],
  fallbackKeys: string[] = []
): Promise<void> {
  const persistable = filterPersistableAnnotations(annotations);
  const updatedAt = nextAnnotationSaveTimestamp();
  const record: StoredAnnotationRecord = { annotations: persistable, updatedAt };
  const keys = annotationStorageKeys(docKey, fallbackKeys);
  let localSaveSucceeded = false;

  // 1. LocalStorage for fast instant access
  const json = JSON.stringify(record);
  for (const key of keys) {
    try {
      localStorage.setItem(`${STORAGE_KEYS.ANNOTATIONS_PREFIX}${key}`, json);
      localSaveSucceeded = true;
    } catch {
      // Large image annotations may exceed localStorage; IndexedDB remains authoritative.
    }
  }

  // 2. Persistent IndexedDB for full-size payloads & image attachments
  const idbResults = await Promise.all(
    keys.map((key) => idbSaveAnnotations(key, persistable, updatedAt))
  );

  // 3. Update annotation count in recent docs
  try {
    const recents = loadRecentDocs();
    const updated = recents.map((doc) => {
      if (
        doc.filePath === docKey ||
        doc.fileName === docKey ||
        fallbackKeys.includes(doc.filePath || '') ||
        fallbackKeys.includes(doc.fileName)
      ) {
        return { ...doc, annotationCount: persistable.length };
      }
      return doc;
    });
    localStorage.setItem(STORAGE_KEYS.RECENT_DOCS, JSON.stringify(updated));
  } catch {}

  if (!localSaveSucceeded && !idbResults.some(Boolean)) {
    throw new Error('No annotation storage backend is available.');
  }
}

export function loadAnnotationRecordForDocSync(
  docKey: string,
  fallbackKeys: string[] = []
): StoredAnnotationRecord | null {
  const records = annotationStorageKeys(docKey, fallbackKeys).map((key) => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEYS.ANNOTATIONS_PREFIX}${key}`);
      return raw ? parseStoredAnnotationRecord(raw) : null;
    } catch {}
    return null;
  });
  return selectNewestAnnotationRecord(records);
}

export function loadAnnotationsForDocSync(docKey: string, fallbackKeys: string[] = []): Annotation[] {
  return loadAnnotationRecordForDocSync(docKey, fallbackKeys)?.annotations ?? [];
}

export async function loadAnnotationRecordForDocAsync(
  docKey: string,
  fallbackKeys: string[] = []
): Promise<StoredAnnotationRecord | null> {
  const records = await Promise.all(
    annotationStorageKeys(docKey, fallbackKeys).map(idbLoadAnnotationRecord)
  );
  return selectNewestAnnotationRecord(records);
}

export async function loadAnnotationsForDocAsync(
  docKey: string,
  fallbackKeys: string[] = []
): Promise<Annotation[] | null> {
  return (await loadAnnotationRecordForDocAsync(docKey, fallbackKeys))?.annotations ?? null;
}

export function loadAnnotationsForDoc(docKey: string): Annotation[] {
  return loadAnnotationsForDocSync(docKey);
}

// --- Last Read Page Position ---

export function saveLastPageForDoc(
  docKey: string,
  pageNumber: number,
  fileName?: string,
  filePath?: string
): void {
  try {
    localStorage.setItem(`${STORAGE_KEYS.LAST_PAGE_PREFIX}${docKey}`, String(pageNumber));
    if (fileName) {
      localStorage.setItem(`${STORAGE_KEYS.LAST_PAGE_PREFIX}${fileName}`, String(pageNumber));
      updateRecentDocLastPage(fileName, pageNumber);
    }
    if (filePath) {
      localStorage.setItem(`${STORAGE_KEYS.LAST_PAGE_PREFIX}${filePath}`, String(pageNumber));
      updateRecentDocLastPage(filePath, pageNumber);
    }
  } catch {}
}

export function loadLastPageForDoc(docKey: string, fallbackKey?: string): number {
  try {
    let raw = localStorage.getItem(`${STORAGE_KEYS.LAST_PAGE_PREFIX}${docKey}`);
    if (!raw && fallbackKey) {
      raw = localStorage.getItem(`${STORAGE_KEYS.LAST_PAGE_PREFIX}${fallbackKey}`);
    }
    return raw ? parseInt(raw, 10) : 1;
  } catch {
    return 1;
  }
}

// --- Dashboard & Library Storage ---

export function loadSavedDirectories(): SavedDirectory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_DIRS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSavedDirectories(dirs: SavedDirectory[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_DIRS, JSON.stringify(dirs));
  } catch (e) {
    console.warn('Failed to save directories to localStorage', e);
  }
}

export function loadRecentDocs(): DashboardPdfItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECENT_DOCS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordRecentDoc(doc: Omit<DashboardPdfItem, 'id'> & { id?: string }): void {
  try {
    const current = loadRecentDocs();
    const id = doc.id || doc.filePath || doc.fileName;
    const updatedItem: DashboardPdfItem = {
      ...doc,
      id,
      lastOpenedAt: Date.now(),
    };

    // Remove existing entry and place this at the front
    const filtered = current.filter((item) => item.filePath !== doc.filePath && item.id !== id);
    const updated = [updatedItem, ...filtered].slice(0, 50); // keep up to 50 recent documents

    localStorage.setItem(STORAGE_KEYS.RECENT_DOCS, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to record recent doc in localStorage', e);
  }
}

export function updateRecentDocLastPage(identifier: string, pageNumber: number): void {
  try {
    const current = loadRecentDocs();
    const updated = current.map((doc) => {
      if (doc.filePath === identifier || doc.fileName === identifier || doc.id === identifier) {
        return { ...doc, lastReadPage: pageNumber };
      }
      return doc;
    });
    localStorage.setItem(STORAGE_KEYS.RECENT_DOCS, JSON.stringify(updated));
  } catch {}
}

export function updateRecentDocPageCount(identifier: string, numPages: number): void {
  try {
    const current = loadRecentDocs();
    const updated = current.map((doc) => {
      if (doc.filePath === identifier || doc.fileName === identifier || doc.id === identifier) {
        return { ...doc, numPages };
      }
      return doc;
    });
    localStorage.setItem(STORAGE_KEYS.RECENT_DOCS, JSON.stringify(updated));
  } catch {}
}

export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(docId: string): boolean {
  try {
    const current = loadFavorites();
    const isFav = current.includes(docId);
    const updated = isFav ? current.filter((id) => id !== docId) : [...current, docId];
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(updated));
    return !isFav;
  } catch {
    return false;
  }
}
