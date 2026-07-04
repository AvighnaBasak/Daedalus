import type { ITheme } from "@xterm/xterm";

/**
 * Daedalus terminal palette — full ANSI color on a matte-black ground.
 * The chrome around the terminal stays greyscale+red, but the terminal itself
 * renders the CLI's real colors (VS Code-calibrated ANSI ramp) so Claude Code's
 * TUI looks the way it does in a proper terminal.
 */
export const daedalusXtermTheme: ITheme = {
  background: "#0a0a0a",
  foreground: "#e6e6e6",
  cursor: "#e5484d",
  cursorAccent: "#0a0a0a",
  selectionBackground: "rgba(229,72,77,0.22)",

  black: "#0a0a0a",
  brightBlack: "#666666",
  red: "#e5484d",
  brightRed: "#ff5c61",
  green: "#0dbc79",
  brightGreen: "#23d18b",
  yellow: "#e5c07b",
  brightYellow: "#f5e0a3",
  blue: "#3b8eea",
  brightBlue: "#61afef",
  magenta: "#c678dd",
  brightMagenta: "#d670d6",
  cyan: "#11a8cd",
  brightCyan: "#29b8db",
  white: "#e6e6e6",
  brightWhite: "#f5f5f5",
};

/**
 * Font stack for xterm. IMPORTANT: xterm measures glyphs on a canvas and cannot
 * resolve CSS variables — this must be a concrete, comma-separated list of real
 * font family names. Cascadia Mono ships with Windows 10/11 (full box-drawing
 * coverage); the rest are safe fallbacks per platform.
 */
export const TERMINAL_FONT =
  '"Cascadia Mono", "Cascadia Code", Consolas, "SF Mono", Menlo, "DejaVu Sans Mono", monospace';
