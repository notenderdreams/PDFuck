import React from 'react';
import { X, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'File & View',
    items: [
      { keys: ['Cmd', 'O'], desc: 'Open PDF file' },
      { keys: ['Cmd', 'S'], desc: 'Export / Save Modified PDF' },
      { keys: ['Cmd', 'Shift', 'S'], desc: 'Save Annotations JSON' },
      { keys: ['Cmd', 'I'], desc: 'Quick Invert Colors' },
      { keys: ['Cmd', 'F'], desc: 'Find / Search Text' },
      { keys: ['F'], desc: 'Toggle Fullscreen Zen Mode' },
    ],
  },
  {
    title: 'Studio Tools',
    items: [
      { keys: ['H'], desc: 'Highlighter Pen Tool' },
      { keys: ['R'], desc: 'Area / Rectangle Highlight' },
      { keys: ['P'], desc: 'Vector Freehand Pen' },
      { keys: ['I'], desc: 'Attach Image / Stamp' },
      { keys: ['T'], desc: 'Text Note Tool' },
      { keys: ['E'], desc: 'Eraser (Sweep / Click)' },
      { keys: ['V'], desc: 'Pointer / Select Tool' },
    ],
  },
  {
    title: 'Navigation & Zoom',
    items: [
      { keys: ['Cmd', '+'], desc: 'Zoom In' },
      { keys: ['Cmd', '-'], desc: 'Zoom Out' },
      { keys: ['Cmd', '0'], desc: 'Reset Zoom (100%)' },
      { keys: ['→', 'J'], desc: 'Next Page' },
      { keys: ['←', 'K'], desc: 'Previous Page' },
      { keys: ['Cmd', 'Z'], desc: 'Undo' },
      { keys: ['Cmd', 'Shift', 'Z'], desc: 'Redo' },
    ],
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in text-xs">
      <div className="w-full max-w-lg bg-[#25252c] border border-[#383846] rounded-xl p-5 shadow-2xl flex flex-col gap-4 animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-[#0080f0]/15 border border-[#0080f0]/30 text-[#38bdf8]">
              <Command className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Studio Keyboard Shortcuts
              </h3>
              <p className="text-[11px] text-zinc-400">
                Quick commands for fluid document workflow
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#32323c] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcut Groups */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SHORTCUT_GROUPS.map((group, gIdx) => (
            <div
              key={gIdx}
              className="p-3 rounded-lg bg-[#1e1e24] border border-[#32323e] flex flex-col gap-2"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {group.title}
              </span>
              <div className="flex flex-col gap-1.5">
                {group.items.map((item, iIdx) => (
                  <div key={iIdx} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-1 py-0.5 text-[9px] font-mono font-semibold bg-[#2a2a34] text-zinc-200 border border-[#3c3c4a] rounded shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                    <span className="text-[10.5px] text-zinc-400 leading-tight">
                      {item.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center text-[11px] text-zinc-500 pt-0.5">
          Press <kbd className="px-1 py-0.5 bg-[#2a2a34] rounded text-[10px] font-mono text-zinc-300">?</kbd> anytime to open this guide.
        </div>
      </div>
    </div>
  );
};
