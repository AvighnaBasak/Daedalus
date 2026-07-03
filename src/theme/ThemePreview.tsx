import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { StatusDot } from "@/components/ui/StatusDot";
import { Meter } from "@/components/ui/Meter";
import { Bell, Check, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  ACCENT_PRESETS,
  BG_PRESETS,
  loadTheme,
  saveTheme,
  type ThemeSettings,
} from "@/lib/theme";

const GREYS = [
  "--black", "--grey-950", "--grey-900", "--grey-850", "--grey-800", "--grey-700",
  "--grey-600", "--grey-500", "--grey-400", "--grey-300", "--grey-200", "--grey-100",
  "--grey-050", "--white",
];
const REDS = ["--red-lo", "--red-mid", "--red", "--red-hi"];

export function ThemePreview() {
  const [theme, setTheme] = useState<ThemeSettings>(() => loadTheme());

  const update = (patch: Partial<ThemeSettings>) => {
    const next = { ...theme, ...patch };
    setTheme(next);
    saveTheme(next);
  };

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-3xl px-8 py-8">
        <header className="mb-8">
          <span className="mono-label">Theme</span>
          <h1 className="mt-1 text-[28px] leading-tight text-text-emphasis">Make it yours</h1>
          <p className="mt-2 text-text-muted">
            Greyscale + one accent. No gradients, no glow — depth comes from surfaces, hairlines and shadow.
          </p>
        </header>

        {/* ---- customization ---- */}
        <Section title="Accent color">
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.hex}
                onClick={() => update({ accent: p.hex })}
                title={p.name}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-[var(--r-2)] border px-3 text-[12px] transition-colors",
                  theme.accent.toLowerCase() === p.hex.toLowerCase()
                    ? "border-border-strong bg-surface-raised text-text-emphasis"
                    : "border-border text-text-muted hover:border-border-hover",
                )}
              >
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: p.hex }} />
                {p.name}
              </button>
            ))}
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-[var(--r-2)] border border-border px-3 text-[12px] text-text-muted hover:border-border-hover">
              <input
                type="color"
                value={theme.accent}
                onChange={(e) => update({ accent: e.target.value })}
                className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
              />
              Custom
              <span className="tabular font-mono text-[11px] text-text-disabled">{theme.accent}</span>
            </label>
          </div>
        </Section>

        <Section title="Background">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(BG_PRESETS) as ThemeSettings["bg"][]).map((id) => (
              <button
                key={id}
                onClick={() => update({ bg: id })}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-[var(--r-2)] border px-3 text-[12px] transition-colors",
                  theme.bg === id
                    ? "border-border-strong bg-surface-raised text-text-emphasis"
                    : "border-border text-text-muted hover:border-border-hover",
                )}
              >
                <span className="h-3.5 w-3.5 rounded-[3px] border border-border-strong" style={{ background: BG_PRESETS[id].hex }} />
                {BG_PRESETS[id].name}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Effects">
          <div className="flex flex-col gap-2">
            <EffectRow
              label="Film grain"
              desc="Subtle static texture over the whole app."
              on={theme.grain}
              onToggle={() => update({ grain: !theme.grain })}
            />
            <EffectRow
              label="Sound cues"
              desc="A quiet two-note chime when an agent needs your input."
              on={theme.sound}
              onToggle={() => update({ sound: !theme.sound })}
            />
          </div>
        </Section>

        <div className="my-8 h-px bg-border" />

        <Section title="Greyscale ramp">
          <div className="grid grid-cols-7 gap-2">
            {GREYS.map((v) => (
              <Swatch key={v} varName={v} />
            ))}
          </div>
        </Section>

        <Section title="Accent — the only chroma">
          <div className="grid grid-cols-7 gap-2">
            {REDS.map((v) => (
              <Swatch key={v} varName={v} />
            ))}
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="solid"><Plus size={14} />Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger"><Trash2 size={14} />Danger</Button>
            <Button variant="outline" disabled>Disabled</Button>
            <IconButton aria-label="bell"><Bell size={16} /></IconButton>
            <IconButton active aria-label="check"><Check size={16} /></IconButton>
          </div>
        </Section>

        <Section title="Status">
          <div className="flex items-center gap-6 text-[12px] text-text-muted">
            <span className="flex items-center gap-2"><StatusDot tone="ok" />Connected</span>
            <span className="flex items-center gap-2"><StatusDot tone="idle" />Idle</span>
            <span className="flex items-center gap-2"><StatusDot tone="busy" />Working</span>
            <span className="flex items-center gap-2"><StatusDot tone="alert" pulse />Attention</span>
          </div>
        </Section>

        <Section title="Context meter (grey → red ramp)">
          <div className="flex flex-col gap-3">
            {[0.2, 0.55, 0.75, 0.9, 0.98].map((v) => (
              <div key={v} className="flex items-center gap-3">
                <Meter value={v} />
                <span className="tabular w-10 text-right text-[12px] text-text-muted">
                  {Math.round(v * 100)}%
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Surfaces & type">
          <div className="grid grid-cols-2 gap-3">
            {["bg", "surface", "surface-raised", "overlay"].map((s) => (
              <div
                key={s}
                className="rounded-[var(--r-2)] border border-border p-4"
                style={{ background: `var(--${s})` }}
              >
                <span className="mono-label">{s}</span>
                <p className="mt-2 text-text">The quick brown fox</p>
                <p className="text-text-muted">jumps over the lazy dog</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function EffectRow({
  label,
  desc,
  on,
  onToggle,
}: {
  label: string;
  desc: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-[var(--r-2)] border border-border bg-surface px-4 py-3">
      <div className="min-w-0 pr-4">
        <p className="text-[13px] text-text">{label}</p>
        <p className="mt-0.5 text-[12px] text-text-muted">{desc}</p>
      </div>
      <button
        onClick={onToggle}
        aria-pressed={on}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          on ? "bg-accent" : "bg-grey-600",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
            on ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mono-label mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ varName }: { varName: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className="h-12 rounded-[var(--r-2)] border border-border"
        style={{ background: `var(${varName})` }}
      />
      <span className="truncate text-[10px] text-text-disabled">{varName.replace("--", "")}</span>
    </div>
  );
}
