import { commands } from '../libs/bindings';
import type { LibrarySnapshot as NativeLibrarySnapshot } from '../libs/bindings';
import type { DashboardPdfItem, SavedDirectory } from './types';

export interface ScannedPdfResult {
  file_name: string;
  file_path: string;
  file_size: number;
  modified_timestamp: number;
  directory_path: string;
  num_pages?: number | null;
}

export interface LibrarySnapshot {
  directories: SavedDirectory[];
  documents: DashboardPdfItem[];
}

const normalizeLibrarySnapshot = (
  snapshot: NativeLibrarySnapshot,
): LibrarySnapshot => {
  const folderPaths = new Map(snapshot.folders.map((folder) => [folder.id, folder.path]));
  return {
    directories: snapshot.folders.map((folder) => ({
    id: folder.id,
    path: folder.path,
    name: folder.name,
    addedAt: folder.importedAt ?? 0,
    pdfCount: folder.pdfCount,
  })),
    documents: snapshot.documents.map((document) => ({
    id: document.id,
    fileName: document.fileName,
    filePath: document.filePath,
    fileSize: document.fileSize ?? 0,
    modifiedTimestamp: document.modifiedAt ?? 0,
    lastOpenedAt: document.lastOpenedAt ?? undefined,
    lastReadPage: document.lastReadPage ?? undefined,
    annotationCount: document.annotationCount ?? undefined,
    numPages: document.numPages ?? undefined,
    isFavorite: document.favorite,
    availability: document.availability,
    sourceType: document.sourceType,
    folderId: document.folderId ?? undefined,
    folderIds: document.folderIds,
    directoryPath: document.folderId ? folderPaths.get(document.folderId) : undefined,
    })),
  };
};

export async function tauriListLibrary(): Promise<LibrarySnapshot> {
  if (!isTauri()) return { directories: [], documents: [] };
  return normalizeLibrarySnapshot(unwrapNativeResult(await commands.listLibrary()));
}

export async function tauriImportLibraryPdf(): Promise<DashboardPdfItem | null> {
  if (!isTauri()) return null;
  const document = unwrapNativeResult(await commands.importLibraryPdfDialog());
  if (!document) return null;
  return normalizeLibrarySnapshot({ folders: [], documents: [document] }).documents[0];
}

export async function tauriImportLibraryFolder(): Promise<LibrarySnapshot | null> {
  if (!isTauri()) return null;
  const snapshot = unwrapNativeResult(await commands.importLibraryFolderDialog());
  return snapshot ? normalizeLibrarySnapshot(snapshot) : null;
}

export async function tauriRefreshLibrary(): Promise<LibrarySnapshot> {
  if (!isTauri()) return { directories: [], documents: [] };
  return normalizeLibrarySnapshot(unwrapNativeResult(await commands.refreshLibrary()));
}

export async function tauriRemoveLibraryFolder(folderId: string, keepDocuments = true): Promise<LibrarySnapshot> {
  if (!isTauri()) return { directories: [], documents: [] };
  return normalizeLibrarySnapshot(unwrapNativeResult(await commands.removeLibraryFolder(folderId, keepDocuments)));
}

export async function tauriRemoveLibraryDocument(documentId: string): Promise<void> {
  if (!isTauri()) return;
  unwrapNativeResult(await commands.removeLibraryDocument(documentId));
}

export async function tauriSetLibraryFavorite(documentId: string, favorite: boolean): Promise<void> {
  if (!isTauri()) return;
  unwrapNativeResult(await commands.setLibraryFavorite(documentId, favorite));
}

export async function tauriTouchLibraryDocument(documentId: string, lastReadPage?: number, annotationCount?: number): Promise<void> {
  if (!isTauri()) return;
  unwrapNativeResult(await commands.touchLibraryDocument(documentId, lastReadPage ?? null, annotationCount ?? null));
}

export async function tauriUpdateLibraryDocumentState(documentId: string, lastReadPage: number, annotationCount: number): Promise<void> {
  if (!isTauri()) return;
  unwrapNativeResult(await commands.updateLibraryDocumentState(documentId, lastReadPage, annotationCount));
}

export async function tauriRelinkLibraryDocument(documentId: string): Promise<DashboardPdfItem | null> {
  if (!isTauri()) return null;
  const document = unwrapNativeResult(await commands.relinkLibraryDocument(documentId));
  if (!document) return null;
  return normalizeLibrarySnapshot({ folders: [], documents: [document] }).documents[0];
}

export type AiProviderStatus =
  | { status: 'ready'; provider: 'codex'; version: string; executable: string }
  | { status: 'native_required' | 'missing_cli' | 'unauthenticated' | 'incompatible_cli'; message: string };

export type AiExplanationErrorCode =
  | 'native_required'
  | 'missing_cli'
  | 'unauthenticated'
  | 'incompatible_cli'
  | 'timeout'
  | 'cancelled'
  | 'process_failed'
  | 'malformed_output';

export interface AiExplanationRequest {
  requestId: string;
  prompt: string;
  pngDataUrl: string;
}

export type AiExplanationResult =
  | { ok: true; response: string }
  | { ok: false; code: AiExplanationErrorCode; message: string };

