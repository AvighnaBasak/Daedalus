/**
 * Curated marketplace catalog — hand-picked, factual entries from the MCP /
 * Claude Code ecosystem (awesome-mcp-servers, awesome-claude-code, and friends).
 * Static by design: no network call, no tracking, reviewable in a PR.
 *
 * Install kinds:
 *  - mcp:    one-click `claude mcp add` via the existing MCP hub plumbing
 *  - claude: a slash command typed into the active Claude session (plugins)
 *  - shell:  a command copied to the clipboard for the terminal panel
 *  - link:   browse-only (collections, frameworks with bespoke setup)
 */

export type MarketCategory = "mcp" | "plugin" | "agents" | "tool" | "collection";

export type MarketInstall =
  | { kind: "mcp"; command: string; args: string[] }
  | { kind: "claude"; text: string }
  | { kind: "shell"; text: string }
  | { kind: "link" };

export interface MarketEntry {
  id: string;
  name: string;
  description: string;
  category: MarketCategory;
  url: string;
  /** Approximate stars, only where verified. */
  stars?: string;
  install: MarketInstall;
}

export const CATEGORY_LABEL: Record<MarketCategory, string> = {
  mcp: "MCP servers",
  plugin: "Plugins & hooks",
  agents: "Agents & skills",
  tool: "Tools",
  collection: "Collections",
};

