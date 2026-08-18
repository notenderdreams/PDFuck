import type { PDFDocumentProxy } from 'pdfjs-dist';
import { isTauri, tauriCopyImageToClipboard, tauriCopyTextToClipboard } from './tauriBridge';

/**
 * Universal clipboard text writer with native desktop bridge and browser fallback
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Strategy 1: Tauri native desktop pasteboard
  if (isTauri()) {
    try {
      const nativeOk = await tauriCopyTextToClipboard(text);
      if (nativeOk) return true;
    } catch (e) {
      console.warn('Tauri native copy text failed, trying browser clipboard:', e);
    }
  }

  // Strategy 2: Async Clipboard API
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, attempting execCommand fallback:', err);
    }
  }

  // Strategy 3: Hidden textarea with execCommand('copy')
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 999999);
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) return true;
  } catch (err) {
    console.error('execCommand copy failed:', err);
  }

  return false;
}

/**
 * Extract clean, structured text from any PDF.js page
 */
export async function extractPageText(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number | unknown
): Promise<string> {
  const safePageNum =
    typeof pageNumber === 'number' && !isNaN(pageNumber)
      ? Math.max(1, Math.floor(pageNumber))
      : 1;

  try {
    const page = await pdfDoc.getPage(safePageNum);
    const textContent = await page.getTextContent();

    if (!textContent || !textContent.items || textContent.items.length === 0) {
      return '';
    }

    let extractedText = '';
    let lastY: number | null = null;

    for (const rawItem of textContent.items) {
      if ('str' in rawItem) {
        const item = rawItem as { str: string; transform?: number[]; hasEOL?: boolean };
        const text = item.str;
        if (!text) continue;

        // Detect vertical line breaks using coordinate transform matrix
        const currentY = item.transform ? item.transform[5] : null;
        if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 6) {
          extractedText += '\n';
        } else if (
          extractedText.length > 0 &&
          !extractedText.endsWith(' ') &&
          !extractedText.endsWith('\n')
        ) {
          extractedText += ' ';
        }

        extractedText += text;

        if (item.hasEOL) {
          extractedText += '\n';
        }

        lastY = currentY;
      }
    }

    return extractedText.trim();
  } catch (err) {
    console.error(`Error extracting text from page ${safePageNum}:`, err);
    return '';
  }
}

/**
 * Capture full composite page canvas (from DOM if rendered, or directly via PDF.js offscreen renderer)
 */
export async function capturePageCompositeCanvas(
  pageNumber: number | unknown,
  pdfDoc?: PDFDocumentProxy | null
): Promise<HTMLCanvasElement | null> {
  const safePageNum =
    typeof pageNumber === 'number' && !isNaN(pageNumber)
      ? Math.max(1, Math.floor(pageNumber))
      : 1;

  const pageContainer = document.getElementById(`pdf-page-${safePageNum}`);
  const pdfCanvas = pageContainer?.querySelector('canvas') as HTMLCanvasElement | null;

  // Fast path: capture already-rendered DOM canvas with annotations
  if (pdfCanvas && pdfCanvas.width > 0 && pdfCanvas.height > 0) {
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = pdfCanvas.width;
    outputCanvas.height = pdfCanvas.height;
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return null;

    // 1. Fill solid white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

    // 2. Draw base PDF canvas
    ctx.drawImage(pdfCanvas, 0, 0);

    // 3. Draw annotations and overlay layers
    if (pageContainer) {
      const otherCanvases = pageContainer.querySelectorAll('canvas');
      otherCanvases.forEach((c) => {
        if (c !== pdfCanvas && c.width > 0 && c.height > 0) {
          ctx.drawImage(c, 0, 0, outputCanvas.width, outputCanvas.height);
        }
      });
    }

    return outputCanvas;
  }

  // Fallback: render pristine 2x raster directly from PDF.js document proxy
  if (pdfDoc) {
    try {
      const page = await pdfDoc.getPage(safePageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = Math.floor(viewport.width);
      offscreenCanvas.height = Math.floor(viewport.height);
      const ctx = offscreenCanvas.getContext('2d');
      if (!ctx) return null;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      return offscreenCanvas;
    } catch (err) {
      console.error(`Direct offscreen render failed for page ${safePageNum}:`, err);
    }
  }

  return null;
}

/**
 * Copy composite page image directly to system clipboard as image/png
 * (Uses native OS pasteboard in Tauri, and standard Clipboard API in browsers)
 */
export async function copyPageImageToClipboard(
  pageNumber: number | unknown,
  pdfDoc?: PDFDocumentProxy | null
): Promise<boolean> {
  const canvas = await capturePageCompositeCanvas(pageNumber, pdfDoc);
  if (!canvas) return false;

  const dataUrl = canvas.toDataURL('image/png');

  // Strategy 1: Tauri native desktop pasteboard (macOS/Windows/Linux)
  if (isTauri()) {
    try {
      const nativeOk = await tauriCopyImageToClipboard(dataUrl);
      if (nativeOk) return true;
    } catch (e) {
      console.warn('Tauri native copy image failed, attempting browser clipboard:', e);
    }
  }

  // Strategy 2: Modern Browser Async Clipboard API
  if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      const blobPromise = new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob returned null'));
        }, 'image/png');
      });

      const item = new ClipboardItem({ 'image/png': blobPromise });
      await navigator.clipboard.write([item]);
      return true;
    } catch (clipErr) {
      console.error('Browser ClipboardItem write failed:', clipErr);
    }
  }

  return false;
}

/**
 * Download composite page image as high-res JPG (Optional standalone download action)
 */
export async function downloadPageAsJpg(
  pageNumber: number | unknown,
  pdfDoc?: PDFDocumentProxy | null,
  baseFileName: string = 'document'
): Promise<boolean> {
  const canvas = await capturePageCompositeCanvas(pageNumber, pdfDoc);
  if (!canvas) return false;

  const safePageNum =
    typeof pageNumber === 'number' && !isNaN(pageNumber)
      ? Math.max(1, Math.floor(pageNumber))
      : 1;

  try {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    link.href = dataUrl;
    const cleanName = baseFileName.replace(/\.pdf$/i, '');
    link.download = `${cleanName}_page_${safePageNum}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('Failed to download JPG:', err);
    return false;
  }
}
