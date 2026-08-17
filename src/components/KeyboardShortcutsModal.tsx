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
      { keys: ['Cmd', 'I'], desc: 'Quick Invert Colors (Dark Mode)' },
      { keys: ['Cmd', 'F'], desc: 'Find / Search Text' },
      { keys: ['F'], desc: 'Toggle Fullscreen Focus (Zen)' },
    ],
  },
  {
    title: 'Annotation Tools',
    items: [
      { keys: ['H'], desc: 'Highlighter Pen Tool' },
      { keys: ['R'], desc: 'Area / Rectangle Highlight' },
      { keys: ['P'], desc: 'Freehand Pen Tool' },
      { keys: ['I'], desc: 'Attach Image / Stamp' },
      { keys: ['T'], desc: 'Text Note Tool' },
      { keys: ['E'], desc: 'Eraser Tool' },
      { keys: ['V'], desc: 'Select / Move Cursor' },
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-xl double-bezel bg-[#121216]/95 border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Command className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Keyboard Shortcuts
              </h3>
              <p className="text-xs text-zinc-400">
                Speed up your reading and annotation workflow
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcut Groups */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SHORTCUT_GROUPS.map((group, gIdx) => (
            <div
              key={gIdx}
              className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-2.5"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                {group.title}
              </span>
              <div className="flex flex-col gap-2">
                {group.items.map((item, iIdx) => (
                  <div key={iIdx} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white/10 text-zinc-200 border border-white/10 rounded shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                    <span className="text-[11px] text-zinc-400 leading-tight">
                      {item.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center text-xs text-zinc-500 pt-1">
          Press <kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px] font-mono text-zinc-300">?</kbd> anytime to open this helper.
        </div>
      </div>
    </div>
  );
};
