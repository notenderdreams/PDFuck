export type ToolType =
  | 'select'
  | 'highlight-text'
  | 'highlight-pen'
  | 'highlight-line'
  | 'highlight-rect'
  | 'pen'
  | 'image'
  | 'text'
  | 'eraser'
  | 'snip'
  | 'ai-box';

export type ReadingTheme = 'default' | 'invert' | 'oled' | 'sepia' | 'nord' | 'matrix';

export type ViewMode = 'continuous' | 'single' | 'spread';

export type AppScreen = 'dashboard' | 'reader';

export interface StrokePoint {
  x: number; // Normalized 0..1 relative to page width
  y: number; // Normalized 0..1 relative to page height
}

export interface DrawingAnnotation {
  id: string;
  pageNumber: number;
  type: 'pen' | 'highlight-pen';
  points: StrokePoint[];
  color: string;
  strokeWidth: number; // in relative units or pt
  opacity: number;
  createdAt: number;
}

export interface LineHighlightAnnotation {
  id: string;
  pageNumber: number;
  type: 'highlight-line';
  startX: number; // Normalized 0..1
  startY: number; // Normalized 0..1
  endX: number; // Normalized 0..1
  endY: number; // Normalized 0..1
  color: string;
  strokeWidth: number;
  opacity: number;
  createdAt: number;
}

export interface RectHighlightAnnotation {
  id: string;
  pageNumber: number;
  type: 'highlight-rect';
  x: number; // Normalized 0..1
  y: number; // Normalized 0..1
  width: number; // Normalized 0..1
  height: number; // Normalized 0..1
  color: string;
  opacity: number;
  createdAt: number;
}

export interface TextHighlightAnnotation {
  id: string;
  pageNumber: number;
  type: 'highlight-text';
  rects: { x: number; y: number; width: number; height: number }[]; // Normalized 0..1
  text: string;
  color: string;
  opacity: number;
  createdAt: number;
}

export interface AttachedImageAnnotation {
  id: string;
  pageNumber: number;
  type: 'image';
  dataUrl: string;
  x: number; // Normalized 0..1
  y: number; // Normalized 0..1
  width: number; // Normalized 0..1
  height: number; // Normalized 0..1
  rotation: number; // degrees
  opacity: number;
  aspectRatio: number;
  name: string;
  createdAt: number;
  attachedInInvertedMode?: boolean; // True if attached while in Dark/Invert theme
  invertInLightMode?: boolean; // Invert image colors when viewed or saved in Light/Normal mode
  extractedText?: string; // Optional extracted raw text from rasterized region or OCR
}

export interface TextNoteAnnotation {
  id: string;
  pageNumber: number;
  type: 'text-note';
  x: number; // Normalized 0..1
  y: number; // Normalized 0..1
  text: string;
  color: string;
  fontSize: number; // in pt
  createdAt: number;
}

export interface AiExplanationAnnotation {
  id: string;
  pageNumber: number;
  type: 'ai-explanation';
  x: number;
  y: number;
  width: number;
  height: number;
  prompt: string;
  response: string;
  provider: 'codex';
  createdAt: number;
  updatedAt: number;
  cardX?: number;
  cardY?: number;
  isOpen?: boolean;
}

export type Annotation =
  | DrawingAnnotation
  | LineHighlightAnnotation
  | RectHighlightAnnotation
  | TextHighlightAnnotation
  | AttachedImageAnnotation
  | TextNoteAnnotation
  | AiExplanationAnnotation;

export interface HighlightColorPreset {
  id: string;
  name: string;
  color: string;
  hex: string;
  textColor: string;
}

export interface ThemeSettings {
  theme: ReadingTheme;
  brightness: number; // 50 - 150 (default 100)
  contrast: number; // 50 - 150 (default 100)
  grayscale: number; // 0 - 100 (default 0)
  sepiaAmount: number; // 0 - 100 (default 0)
  invertImages: boolean; // whether to preserve or invert attached images
}

export interface DocumentBookmark {
  id: string;
  pageNumber: number;
  title: string;
  createdAt: number;
}

export interface PDFOutlineItem {
  title: string;
  pageNumber: number;
  children?: PDFOutlineItem[];
}

export interface DocumentInfo {
  fileName: string;
  numPages: number;
  fileSize?: number;
  filePath?: string;
  fingerprint?: string;
  title?: string;
  author?: string;
}

export interface SearchMatch {
  pageNumber: number;
  matchIndex: number;
  snippet: string;
}

export interface DashboardPdfItem {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  modifiedTimestamp: number;
  directoryPath?: string;
  lastOpenedAt?: number;
  lastReadPage?: number;
  annotationCount?: number;
  numPages?: number;
  isFavorite?: boolean;
}

export interface SavedDirectory {
  id: string;
  path: string;
  name: string;
  addedAt: number;
  pdfCount?: number;
}

export interface SnippetImageEntry {
  id: string;
  type: 'image';
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
  createdAt: number;
  label?: string;
}

export interface SnippetDividerEntry {
  id: string;
  type: 'divider';
  label?: string;
  style?: 'solid' | 'dashed' | 'thick';
  createdAt: number;
}

export type SnippetEntry = SnippetImageEntry | SnippetDividerEntry;

export interface StitchOptions {
  backgroundColor?: string;
  dividerColor?: string;
  padding?: number;
  gap?: number;
  includePageBadges?: boolean;
}
