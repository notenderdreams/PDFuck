import React from 'react';
import { X, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'Mouse & Gestures',
    items: [
      { keys: ['Cmd / Ctrl', 'Wheel'], desc: 'Zoom In / Out Smoothly' },
      { keys: ['Pinch'], desc: 'Trackpad Pinch to Zoom' },
      { keys: ['Space', 'Drag'], desc: 'Pan / Hand Tool' },
      { keys: ['Middle Click', 'Drag'], desc: 'Pan Viewport' },
      { keys: ['Cmd', 'V'], desc: 'Paste Image at Mouse Cursor' },
    ],
  },
  {
    title: 'Annotation Tools',
    items: [
      { keys: ['H'], desc: 'Highlighter Pen Tool' },
      { keys: ['R'], desc: 'Area Highlight Box' },
      { keys: ['P'], desc: 'Freehand Pen' },
      { keys: ['I'], desc: 'Attach Image / Stamp' },
      { keys: ['T'], desc: 'Text Note Tool' },
      { keys: ['E'], desc: 'Eraser (Sweep / Click)' },
      { keys: ['V'], desc: 'Select / Pointer Tool' },
    ],
  },
  {
    title: 'Navigation & View',
    items: [
      { keys: ['Cmd', 'O'], desc: 'Open PDF File' },
      { keys: ['Cmd', 'S'], desc: 'Save Modified PDF' },
      { keys: ['Cmd', 'I'], desc: 'Invert Colors' },
      { keys: ['Cmd', 'F'], desc: 'Find Text in Document' },
      { keys: ['→', 'J'], desc: 'Next Page' },
      { keys: ['←', 'K'], desc: 'Previous Page' },
      { keys: ['F'], desc: 'Fullscreen Focus Mode' },
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
      <div className="w-full max-w-lg bg-[#24242b] border border-[#383846] rounded-xl p-5 shadow-2xl flex flex-col gap-4 animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-[#1e1e24] border border-[#343440] text-zinc-300">
              <Command className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
                Keyboard & Mouse Shortcuts
              </h3>
              <p className="text-[11px] text-zinc-400">
                Quick gestures and keys for fast navigation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon w-7 h-7"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcut Groups */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SHORTCUT_GROUPS.map((group, gIdx) => (
            <div
              key={gIdx}
              className="p-3 rounded-lg bg-[#1e1e24] border border-[#343440] flex flex-col gap-2"
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                {group.title}
              </span>
              <div className="flex flex-col gap-1.5">
                {group.items.map((item, iIdx) => (
                  <div key={iIdx} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-1 py-0.5 text-[9px] font-mono font-medium bg-[#282832] text-zinc-200 border border-[#3c3c4a] rounded shadow-xs"
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
          Press <kbd className="px-1 py-0.5 bg-[#282832] border border-[#3c3c4a] rounded text-[10px] font-mono text-zinc-300">?</kbd> anytime to open shortcuts.
        </div>
      </div>
    </div>
  );
};
