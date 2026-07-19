/**
 * Live snapshot of the --tank-* palette for canvas drawing. Canvas can't
 * read CSS vars at stroke time, so we resolve them from the root element
 * and re-resolve whenever the data-theme attribute flips.
 */

import { useEffect, useState } from "react";

export interface ThemeColors {
  fg: string;
  label: string;
  accent: string;
  dim: string;
  line: string;
  warn: string;
  danger: string;
  accentRgb: string; // "r, g, b"
  fgRgb: string;
  labelRgb: string;
}

function read(): ThemeColors {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    fg: v("--tank-fg"),
    label: v("--tank-label"),
    accent: v("--tank-accent"),
    dim: v("--tank-dim"),
    line: v("--tank-line"),
    warn: v("--tank-warn"),
    danger: v("--tank-danger"),
    accentRgb: v("--tank-accent-rgb"),
    fgRgb: v("--tank-fg-rgb"),
    labelRgb: v("--tank-label-rgb"),
  };
}

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(read);

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
