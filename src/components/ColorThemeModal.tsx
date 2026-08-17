import React from 'react';
import { X, RotateCcw, Check, Moon, Sun, BookOpen, Monitor } from 'lucide-react';
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
    desc: 'Standard clean high-resolution document view',
    bgPreview: 'bg-white',
    textPreview: 'text-zinc-900',
  },
  {
    id: 'invert',
    name: 'Smart Invert (Dark)',
    desc: 'Ergonomic dark theme with balanced color chrominance',
    bgPreview: 'bg-[#18181b]',
    textPreview: 'text-zinc-200',
  },
  {
    id: 'oled',
    name: 'OLED Pitch Black',
    desc: 'Pure #000000 black background for maximum contrast & battery saving',
    bgPreview: 'bg-[#000000]',
    textPreview: 'text-white',
  },
  {
    id: 'sepia',
    name: 'Warm Eye-Care Sepia',
    desc: 'Cozy 5200K tone for reading without eye fatigue',
    bgPreview: 'bg-[#f6eee3]',
    textPreview: 'text-[#433422]',
  },
  {
    id: 'nord',
    name: 'Nord Slate Night',
    desc: 'Cool icy slate theme inspired by Nordic design',
    bgPreview: 'bg-[#2e3440]',
    textPreview: 'text-[#eceff4]',
  },
  {
    id: 'matrix',
    name: 'Cyberpunk Matrix',
    desc: 'Phosphor green terminal contrast for code & schematics',
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md double-bezel bg-[#121216]/95 border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-base font-bold text-white tracking-tight">
              Reading Themes & Color Invert
            </h3>
            <p className="text-xs text-zinc-400">
              Customize eye comfort, contrast, and dark mode luminance
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Theme Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {THEMES.map((t) => {
            const isSelected = settings.theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTheme(t.id)}
                className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all relative ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.3)] ring-1 ring-blue-500'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 rounded-full border border-white/20 shadow-inner ${t.bgPreview}`}
                    />
                    <span className="text-xs font-semibold text-zinc-200">
                      {t.name}
                    </span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  {t.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Brightness & Contrast Sliders */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-300">Document Brightness</span>
            <span className="font-mono text-zinc-400">{settings.brightness}%</span>
          </div>
          <input
            type="range"
            min="60"
            max="140"
            value={settings.brightness}
            onChange={(e) => onUpdateSetting('brightness', parseInt(e.target.value, 10))}
            className="w-full accent-blue-500 cursor-pointer"
          />

          <div className="flex items-center justify-between text-xs mt-1">
            <span className="font-medium text-zinc-300">Document Contrast</span>
            <span className="font-mono text-zinc-400">{settings.contrast}%</span>
          </div>
          <input
            type="range"
            min="60"
            max="150"
            value={settings.contrast}
            onChange={(e) => onUpdateSetting('contrast', parseInt(e.target.value, 10))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
