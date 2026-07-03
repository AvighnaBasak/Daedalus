# Daedalus

> Named after the legendary Greek craftsman/architect who built the Labyrinth — fitting for a "house" built to hold the most powerful thing inside it.

## What I'm Building

Daedalus is a free, open-source, non-Electron desktop shell purpose-built to house the **Claude Code CLI**. It is not a general-purpose code editor and not "yet another Claude Code GUI wrapper" — it's a superhouse: a single power-user cockpit that makes Claude Code as token-efficient, as agentic, and as MCP-juiced as possible, wrapped in a clean, dark, gamerish, editorial-looking UI instead of a generic SaaS dashboard.

Claude Code CLI itself stays untouched and is a required external dependency (`claude` must be installed and authenticated). Daedalus is the shell around it, not a replacement for it.

**Core design principles:**
- **Non-Electron.** Use a lightweight native webview shell (Tauri) instead of bundling Chromium.
- **Don't rebuild what already exists well.** Fork/vendor/adapt open-source components wherever a solid one exists instead of writing from scratch. Links to leverage below.
- **Token/cost efficiency is a first-class feature**, not an afterthought — this is the actual differentiator versus existing Claude Code GUIs.
- **AGPL-3.0, fully open source**, apart from Claude Code CLI itself (which stays Anthropic's, used as an external subprocess). *(Note: this project forks `opcode`, which is AGPL-3.0; that copyleft license carries over to Daedalus.)*
- **Aesthetic matters as much as function.** Dark, grainy, editorial default theme — not blue-gradient SaaS.

---

## Recommended Stack

- **Shell:** [Tauri 2](https://tauri.app) — Rust core + native OS webview, dramatically lighter than Electron, same category `opcode` already proved out for a Claude Code GUI.
- **Editor component:** [Monaco Editor](https://microsoft.github.io/monaco-editor/) — the actual VS Code editor component, usable standalone inside a Tauri webview without pulling in all of VS Code or Electron. Reference: [monaco-editor/react](https://www.npmjs.com/package/@monaco-editor/react) for easy integration, and see [this GitHub issue thread](https://github.com/microsoft/monaco-editor/issues/114) on non-Electron usage patterns.
- **Terminal/pty layer:** [portable-pty](https://docs.rs/portable-pty/) (Rust crate, used by Wezterm) to spawn and manage the `claude` CLI subprocess per session, or [node-pty](https://github.com/microsoft/node-pty) if going through a Node sidecar instead. Render output with a custom token-stream renderer (not raw xterm.js) so visual styling (plan rail, diff animation) is fully controllable.
- **Local state/history:** SQLite (bundled via `rusqlite` or `sqlx` on the Tauri side).
- **Reference architecture:** [opcode](https://github.com/winfunc/opcode) — an existing **AGPL-3.0**, Tauri 2-based GUI for Claude Code sessions. Daedalus forks its session-management/process layer directly (hence Daedalus is AGPL-3.0), strips its chat UI, and rebuilds the UI/feature layer on top per this spec. Note opcode drives Claude *headlessly* (`-p --output-format stream-json`); Daedalus instead runs the **real interactive `claude` TUI over a pty**.

---

## Open Source Components to Study/Fork/Vendor

| Need | Component | Link |
|---|---|---|
| Base architecture for Claude Code session management (Tauri + pty + sessions) | opcode (AGPL-3.0) | https://github.com/winfunc/opcode |
| Code editor surface | Monaco Editor | https://microsoft.github.io/monaco-editor/ |
| Desktop shell (non-Electron) | Tauri 2 | https://tauri.app |
| PTY process handling (Rust) | portable-pty | https://docs.rs/portable-pty/ |
| PTY process handling (Node alt) | node-pty | https://github.com/microsoft/node-pty |
| Mobile device preview via QR/tunnel | cloudflared or ngrok (either as a spawned local process) | https://github.com/cloudflare/cloudflared |
| React Native live device preview | Expo Go integration | https://docs.expo.dev/get-started/expo-go/ |
| In-app browser pane w/ console+network inspection | embed via Tauri's WebView + [Playwright](https://playwright.dev) driven headful browser for the "browser use" / screenshot features | https://playwright.dev |
| MCP client/server plumbing reference | Model Context Protocol SDKs | https://modelcontextprotocol.io |
| Git commit graph (lightweight, embeddable) | isomorphic-git (JS, no native git binary needed) | https://github.com/isomorphic-git/isomorphic-git |
| Secrets scanning before commit | gitleaks (can be shelled out to, or ported logic) | https://github.com/gitleaks/gitleaks |

---

## Feature List

### Foundation
- Tauri-based shell (non-Electron), Monaco as the editor component
- Claude Code CLI runs as a managed pty subprocess per session, not ad hoc shell-out — allows clean multiplexing
- Local-first: SQLite for session history/state, no forced cloud account
- Fork/adapt `opcode`'s session + pty layer as the architectural base

### Agentic Power / Orchestration
- Multi-session board — run several Claude Code instances in parallel on different branches/worktrees, visual kanban of what each is doing
- Sub-agent spawner UI — click to fork a headless Claude Code instance for a scoped task (test-writing, refactor, docs) without polluting main context
- Auto git worktree management — each session gets an isolated worktree so parallel agents never collide on files
- One-click "checkpoint & rewind" — snapshot repo state before a risky agentic run, revert instantly if it goes sideways
- Plan-mode visual rail — turn Claude Code's plan output into a real step tracker instead of scrollback text
- Approval queue — batch-review all pending tool-call permissions in one screen instead of interrupting per-call

### Token & Cost Efficiency (core differentiator)
- Context budget meter — live token usage bar per session, color-coded before blowing the context window
- Built-in `.claudeignore` + lean-context presets as a UI toggle
- Subagent model routing — force Haiku for cheap subagents, Sonnet/Opus for main thread, configurable per task type
- Diff-only context mode — feed Claude diffs/relevant files instead of full-file dumps where possible
- Session compaction button — summarize + prune old turns instead of letting context bloat
- Cache-aware prompt structuring (stable system prompt blocks first, volatile stuff last) to maximize prompt caching hits
- Live $ cost estimate per session (token count × model pricing), not just token count
- Session cost leaderboard/history — see which projects burned the most, spot waste patterns

### MCP Hub
- Built-in MCP marketplace/registry browser — search, one-click install, enable/disable per project
- Visual MCP config editor (no hand-editing `.claude.json`)
- Health check panel — see which MCP servers are connected/auth'd/broken at a glance
- Project-level vs global MCP scoping toggle

### Juiced-Up Extras
- Image generation panel wired to an API — Claude can request assets (icons, mockups, diagrams) mid-session, rendered inline
- Voice input/output (Whisper in, TTS out) for hands-free prompting
- Built-in browser pane (Playwright-backed) so Claude can screenshot/test its own web output without leaving the shell
- Inline terminal + Claude chat side by side, synced to the same cwd
- Live diff viewer as the primary surface, not an afterthought — animated, not just red/green text

### Mobile / Device Preview
- Responsive device-frame preview pane — wrap the built-in browser view in iPhone/Android chrome frames (CSS + viewport resize, not a real emulator)
- QR code generator — spin up a local tunnel (ngrok/cloudflared) and show a QR to open the app on an actual phone instantly
- Expo Go integration for React Native projects — scan QR, live reload on device (skip full emulator, too heavy for v1)

### In-App Browser, Leveled Up
- Multi-tab mini browser + "pin as reference" — Claude can pull a screenshot of a pinned tab (design inspo, docs page) into context on demand
- Console/network tab inside the mini browser so Claude can read JS errors directly instead of copy-paste
- Split view: browser pane auto-refreshes on file save (basic hot reload watcher)

### Project Scaffolding / Templates
- Starter template gallery — Flask+PyWebView, Next.js, React Native, etc. — one-click scaffold + auto-launch Claude Code with a pre-baked prompt for that stack
- "Clone my stack" — save your own settled stacks as reusable templates

### Secrets & Environment
- Local encrypted `.env` vault with a UI — inject secrets into sessions without Claude ever seeing raw keys in context
- One-click "sanitize before commit" — scan diffs for accidentally-included secrets before committing (leverage gitleaks)

### Git, Visual
- Simple commit graph view (branch/commit dots, not full GitKraken) so parallel agent sessions are visually traceable
- Auto-generated commit messages from the session diff, editable before commit

### Quality of Life
- Command palette (Cmd+K) for everything — switch sessions, toggle MCPs, run templates, no menu-diving
- Global clipboard/snippet history scoped per project
- Focus mode — hide everything but active session + diff
- Error overlay — plain-English "here's what broke" instead of raw stack trace on tool-call failure

### Gamerish / Aesthetic Layer
- Dark, grainy, editorial theme by default — no generic SaaS blue
- Session "streak" / activity visualization — commits, agent runs, tokens saved, shown like a stats HUD
- Ambient reactive background — subtle particle/pulse effects tied to tool calls
- Sound design — satisfying, minimal audio cues for task complete / error / approval needed

### Shareability
- Auto-generated session recap card (styled changelog) for build-in-public posts
- Export session as replay/GIF for demos

---

## Suggested v1 Build Order (manageable scope, not the full list at once)

1. Tauri shell + Monaco editor pane, boots to an empty project folder
2. Pty session manager wrapping the `claude` CLI (fork/adapt from `opcode`'s approach)
3. Context/token budget meter + live $ cost estimate
4. MCP marketplace/registry browser + visual config editor
5. Device-frame browser pane (responsive preview) + QR tunnel
6. Command palette (Cmd+K)
7. Dark/grainy default theme pass

Everything else in the feature list above bolts on incrementally after v1 is stable.

## Status (feature audit vs this spec)

**Done** — Tauri shell + Monaco; real interactive `claude` over a managed pty (multiplexed, all
sessions stay alive); SQLite-local, no cloud; multi-session board; sub-agent spawner (headless
`claude -p`); auto git-worktree isolation; checkpoint & rewind; attention routing (permission/plan
prompts flag the tab/board); context budget meter + live $ per session; lean-context presets
(permissions.deny); per-session model switching (incl. cheap subagent default = Haiku); session
compaction; cost history/leaderboard; MCP list/add/remove + curated quick-installs + health dots +
local/user scoping; device-frame preview + QR + public ngrok tunnel; multi-tab mini browser;
auto-refresh on save; template gallery + clone-my-stack; encrypted `.env` vault + git-ignore
guard; sanitize-before-commit secret scan; commit graph; AI commit messages via `claude -p`;
⌘K palette; snippets history; focus mode; plain-English error overlay/onboarding; grain, sound
cues, custom accent/background themes, stats HUD, recap card export.

**Consciously deferred** (reasons in README): browser console/network capture and pin-tab
screenshots (need Playwright/CDP, not a webview iframe); full plan-text step rail (TUI parsing too
brittle — prompts are detected/routed instead); session replay/GIF; Expo Go deep integration
(the QR tunnel already covers scanning a Metro server); image generation & voice (kept out to stay
zero-cost); cache-aware prompt structuring & diff-only context (the CLI owns prompt assembly —
not interceptable from a shell without rebuilding the chat, which this project deliberately avoids).

## License

AGPL-3.0, fully open source (inherited from the forked `opcode` base). Claude Code CLI remains a required external dependency owned by Anthropic and is not redistributed as part of this project.
