import type { Annotation, ThemeSettings, ViewMode } from './types';

const STORAGE_KEYS = {
  THEME_SETTINGS: 'pdfuck_theme_settings',
  VIEW_MODE: 'pdfuck_view_mode',
  ZOOM_LEVEL: 'pdfuck_zoom_level',
  RECENT_DOCS: 'pdfuck_recent_docs',
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
