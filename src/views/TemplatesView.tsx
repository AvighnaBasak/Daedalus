import { useState } from "react";
import { FolderOpen, Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { runScaffold } from "@/lib/git";
import { pickProjectFolder } from "@/lib/project";
import type { Session } from "@/lib/types";

interface Template {
  id: string;
  name: string;
  stack: string;
  command: string;
  /** args; "{name}" is replaced with the project name */
  args: string[];
}

const TEMPLATES: Template[] = [
  { id: "vite-react", name: "Vite + React", stack: "TypeScript", command: "npm", args: ["create", "vite@latest", "{name}", "--", "--template", "react-ts"] },
  { id: "vite-vue", name: "Vite + Vue", stack: "TypeScript", command: "npm", args: ["create", "vite@latest", "{name}", "--", "--template", "vue-ts"] },
  { id: "vite-svelte", name: "Vite + Svelte", stack: "TypeScript", command: "npm", args: ["create", "vite@latest", "{name}", "--", "--template", "svelte-ts"] },
  { id: "next", name: "Next.js", stack: "App Router · Tailwind", command: "npx", args: ["create-next-app@latest", "{name}", "--ts", "--tailwind", "--eslint", "--app", "--src-dir", "--use-npm", "--yes"] },
];

const CUSTOM_KEY = "daedalus.templates.custom";
function loadCustom(): Template[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveCustom(list: Template[]) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
}

function joinPath(parent: string, name: string): string {
  const sep = parent.includes("\\") ? "\\" : "/";
  return parent.replace(/[\\/]$/, "") + sep + name;
}

export function TemplatesView({ onScaffolded }: { onScaffolded: (session: Session) => void }) {
  const [selected, setSelected] = useState<Template | null>(null);
  const [parent, setParent] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState<Template[]>(() => loadCustom());
  const [showSave, setShowSave] = useState(false);
  const [cName, setCName] = useState("");
  const [cCmd, setCCmd] = useState("");

  const all = [...TEMPLATES, ...custom];

  const saveStack = () => {
    const parts = cCmd.trim().split(/\s+/);
    if (!cName.trim() || parts.length === 0) return;
    const t: Template = {
      id: `custom-${Date.now().toString(36)}`,
      name: cName.trim(),
      stack: "Custom stack",
      command: parts[0],
      args: parts.slice(1),
    };
    const next = [...custom, t];
    setCustom(next);
    saveCustom(next);
    setShowSave(false);
    setCName("");
    setCCmd("");
  };

  const create = async () => {
    if (!selected || !parent || !name.trim() || busy) return;
    setBusy(true);
    setError(null);
    setOutput("Scaffolding…");
    const projName = name.trim();
    const args = selected.args.map((a) => a.replace("{name}", projName));
    try {
      const out = await runScaffold(selected.command, args, parent);
      setOutput(out.slice(-600));
      const cwd = joinPath(parent, projName);
      onScaffolded({ id: crypto.randomUUID(), title: projName, cwd });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-3xl px-8 py-6">
        <span className="mono-label">Templates</span>
        <h1 className="mt-1 text-[22px] text-text-emphasis">Start a new project</h1>
        <p className="mt-1 text-[13px] text-text-muted">
          Scaffold a starter and open a Claude session in it.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {all.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSelected(t);
                setError(null);
                setOutput(null);
              }}
              className={[
                "rounded-[var(--r-2)] border bg-surface p-4 text-left transition-colors",
                selected?.id === t.id ? "border-accent" : "border-border hover:border-border-hover",
              ].join(" ")}
            >
              <p className="text-[14px] text-text-emphasis">{t.name}</p>
              <p className="mt-0.5 text-[12px] text-text-muted">{t.stack}</p>
              <p className="mt-2 font-mono text-[11px] text-text-disabled">
                {t.command} {t.args.filter((a) => a !== "--").join(" ")}
              </p>
            </button>
          ))}
        </div>

        {/* clone my stack */}
        <div className="mt-4">
          {showSave ? (
            <div className="flex flex-col gap-2 rounded-[var(--r-2)] border border-border bg-surface-raised p-3">
              <span className="mono-label !text-[10px]">Save your own stack</span>
              <input
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="Template name (e.g. My T3 stack)"
                className="rounded-[var(--r-1)] border border-border bg-bg px-2 py-1.5 text-[12px] text-text outline-none placeholder:text-text-disabled focus:border-border-hover"
              />
              <input
                value={cCmd}
                onChange={(e) => setCCmd(e.target.value)}
                placeholder="Command — use {name} for the project name, e.g. npx create-t3-app@latest {name} --CI"
                spellCheck={false}
                className="rounded-[var(--r-1)] border border-border bg-bg px-2 py-1.5 font-mono text-[11px] text-text outline-none placeholder:text-text-disabled focus:border-border-hover"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowSave(false)}>Cancel</Button>
                <Button size="sm" variant="solid" onClick={saveStack} disabled={!cName.trim() || !cCmd.trim()}>Save template</Button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowSave(true)} className="text-[12px] text-text-muted underline-offset-2 hover:text-text hover:underline">
              + Clone my stack — save a custom scaffold command as a template
            </button>
          )}
        </div>

        {selected && (
          <div className="mt-5 rounded-[var(--r-2)] border border-border bg-surface-raised p-4">
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="mono-label !text-[10px]">Project name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.replace(/\s+/g, "-"))}
                  placeholder="my-app"
                  spellCheck={false}
                  className="rounded-[var(--r-1)] border border-border bg-bg px-2 py-1.5 font-mono text-[12px] text-text outline-none placeholder:text-text-disabled focus:border-border-hover"
                />
              </label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={async () => setParent(await pickProjectFolder())}>
                  <FolderOpen size={13} />
                  {parent ? "Change folder" : "Parent folder"}
                </Button>
                {parent && <span className="truncate text-[11px] text-text-muted">{parent}</span>}
              </div>

              {error && <p className="font-mono text-[11px] text-accent-hover">{error}</p>}
              {output && !error && (
                <pre className="max-h-32 overflow-auto rounded-[var(--r-1)] border border-border bg-bg p-2 font-mono text-[11px] text-text-muted">
                  {output}
                </pre>
              )}

              <div className="flex justify-end">
                <Button variant="solid" onClick={create} disabled={!parent || !name.trim() || busy}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                  Create & open
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
