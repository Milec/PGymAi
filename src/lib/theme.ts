export type ThemeName = 'hud' | 'night' | 'light' | 'bubblegum';

export const THEMES: { id: ThemeName; label: string; blurb: string; swatch: string[] }[] = [
  { id: 'hud', label: 'Starship HUD', blurb: 'Deep space-navy, cyan/violet glow', swatch: ['#05070f', '#38e1ff', '#a26bff'] },
  { id: 'night', label: 'Dark Night', blurb: 'Calm indigo, low glow', swatch: ['#070912', '#7aa2ff', '#b09cff'] },
  { id: 'light', label: 'Light', blurb: 'Clean daylight', swatch: ['#eef3fb', '#0b8fb8', '#7c4ddb'] },
  { id: 'bubblegum', label: 'Bubblegum', blurb: 'Girly pastel pink', swatch: ['#fff0f7', '#ff4fa3', '#a05cff'] },
];

export const DEFAULT_THEME: ThemeName = 'hud';

/** Apply a theme by stamping data-theme on <html> and syncing the browser UI colour. */
export function applyTheme(theme: ThemeName): void {
  const root = document.documentElement;
  if (theme === 'hud') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);

  // Keep the PWA theme-color / status bar in step with the page background.
  const bg = getComputedStyle(root).getPropertyValue('--space-0').trim() || '#05070f';
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', bg);
}
