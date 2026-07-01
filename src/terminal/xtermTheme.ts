import type { ITheme } from "@xterm/xterm";

/**
 * Daedalus terminal palette. The app's chroma rule (greyscale + red only) is
 * applied to the ANSI table: colors collapse onto a grey ramp, and only the
 * red channel stays chromatic so warnings/removals still read as "look here".
 */
export const daedalusXtermTheme: ITheme = {
  background: "#0a0a0a",
  foreground: "#e6e6e6",
  cursor: "#e5484d",
  cursorAccent: "#0a0a0a",
  selectionBackground: "rgba(229,72,77,0.22)",

  black: "#0a0a0a",
  brightBlack: "#3d3d3d",
  red: "#e5484d",
  brightRed: "#ff5c61",
  green: "#c8c8c8",
  brightGreen: "#ededed",
  yellow: "#9a9a9a",
  brightYellow: "#c4c4c4",
  blue: "#7e7e7e",
  brightBlue: "#a6a6a6",
  magenta: "#b4b4b4",
  brightMagenta: "#e6e6e6",
  cyan: "#8a8a8a",
  brightCyan: "#bdbdbd",
  white: "#e6e6e6",
  brightWhite: "#f5f5f5",
};
