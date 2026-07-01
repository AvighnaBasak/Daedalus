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

**Core cockpit**
- **Live Claude Code terminal** — the real interactive TUI over a pty, with multi-session tabs that
  all keep running in the background when you switch.
- **Context & cost HUD** — token budget meter (grey → red as it fills) and a live `$` estimate,
  derived from `~/.claude/projects/**` transcripts.
- **Files & Editor** — a project file tree with a Monaco editor; open, edit, and save (`Ctrl+S`).
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

- **[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)** installed and authenticated
  (`npm i -g @anthropic-ai/claude-code`, then run `claude` once to sign in).
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
npm run tauri build    # produces NSIS (.exe) and MSI bundles on Windows
```

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

## Roadmap

- Public QR tunnel (cloudflared) so the device preview works off-network.
- Auto-open the editor when Claude edits a file.
- Commit graph + AI commit messages; secrets vault and pre-commit secret scanning.
- Gamerish FX pass: film grain, reactive background, sound cues, session streak HUD.
- macOS polish.

## License

**AGPL-3.0** (inherited from the forked `opcode` base). The Claude Code CLI remains a separate
external dependency owned by Anthropic and is not redistributed as part of this project.

## Credits

Built on the shoulders of [opcode](https://github.com/winfunc/opcode), [Tauri](https://tauri.app),
[Monaco Editor](https://microsoft.github.io/monaco-editor/), and [xterm.js](https://xtermjs.org).
