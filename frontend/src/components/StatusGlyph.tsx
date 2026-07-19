/**
 * StatusGlyph — cockpit status shape language.
 * State is communicated by SHAPE + color, never color alone:
 *   live     ● filled circle    — receiving traffic
 *   standby  ◆ filled diamond   — connected, no recent traffic
 *   error    ▲ filled triangle  — offline / link down
 *   info     □ hollow square    — dim / not registered
 *   critical ■ filled square    — fuel reserve, pulses
 *   warn     ◆ filled diamond   — warm escalation (amber)
 */

export type StatusKind = "live" | "standby" | "error" | "info" | "critical" | "warn";

const GLYPH: Record<StatusKind, string> = {
  live: "●", // ●
  standby: "◆", // ◆
  error: "▲", // ▲
  info: "□", // □
  critical: "■", // ■
  warn: "◆", // ◆
};

interface StatusGlyphProps {
  kind: StatusKind;
  /** Short mono tag rendered next to the shape, e.g. "LIVE". */
  label?: string;
  title?: string;
}

export function StatusGlyph({ kind, label, title }: StatusGlyphProps) {
  return (
    <span className={`glyph glyph-${kind}`} title={title} role="status">
      <span className="glyph-shape" aria-hidden="true">
        {GLYPH[kind]}
      </span>
      {label && <span className="glyph-word">{label}</span>}
    </span>
  );
}
