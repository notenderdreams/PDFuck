import { describe, expect, test, beforeEach } from 'bun:test';

// In-memory mock for localStorage in test environment
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

// Install localStorage global before importing storage
const mockStorage = createLocalStorageMock();
(globalThis as unknown as { localStorage: typeof mockStorage }).localStorage = mockStorage;

import {
  loadLibraryFilter,
  saveLibraryFilter,
  loadLibrarySort,
  saveLibrarySort,
  loadSavedDirectories,
  saveSavedDirectories,
} from '../src/utils/storage';

describe('Library filter & folder selection persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('defaults to "all" filter and "recent" sort when uninitialized', () => {
    expect(loadLibraryFilter()).toBe('all');
    expect(loadLibrarySort()).toBe('recent');
  });

  test('persists view filter tabs (recent, favorites, all)', () => {
    saveLibraryFilter('favorites');
    expect(loadLibraryFilter()).toBe('favorites');

    saveLibraryFilter('recent');
    expect(loadLibraryFilter()).toBe('recent');

    saveLibraryFilter('all');
    expect(loadLibraryFilter()).toBe('all');
  });

  test('persists selected folder directory ID/path', () => {
    const folderPath = '/Users/test/Documents/ResearchPDFs';
    saveLibraryFilter(folderPath);
    expect(loadLibraryFilter()).toBe(folderPath);
  });

  test('persists library sorting option', () => {
    saveLibrarySort('name');
    expect(loadLibrarySort()).toBe('name');

    saveLibrarySort('size');
    expect(loadLibrarySort()).toBe('size');

    saveLibrarySort('recent');
    expect(loadLibrarySort()).toBe('recent');
  });

  test('persists saved directories list', () => {
    const dirs = [
      { id: 'dir1', name: 'Work', path: '/work', addedAt: 1000, pdfCount: 5 },
      { id: 'dir2', name: 'Personal', path: '/personal', addedAt: 2000, pdfCount: 12 },
    ];
    saveSavedDirectories(dirs);
    expect(loadSavedDirectories()).toEqual(dirs);
  });
});
