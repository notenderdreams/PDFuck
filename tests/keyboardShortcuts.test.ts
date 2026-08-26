import { describe, expect, test } from 'bun:test';

const projectFile = (path: string) => Bun.file(new URL(`../${path}`, import.meta.url)).text();

describe('annotation keyboard shortcuts', () => {
  test('U underlines selected text before falling back to the underline-line tool', async () => {
    const [keyboardSource, appSource, modalSource] = await Promise.all([
      projectFile('src/hooks/useKeyboard.ts'),
      projectFile('src/App.tsx'),
      projectFile('src/components/KeyboardShortcutsModal.tsx'),
    ]);

    expect(keyboardSource).toContain("case 'u':");
    expect(keyboardSource).toContain('options.onSelectUnderlineTool?.()');
    expect(appSource).toContain("if (addHighlightsFromSelection('underline', false)) return;");
    expect(appSource).toContain("handleSelectTool('highlight-line')");
    expect(appSource).toContain("setLineHighlightStyle('underline')");
    expect(modalSource).toContain(
      "{ keys: ['U'], desc: 'Underline Selected Text / Tool' }"
    );
  });
});
