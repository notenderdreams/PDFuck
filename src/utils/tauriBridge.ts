import { invoke } from '@tauri-apps/api/core';

export interface OpenFileResult {
  file_name: string;
  file_path: string;
  data: number[];
}

export interface OpenImageResult {
  file_name: string;
  file_path: string;
  data_url: string;
}

export interface SaveResult {
  success: boolean;
  file_path?: string | null;
}

export interface ScannedPdfResult {
  file_name: string;
  file_path: string;
  file_size: number;
  modified_timestamp: number;
  directory_path: string;
  num_pages?: number | null;
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
  return invoke<AiProviderStatus>('get_ai_provider_status');
}

export async function setAiProviderExecutable(executablePath: string): Promise<AiProviderStatus> {
  if (!isTauri()) {
    return { status: 'native_required', message: 'Local CLI explanations require the PDFuck desktop app.' };
  }
  return invoke<AiProviderStatus>('set_ai_provider_executable', { executablePath });
}

export async function runAiExplanation(request: AiExplanationRequest): Promise<AiExplanationResult> {
  if (!isTauri()) {
    return { ok: false, code: 'native_required', message: 'Local CLI explanations require the PDFuck desktop app.' };
  }
  try {
    return await invoke<AiExplanationResult>('run_ai_explanation', { request });
  } catch (error) {
    return { ok: false, code: 'process_failed', message: error instanceof Error ? error.message : String(error) };
  }
}

export async function cancelAiExplanation(requestId: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    return await invoke<boolean>('cancel_ai_explanation', { requestId });
  } catch {
    return false;
  }
}

export async function tauriOpenPdf(): Promise<{ fileName: string; filePath: string; data: Uint8Array } | null> {
  if (!isTauri()) return null;
  try {
    const res = await invoke<OpenFileResult | null>('open_pdf_dialog');
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
    const res = await invoke<OpenFileResult | null>('read_file_from_path', { filePath });
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
    const res = await invoke<OpenImageResult | null>('open_image_dialog');
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
    const res = await invoke<SaveResult>('save_pdf_dialog', {
      data: Array.from(pdfBytes),
      defaultName,
    });
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
    const res = await invoke<SaveResult>('write_pdf_file', {
      filePath,
      data: Array.from(pdfBytes),
    });
    return res.success;
  } catch (err) {
    console.error('Tauri write PDF error:', err);
    return false;
  }
}

export async function tauriSaveJson(jsonString: string, defaultName: string): Promise<{ success: boolean; path?: string }> {
  if (!isTauri()) return { success: false };
  try {
    const res = await invoke<SaveResult>('save_json_dialog', {
      jsonString,
      defaultName,
    });
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
    const res = await invoke<string | null>('select_directory_dialog');
    return res;
  } catch (err) {
    console.error('Tauri select directory error:', err);
    return null;
  }
}

export async function tauriScanDirectoryPdfs(directoryPath: string): Promise<ScannedPdfResult[]> {
  if (!isTauri()) return [];
  try {
    const res = await invoke<ScannedPdfResult[]>('scan_directory_pdfs', { directoryPath });
    return res || [];
  } catch (err) {
    console.error('Tauri scan directory error:', err);
    return [];
  }
}

export async function tauriGetDefaultDirectories(): Promise<string[]> {
  if (!isTauri()) return [];
  try {
    const res = await invoke<string[]>('get_default_directories');
    return res || [];
  } catch (err) {
    console.error('Tauri get default directories error:', err);
    return [];
  }
}

export async function tauriCopyImageToClipboard(pngDataUrl: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const res = await invoke<boolean>('copy_image_to_clipboard', {
      pngDataUrl,
    });
    return res;
  } catch (err) {
    console.error('Tauri native copy image error:', err);
    return false;
  }
}

export async function tauriCopyTextToClipboard(text: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const res = await invoke<boolean>('copy_text_to_clipboard', {
      text,
    });
    return res;
  } catch (err) {
    console.error('Tauri native copy text error:', err);
    return false;
  }
}
