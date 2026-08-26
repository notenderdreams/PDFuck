import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(new URL(`../${path}`, import.meta.url)).text();
}

describe('plain text and sticky note tools', () => {
  test('offers separate toolbar tools and keyboard shortcuts', async () => {
    const [toolbar, keyboard, shortcuts] = await Promise.all([
      source('src/components/Toolbar.tsx'),
      source('src/hooks/useKeyboard.ts'),
      source('src/components/KeyboardShortcutsModal.tsx'),
    ]);

    expect(toolbar).toContain("{ id: 'text', icon: Type, label: 'Plain Text', shortcut: 'T' }");
    expect(toolbar).toContain("{ id: 'sticky-note', icon: StickyNote, label: 'Sticky Note', shortcut: 'N' }");
    expect(keyboard).toContain("options.onSelectTool('sticky-note')");
    expect(shortcuts).toContain("{ keys: ['T'], desc: 'Plain Text Tool' }");
    expect(shortcuts).toContain("{ keys: ['N'], desc: 'Sticky Note Tool' }");
  });

  test('stores a presentation kind while treating legacy notes as sticky', async () => {
    const [canvas, overlay, exporter] = await Promise.all([
      source('src/components/AnnotationCanvas.tsx'),
      source('src/components/TextNoteOverlay.tsx'),
      source('src/utils/pdfExporter.ts'),
    ]);

    expect(canvas).toContain("kind: textInputKind");
    expect(canvas).toContain("textInputKind === 'plain' ? selectedColor : '#fef08a'");
    expect(canvas).toContain('aria-label="Add plain text"');
    expect(canvas).toContain('onBlur={handleSaveTextNote}');
    expect(canvas).toContain("textInputPos && textInputKind === 'sticky'");
    expect(canvas).toContain('const t1 = setTimeout(focusTextarea, 0);');
    expect(canvas).toContain("activeTool === 'text' ? 'cursor-text' : 'cursor-crosshair'");
    expect(canvas).toContain('if (textInputPos) handleSaveTextNote();');
    expect(canvas).toContain("e.key === 'Enter' && !e.shiftKey");
    expect(canvas).toContain("rows={Math.max(1, textInputValue.split('\\n').length)}");
    expect(overlay).toContain("if (annotation.kind === 'plain')");
    expect(overlay).toContain('aria-label="Edit plain text"');
    expect(overlay).toContain('onBlur={handleSaveEdit}');
    expect(overlay).toContain(
      'textareaRef.current?.setSelectionRange(annotation.text.length, annotation.text.length)'
    );
    expect(overlay).not.toContain('flex min-w-[180px] flex-col gap-1.5 rounded-lg');
    expect(exporter).toContain("const isPlainText = textAnn.kind === 'plain'");
    expect(exporter).toContain('if (!isPlainText)');
  });
});
