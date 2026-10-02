const KEY = 'reunite-theme';
let media = null;
try {
  media = window.matchMedia('(prefers-color-scheme: dark)');
} catch {}

export function getTheme() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system')
      return stored;
  } catch {}
  return 'system';
}

export function resolvedTheme(theme = getTheme()) {
  if (theme !== 'system') return theme;
  return media?.matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = resolvedTheme(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  return theme;
}

export function cycleTheme(theme = getTheme()) {
  const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
  return applyTheme(next);
}

export function watchSystemTheme(onChange) {
  try {
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  } catch {
    return () => {};
  }
}
