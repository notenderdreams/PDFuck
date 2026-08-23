import { pdfjsLib } from './pdfWorker';

export async function getPdfPageCount(data: Uint8Array): Promise<number> {
  const loadingTask = pdfjsLib.getDocument({ data: data.slice() });
  try {
    const document = await loadingTask.promise;
    return document.numPages;
  } finally {
    await loadingTask.destroy();
  }
}
