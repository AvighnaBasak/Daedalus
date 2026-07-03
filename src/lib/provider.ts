import { useEffect, useState } from "react";
import { invoke, isTauri } from "./tauri";

export type ProviderKind = "subscription" | "ollama" | "custom";

export interface ProviderConfig {
  kind: ProviderKind;
  base_url: string;
  api_key: string;
  model: string;
  small_model: string;
}

export const DEFAULT_PROVIDER: ProviderConfig = {
  kind: "subscription",
  base_url: "",
  api_key: "",
  model: "",
  small_model: "",
};

export const getProvider = async (): Promise<ProviderConfig> => {
  if (!isTauri()) return DEFAULT_PROVIDER;
  return { ...DEFAULT_PROVIDER, ...(await invoke<ProviderConfig>("get_provider")) };
};

export const setProvider = async (config: ProviderConfig): Promise<void> => {
  if (!isTauri()) return;
  await invoke<void>("set_provider", { config });
  window.dispatchEvent(new CustomEvent("daedalus:provider"));
};

export interface ModelInfo {
  id: string;
  name: string;
}

/** Models the configured backend actually serves (Ollama tags / OpenRouter
 * catalog filtered to tool-capable models / generic v1-models probe). */
export const listProviderModels = async (config: ProviderConfig): Promise<ModelInfo[]> => {
  if (!isTauri()) return [];
  return invoke<ModelInfo[]>("list_provider_models", { config });
};

/** Known-good Anthropic-compatible endpoints for the custom option. */
export const CUSTOM_PRESETS: { name: string; url: string; hint: string }[] = [
  { name: "OpenRouter", url: "https://openrouter.ai/api", hint: "hundreds of models — incl. Gemini, GPT, Qwen" },
  { name: "DeepSeek", url: "https://api.deepseek.com/anthropic", hint: "deepseek-chat / reasoner" },
  { name: "Moonshot Kimi", url: "https://api.moonshot.ai/anthropic", hint: "kimi-k2" },
  { name: "Z.AI GLM", url: "https://api.z.ai/api/anthropic", hint: "glm-4.7" },
  { name: "LM Studio", url: "http://localhost:1234", hint: "local models" },
];

/** Live provider config, refreshed whenever it's changed anywhere in the app. */
export function useProvider(): ProviderConfig {
  const [config, setConfig] = useState<ProviderConfig>(DEFAULT_PROVIDER);
  useEffect(() => {
    let alive = true;
    const refresh = () => void getProvider().then((c) => alive && setConfig(c));
    refresh();
    window.addEventListener("daedalus:provider", refresh);
    return () => {
      alive = false;
      window.removeEventListener("daedalus:provider", refresh);
    };
  }, []);
  return config;
}

/** Honest feature-compatibility notes per provider, surfaced in the UI. */
export function compatNotes(kind: ProviderKind): string[] {
  if (kind === "subscription") return [];
  const shared = [
    "Cost tracking shows $0 — local models are free; third-party API pricing isn't tracked.",
    "Agentic quality (tool use, plan mode, sub-agents) depends on the model — small models may struggle.",
    "The Opus/Sonnet/Haiku switcher is replaced by your provider's model names.",
  ];
  if (kind === "ollama") {
    return [
      "Needs Ollama v0.14+ running locally (`ollama serve`).",
      "Use a coding model with a large context — 64k+ tokens recommended (e.g. qwen3-coder, glm-4.7).",
      ...shared,
    ];
  }
  return [
    "The endpoint must speak the Anthropic Messages API — OpenRouter, DeepSeek, Kimi, GLM, and LM Studio do.",
    "Raw Google Gemini / OpenAI keys won't work directly (different protocol) — use them through OpenRouter or a LiteLLM gateway instead.",
    ...shared,
  ];
}

export function providerLabel(kind: ProviderKind): string {
  return kind === "ollama" ? "Ollama · local" : kind === "custom" ? "Custom API" : "Claude subscription";
}
