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

  test('number keys select palette colors and recolor a selected highlight', async () => {
    const [keyboardSource, appSource, toolbarSource] = await Promise.all([
      projectFile('src/hooks/useKeyboard.ts'),
      projectFile('src/App.tsx'),
      projectFile('src/components/Toolbar.tsx'),
    ]);

    expect(keyboardSource).toContain("if (/^[1-8]$/.test(e.key))");
    expect(keyboardSource).toContain('options.onSelectHighlightColor?.(Number(e.key) - 1)');
    expect(appSource).toContain('setSelectedColor(color);');
    expect(appSource).toContain("selectedAnnotation.type === 'highlight-text'");
    expect(appSource).toContain('updateAnnotation(selectedAnnotation.id, { color });');
    expect(appSource).not.toContain('if (!isHighlightTool(activeTool)) return;');
    expect(appSource).toContain('setSelectedColor(selectedAnnotation.color);');
    expect(appSource).toContain('colorPresets={highlightColors}');
    expect(appSource).toContain('replaceHighlightPaletteColor');
    expect(toolbarSource).toContain('onReplaceSelectedColor(e.target.value)');
    expect(toolbarSource).toContain('aria-label={`Select highlight color ${index + 1}`}');
    expect(toolbarSource).toContain('className={`macos-color-orb');
    expect(toolbarSource).toContain('<Palette className="h-4 w-4" aria-hidden="true" />');
    expect(toolbarSource).not.toContain('fill={selectedColor}');
    expect(toolbarSource).toContain('aria-label="Choose a custom color"');
    expect(toolbarSource).toContain(
      'text-[9px] leading-none font-mono font-semibold text-[var(--muted-foreground)]'
    );
    expect(toolbarSource).not.toContain('text-white mix-blend-difference');
  });
});
