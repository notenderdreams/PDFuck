import { useState, useEffect, useCallback } from 'react';
import type { ReadingTheme, ThemeSettings } from '../utils/types';
import { loadThemeSettings, saveThemeSettings } from '../utils/storage';

const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  theme: 'default',
  brightness: 100,
  contrast: 100,
  grayscale: 0,
  sepiaAmount: 0,
  invertImages: false,
};

export function useColorTheme() {
  const [settings, setSettings] = useState<ThemeSettings>(() => {
    return loadThemeSettings() || DEFAULT_THEME_SETTINGS;
  });

  useEffect(() => {
    saveThemeSettings(settings);
  }, [settings]);

  const setTheme = useCallback((theme: ReadingTheme) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const toggleInvert = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      theme: prev.theme === 'invert' ? 'default' : 'invert',
    }));
  }, []);

  const updateSetting = useCallback(<K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      brightness: 100,
      contrast: 100,
      grayscale: 0,
      sepiaAmount: 0,
    }));
  }, []);

  // Compute CSS filter style for PDF pages
  const getPageFilterClass = useCallback((): string => {
    switch (settings.theme) {
      case 'invert':
        return 'page-theme-invert';
      case 'oled':
        return 'page-theme-oled';
      case 'sepia':
        return 'page-theme-sepia';
      case 'nord':
        return 'page-theme-nord';
      case 'matrix':
        return 'page-theme-matrix';
      default:
        return 'page-theme-default';
    }
  }, [settings.theme]);

  // Dynamic filter for custom brightness/contrast adjustments
  const getCustomFilterStyle = useCallback(() => {
    const filters: string[] = [];
    if (settings.brightness !== 100) {
      filters.push(`brightness(${settings.brightness}%)`);
    }
    if (settings.contrast !== 100) {
      filters.push(`contrast(${settings.contrast}%)`);
    }
    if (settings.grayscale > 0) {
      filters.push(`grayscale(${settings.grayscale}%)`);
    }
    return filters.length > 0 ? { filter: filters.join(' ') } : {};
  }, [settings.brightness, settings.contrast, settings.grayscale]);

  return {
    settings,
    setTheme,
    toggleInvert,
    updateSetting,
    resetFilters,
    getPageFilterClass,
    getCustomFilterStyle,
  };
}
