import { describe, expect, test } from 'bun:test';
import { PDFDocument } from 'pdf-lib';
import {
  deletePageFromPdf,
  reindexAfterPageDeletion,
} from '../src/utils/pageExtractor';

describe('page deletion', () => {
  test('removes the requested PDF page', async () => {
    const source = await PDFDocument.create();
    source.addPage([100, 200]);
    source.addPage([200, 300]);
    source.addPage([300, 400]);

    const updatedBytes = await deletePageFromPdf(await source.save(), 2);
    const updated = await PDFDocument.load(updatedBytes);

    expect(updated.getPageCount()).toBe(2);
    expect(updated.getPage(0).getWidth()).toBe(100);
    expect(updated.getPage(1).getWidth()).toBe(300);
  });

  test('does not allow deleting the only page', async () => {
    const source = await PDFDocument.create();
    source.addPage();

    await expect(deletePageFromPdf(await source.save(), 1)).rejects.toThrow(
      'A PDF must keep at least one page.'
    );
  });

  test('removes page-bound data and shifts later page numbers', () => {
    const entries = [
      { id: 'before', pageNumber: 1 },
      { id: 'divider' },
      { id: 'deleted', pageNumber: 2 },
      { id: 'after', pageNumber: 3 },
    ];

    expect(reindexAfterPageDeletion(entries, 2)).toEqual([
      { id: 'before', pageNumber: 1 },
      { id: 'divider' },
      { id: 'after', pageNumber: 2 },
    ]);
  });
});
