import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Sliders,
  Palette,
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
  Cpu,
  Terminal,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import type { ReadingTheme, ThemeSettings, ViewMode } from '../utils/types';
import {
  openExternalUrl,
  getAiProviderStatus,
  setAiProviderPreference,
  type AiProviderStatus,
  type DiscoveredAiProvider,
} from '../utils/tauriBridge';

import { SparkleIcon } from './icons/SparkleIcon';

type SettingsTab = 'general' | 'appearance' | 'ai' | 'shortcuts' | 'about';

// Crisp Brand SVG Logos for AI Engines
const AntigravityLogo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 434 400" fill="currentColor" className={className} aria-label="Antigravity Logo">
    <path d="M392.7093,390.1367c24.1675,18.1303,60.4188,6.0436,27.1881-27.1951C320.2076,266.2475,341.3537.3393,217.4969.3393S114.7857,266.2475,15.0959,362.9416c-36.2508,36.2602,3.0207,45.3254,27.1881,27.1952,93.6484-63.4553,87.6064-175.2575,175.2129-175.2575s81.5645,111.8022,175.2124,175.2575h0Z" />
  </svg>
);

const CodexLogo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Codex Logo">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.0993 3.8558L12.5973 8.3829l2.02-1.1638a.0804.0804 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4022-.686zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.6069 1.4997-2.602-1.4997z" />
  </svg>
);

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
    title: 'Reading Layout',
    items: [
      { keys: ['Cmd / Ctrl', 'Shift', '1'], desc: 'Single Page' },
      { keys: ['Cmd / Ctrl', 'Shift', '2'], desc: 'Side-by-Side Pages' },
      { keys: ['Cmd / Ctrl', 'Shift', '3'], desc: 'Continuous Scroll' },
    ],
  },
  {
    title: 'Mouse & Gestures',
    items: [
      { keys: ['Double Click'], desc: 'Highlight / Remove Word Highlight' },
      { keys: ['Triple Click'], desc: 'Highlight / Remove Line Highlight' },
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
      { keys: ['U'], desc: 'Underline Selected Text / Tool' },
      { keys: ['1–8'], desc: 'Choose Highlight Palette Color' },
      { keys: ['H'], desc: 'Freehand Highlighter Pen' },
      { keys: ['R'], desc: 'Area Highlight Box' },
      { keys: ['P'], desc: 'Freehand Pen' },
      { keys: ['C'], desc: 'Snip & Compact for AI' },
      { keys: ['A'], desc: 'Explain PDF Region with AI' },
      { keys: ['T'], desc: 'Plain Text Tool' },
      { keys: ['N'], desc: 'Sticky Note Tool' },
      { keys: ['E'], desc: 'Eraser (Sweep / Click)' },
      { keys: ['V'], desc: 'Select / Pointer Tool' },
    ],
  },
  {
    title: 'Navigation & View',
    items: [
      { keys: ['Cmd', ','], desc: 'Preferences & Settings' },
      { keys: ['Cmd', 'Shift', 'L'], desc: 'Toggle Light / Dark Mode' },
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

  // AI Provider State
  const [aiStatus, setAiStatus] = useState<AiProviderStatus | null>(null);
  const [isLoadingAiStatus, setIsLoadingAiStatus] = useState<boolean>(false);
  const [isUpdatingProvider, setIsUpdatingProvider] = useState<boolean>(false);

  const fetchAiStatus = useCallback(async () => {
    setIsLoadingAiStatus(true);
    try {
      const res = await getAiProviderStatus();
      setAiStatus(res);
    } catch (err) {
      console.warn('Failed to fetch AI provider status:', err);
    } finally {
      setIsLoadingAiStatus(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'ai') {
      void fetchAiStatus();
    }
  }, [isOpen, activeTab, fetchAiStatus]);

  const handleSelectProvider = async (providerId: string, executablePath?: string | null) => {
    setIsUpdatingProvider(true);
    try {
      const res = await setAiProviderPreference(providerId, executablePath ?? null);
      setAiStatus(res);
    } catch (err) {
      console.warn('Failed to set AI provider preference:', err);
    } finally {
      setIsUpdatingProvider(false);
    }
  };

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
        e.preventDefault();
        e.stopPropagation();
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
    { id: 'ai', label: 'AI Assistant', icon: SparkleIcon },
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
                      { id: 'spread' as ViewMode, label: 'Side by Side', icon: BookOpen },
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
              <div className="flex flex-col gap-4 flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">AI Assistant & CLI Engine</h3>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      Select which local CLI powers Cinnabar's AI explanations, math analysis, and text summaries.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void fetchAiStatus()}
                    disabled={isLoadingAiStatus}
                    className="btn-secondary flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-all hover:bg-white/10"
                    title="Rescan installed CLIs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAiStatus ? 'animate-spin text-blue-400' : 'text-zinc-400'}`} />
                    <span>Rescan</span>
                  </button>
                </div>

                {/* Available Provider Selector Cards */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-0.5">
                    Select AI Engine
                  </span>

                  {/* 1. Antigravity CLI */}
                  {(() => {
                    const agyFound = aiStatus?.availableProviders?.find((p) => p.id === 'antigravity');
                    const isSelected = aiStatus?.provider === 'antigravity';
                    return (
                      <div
                        onClick={() => void handleSelectProvider('antigravity', agyFound?.executable)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-blue-500/10 border-blue-500/40 shadow-xs'
                            : 'bg-[var(--card)] border-[var(--border)] hover:border-zinc-500/50 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-all ${
                            isSelected
                              ? 'bg-white text-black border border-black/10'
                              : 'bg-[var(--secondary)] text-zinc-400 border border-[var(--border)]'
                          }`}>
                            <AntigravityLogo className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-[var(--foreground)]">Antigravity CLI</span>
                              <span className="font-mono text-[10px] text-zinc-400">agy</span>
                              {agyFound?.version && (
                                <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono text-[9px] border border-zinc-700">
                                  v{agyFound.version}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-400 truncate">
                              {agyFound ? agyFound.executable : 'Not detected in standard paths'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {agyFound ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-medium border border-emerald-500/20">
                              Available
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-500 text-[10px] border border-zinc-700">
                              Not Found
                            </span>
                          )}
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-zinc-600'}`}>
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 2. Codex CLI */}
                  {(() => {
                    const codexFound = aiStatus?.availableProviders?.find((p) => p.id === 'codex');
                    const isSelected = aiStatus?.provider === 'codex';
                    return (
                      <div
                        onClick={() => void handleSelectProvider('codex', codexFound?.executable)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-blue-500/10 border-blue-500/40 shadow-xs'
                            : 'bg-[var(--card)] border-[var(--border)] hover:border-zinc-500/50 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-all ${
                            isSelected
                              ? 'bg-white text-black border border-black/10'
                              : 'bg-[var(--secondary)] text-zinc-400 border border-[var(--border)]'
                          }`}>
                            <CodexLogo className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-[var(--foreground)]">Codex CLI</span>
                              <span className="font-mono text-[10px] text-zinc-400">codex</span>
                              {codexFound?.version && (
                                <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono text-[9px] border border-zinc-700">
                                  v{codexFound.version}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-400 truncate">
                              {codexFound ? codexFound.executable : 'Not detected in standard paths'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {codexFound ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-medium border border-emerald-500/20">
                              Available
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-500 text-[10px] border border-zinc-700">
                              Not Found
                            </span>
                          )}
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-zinc-600'}`}>
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Privacy & Sandboxing Notice */}
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-2 text-[11px] text-zinc-400 leading-relaxed">
                  <Cpu className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
                  <span>
                    Cinnabar executes the selected CLI locally with <code className="text-zinc-300 font-mono text-[10px]">--sandbox</code> restrictions. Your PDF documents and prompts remain on your machine and are not indexed or stored remotely.
                  </span>
                </div>

                {/* Coming Soon Note Stick to Bottom */}
                <div className="mt-auto pt-2 text-[11px] leading-relaxed text-zinc-400">
                  <span className="font-semibold text-[var(--foreground)] mr-1.5">NOTE:</span>
                  We will bring proper built-in AI integration with direct provider support and custom API keys soon.
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
                      Cinnabar
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
