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

  test('number keys select palette colors only through the highlight-mode callback', async () => {
    const [keyboardSource, appSource, toolbarSource] = await Promise.all([
      projectFile('src/hooks/useKeyboard.ts'),
      projectFile('src/App.tsx'),
      projectFile('src/components/Toolbar.tsx'),
    ]);

    expect(keyboardSource).toContain("if (/^[1-8]$/.test(e.key))");
    expect(keyboardSource).toContain('options.onSelectHighlightColor?.(Number(e.key) - 1)');
    expect(appSource).toContain('if (!isHighlightTool(activeTool)) return;');
    expect(toolbarSource).toContain('aria-label={`Select highlight color ${index + 1}`}');
    expect(toolbarSource).toContain(
      'text-[9px] leading-none font-mono font-semibold text-[var(--muted-foreground)]'
    );
    expect(toolbarSource).not.toContain('text-white mix-blend-difference');
  });
});
