import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

// Helper to convert hex to HSL
function hexToHSL(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Helper to convert HSL to hex
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Generate color palette from a single accent color
function generatePalette(accentHex) {
  const hsl = hexToHSL(accentHex);
  
  return {
    accent: accentHex,
    accentDark: hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 15, 10)),
    accentLight: hslToHex(hsl.h, hsl.s, Math.min(hsl.l + 15, 90)),
    accentGlow: `rgba(${parseInt(accentHex.slice(1,3),16)}, ${parseInt(accentHex.slice(3,5),16)}, ${parseInt(accentHex.slice(5,7),16)}, 0.15)`,
    ember: hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l + 10),
    flame: accentHex,
    blaze: hslToHex((hsl.h - 20 + 360) % 360, hsl.s, hsl.l - 5),
  };
}

// Preset themes
const THEMES = {
  dark: {
    name: 'Dark',
    mode: 'dark',
    bg: {
      primary: '#0a0a0a',
      secondary: '#111111',
      tertiary: '#1a1a1a',
      hover: '#252525',
    },
    text: {
      primary: '#ffffff',
      secondary: '#999999',
      muted: '#666666',
    },
    border: '#2a2a2a',
  },
  light: {
    name: 'Light',
    mode: 'light',
    bg: {
      primary: '#f5f5f5',
      secondary: '#ffffff',
      tertiary: '#eeeeee',
      hover: '#e0e0e0',
    },
    text: {
      primary: '#1a1a1a',
      secondary: '#666666',
      muted: '#999999',
    },
    border: '#d0d0d0',
  },
  midnight: {
    name: 'Midnight',
    mode: 'dark',
    bg: {
      primary: '#0d1117',
      secondary: '#161b22',
      tertiary: '#21262d',
      hover: '#30363d',
    },
    text: {
      primary: '#f0f6fc',
      secondary: '#8b949e',
      muted: '#6e7681',
    },
    border: '#30363d',
  },
};

