import { currentAccent } from "./theme";

export interface RecapStats {
  projects: number;
  sessions: number;
  totalTokens: number;
  totalCost: number;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Render a styled build-in-public recap card and download it as a PNG. */
export async function downloadRecapCard(stats: RecapStats): Promise<void> {
  const accent = currentAccent();
  const date = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const mono = "Consolas, 'JetBrains Mono', monospace";
  const sans = "'Segoe UI', system-ui, sans-serif";

  const row = (y: number, label: string, value: string) => `
    <text x="64" y="${y}" font-family="${mono}" font-size="15" letter-spacing="2" fill="#6E6E6E">${esc(label)}</text>
    <text x="736" y="${y}" text-anchor="end" font-family="${mono}" font-size="24" fill="#F5F5F5">${esc(value)}</text>
    <line x1="64" y1="${y + 18}" x2="736" y2="${y + 18}" stroke="#262626" stroke-width="1"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="460">
  <rect width="800" height="460" fill="#0A0A0A"/>
  <rect x="0.5" y="0.5" width="799" height="459" fill="none" stroke="${accent}" stroke-width="1"/>
  <text x="64" y="86" font-family="${mono}" font-size="16" letter-spacing="6" fill="${accent}">◆ DAEDALUS</text>
  <text x="736" y="86" text-anchor="end" font-family="${mono}" font-size="14" fill="#6E6E6E">${esc(date)}</text>
  <text x="64" y="150" font-family="${sans}" font-size="34" font-weight="600" fill="#F5F5F5">Session recap</text>
  ${row(226, "PROJECTS", String(stats.projects))}
  ${row(288, "SESSIONS", String(stats.sessions))}
  ${row(350, "TOKENS", fmtTokens(stats.totalTokens))}
  ${row(412, "COST", `$${stats.totalCost.toFixed(2)}`)}
</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG render failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 920;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    const png: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png"),
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(png);
    a.download = `daedalus-recap-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  } finally {
    URL.revokeObjectURL(url);
  }
}
