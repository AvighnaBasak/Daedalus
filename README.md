# Daedalus

> A power-user desktop cockpit for the **Claude Code CLI** — matte-black, non-Electron, token-aware.

Daedalus is a lightweight native desktop shell built to *house* the real Claude Code CLI. It is
**not** another chat wrapper: it runs the genuine interactive `claude` TUI in a real pseudo-terminal
and wraps it in a fast, editorial, greyscale-and-red interface with a live token/cost meter, an MCP
hub, a project file editor, and a device-frame web preview.

Claude Code itself stays untouched and is a required external dependency — Daedalus is the shell
around it, not a replacement for it.

---

## Why

Existing Claude Code GUIs either reimplement the chat (losing the real TUI, plan mode, and
permission prompts) or ship a heavyweight Electron app. Daedalus keeps the **real CLI** and makes
it more powerful:

- **Real `claude`, real terminal.** The interactive CLI runs over a true pty (ConPTY on Windows),
  rendered with a themed xterm — plan mode, approvals, everything, exactly as in your terminal.
- **Token & cost as a first-class feature.** A live meter reads Claude's own session transcripts
  and shows context-window fill and a running dollar estimate.
- **Non-Electron.** A Tauri 2 shell (Rust core + the OS webview) instead of bundling Chromium.
- **Aesthetics matter.** A strict matte-black design system: a full greyscale ramp plus a single
  red accent, no gradients, crisp hairlines.

## Features

**Bring your own brain — three ways to run it**

Daedalus always drives the real Claude Code CLI, but *where it thinks* is your choice
(picked in onboarding, switchable any time in Settings):

| Backend | Cost | How |
|---|---|---|
| **Claude subscription** (default) | your plan | the CLI's normal Anthropic login |
| **Ollama — local & free** | $0 | Ollama v0.14+ speaks the Anthropic API natively; Daedalus injects `ANTHROPIC_BASE_URL` |
| **Any API key** | your provider's | any Anthropic-compatible endpoint (DeepSeek, GLM, Kimi, LM Studio, gateways…) |

The whole app adapts: cost tracking shows **$0 / untracked** for local & custom models, sub-agents
follow the same backend, and the model switcher gains **live catalog search** — your installed
Ollama models, or OpenRouter's full list filtered to tool-capable (Claude Code-usable) models
(256 of 340 at the time of writing, including Gemini and GPT via OpenRouter). Sessions are stamped
with the backend they started on; change providers and a one-click **"restart to apply"** chip
appears. The UI tells you honestly when a feature depends on model quality (small local models can
struggle with agentic tool use — prefer 64k+ context coding models like `qwen3-coder`), and that
raw Google/OpenAI keys need a gateway like OpenRouter or LiteLLM.

**Core cockpit**
- **Live Claude Code terminal** — the real interactive TUI over a pty, full ANSI color, with
  multi-session tabs that all keep running in the background when you switch.
- **Session resume** — opening a folder Claude has worked in before offers "resume last
  conversation" (`claude --continue`); provider-change restarts also pick the conversation back up.
- **Context & cost HUD** — token budget meter (grey → red as it fills) and a live `$` estimate,
  derived from `~/.claude/projects/**` transcripts.
- **Files & Editor** — a VS Code-grade editing surface: file tree with colored file-type icons and
  live git decorations (green `U`, amber `M`, red `D` — folders dot when dirty), right-click
  new-file / new-folder / rename / delete, multi-tab Monaco with Dark+-style syntax color, dirty
  dots, and `Ctrl+S` save.
- **MCP Hub** — list configured MCP servers with health status, add new ones (stdio / SSE),
  and remove them, without hand-editing config.
- **Device preview** — an in-app browser framed as Desktop / iPhone / Android, with a QR code.
- **Command palette** — `⌘/Ctrl+K` to jump between sessions and panels.
- **Seamless onboarding** — first-run preflight checks for the `claude` CLI with plain-English fixes.

**Agentic orchestration**
- **Isolated parallel agents** — start a session on its own **git worktree** (new branch) so several
  Claude agents can work at once without colliding on files.
- **Agent board** — a live overview of every session: status (idle / working / needs-you), context %,
  cost, and last activity; click to focus, or remove a worktree when done.
- **Attention routing** — when an agent hits a permission/plan prompt, its tab and board card flag red
  so you always know which one is waiting on you.
- **Checkpoint & rewind** — one-click git snapshot before a risky run (`commit-tree`, no history
  pollution) and instant rewind (`git restore`).
- **Session compaction** — a button that runs `/compact` to prune context.
- **Template gallery** — scaffold a starter (Vite React/Vue/Svelte, Next.js) and open a session in it.

**Git & diff visibility**
- **Live diff viewer** — see exactly what Claude changed per file in a themed Monaco diff (additions
  grey, removals red), plus a commit-graph **History** tab.
- **AI commit messages** — generate a commit message from the working diff via the `claude` CLI
  (runs on your subscription, no extra API cost).
- **Secret-scan before commit** — a built-in gitleaks-style scanner flags likely keys/tokens in your
  changes (and untracked files) before you commit.

**Token efficiency**
- **Model switcher** — one click to switch the live session between Opus / Sonnet / Haiku (`/model`).
- **Cost history** — a cross-project leaderboard of tokens and `$` spent, from `~/.claude` transcripts.
- **Lean context** — deny Claude read access to heavy dirs (node_modules, dist, target, lockfiles…)
  via `.claude/settings.local.json`, so it stops wasting context on them.

