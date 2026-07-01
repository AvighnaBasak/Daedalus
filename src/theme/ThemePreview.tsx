import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { StatusDot } from "@/components/ui/StatusDot";
import { Meter } from "@/components/ui/Meter";
import { Bell, Check, Plus, Trash2 } from "lucide-react";

const GREYS = [
  "--black", "--grey-950", "--grey-900", "--grey-850", "--grey-800", "--grey-700",
  "--grey-600", "--grey-500", "--grey-400", "--grey-300", "--grey-200", "--grey-100",
  "--grey-050", "--white",
];
const REDS = ["--red-lo", "--red-mid", "--red", "--red-hi"];

export function ThemePreview() {
  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-3xl px-8 py-8">
        <header className="mb-8">
          <span className="mono-label">Design System</span>
          <h1 className="mt-1 text-[28px] leading-tight text-text-emphasis">Daedalus — matte noir</h1>
          <p className="mt-2 text-text-muted">
            Greyscale + a single red accent. No gradients. Elevation via surface steps and 1px hairlines.
          </p>
        </header>

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
