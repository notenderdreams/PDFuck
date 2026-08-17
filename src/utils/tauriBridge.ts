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
