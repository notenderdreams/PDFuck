import type { Annotation, DashboardPdfItem, SavedDirectory, ThemeSettings, ViewMode } from './types';

const STORAGE_KEYS = {
  THEME_SETTINGS: 'pdfuck_theme_settings',
  VIEW_MODE: 'pdfuck_view_mode',
  ZOOM_LEVEL: 'pdfuck_zoom_level',
  RECENT_DOCS: 'pdfuck_recent_docs',
  SAVED_DIRS: 'pdfuck_saved_directories',
  FAVORITES: 'pdfuck_favorite_doc_ids',
  ANNOTATIONS_PREFIX: 'pdfuck_annotations_',
  LAST_PAGE_PREFIX: 'pdfuck_last_page_',
};

// --- IndexedDB Engine for Large Annotation Payloads (Images, Stickers, Ink) ---
const IDB_NAME = 'pdfuck_database';
const IDB_VERSION = 1;
const IDB_STORE_ANNOTATIONS = 'annotations_store';

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

export async function idbSaveAnnotations(docKey: string, annotations: Annotation[]): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE_ANNOTATIONS, 'readwrite');
    const store = tx.objectStore(IDB_STORE_ANNOTATIONS);
    store.put({ docKey, annotations, updatedAt: Date.now() });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    // console.warn('IDB Save Error:', err);
  }
}

export async function idbLoadAnnotations(docKey: string): Promise<Annotation[] | null> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE_ANNOTATIONS, 'readonly');
    const store = tx.objectStore(IDB_STORE_ANNOTATIONS);
    const req = store.get(docKey);
    return await new Promise<Annotation[] | null>((resolve) => {
      req.onsuccess = () => {
        resolve(req.result ? req.result.annotations : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
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
  return annotations.filter((ann) => {
    // If it's an AI explanation box without a response (user just drew a box but didn't send/explain), do not persist
    if (ann.type === 'ai-explanation') {
      return Boolean(ann.response && ann.response.trim());
    }
    return true;
  });
}

export function saveAnnotationsForDoc(
  docKey: string,
  annotations: Annotation[],
  fallbackKeys: string[] = []
): void {
  const persistable = filterPersistableAnnotations(annotations);

  // 1. LocalStorage for fast instant access
  try {
    const json = JSON.stringify(persistable);
    localStorage.setItem(`${STORAGE_KEYS.ANNOTATIONS_PREFIX}${docKey}`, json);
    for (const key of fallbackKeys) {
      if (key) {
        localStorage.setItem(`${STORAGE_KEYS.ANNOTATIONS_PREFIX}${key}`, json);
      }
    }
  } catch (e) {
    // QuotaExceededError is handled gracefully via IndexedDB below
  }

  // 2. Persistent IndexedDB for full-size payloads & image attachments
  idbSaveAnnotations(docKey, persistable);
  for (const key of fallbackKeys) {
    if (key) {
      idbSaveAnnotations(key, persistable);
    }
  }

  // 3. Update annotation count in recent docs
  try {
    const recents = loadRecentDocs();
    const updated = recents.map((doc) => {
      if (doc.filePath === docKey || doc.fileName === docKey || fallbackKeys.includes(doc.filePath || '')) {
        return { ...doc, annotationCount: persistable.length };
      }
      return doc;
    });
    localStorage.setItem(STORAGE_KEYS.RECENT_DOCS, JSON.stringify(updated));
  } catch {}
}

export function loadAnnotationsForDocSync(docKey: string, fallbackKeys: string[] = []): Annotation[] {
  // Try main docKey
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.ANNOTATIONS_PREFIX}${docKey}`);
    if (raw) return filterPersistableAnnotations(JSON.parse(raw));
  } catch {}

  // Try fallback keys (e.g. filePath, fileName, fingerprint)
  for (const key of fallbackKeys) {
    if (!key) continue;
    try {
      const raw = localStorage.getItem(`${STORAGE_KEYS.ANNOTATIONS_PREFIX}${key}`);
      if (raw) return filterPersistableAnnotations(JSON.parse(raw));
    } catch {}
  }

  return [];
}

export async function loadAnnotationsForDocAsync(
  docKey: string,
  fallbackKeys: string[] = []
): Promise<Annotation[] | null> {
  const fromIdb = await idbLoadAnnotations(docKey);
  if (fromIdb && fromIdb.length > 0) return filterPersistableAnnotations(fromIdb);

  for (const key of fallbackKeys) {
    if (!key) continue;
    const fb = await idbLoadAnnotations(key);
    if (fb && fb.length > 0) return filterPersistableAnnotations(fb);
  }

  return null;
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