export const CATALOG: MarketEntry[] = [
  // ---- MCP servers: official reference ----
  {
    id: "mcp-filesystem",
    name: "Filesystem",
    description: "Read/write files with scoped access — the official reference server.",
    category: "mcp",
    url: "https://github.com/modelcontextprotocol/servers",
    install: { kind: "mcp", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "."] },
  },
  {
    id: "mcp-memory",
    name: "Memory",
    description: "Persistent knowledge-graph memory across sessions (official).",
    category: "mcp",
    url: "https://github.com/modelcontextprotocol/servers",
    install: { kind: "mcp", command: "npx", args: ["-y", "@modelcontextprotocol/server-memory"] },
  },
  {
    id: "mcp-github",
    name: "GitHub",
    description: "Repos, issues, PRs, code search. Needs GITHUB_PERSONAL_ACCESS_TOKEN in the env.",
    category: "mcp",
    url: "https://github.com/modelcontextprotocol/servers",
    install: { kind: "mcp", command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
  },
  {
    id: "mcp-sequential",
    name: "Sequential Thinking",
    description: "Structured step-by-step reasoning scratchpad (official).",
    category: "mcp",
    url: "https://github.com/modelcontextprotocol/servers",
    install: { kind: "mcp", command: "npx", args: ["-y", "@modelcontextprotocol/server-sequential-thinking"] },
  },
  {
    id: "mcp-puppeteer",
    name: "Puppeteer",
    description: "Headless Chrome automation: navigate, screenshot, interact (official).",
    category: "mcp",
    url: "https://github.com/modelcontextprotocol/servers",
    install: { kind: "mcp", command: "npx", args: ["-y", "@modelcontextprotocol/server-puppeteer"] },
  },
  {
    id: "mcp-brave",
    name: "Brave Search",
    description: "Web + local search API. Needs BRAVE_API_KEY in the env.",
    category: "mcp",
    url: "https://github.com/modelcontextprotocol/servers",
    install: { kind: "mcp", command: "npx", args: ["-y", "@modelcontextprotocol/server-brave-search"] },
  },
  {
    id: "mcp-postgres",
    name: "PostgreSQL",
    description: "Read-only SQL over your database — append your connection string to the args after adding.",
    category: "mcp",
    url: "https://github.com/modelcontextprotocol/servers",
    install: { kind: "mcp", command: "npx", args: ["-y", "@modelcontextprotocol/server-postgres"] },
  },
  {
    id: "mcp-slack",
    name: "Slack",
    description: "Channels, messages, users. Needs SLACK_BOT_TOKEN + SLACK_TEAM_ID in the env.",
    category: "mcp",
    url: "https://github.com/modelcontextprotocol/servers",
    install: { kind: "mcp", command: "npx", args: ["-y", "@modelcontextprotocol/server-slack"] },
  },
  // ---- MCP servers: community favourites ----
  {
    id: "mcp-playwright",
    name: "Playwright (Microsoft)",
    description: "Drive a real browser through accessibility snapshots — the standard for UI testing agents.",
    category: "mcp",
    url: "https://github.com/microsoft/playwright-mcp",
    install: { kind: "mcp", command: "npx", args: ["-y", "@playwright/mcp@latest"] },
  },
  {
    id: "mcp-context7",
    name: "Context7 (Upstash)",
    description: "Up-to-date, version-specific docs for any library injected straight into context.",
    category: "mcp",
    url: "https://github.com/upstash/context7",
    install: { kind: "mcp", command: "npx", args: ["-y", "@upstash/context7-mcp"] },
  },
  {
    id: "mcp-firecrawl",
    name: "Firecrawl",
    description: "Web scraping + crawling that returns clean markdown. Needs FIRECRAWL_API_KEY.",
    category: "mcp",
    url: "https://github.com/mendableai/firecrawl-mcp-server",
    install: { kind: "mcp", command: "npx", args: ["-y", "firecrawl-mcp"] },
  },
  {
    id: "mcp-desktop-commander",
    name: "Desktop Commander",
    description: "Terminal control, process management, and diff-based file editing on your machine.",
    category: "mcp",
    url: "https://github.com/wonderwhy-er/DesktopCommanderMCP",
    install: { kind: "mcp", command: "npx", args: ["-y", "@wonderwhy-er/desktop-commander"] },
  },
  {
    id: "mcp-exa",
    name: "Exa Search",
    description: "AI-native web search with semantic results. Needs EXA_API_KEY.",
    category: "mcp",
    url: "https://github.com/exa-labs/exa-mcp-server",
    install: { kind: "mcp", command: "npx", args: ["-y", "exa-mcp-server"] },
  },
  {
    id: "mcp-magic",
    name: "21st.dev Magic",
    description: "Generate polished UI components from natural language. Needs a 21st.dev API key.",
    category: "mcp",
    url: "https://github.com/21st-dev/magic-mcp",
    install: { kind: "mcp", command: "npx", args: ["-y", "@21st-dev/magic"] },
  },
  {
    id: "mcp-supabase",
    name: "Supabase",
    description: "Manage projects, run SQL, inspect schemas. Needs a Supabase access token.",
    category: "mcp",
    url: "https://github.com/supabase-community/supabase-mcp",
    install: { kind: "mcp", command: "npx", args: ["-y", "@supabase/mcp-server-supabase"] },
  },
  {
    id: "mcp-notion",
    name: "Notion",
    description: "Read and write Notion pages and databases. Needs a Notion integration token.",
    category: "mcp",
    url: "https://github.com/makenotion/notion-mcp-server",
    install: { kind: "mcp", command: "npx", args: ["-y", "@notionhq/notion-mcp-server"] },
  },
  {
    id: "mcp-linear",
    name: "Linear (remote)",
    description: "Issues, projects, and cycles over Linear's hosted MCP endpoint (OAuth on first use).",
    category: "mcp",
    url: "https://linear.app/docs/mcp",
    install: { kind: "mcp", command: "npx", args: ["-y", "mcp-remote", "https://mcp.linear.app/sse"] },
  },
  {
    id: "mcp-stripe",
    name: "Stripe",
    description: "Payments, customers, invoices via the Stripe API. Needs STRIPE_SECRET_KEY.",
    category: "mcp",
    url: "https://github.com/stripe/agent-toolkit",
    install: { kind: "mcp", command: "npx", args: ["-y", "@stripe/mcp", "--tools=all"] },
  },
  {
    id: "mcp-fetch",
    name: "Fetch",
    description: "Fetch web pages as markdown (official, Python — requires uv installed).",
    category: "mcp",
    url: "https://github.com/modelcontextprotocol/servers",
    install: { kind: "mcp", command: "uvx", args: ["mcp-server-fetch"] },
  },
  {
    id: "mcp-git",
    name: "Git",
    description: "Repository inspection: log, diff, blame, branch state (official, requires uv).",
    category: "mcp",
    url: "https://github.com/modelcontextprotocol/servers",
    install: { kind: "mcp", command: "uvx", args: ["mcp-server-git"] },
  },
  {
    id: "mcp-mcpx",
    name: "Lunar MCPX gateway",
    description: "Aggregates many MCP servers behind one endpoint with access control and a control-plane UI (Docker).",
    category: "mcp",
    url: "https://github.com/TheLunarCompany/lunar",
    stars: "466",
    install: { kind: "link" },
  },
  // ---- Plugins & hooks ----
  {
    id: "plugin-safety-net",
    name: "CC Safety Net",
    description:
      "PreToolUse hook that blocks destructive commands (rm -rf, git reset --hard, force push) with semantic parsing, fail-closed. After adding the marketplace, run /plugin install safety-net@cc-marketplace.",
    category: "plugin",
    url: "https://github.com/kenryu42/claude-code-safety-net",
    stars: "1.4k",
    install: { kind: "claude", text: "/plugin marketplace add kenryu42/cc-marketplace" },
  },
  {
    id: "plugin-dev-browser",
    name: "Dev Browser",
    description:
      "Claude tests its own work by scripting a persistent Chrome via sandboxed Playwright scripts — cheaper and faster than per-action browser MCPs.",
    category: "plugin",
    url: "https://github.com/sawyerhood/dev-browser",
    stars: "6.4k",
    install: { kind: "shell", text: "npm install -g dev-browser && dev-browser install" },
  },
  {
    id: "tool-ccusage",
    name: "ccusage",
    description: "Analyze Claude Code token usage and cost from local session logs — daily, monthly, per-project reports.",
    category: "tool",
    url: "https://github.com/ryoppippi/ccusage",
    install: { kind: "shell", text: "npx ccusage@latest" },
  },
  {
    id: "tool-claude-code-templates",
    name: "Claude Code Templates",
    description: "CLI for browsing and installing community agents, commands, hooks, and MCP configs (aitmpl.com).",
    category: "tool",
    url: "https://github.com/davila7/claude-code-templates",
    install: { kind: "shell", text: "npx claude-code-templates@latest" },
  },
  {
    id: "tool-claude-code-router",
    name: "Claude Code Router",
    description: "Route Claude Code requests to alternative model backends with per-task model rules.",
    category: "tool",
    url: "https://github.com/musistudio/claude-code-router",
    install: { kind: "link" },
  },
  {
    id: "tool-statusbar",
    name: "claude-statusbar",
    description: "Statusline showing rate-limit usage, context window fill, and session cost in the CLI.",
    category: "tool",
    url: "https://github.com/leeguooooo/claude-statusbar",
    install: { kind: "link" },
  },
  {
    id: "tool-vibe-kanban",
    name: "Vibe Kanban",
    description: "Kanban board for orchestrating multiple coding agents (Claude Code, Gemini CLI, …) across tasks.",
    category: "tool",
    url: "https://github.com/BloopAI/vibe-kanban",
    install: { kind: "shell", text: "npx vibe-kanban" },
  },
  // ---- Agents & skills ----
  {
    id: "agents-official-skills",
    name: "Anthropic skill library",
    description: "Official skills from Anthropic (documents, spreadsheets, PDFs, and more) — copy into ~/.claude/skills.",
    category: "agents",
    url: "https://github.com/anthropics/skills",
    install: { kind: "link" },
  },
  {
    id: "agents-wshobson",
    name: "wshobson/agents",
    description: "Large collection of production-grade Claude Code subagents across engineering domains.",
    category: "agents",
    url: "https://github.com/wshobson/agents",
    install: { kind: "link" },
  },
  {
    id: "agents-voltagent",
    name: "Awesome subagents",
    description: "Curated, categorized index of Claude Code subagent definitions.",
    category: "agents",
    url: "https://github.com/VoltAgent/awesome-claude-code-subagents",
    install: { kind: "link" },
  },
  {
    id: "agents-everything",
    name: "Everything Claude Code",
    description: "A hackathon-winner's full setup: dozens of subagents, skills, slash commands, and MCP configs.",
    category: "agents",
    url: "https://github.com/affaan-m/everything-claude-code",
    install: { kind: "link" },
  },
  {
    id: "agents-bmad",
    name: "BMAD-METHOD",
    description: "Agile-flavored multi-agent framework: analyst → PM → architect → dev roles for bigger builds.",
    category: "agents",
    url: "https://github.com/bmad-code-org/BMAD-METHOD",
    install: { kind: "link" },
  },
  // ---- Collections ----
  {
    id: "coll-awesome-mcp",
    name: "awesome-mcp-servers",
    description: "The community-maintained directory of MCP servers — thousands, categorized.",
    category: "collection",
    url: "https://github.com/punkpeye/awesome-mcp-servers",
    install: { kind: "link" },
  },
  {
    id: "coll-awesome-cc",
    name: "awesome-claude-code",
    description: "Curated slash commands, CLAUDE.md patterns, hooks, statuslines, and workflow tools.",
    category: "collection",
    url: "https://github.com/hesreallyhim/awesome-claude-code",
    install: { kind: "link" },
  },
  {
    id: "coll-cc-toolkit",
    name: "Claude Code toolkit",
    description: "Big index of agents, plugins, MCP configs, and companion apps for Claude Code.",
    category: "collection",
    url: "https://github.com/rohitg00/awesome-claude-code-toolkit",
    install: { kind: "link" },
  },
  {
    id: "coll-awesome-plugins",
    name: "awesome-claude-plugins",
    description: "Auto-updated adoption metrics across indexed plugin repos — see what's actually used.",
    category: "collection",
    url: "https://github.com/quemsah/awesome-claude-plugins",
    install: { kind: "link" },
  },
];
