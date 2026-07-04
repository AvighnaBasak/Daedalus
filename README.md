<div align="center">

# **DAEDALUS**

**A super-house for Claude Code.**

A free, open-source, non-Electron desktop cockpit that houses the *real* interactive
Claude Code CLI — and wraps it in everything a power user needs: a VS Code-grade editor,
parallel isolated agents, git superpowers, live cost telemetry, device previews,
an encrypted vault, and a bring-your-own-brain provider system. Zero API cost required.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-red.svg)](LICENSE)
![Platform](https://img.shields.io/badge/Platform-Windows--first-lightgrey)
![Shell](https://img.shields.io/badge/Shell-Tauri%202%20(no%20Electron)-black)

</div>

---

## Why Daedalus

- **The real `claude`, not a re-implementation.** The genuine interactive CLI runs over a true
  pseudo-terminal (ConPTY on Windows). Every feature of the CLI — plan mode, permission prompts,
  slash commands, hooks — works exactly as Anthropic ships it.
- **Zero-cost by design.** Works with a Claude subscription (no API billing), a free local model
  through Ollama, or any Anthropic-compatible API. Cost tracking reads Claude's own transcripts.
- **Not Electron.** A Tauri 2 shell (Rust core + the OS WebView). ~19 MB executable,
  ~7.5 MB installer, ~75 MB RAM, ~200 kB gzipped initial JS.
- **Editorial matte-black design.** A strict greyscale ramp with a single red accent, hairline
  borders, real depth — no gradients, no glow. The terminal and editor render in full color.

---

## Features

### The terminal (core)

- Real interactive **Claude Code TUI** over a native pty — raw bytes streamed to a truecolor
  xterm.js front-end (full ANSI palette, Cascadia Mono, 10,000-line scrollback, clickable links).
- **Multi-session tabs** — every session's terminal stays mounted and running when you switch
  tabs, open panels, or use the board. Agents never pause in the background.
- **Session resume** — opening a folder Claude has worked in before offers
  *Resume last conversation* (`claude --continue`) or *Start fresh*.
- **Live status detection** per session — *idle / working / needs-you* inferred from terminal
  output; a red pulsing dot on the tab, a pulsing hairline over the terminal, and an optional
  two-note chime when an agent hits a permission or plan prompt.
- **Backend badge** (ANTHROPIC / OLLAMA / CUSTOM) showing what each session was spawned on, and a
  **"Provider changed — restart to apply"** chip that respawns the session (resuming its
  conversation) when you switch providers mid-flight.
- **Model switcher** — `/model` from a menu: Opus / Sonnet / Haiku on subscription, or a live,
  searchable catalog of every model your Ollama / API endpoint actually serves.
- **Compact button** — one click runs `/compact` to summarize and prune context.
- **Snippets** — per-project snippet library, pasted straight into the live CLI.
- **Focus mode** (`Ctrl+Shift+F`) — hides everything but the terminal.
- **Command palette** (`Ctrl+K`) — jump to any session, panel, or action.
- **HUD strip** — live context-window meter (grey → red as it fills) and running `$` estimate in
  the title bar, parsed from Claude Code's own transcript files.

### The editor (VS Code-grade)

- **File tree** with colored file-type icons (TS, JS, JSON, HTML, CSS, Rust, Python, Go, images,
  configs, and more) and folder tinting.
- **Live git decorations** — VS Code-style letters and colors: `U` untracked (green), `M` modified
  (amber), `A` added (green), `D` deleted (red, strikethrough), `R` renamed (blue), plus an amber
  dot on any folder containing changes. Auto-refreshes every 5 seconds.
- **File operations** — right-click context menu: New file, New folder, Rename, Delete
  (two-step confirm); inline naming inputs right in the tree; toolbar buttons for quick creation.
- **Multi-tab Monaco editor** — open as many files as you like; per-tab dirty dots; close
  buttons; `Ctrl+S` to save; tabs auto-close when their file is deleted.
- **Full Dark+-style syntax colors** on the matte-black ground, for ~30 languages, with
  bracket-match highlighting, indent guides, find-match colors, and smooth cursor.
- **Safety rails** — 2 MB size guard and binary-file detection before opening.
- Monaco is **lazy-loaded** — the app boots instantly; the editor loads on first open.

### Git superpowers

- **Changes panel** — working-tree file list with VS Code status colors, and an inline Monaco
  **diff viewer** (green insertions / red removals) for every file against HEAD.
- **Commit from the app** — message box with an **AI-generated commit message** button
  (pipes the diff through `claude -p` on your configured provider).
- **Secret scan before every commit** — built-in gitleaks-style rules (AWS keys, GitHub / Slack /
  Google tokens, private keys, generic API secrets) over the diff *and* untracked files, with an
  explicit *Commit anyway* override.
- **History graph** — commit timeline with merge markers, branch/tag badges, authors, and dates.
- **Checkpoint & rewind** — one-click git-plumbing snapshot (tracked + untracked, no history
  pollution, HEAD untouched) before a risky run; rewind restores the snapshot instantly.
- **Isolated parallel agents** — start a session on its own **git worktree** (auto-created
  branch) so several Claude agents work the same repo without collisions; worktrees live outside
  your project and can be removed from the board.

### Agent orchestration

- **Agent board** — a live overview card per session: status dot, branch/worktree badge, context
  %, cost, last activity; click to focus, spawn plain or isolated sessions, remove worktrees.
- **Attention routing** — the moment any background agent needs a human decision, its tab and
  board card flag red; click and answer in the real terminal.
- **Headless sub-agents** — fork a scoped `claude -p` task (model selectable) with live output
  streaming and a kill switch, without disturbing your main session.
- **Template gallery** — scaffold a starter project (Vite React / Vue / Svelte, Next.js, …) and
  auto-open a session inside it, with a prefilled kickoff prompt.

### Bring your own brain (providers)

| Provider | Cost | How |
|---|---|---|
| **Claude subscription** (default) | Your existing plan, $0 API | The CLI's own login |
| **Ollama** (local) | $0 | Native Anthropic-compatible API (Ollama ≥ 0.14) |
| **Any Anthropic-compatible API** | Provider-priced | OpenRouter, DeepSeek, Moonshot, Z.AI GLM, LM Studio presets — or any base URL |

- Switch in onboarding or Settings; applies to new sessions (existing tabs get a restart chip).
- **Live model catalogs** — Ollama models via `/api/tags`; OpenRouter filtered to
  **tool-capable models only** (the ones that can actually drive Claude Code); generic
  `/v1/models` probe for other gateways.
- **Honest compatibility notes** — small models are flagged as weak for agentic use; raw
  Google/OpenAI keys are called out as needing a gateway (different protocol).
- **Cost adapts** — non-Claude models display $0; transcripts still track tokens.

### Preview & sharing

- **In-app browser** — Desktop, iPhone, and Android device frames; multi-tab; URL bar.
- **Auto-reload on save** — a native file watcher refreshes the preview when Claude edits files.
- **Public tunnel** — one click spins up ngrok and shows a **QR code** so any phone, anywhere,
  can open your dev server.
- **Recap cards** — export a shareable PNG of your session stats.

### Secrets & safety

- **Encrypted vault** — per-project secrets stored **AES-256-GCM** encrypted outside the repo;
  one click writes them to `.env` *and* ensures `.gitignore` covers it.
- **Lean context** — a toggle that denies Claude read access to heavy directories
  (`node_modules`, `dist`, `target`, lockfiles, …) via `.claude/settings.local.json`,
  saving tokens on every session.
- **Strict CSP** — the webview only talks to itself and your local dev servers.

### MCP hub

- List configured MCP servers with health status, add stdio/SSE servers, remove them, and
  quick-add popular ones — no hand-editing JSON.

### Cost analytics

- **Live meter** — context % and cost for the active session, straight from
  `~/.claude/projects/**` transcripts (the same numbers Claude itself sees).
- **Cost history** — a cross-project leaderboard of tokens and dollars over time.

### Desktop experience

- **Frameless matte-black window** with a thin red accent border, custom title bar (drag
  anywhere, double-click to maximize), and native minimize / maximize / close.
- **Custom themes** — pick or fine-tune the accent color and background tone in Settings;
  optional film grain and sound; everything follows the design tokens.
- **Onboarding** — detects the `claude` CLI (reliably, including in installed builds), offers a
  guided `npm install -g @anthropic-ai/claude-code` with the official setup docs, then provider
  choice, then your first project. No subscription? It tells you exactly how to run free.
- **Settings** — install/uninstall the CLI, switch providers, toggle lean context, re-run
  onboarding.
- **Installers** — NSIS `.exe` and `.msi`, per-user (no admin), WebView2 bootstrapped
  automatically; no console-window flashes anywhere.

---

## Tech stack

| Layer | Tech |
|---|---|
| Shell | [Tauri 2](https://tauri.app) — Rust core + WebView2 |
| Frontend | React 19 · Vite · TypeScript · Tailwind CSS v4 |
| Terminal | [xterm.js](https://xtermjs.org) over [`portable-pty`](https://docs.rs/portable-pty/) (ConPTY) |
| Editor | [Monaco](https://microsoft.github.io/monaco-editor/) (lazy-loaded, locally bundled) |
| Crypto | `aes-gcm` (AES-256-GCM) |
| Store | SQLite (`rusqlite`) |

---

## Getting started

### Prerequisites (Windows)

1. **[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)** — or let Daedalus's
   onboarding install it for you (`npm install -g @anthropic-ai/claude-code`).
2. **WebView2 runtime** — preinstalled on Windows 11; the installer bootstraps it otherwise.
3. No Claude subscription? Pick **Ollama** or an **API key** during onboarding — total cost $0
   with local models.

### Install

Run `Daedalus_x64-setup.exe` (NSIS) or the `.msi` — per-user, no admin required.

### Build from source

```bash
# Needs Node 20+, Rust (MSVC toolchain), and VS Build Tools C++ workload
git clone https://github.com/AvighnaBasak/Daedalus.git
cd Daedalus
npm install
npm run tauri dev      # develop
npm run tauri build    # produce installers in src-tauri/target/release/bundle/
```

---

## Design system

Single source of truth in `src/styles/tokens.css`: matte black `#0A0A0A`, a full greyscale ramp,
and exactly one chromatic accent (red `#E5484D`, user-tunable). Elevation via surface steps and
1 px hairlines + neutral shadows — never gradients, never glow. Code and terminal output are the
one deliberate exception: they render in full color, because syntax should look like syntax.

---

## License

**AGPL-3.0.** Daedalus began as a hard fork of [opcode](https://github.com/winfunc/opcode)
(AGPL-3.0) and inherits its license. The Claude Code CLI itself is a separate, external
dependency owned by Anthropic.

## Credits

- [opcode](https://github.com/winfunc/opcode) — the AGPL fork base for the Tauri scaffolding.
- [Anthropic](https://anthropic.com) — Claude Code.
- Everyone building open tooling around agentic coding.
