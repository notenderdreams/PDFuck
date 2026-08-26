import { describe, expect, test } from 'bun:test';

const projectFile = (path: string) => Bun.file(new URL(`../${path}`, import.meta.url)).text();

describe('annotation keyboard shortcuts', () => {
  test('U selects underline-line mode without changing the general highlight style', async () => {
    const [keyboardSource, appSource, modalSource] = await Promise.all([
      projectFile('src/hooks/useKeyboard.ts'),
      projectFile('src/App.tsx'),
      projectFile('src/components/KeyboardShortcutsModal.tsx'),
    ]);

    expect(keyboardSource).toContain("case 'u':");
    expect(keyboardSource).toContain('options.onSelectUnderlineTool?.()');
    expect(appSource).toContain("setLineHighlightStyle('underline')");
    expect(appSource).not.toContain("onSelectUnderlineTool: () => setHighlightStyle('underline')");
    expect(modalSource).toContain("{ keys: ['U'], desc: 'Straight Underline Tool' }");
  });
});
