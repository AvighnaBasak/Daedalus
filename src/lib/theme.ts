/**
 * User-adjustable theme: accent color, background tone, grain and sound cues.
 * Settings persist in localStorage and are applied as CSS custom properties on
 * :root, so every token-driven surface follows instantly.
 */

export interface ThemeSettings {
  accent: string; // hex
  bg: "matte" | "graphite" | "oled";
  grain: boolean;
  sound: boolean;
}

export const ACCENT_PRESETS: { name: string; hex: string }[] = [
  { name: "Signal Red", hex: "#E5484D" },
  { name: "Ember", hex: "#E5583A" },
  { name: "Crimson", hex: "#D3323F" },
  { name: "Magma", hex: "#FF4F3F" },
  { name: "Rosewood", hex: "#C9364C" },
];

export const BG_PRESETS: Record<ThemeSettings["bg"], { name: string; hex: string }> = {
  matte: { name: "Matte Black", hex: "#0A0A0A" },
  graphite: { name: "Graphite", hex: "#0D0E10" },
  oled: { name: "OLED", hex: "#000000" },
};

const KEY = "daedalus.theme.v1";
const DEFAULTS: ThemeSettings = { accent: "#E5484D", bg: "matte", grain: true, sound: true };

export function loadTheme(): ThemeSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveTheme(next: ThemeSettings) {
  localStorage.setItem(KEY, JSON.stringify(next));
  applyTheme(next);
  window.dispatchEvent(new CustomEvent("daedalus:theme"));
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(hex: string, target: number, t: number): string {
  const [r, g, b] = hexToRgb(hex);
  const m = (c: number) => Math.round(c + (target - c) * t);
  return `#${[m(r), m(g), m(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function accentAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function applyTheme(s: ThemeSettings) {
  const root = document.documentElement.style;
  root.setProperty("--red", s.accent);
  root.setProperty("--red-hi", mix(s.accent, 255, 0.18));
  root.setProperty("--red-mid", mix(s.accent, 0, 0.18));
  root.setProperty("--red-lo", mix(s.accent, 0, 0.5));
  root.setProperty("--red-dim", accentAlpha(s.accent, 0.12));
  root.setProperty("--black", BG_PRESETS[s.bg].hex);
}

/** Current accent straight from the applied CSS (for canvases/xterm). */
export function currentAccent(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--red").trim() || "#E5484D"
  );
}