**Preview power**
- **Public tunnel + QR** — expose the local dev server via ngrok and scan the QR from any network.
- **Multi-tab preview** and **auto-reload on save** (a file watcher refreshes the in-app browser).

**Secrets, env & QoL**
- **Encrypted secrets vault** — per-project keys stored AES-256-GCM encrypted outside the repo;
  materialize a git-ignored `.env` on demand. Raw keys never sit in Claude's context.
- **Sub-agent spawner** — fork a headless `claude -p` (Haiku by default) for scoped tasks with
  live streamed output, without polluting the main session.
- **Focus mode** (`Ctrl+Shift+F`) — hide everything but the terminal.
- **Snippets** — per-project clipboard/snippet history, pasted straight into the live CLI.

**Aesthetic & shareability**
- **Custom themes** — pick or fine-tune the accent color and background tone; everything follows,
  including the terminal cursor. Film grain and sound cues are toggleable.
- **Attention cues** — a pulsing hairline (and optional two-note chime) when an agent needs you.
- **Stats HUD + recap card** — lifetime projects/sessions/tokens/cost on the board, exportable as
  a styled PNG for build-in-public posts.

Panels dock beside the always-present terminal (Editor on the left; MCP and Preview on the right)
and close with `X` to return Claude to fullscreen — the session never restarts when you open a panel.

## Tech stack

- **Shell:** [Tauri 2](https://tauri.app) (Rust + native WebView2)
- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS v4
- **Editor:** [Monaco](https://microsoft.github.io/monaco-editor/) · **Terminal:** [xterm.js](https://xtermjs.org)
- **PTY:** [`portable-pty`](https://docs.rs/portable-pty/) · **Store:** SQLite (`rusqlite`)

Daedalus forks the session/process architecture of [opcode](https://github.com/winfunc/opcode)
(AGPL-3.0), strips its headless chat UI, and rebuilds the feature/UI layer on top — running the real
interactive CLI over a pty rather than driving Claude headlessly.

## Prerequisites (Windows)

- **[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)** installed
  (`npm i -g @anthropic-ai/claude-code`). A Claude subscription is optional — Ollama or any
  Anthropic-compatible API key works too (configured in onboarding/Settings).
- **Node.js** 20+ and **Rust** (stable, `x86_64-pc-windows-msvc`).
- **Visual Studio Build Tools** with the **Desktop development with C++** workload (MSVC + Windows SDK):
  ```powershell
  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
  ```
- **WebView2 runtime** (preinstalled on Windows 11; the installer bundles a bootstrapper otherwise).

> Windows is the primary target for v1. macOS/Linux code paths exist but are not yet a focus.

## Getting started

```bash
git clone https://github.com/AvighnaBasak/Daedalus.git
cd Daedalus
npm install
npm run tauri dev      # launches the app (first Rust build takes a few minutes)
```

Build an installer:

```bash
npm run tauri build    # branded NSIS (.exe) + MSI bundles on Windows
```

**Fast & light by design** — no Electron (native WebView2), a size-optimized LTO release build,
and a lazily-loaded editor: Monaco's ~3 MB only loads the first time you open the Files or Git
panel, so the cockpit starts on a ~200 kB (gzipped) bundle.

## Project structure

```
Daedalus/
├─ src/                  # React UI
│  ├─ styles/tokens.css  # design system — the single source of truth
│  ├─ shell/             # title bar, rail, docks
│  ├─ terminal/          # xterm bound to the pty (the real claude TUI)
│  ├─ editor/            # Monaco + file tree
│  ├─ views/             # MCP hub, device preview, settings
│  ├─ meter/             # token/cost hook
│  └─ palette/           # ⌘K command palette
├─ src-tauri/            # Rust core
│  ├─ src/pty/           # interactive `claude` over portable-pty
│  ├─ src/git/           # worktrees, checkpoint/rewind, scaffold runner
│  ├─ src/live_usage/    # token/cost from ~/.claude/projects transcripts
│  ├─ src/files/         # project file read/write for the editor
│  └─ src/commands/      # sessions, MCP (from the opcode base)
└─ DAEDALUS.md           # original design brief
```

## Design system

Everything derives from `src/styles/tokens.css`. The rule: **the only chroma in the app is red;
everything else is greyscale, and there are no gradients** — elevation comes from surface steps and
1px hairlines. Base `#0A0A0A`, accent `#E5484D`.

## Roadmap / consciously deferred

- **Console/network capture in the preview** — needs a Playwright/CDP-driven browser (webview
  iframes can't expose cross-origin consoles); planned as an opt-in later.
- **Pin-a-tab screenshots into context** — same Playwright dependency as above.
- **Session replay/GIF export** — recap cards ship today; full replay is a heavy add.
- **Plan-mode step rail** — plan/permission prompts are detected and routed (red pulse); parsing
  full plan text out of the TUI is too brittle to ship.
- **Image generation / voice I/O** — intentionally out of scope to keep Daedalus zero-cost.
- macOS polish.

## License

**AGPL-3.0** (inherited from the forked `opcode` base). The Claude Code CLI remains a separate
external dependency owned by Anthropic and is not redistributed as part of this project.

## Credits

Built on the shoulders of [opcode](https://github.com/winfunc/opcode), [Tauri](https://tauri.app),
[Monaco Editor](https://microsoft.github.io/monaco-editor/), and [xterm.js](https://xtermjs.org).
