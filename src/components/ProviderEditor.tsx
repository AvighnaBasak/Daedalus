import { useEffect, useState } from "react";
import { Sparkle, Server, KeyRound, Info, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ModelPicker } from "@/components/ModelPicker";
import { cn } from "@/lib/cn";
import {
  compatNotes,
  getProvider,
  setProvider,
  CUSTOM_PRESETS,
  type ProviderConfig,
  type ProviderKind,
} from "@/lib/provider";

const OPTIONS: { kind: ProviderKind; icon: typeof Server; title: string; desc: string }[] = [
  {
    kind: "subscription",
    icon: Sparkle,
    title: "Claude subscription",
    desc: "Anthropic models via your existing Claude login. Full quality, full cost tracking.",
  },
  {
    kind: "ollama",
    icon: Server,
    title: "Ollama · local & free",
    desc: "Run open models on your machine through Claude Code. Zero cost, data never leaves.",
  },
  {
    kind: "custom",
    icon: KeyRound,
    title: "Any API key",
    desc: "Point Claude Code at any Anthropic-compatible endpoint with your own key.",
  },
];

/** Pick + configure the model backend. Used in onboarding and in Settings. */
export function ProviderEditor({ onSaved }: { onSaved?: (config: ProviderConfig) => void }) {
  const [config, setConfig] = useState<ProviderConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getProvider().then(setConfig);
  }, []);

  if (!config) {
    return <Loader2 size={16} className="animate-spin text-text-muted" />;
  }

  const patch = (p: Partial<ProviderConfig>) => {
    setConfig({ ...config, ...p });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await setProvider(config);
      setSaved(true);
      onSaved?.(config);
    } finally {
      setSaving(false);
    }
  };

  const notes = compatNotes(config.kind);
  const needsModel = config.kind !== "subscription";
  const canSave =
    config.kind === "subscription" ||
    (config.kind === "ollama" && config.model.trim().length > 0) ||
    (config.kind === "custom" &&
      config.base_url.trim().length > 0 &&
      config.api_key.trim().length > 0 &&
      config.model.trim().length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ kind, icon: Icon, title, desc }) => (
          <button
            key={kind}
            onClick={() => patch({ kind })}
            className={cn(
              "rounded-[var(--r-2)] border p-3 text-left transition-colors",
              config.kind === kind
                ? "border-accent bg-surface-raised"
                : "border-border bg-surface hover:border-border-hover",
            )}
          >
            <Icon size={15} className={config.kind === kind ? "text-accent" : "text-text-muted"} />
            <p className="mt-2 text-[13px] leading-tight text-text-emphasis">{title}</p>
            <p className="mt-1 text-[11px] leading-snug text-text-muted">{desc}</p>
          </button>
        ))}
      </div>

      {config.kind === "ollama" && (
        <div className="flex flex-col gap-2 rounded-[var(--r-2)] border border-border bg-surface-raised p-3">
          <Field label="Ollama URL">
            <Input
              value={config.base_url}
              onChange={(v) => patch({ base_url: v })}
              placeholder="http://localhost:11434 (default)"
            />
          </Field>
          <Field label="Model — pick from what's installed, or type any">
            <ModelPicker config={config} value={config.model} onPick={(id) => patch({ model: id })} maxHeight={160} />
            <Input
              value={config.model}
              onChange={(v) => patch({ model: v })}
              placeholder="qwen3-coder  ·  glm-4.7  ·  gpt-oss:20b"
            />
          </Field>
        </div>
      )}

      {config.kind === "custom" && (
        <div className="flex flex-col gap-2 rounded-[var(--r-2)] border border-border bg-surface-raised p-3">
          <div className="flex flex-wrap gap-1.5">
            {CUSTOM_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => patch({ base_url: p.url })}
                title={`${p.url} — ${p.hint}`}
                className={cn(
                  "rounded-[var(--r-1)] border px-2 py-1 text-[11px] transition-colors",
                  config.base_url === p.url
                    ? "border-accent text-text-emphasis"
                    : "border-border text-text-muted hover:border-border-hover hover:text-text",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
          <Field label="Base URL (Anthropic-compatible)">
            <Input
              value={config.base_url}
              onChange={(v) => patch({ base_url: v })}
              placeholder="https://openrouter.ai/api"
            />
          </Field>
          <Field label="API key">
            <Input
              value={config.api_key}
              onChange={(v) => patch({ api_key: v })}
              placeholder="sk-…"
              password
            />
          </Field>
          <Field label="Model — search your provider's catalog, or type any">
            <ModelPicker config={config} value={config.model} onPick={(id) => patch({ model: id })} maxHeight={160} />
            <div className="grid grid-cols-2 gap-2">
              <Input value={config.model} onChange={(v) => patch({ model: v })} placeholder="model id" />
              <Input
                value={config.small_model}
                onChange={(v) => patch({ small_model: v })}
                placeholder="small/fast model (optional)"
              />
            </div>
          </Field>
        </div>
      )}

      {notes.length > 0 && (
        <div className="rounded-[var(--r-2)] border border-border bg-surface p-3">
          <p className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <Info size={12} className="text-text-muted" />
            Good to know
          </p>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-[11px] leading-snug text-text-muted">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {saved && (
          <span className="flex items-center gap-1 text-[12px] text-text-muted">
            <Check size={13} /> Saved — applies to new sessions
          </span>
        )}
        <Button size="sm" variant="solid" onClick={save} disabled={!canSave || saving}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : null}
          {needsModel ? "Save provider" : "Use subscription"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="mono-label !text-[10px]">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  password,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  password?: boolean;
}) {
  return (
    <input
      value={value}
      type={password ? "password" : "text"}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="rounded-[var(--r-1)] border border-border bg-bg px-2 py-1.5 font-mono text-[12px] text-text outline-none placeholder:text-text-disabled focus:border-border-hover"
    />
  );
}
