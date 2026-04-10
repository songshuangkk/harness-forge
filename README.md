# Harness Forge

A visual wizard that generates **executable AI agent infrastructure** for your project. Walk through a 5-step configuration wizard, then download a ZIP containing slash commands, hook scripts, constraint definitions, and engine-specific settings — ready to use immediately.

## What It Generates

Harness Forge produces a **layered output structure**:

| Layer | Directory | Purpose |
|-------|-----------|---------|
| Core | `.harness/` | Engine-agnostic definitions (config, roles, flows, constraints) |
| Adapter | `.claude/` / `.cursor/` / `.codex/` | Engine-specific commands, rules, hooks, settings |
| Scaffold | Root | README.md, ARCHITECTURE.md |

### Supported Engines

| Engine | Mechanism | Files |
|--------|-----------|-------|
| **Claude Code** | Slash commands + hooks + settings.json | `.claude/commands/*.md`, `.claude/hooks/*.sh`, `.claude/settings.json`, `CLAUDE.md` |
| **Cursor** | Rules injection + MCP config | `.cursor/rules/*.mdc`, `.cursor/mcp.json`, `.cursorrules` |
| **OpenAI Codex** | Skills + experimental hooks + TOML config | `.codex/skills/*/SKILL.md`, `.codex/hooks.json`, `.codex/config.toml`, `AGENTS.md` |

## Design Philosophy

Three frameworks fused into one sprint flow:

```
Think → Plan → Build → Review → Test → Ship → Reflect
```

| Source | Contribution |
|--------|-------------|
| **Anthropic Managed Agents** | Session / Harness / Sandbox three-layer architecture |
| **GStack** | 7-stage sprint flow, role-driven commands, multi-review pipeline |
| **Superpowers** | Mandatory TDD, subagent parallelism, structured plans with verification steps |

## Quick Start

```bash
git clone git@github.com:songshuangkk/harness-forge.git
cd harness-forge
npm install
npm run dev
```

Open http://localhost:3000, pick a template, configure, and download.

## How It Works

```
Template Presets → 5-Step Wizard → Zustand Store → Generators → JSZip → Download
```

1. **Choose a template** — Solo Dev, GStack Sprint, Managed Agents, or start blank
2. **Project basics** — Name, description, tech stack
3. **Architecture** — Session storage, Harness engine, Sandbox type
4. **Sprint flow** — Pick stages, assign roles, set gates and constraints
5. **Integration** — MCP servers, hooks
6. **Generate** — Preview all output files in a directory tree, download ZIP

## Generator Architecture

```
src/generators/
├── core/                    ← Engine-agnostic definitions
│   ├── config.ts            → .harness/config.yaml
│   ├── roles.ts             → .harness/roles/*.md
│   ├── flows.ts             → .harness/flows/*.md
│   └── constraints.ts       → .harness/constraints/*.yaml
├── engines/
│   ├── claude/              ← Claude Code adapter
│   │   ├── claudeMd.ts      → CLAUDE.md
│   │   ├── commands.ts      → .claude/commands/*.md (slash commands)
│   │   ├── hooks.ts         → .claude/hooks/*.sh (executable scripts)
│   │   └── settings.ts      → .claude/settings.json
│   ├── cursor/              ← Cursor adapter
│   │   ├── cursorrules.ts   → .cursorrules
│   │   ├── rules.ts         → .cursor/rules/*.mdc
│   │   └── mcp.ts           → .cursor/mcp.json
│   └── codex/               ← Codex adapter
│       ├── agentsMd.ts      → AGENTS.md
│       ├── skills.ts        → .codex/skills/*/SKILL.md
│       ├── hooks.ts         → .codex/hooks.json + .codex/hooks/*.sh
│       └── config.ts        → .codex/config.toml
├── scaffold.ts              → README.md + docs/plans/ARCHITECTURE.md
└── index.ts                 → generateAll() pipeline
```

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**
- **Zustand** (state management)
- **JSZip** + **file-saver** (client-side ZIP generation)

## Commands

```bash
npm run dev      # Development server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npm run start    # Serve production build
```

## License

MIT
