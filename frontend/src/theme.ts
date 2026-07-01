/** Theme system — 4 named themes driven by data-theme on <html>. */

export const THEMES = ["tank", "midnight", "mono", "cyberpunk"] as const;
export type ThemeName = (typeof THEMES)[number];

export const THEME_META: Record<ThemeName, { label: string; tagline: string }> = {
  tank: { label: "Tank", tagline: "Amber on midnight" },
  midnight: { label: "Midnight", tagline: "Violet ink" },
  mono: { label: "Mono", tagline: "Grayscale terminal" },
  cyberpunk: { label: "Cyberpunk", tagline: "CRT phosphor" },
};

const STORAGE_KEY = "token-tank-theme";

export function getInitialTheme(): ThemeName {
  const saved = localStorage.getItem(STORAGE_KEY);
  return (THEMES as readonly string[]).includes(saved ?? "")
    ? (saved as ThemeName)
    : "tank";
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export function nextTheme(current: ThemeName): ThemeName {
  return THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
}