const AI_ERROR_CODES = new Set<AiExplanationErrorCode>([
  'native_required',
  'missing_cli',
  'unauthenticated',
  'incompatible_cli',
  'timeout',
  'cancelled',
  'process_failed',
  'malformed_output',
]);

function unwrapNativeResult<T, E>(result: { status: 'ok'; data: T } | { status: 'error'; error: E }): T {
  if (result.status === 'error') {
    throw new Error(typeof result.error === 'string' ? result.error : 'The native command could not be completed.');
  }
  return result.data;
}

function normalizeProviderStatus(status: Awaited<ReturnType<typeof commands.getAiProviderStatus>>): AiProviderStatus {
  const value = unwrapNativeResult(status);
  if (
    value.status === 'ready' &&
    value.provider === 'codex' &&
    typeof value.version === 'string' &&
    typeof value.executable === 'string'
  ) {
    return {
      status: 'ready',
      provider: 'codex',
      version: value.version,
      executable: value.executable,
    };
  }
  const errorStatus = value.status === 'unauthenticated' || value.status === 'incompatible_cli'
    ? value.status
    : 'missing_cli';
  return {
    status: errorStatus,
    message: value.message || 'The Codex CLI is not ready.',
  };
}

function normalizeExplanationResult(
  result: Awaited<ReturnType<typeof commands.runAiExplanation>>,
): AiExplanationResult {
  const value = unwrapNativeResult(result);
  if (value.ok && typeof value.response === 'string') {
    return { ok: true, response: value.response };
  }
  const code = typeof value.code === 'string' && AI_ERROR_CODES.has(value.code as AiExplanationErrorCode)
    ? value.code as AiExplanationErrorCode
    : 'process_failed';
  return {
    ok: false,
    code,
    message: value.message || 'The explanation could not be completed.',
  };
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function startDraggingWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().startDragging();
  } catch (err) {
    console.warn('Tauri startDragging failed:', err);
  }
}

export async function toggleMaximizeWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().toggleMaximize();
  } catch (err) {
    console.warn('Tauri toggleMaximize failed:', err);
  }
}

export async function toggleFullscreenWindow(): Promise<void> {
  if (isTauri()) {
    try {
      const res = await commands.toggleFullscreenWindow();
      unwrapNativeResult(res);
      return;
    } catch (err) {
      console.warn('Native toggleFullscreenWindow command failed, falling back to window API:', err);
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const isFull = await win.isFullscreen();
        await win.setFullscreen(!isFull);
        return;
      } catch (err2) {
        console.warn('Tauri window API setFullscreen failed:', err2);
      }
    }
  }

  // Browser / WebKit fallback
  try {
    if (typeof document !== 'undefined') {
      const doc = document as unknown as {
        fullscreenElement?: Element | null;
        webkitFullscreenElement?: Element | null;
        mozFullScreenElement?: Element | null;
        msFullscreenElement?: Element | null;
        exitFullscreen?: () => Promise<void>;
        webkitExitFullscreen?: () => Promise<void>;
        mozCancelFullScreen?: () => Promise<void>;
        msExitFullscreen?: () => Promise<void>;
      };
      const docEl = document.documentElement as unknown as {
        requestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => Promise<void>;
        mozRequestFullScreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      };

      const isFullScreen = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (!isFullScreen) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    }
  } catch (err) {
    console.warn('Browser toggleFullscreen failed:', err);
  }
}

export async function exitFullscreenWindow(): Promise<void> {
  if (isTauri()) {
    try {
      const res = await commands.exitFullscreenWindow();
      unwrapNativeResult(res);
      return;
    } catch (err) {
      console.warn('Native exitFullscreenWindow command failed, falling back to window API:', err);
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const isFull = await win.isFullscreen();
        if (isFull) {
          await win.setFullscreen(false);
        }
        return;
      } catch (err2) {
        console.warn('Tauri window API exitFullscreen failed:', err2);
      }
    }
  }

  // Browser / WebKit fallback
  try {
    if (typeof document !== 'undefined') {
      const doc = document as unknown as {
        fullscreenElement?: Element | null;
        webkitFullscreenElement?: Element | null;
        mozFullScreenElement?: Element | null;
        msFullscreenElement?: Element | null;
        exitFullscreen?: () => Promise<void>;
        webkitExitFullscreen?: () => Promise<void>;
        mozCancelFullScreen?: () => Promise<void>;
        msExitFullscreen?: () => Promise<void>;
      };

      const isFullScreen = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (isFullScreen) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    }
  } catch (err) {
    console.warn('Browser exitFullscreen failed:', err);
  }
}

export function handleTitlebarMouseDown(e: React.MouseEvent): void {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement | null;
  if (!target) return;
  if (target.closest('button, input, textarea, select, a, [role="button"], .app-no-drag, [data-tauri-drag-region="false"]')) {
    return;
  }
  if (e.detail === 2) {
    void toggleMaximizeWindow();
    return;
  }
  void startDraggingWindow();
}

