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

export function saveAnnotationsForDoc(docKey: string, annotations: Annotation[]): void {
  try {
    localStorage.setItem(`${STORAGE_KEYS.ANNOTATIONS_PREFIX}${docKey}`, JSON.stringify(annotations));
  } catch (e) {
    console.warn('Failed to save annotations to localStorage', e);
  }
}

export function loadAnnotationsForDoc(docKey: string): Annotation[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.ANNOTATIONS_PREFIX}${docKey}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLastPageForDoc(docKey: string, pageNumber: number): void {
  try {
    localStorage.setItem(`${STORAGE_KEYS.LAST_PAGE_PREFIX}${docKey}`, String(pageNumber));
  } catch {}
}

export function loadLastPageForDoc(docKey: string): number {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.LAST_PAGE_PREFIX}${docKey}`);
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