// Preset accent colors
const ACCENT_PRESETS = [
  { name: 'Fire', color: '#f97316'},
  { name: 'Ruby', color: '#ef4444'},
  { name: 'Emerald', color: '#22c55e'},
  { name: 'Ocean', color: '#3b82f6'},
  { name: 'Violet', color: '#8b5cf6'},
  { name: 'Pink', color: '#ec4899'},
  { name: 'Cyan', color: '#06b6d4'},
  { name: 'Gold', color: '#eab308'},
];

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState('dark');
  const [accentColor, setAccentColor] = useState('#f97316');
  const [colorShift, setColorShift] = useState(false);
  const [colorShiftSpeed, setColorShiftSpeed] = useState(5); // seconds per full cycle

  // Load saved theme settings
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await window.electronAPI?.loadSettings?.();
        if (saved?.themeMode) setThemeMode(saved.themeMode);
        if (saved?.accentColor) setAccentColor(saved.accentColor);
        if (saved?.colorShift !== undefined) setColorShift(saved.colorShift);
        if (saved?.colorShiftSpeed) setColorShiftSpeed(saved.colorShiftSpeed);
      } catch {}
    };
    loadTheme();
  }, []);

  // Apply theme to document
  useEffect(() => {
    const theme = THEMES[themeMode] || THEMES.dark;
    const palette = generatePalette(accentColor);
    const root = document.documentElement;

    // Apply background colors
    root.style.setProperty('--bg-primary', theme.bg.primary);
    root.style.setProperty('--bg-secondary', theme.bg.secondary);
    root.style.setProperty('--bg-tertiary', theme.bg.tertiary);
    root.style.setProperty('--bg-hover', theme.bg.hover);

    // Apply text colors
    root.style.setProperty('--text-primary', theme.text.primary);
    root.style.setProperty('--text-secondary', theme.text.secondary);
    root.style.setProperty('--text-muted', theme.text.muted);

    // Apply border
    root.style.setProperty('--border', theme.border);

    // Apply accent colors
    root.style.setProperty('--accent', palette.accent);
    root.style.setProperty('--accent-secondary', palette.blaze);
    root.style.setProperty('--accent-glow', palette.accentGlow);
    root.style.setProperty('--accent-hover', palette.accentDark);
    root.style.setProperty('--fire-gradient', `linear-gradient(135deg, ${palette.accent} 0%, ${palette.accentDark} 100%)`);
    root.style.setProperty('--fire-gradient-text', `linear-gradient(90deg, ${palette.ember}, ${palette.accent})`);
    root.style.setProperty('--ember', palette.ember);
    root.style.setProperty('--flame', palette.flame);
    root.style.setProperty('--blaze', palette.blaze);
    root.style.setProperty('--border-fire', `rgba(${parseInt(accentColor.slice(1,3),16)}, ${parseInt(accentColor.slice(3,5),16)}, ${parseInt(accentColor.slice(5,7),16)}, 0.3)`);

    // Add theme mode class
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-midnight');
    document.body.classList.add(`theme-${themeMode}`);
  }, [themeMode, accentColor]);

  // Color shift animation
  useEffect(() => {
    if (!colorShift) return;

    let hue = hexToHSL(accentColor).h;
    const interval = setInterval(() => {
      hue = (hue + 1) % 360;
      const newColor = hslToHex(hue, 80, 55);
      const palette = generatePalette(newColor);
      const root = document.documentElement;

      root.style.setProperty('--accent', palette.accent);
      root.style.setProperty('--accent-secondary', palette.blaze);
      root.style.setProperty('--accent-glow', palette.accentGlow);
      root.style.setProperty('--accent-hover', palette.accentDark);
      root.style.setProperty('--fire-gradient', `linear-gradient(135deg, ${palette.accent} 0%, ${palette.accentDark} 100%)`);
      root.style.setProperty('--fire-gradient-text', `linear-gradient(90deg, ${palette.ember}, ${palette.accent})`);
      root.style.setProperty('--ember', palette.ember);
      root.style.setProperty('--flame', palette.flame);
      root.style.setProperty('--blaze', palette.blaze);
      root.style.setProperty('--border-fire', `rgba(${parseInt(newColor.slice(1,3),16)}, ${parseInt(newColor.slice(3,5),16)}, ${parseInt(newColor.slice(5,7),16)}, 0.3)`);
    }, (colorShiftSpeed * 1000) / 360);

    return () => clearInterval(interval);
  }, [colorShift, colorShiftSpeed]);

  const saveTheme = async (newMode, newAccent, newShift, newSpeed) => {
    const settings = {
      themeMode: newMode ?? themeMode,
      accentColor: newAccent ?? accentColor,
      colorShift: newShift ?? colorShift,
      colorShiftSpeed: newSpeed ?? colorShiftSpeed,
    };
    await window.electronAPI?.saveSettings?.(settings);
  };

  const value = {
    themeMode,
    setThemeMode: (mode) => { setThemeMode(mode); saveTheme(mode); },
    accentColor,
    setAccentColor: (color) => { setAccentColor(color); saveTheme(null, color); },
    colorShift,
    setColorShift: (shift) => { setColorShift(shift); saveTheme(null, null, shift); },
    colorShiftSpeed,
    setColorShiftSpeed: (speed) => { setColorShiftSpeed(speed); saveTheme(null, null, null, speed); },
    themes: THEMES,
    accentPresets: ACCENT_PRESETS,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  // Return defaults if used outside provider (prevents crashes)
  if (!context) {
    return {
      themeMode: 'dark',
      setThemeMode: () => {},
      accentColor: '#f97316',
      setAccentColor: () => {},
      colorShift: false,
      setColorShift: () => {},
      colorShiftSpeed: 10,
      setColorShiftSpeed: () => {},
      themes: [],
      accentPresets: [],
    };
  }
  return context;
}

export default ThemeContext;
