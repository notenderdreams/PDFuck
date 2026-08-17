import React from 'react';
import { X, RotateCcw, Check, Moon, Sun, BookOpen } from 'lucide-react';
import type { ReadingTheme, ThemeSettings } from '../utils/types';

interface ColorThemeModalProps {
  isOpen: boolean;
  settings: ThemeSettings;
  onClose: () => void;
  onSelectTheme: (theme: ReadingTheme) => void;
  onUpdateSetting: <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) => void;
  onResetFilters: () => void;
}

const THEMES: {
  id: ReadingTheme;
  name: string;
  desc: string;
  bgPreview: string;
  textPreview: string;
}[] = [
  {
    id: 'default',
    name: 'Original Paper',
    desc: 'Clean standard document view',
    bgPreview: 'bg-white',
    textPreview: 'text-zinc-900',
  },
  {
    id: 'invert',
    name: 'Smart Invert (Dark)',
    desc: 'Balanced chrominance dark mode',
    bgPreview: 'bg-[#18181b]',
    textPreview: 'text-zinc-200',
  },
  {
    id: 'oled',
    name: 'OLED Pitch Black',
    desc: 'Pure #000000 true black background',
    bgPreview: 'bg-[#000000]',
    textPreview: 'text-white',
  },
  {
    id: 'sepia',
    name: 'Warm Eye-Care Sepia',
    desc: '5200K tone for prolonged reading',
    bgPreview: 'bg-[#f6eee3]',
    textPreview: 'text-[#433422]',
  },
  {
    id: 'nord',
    name: 'Nord Slate Night',
    desc: 'Cool Arctic dark theme',
    bgPreview: 'bg-[#2e3440]',
    textPreview: 'text-[#eceff4]',
  },
  {
    id: 'matrix',
    name: 'Cyberpunk Matrix',
    desc: 'High-contrast phosphor green',
    bgPreview: 'bg-[#0d1a0d]',
    textPreview: 'text-[#39ff14]',
  },
];

export const ColorThemeModal: React.FC<ColorThemeModalProps> = ({
  isOpen,
  settings,
  onClose,
  onSelectTheme,
  onUpdateSetting,
  onResetFilters,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in text-xs">
      <div className="w-full max-w-md bg-[#25252c] border border-[#383846] rounded-xl p-5 shadow-2xl flex flex-col gap-4 animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-white tracking-tight">
              Reading Themes & Color Invert
            </h3>
            <p className="text-[11px] text-zinc-400">
              Select ergonomic palette & adjust raster filters
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#32323c] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Theme Grid */}
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => {
            const isSelected = settings.theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTheme(t.id)}
                className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                  isSelected
                    ? 'border-[#0080f0] bg-[#0080f0]/15 shadow-sm ring-1 ring-[#0080f0]'
                    : 'border-[#363644] bg-[#1e1e24] hover:bg-[#2a2a34] hover:border-[#424254]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs ${t.bgPreview}`}
                    />
                    <span className="font-semibold text-zinc-200 text-xs">
                      {t.name}
                    </span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#38bdf8]" />}
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  {t.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Brightness & Contrast Sliders */}
        <div className="p-3 rounded-lg bg-[#1e1e24] border border-[#32323e] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-300">Document Brightness</span>
            <span className="font-mono text-zinc-400">{settings.brightness}%</span>
          </div>
          <input
            type="range"
            min="60"
            max="140"
            value={settings.brightness}
            onChange={(e) => onUpdateSetting('brightness', parseInt(e.target.value, 10))}
            className="w-full accent-[#0080f0] cursor-pointer h-1"
          />

          <div className="flex items-center justify-between mt-1">
            <span className="font-medium text-zinc-300">Document Contrast</span>
            <span className="font-mono text-zinc-400">{settings.contrast}%</span>
          </div>
          <input
            type="range"
            min="60"
            max="150"
            value={settings.contrast}
            onChange={(e) => onUpdateSetting('contrast', parseInt(e.target.value, 10))}
            className="w-full accent-[#0080f0] cursor-pointer h-1"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-zinc-400 hover:text-white hover:bg-[#32323c] transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-[#0080f0] hover:bg-[#0070dc] text-white font-semibold shadow-sm transition-all active:scale-98"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
