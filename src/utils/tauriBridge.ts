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
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
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