export async function getAiProviderStatus(): Promise<AiProviderStatus> {
  if (!isTauri()) {
    return { status: 'native_required', message: 'Local CLI explanations require the PDFuck desktop app.' };
  }
  return normalizeProviderStatus(await commands.getAiProviderStatus());
}

export async function setAiProviderExecutable(executablePath: string): Promise<AiProviderStatus> {
  if (!isTauri()) {
    return { status: 'native_required', message: 'Local CLI explanations require the PDFuck desktop app.' };
  }
  return normalizeProviderStatus(await commands.setAiProviderExecutable(executablePath));
}

export async function runAiExplanation(request: AiExplanationRequest): Promise<AiExplanationResult> {
  if (!isTauri()) {
    return { ok: false, code: 'native_required', message: 'Local CLI explanations require the PDFuck desktop app.' };
  }
  try {
    return normalizeExplanationResult(await commands.runAiExplanation(request));
  } catch (error) {
    return { ok: false, code: 'process_failed', message: error instanceof Error ? error.message : String(error) };
  }
}

export async function cancelAiExplanation(requestId: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    return await commands.cancelAiExplanation(requestId);
  } catch {
    return false;
  }
}

export async function tauriOpenPdf(): Promise<{ fileName: string; filePath: string; data: Uint8Array } | null> {
  if (!isTauri()) return null;
  try {
    const res = await commands.openPdfDialog();
    if (res && res.data) {
      return {
        fileName: res.file_name,
        filePath: res.file_path,
        data: new Uint8Array(res.data),
      };
    }
  } catch (err) {
    console.warn('Tauri open PDF dialog error:', err);
  }
  return null;
}

export async function tauriReadFile(filePath: string): Promise<{ fileName: string; filePath: string; data: Uint8Array } | null> {
  if (!isTauri()) return null;
  try {
    const res = await commands.readFileFromPath(filePath);
    if (res && res.data) {
      return {
        fileName: res.file_name,
        filePath: res.file_path,
        data: new Uint8Array(res.data),
      };
    }
  } catch (err) {
    console.error('Tauri read file error:', err);
  }
  return null;
}

export async function tauriOpenImage(): Promise<{ fileName: string; filePath: string; dataUrl: string } | null> {
  if (!isTauri()) return null;
  try {
    const res = await commands.openImageDialog();
    if (res && res.data_url) {
      return {
        fileName: res.file_name,
        filePath: res.file_path,
        dataUrl: res.data_url,
      };
    }
  } catch (err) {
    console.warn('Tauri open image dialog error:', err);
  }
  return null;
}

export async function tauriSavePdf(pdfBytes: Uint8Array, defaultName: string): Promise<{ success: boolean; path?: string }> {
  if (!isTauri()) return { success: false };
  try {
    const res = await commands.savePdfDialog(Array.from(pdfBytes), defaultName);
    return {
      success: res.success,
      path: res.file_path || undefined,
    };
  } catch (err) {
    console.error('Tauri save PDF error:', err);
    return { success: false };
  }
}

export async function tauriWritePdf(pdfBytes: Uint8Array, filePath: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const res = await commands.writePdfFile(filePath, Array.from(pdfBytes));
    return res.success;
  } catch (err) {
    console.error('Tauri write PDF error:', err);
    return false;
  }
}

export async function tauriSaveJson(jsonString: string, defaultName: string): Promise<{ success: boolean; path?: string }> {
  if (!isTauri()) return { success: false };
  try {
    const res = await commands.saveJsonDialog(jsonString, defaultName);
    return {
      success: res.success,
      path: res.file_path || undefined,
    };
  } catch (err) {
    console.error('Tauri save JSON error:', err);
    return { success: false };
  }
}

export async function tauriSelectDirectory(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const res = await commands.selectDirectoryDialog();
    return res;
  } catch (err) {
    console.error('Tauri select directory error:', err);
    return null;
  }
}

export async function tauriScanDirectoryPdfs(directoryPath: string): Promise<ScannedPdfResult[]> {
  if (!isTauri()) return [];
  try {
    const res = await commands.scanDirectoryPdfs(directoryPath);
    return res.map((item) => ({
      ...item,
      file_size: item.file_size ?? 0,
      modified_timestamp: item.modified_timestamp ?? 0,
    }));
  } catch (err) {
    console.error('Tauri scan directory error:', err);
    return [];
  }
}

export async function tauriGetDefaultDirectories(): Promise<string[]> {
  if (!isTauri()) return [];
  try {
    const res = await commands.getDefaultDirectories();
    return res || [];
  } catch (err) {
    console.error('Tauri get default directories error:', err);
    return [];
  }
}

export async function tauriCopyImageToClipboard(pngDataUrl: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const res = await commands.copyImageToClipboard(pngDataUrl);
    return res;
  } catch (err) {
    console.error('Tauri native copy image error:', err);
    return false;
  }
}

export async function tauriCopyTextToClipboard(text: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const res = await commands.copyTextToClipboard(text);
    return res;
  } catch (err) {
    console.error('Tauri native copy text error:', err);
    return false;
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
      return;
    } catch (err) {
      console.warn('Tauri openUrl plugin error, falling back to window.open:', err);
    }
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
