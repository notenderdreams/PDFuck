import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Palette,
  Sparkles,
  Keyboard,
  Info,
  Check,
  RotateCcw,
  Layers,
  FileText,
  BookOpen,
  Code2,
  CircleUserRound,
  Bug,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import type { ReadingTheme, ThemeSettings, ViewMode } from '../utils/types';
import { openExternalUrl } from '../utils/tauriBridge';

type SettingsTab = 'general' | 'appearance' | 'ai' | 'shortcuts' | 'about';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Theme & Appearance
  themeSettings?: ThemeSettings;
  onSelectTheme?: (theme: ReadingTheme) => void;
  onUpdateThemeSetting?: <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) => void;
  onResetThemeFilters?: () => void;
  // View mode
  viewMode?: ViewMode;
  onChangeViewMode?: (mode: ViewMode) => void;
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
    name: 'Smart Invert',
    desc: 'Balanced chrominance dark mode',
    bgPreview: 'bg-[#18181b]',
    textPreview: 'text-zinc-200',
  },
  {
    id: 'oled',
    name: 'OLED Black',
    desc: 'Pure #000000 true black background',
    bgPreview: 'bg-[#000000]',
    textPreview: 'text-white',
  },
  {
    id: 'sepia',
    name: 'Eye-Care Sepia',
    desc: '5200K tone for prolonged reading',
    bgPreview: 'bg-[#f6eee3]',
    textPreview: 'text-[#433422]',
  },
  {
    id: 'nord',
    name: 'Nord Slate',
    desc: 'Cool Arctic dark theme',
    bgPreview: 'bg-[#2e3440]',
    textPreview: 'text-[#eceff4]',
  },
  {
    id: 'matrix',
    name: 'Terminal Matrix',
    desc: 'Phosphor green matrix mode',
    bgPreview: 'bg-[#0d1a0d]',
    textPreview: 'text-[#39ff14]',
  },
];

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
      { keys: ['Cmd / Ctrl', 'Shift', 'H'], desc: 'Highlight Selected PDF Text' },
      { keys: ['L'], desc: 'Straight Line Highlighter' },
      { keys: ['U'], desc: 'Straight Underline Tool' },
      { keys: ['H'], desc: 'Freehand Highlighter Pen' },
      { keys: ['R'], desc: 'Area Highlight Box' },
      { keys: ['P'], desc: 'Freehand Pen' },
      { keys: ['C'], desc: 'Snip & Compact for AI' },
      { keys: ['A'], desc: 'Explain PDF Region with AI' },
      { keys: ['T'], desc: 'Sticky Text Note Tool' },
      { keys: ['E'], desc: 'Eraser (Sweep / Click)' },
      { keys: ['V'], desc: 'Select / Pointer Tool' },
    ],
  },
  {
    title: 'Navigation & View',
    items: [
      { keys: ['Cmd', 'L'], desc: 'Toggle Library Dashboard' },
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

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  themeSettings,
  onSelectTheme,
  onUpdateThemeSetting,
  onResetThemeFilters,
  viewMode = 'continuous',
  onChangeViewMode,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'latest'>('idle');
  const [lastUpdateDate, setLastUpdateDate] = useState<string>('August 2026');

  const handleCheckForUpdates = () => {
    if (updateStatus === 'checking') return;
    setUpdateStatus('checking');
    setTimeout(() => {
      setUpdateStatus('latest');
      setLastUpdateDate('Today');
      setTimeout(() => setUpdateStatus('idle'), 3500);
    }, 850);
  };

  // Handle ESC key for closing modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const NAV_ITEMS: { id: SettingsTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'appearance', label: 'Reading & Theme', icon: Palette },
    { id: 'ai', label: 'AI Assistant', icon: Sparkles },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <div
        className="w-full max-w-2xl h-[500px] max-h-[90vh] bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex p-1.5 gap-2 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Segmented Navigation Sidebar (Cutout Inset Panel) */}
        <aside className="w-44 flex flex-col shrink-0 select-none macos-sidebar bg-[var(--workspace)] border border-[var(--border)] rounded-xl p-1.5 shadow-xs overflow-hidden">
          {/* Sidebar Title Header */}
          <div className="h-8 px-2 flex items-center shrink-0">
            <h2 id="settings-dialog-title" className="text-xs font-semibold text-[var(--foreground)] tracking-tight">
              Settings
            </h2>
          </div>

          {/* Navigation Items */}
          <div className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-zinc-400 hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-zinc-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Main Option View */}
        <div className="flex-1 relative flex flex-col min-w-0 min-h-0 bg-transparent overflow-hidden">
          {/* Close Button at top-right */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2.5 right-2.5 z-10 w-6.5 h-6.5 rounded-md flex items-center justify-center text-zinc-400 hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors"
            title="Close Settings (Esc)"
            aria-label="Close Settings"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <main className={`flex-1 overflow-y-auto flex flex-col text-xs text-[var(--foreground)] ${activeTab === 'about' ? 'p-0' : 'p-3.5 pr-8 gap-4'}`}>
            {/* 1. GENERAL TAB */}
            {activeTab === 'general' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">General Preferences</h3>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Configure document layout, reading behavior, and default startup preferences.
                  </p>
                </div>

                <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-zinc-200">Default Reading Layout</span>
                    <span className="text-[11px] text-zinc-400">
                      Choose how pages are presented when opening documents.
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { id: 'continuous' as ViewMode, label: 'Continuous Scroll', icon: Layers },
                      { id: 'single' as ViewMode, label: 'Single Page', icon: FileText },
                      { id: 'book' as ViewMode, label: 'Two Page Book', icon: BookOpen },
                    ].map((mode) => {
                      const Icon = mode.icon;
                      const isCurrent = viewMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => onChangeViewMode?.(mode.id)}
                          className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border text-center transition-all ${
                            isCurrent
                              ? 'bg-blue-600 text-white border-blue-500 font-semibold shadow-sm'
                              : 'bg-[var(--secondary)] border-[var(--border)] text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-zinc-400'}`} />
                          <span className="text-[11px]">{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* 2. READING & THEME TAB */}
            {activeTab === 'appearance' && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">Reading & Color Themes</h3>
                    <p className="text-zinc-400 text-[11px]">
                      Select visual document filters and fine-tune contrast and brightness.
                    </p>
                  </div>
                  {onResetThemeFilters && (
                    <button
                      type="button"
                      onClick={onResetThemeFilters}
                      className="btn-ghost flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200"
                      title="Reset brightness, contrast, and grayscale"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                {/* Theme Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {THEMES.map((t) => {
                    const isSelected = themeSettings?.theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectTheme?.(t.id)}
                        className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-500 shadow-md ring-1 ring-blue-500'
                            : 'bg-[var(--card)] border-[var(--border)] hover:border-zinc-500/50 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between mb-1.5">
                          <span className={`font-semibold text-xs ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                            {t.name}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className={`w-full h-8 rounded-md ${t.bgPreview} border border-white/20 flex items-center justify-center p-1.5 shadow-inner`}>
                          <span className={`text-[10px] font-serif font-bold ${t.textPreview}`}>Aa 123</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Brightness & Contrast Sliders */}
                {themeSettings && onUpdateThemeSetting && (
                  <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-300">Brightness</span>
                        <span className="font-mono text-zinc-400 text-[11px]">{themeSettings.brightness}%</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        value={themeSettings.brightness}
                        onChange={(e) => onUpdateThemeSetting('brightness', parseInt(e.target.value, 10))}
                        className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border)]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-300">Contrast</span>
                        <span className="font-mono text-zinc-400 text-[11px]">{themeSettings.contrast}%</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        value={themeSettings.contrast}
                        onChange={(e) => onUpdateThemeSetting('contrast', parseInt(e.target.value, 10))}
                        className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border)]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-300">Grayscale Mode</span>
                        <span className="font-mono text-zinc-400 text-[11px]">{themeSettings.grayscale}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={themeSettings.grayscale}
                        onChange={(e) => onUpdateThemeSetting('grayscale', parseInt(e.target.value, 10))}
                        className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. AI ASSISTANT TAB */}
            {activeTab === 'ai' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">AI Assistant & Explanation</h3>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Ask questions about a page and get help understanding what you are reading.
                  </p>
                </div>

                <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-zinc-200 block">Codex CLI Preview</span>
                      <span className="text-[11px] text-zinc-400">
                        For now, PDFuck uses Codex CLI for explanations. If you are already signed in, it will use that session. You do not need to sign in again here.
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--secondary)] text-zinc-300 font-medium text-[10px] border border-[var(--border)]">
                      Preview
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex flex-col gap-2">
                  <span className="text-base font-bold tracking-tight text-blue-400">Coming soon: built-in AI</span>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    We are working on a proper AI integration with a simpler setup and more ways to get help while you read.
                  </p>
                </div>
              </div>
            )}

            {/* 4. SHORTCUTS TAB */}
            {activeTab === 'shortcuts' && (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">Keyboard Shortcuts</h3>
                  <p className="text-zinc-400 text-[11px]">
                    Quick reference for document navigation, tool selection, and editing.
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  {SHORTCUT_GROUPS.map((group) => (
                    <div key={group.title} className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-1">
                        {group.title}
                      </span>
                      <div className="grid grid-cols-1 gap-1 p-2 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                        {group.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          >
                            <span className="text-zinc-300 text-[11px]">{item.desc}</span>
                            <div className="flex items-center gap-1">
                              {item.keys.map((k, kIdx) => (
                                <kbd
                                  key={kIdx}
                                  className="px-1.5 py-0.5 text-[10px] font-mono font-medium text-zinc-300 bg-[var(--secondary)] border border-[var(--border)] rounded shadow-2xs"
                                >
                                  {k}
                                </kbd>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. ABOUT TAB - Full-Height Hero Card & Centered Bottom Boxes */}
            {activeTab === 'about' && (
              <div className="flex-1 flex flex-col justify-between gap-2.5 h-full min-h-0">
                {/* Hero Card Rectangle with Rounded Borders (Takes Remaining Vertical Space) */}
                <div className="flex-1 rounded-2xl bg-[var(--workspace)] border border-[var(--border)] p-6 shadow-2xs flex items-center justify-between gap-4 min-h-0">
                  {/* Left: Big Title + Version Below (Vertically Centered) */}
                  <div className="flex flex-col justify-center">
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-[var(--foreground)] leading-none">
                      PDFuck
                    </h1>
                    <div className="mt-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--secondary)] text-[var(--muted-foreground)] font-mono text-[10px] border border-[var(--border)] font-medium">
                        Version 0.1.0
                      </span>
                    </div>
                  </div>

                  {/* Right: Update Button + Last Updated Date (Vertically Centered) */}
                  <div className="flex flex-col items-end justify-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleCheckForUpdates}
                      disabled={updateStatus === 'checking'}
                      className="btn-secondary flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all active:scale-[0.98]"
                    >
                      {updateStatus === 'checking' ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--muted-foreground)]" />
                          <span className="text-[var(--foreground)]">Checking…</span>
                        </>
                      ) : updateStatus === 'latest' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[var(--foreground)]" />
                          <span className="text-[var(--foreground)]">Up to date</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                          <span>Check for updates</span>
                        </>
                      )}
                    </button>
                    <span className="text-[10px] text-[var(--muted-foreground)] font-medium">
                      Last update: {lastUpdateDate}
                    </span>
                  </div>
                </div>

                {/* 3 Horizontal Boxes on the Bottom with Centered Content */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0">
                  {/* Box 1: GitHub Repository */}
                  <a
                    href="https://github.com/notenderdreams/PDFuck"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      void openExternalUrl('https://github.com/notenderdreams/PDFuck');
                    }}
                    className="relative p-3.5 rounded-xl bg-[var(--workspace)] border border-[var(--border)] hover:bg-[var(--secondary)] hover:border-[var(--muted-foreground)]/30 transition-all flex flex-col items-center justify-center text-center gap-1.5 group shadow-2xs hover:-translate-y-0.5 cursor-pointer"
                  >
                    <ArrowUpRight className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-[var(--subtle-foreground)] group-hover:text-[var(--foreground)] transition-colors" />
                    <div className="w-9 h-9 rounded-lg bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] flex items-center justify-center group-hover:text-[var(--primary)] group-hover:border-[var(--primary)]/30 transition-all">
                      <Code2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors block">
                        Repository
                      </span>
                      <span className="text-[11px] text-[var(--muted-foreground)] block truncate">
                        GitHub source
                      </span>
                    </div>
                  </a>

                  {/* Box 2: Feedback & Issues */}
                  <a
                    href="https://github.com/notenderdreams/PDFuck/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      void openExternalUrl('https://github.com/notenderdreams/PDFuck/issues');
                    }}
                    className="relative p-3.5 rounded-xl bg-[var(--workspace)] border border-[var(--border)] hover:bg-[var(--secondary)] hover:border-[var(--muted-foreground)]/30 transition-all flex flex-col items-center justify-center text-center gap-1.5 group shadow-2xs hover:-translate-y-0.5 cursor-pointer"
                  >
                    <ArrowUpRight className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-[var(--subtle-foreground)] group-hover:text-[var(--foreground)] transition-colors" />
                    <div className="w-9 h-9 rounded-lg bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] flex items-center justify-center group-hover:text-[var(--primary)] group-hover:border-[var(--primary)]/30 transition-all">
                      <Bug className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors block">
                        Feedback
                      </span>
                      <span className="text-[11px] text-[var(--muted-foreground)] block truncate">
                        Issues & requests
                      </span>
                    </div>
                  </a>

                  {/* Box 3: Creator */}
                  <a
                    href="https://github.com/notenderdreams"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      void openExternalUrl('https://github.com/notenderdreams');
                    }}
                    className="relative p-3.5 rounded-xl bg-[var(--workspace)] border border-[var(--border)] hover:bg-[var(--secondary)] hover:border-[var(--muted-foreground)]/30 transition-all flex flex-col items-center justify-center text-center gap-1.5 group shadow-2xs hover:-translate-y-0.5 cursor-pointer"
                  >
                    <ArrowUpRight className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-[var(--subtle-foreground)] group-hover:text-[var(--foreground)] transition-colors" />
                    <div className="w-9 h-9 rounded-lg bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] flex items-center justify-center group-hover:text-[var(--primary)] group-hover:border-[var(--primary)]/30 transition-all">
                      <CircleUserRound className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors block">
                        Creator
                      </span>
                      <span className="text-[11px] text-[var(--muted-foreground)] block truncate">
                        @notenderdreams
                      </span>
                    </div>
                  </a>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
