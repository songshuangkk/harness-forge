# CLAUDE.md

## Project Overview

**Harness Forge** — Visual wizard for configuring AI coding agent projects (Claude Code, Codex, Cursor). 5-step wizard → download ZIP with CLAUDE.md, settings.json, and scaffolding.

## Commands

```bash
npm run dev      # Dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npm run start    # Serve production build
```

No test framework.

## Architecture

### Wizard Flow

1. **Project Basics** (`/wizard`) — name, description, tech stack
2. **Architecture** (`/wizard/architecture`) — Session/Harness/Sandbox config
3. **Flow** (`/wizard/flow`) — sprint stages, roles, constraints
4. **Integration** (`/wizard/integration`) — MCP servers, hooks
5. **Generate** (`/wizard/generate`) — preview output files, download ZIP

### Data Flow

```
Template Presets (src/templates/) → URL param → Zustand Store → Generators → JSZip → Download
```

- **Store**: `src/store/useProjectConfig.ts` — single Zustand store holding `ProjectConfig` + wizard step. `loadTemplate()` merges preset configs.
- **Types**: `src/types/index.ts` — `ProjectConfig` is the central shape; stage configs are `ThinkConfig`, `PlanConfig`, etc.
- **Generators**: `src/generators/` — per-engine adapters under `engines/` (claude, codex, cursor), unified via `generateAll()`.
- **Templates**: `src/templates/` — `solo-dev`, `gstack-sprint`, `managed-agents`. Selected on home page via `?template=` query param.

### Tech Stack

- Next.js 16 App Router + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui (base-nova, lucide icons)
- Path alias: `@/*` → `./src/*`

### Directory Layout

- `src/components/ui/` — shadcn/ui primitives
- `src/components/wizard/` — wizard-specific components
- `src/generators/` — output file generators (agentConfig, settings, scaffold)
- `src/templates/` — template presets
- `src/store/` — Zustand store
- `src/types/` — type definitions

## Sprint Stage Design

7 stages (Think → Plan → Build → Review → Test → Ship → Reflect) fused from three sources:

| Source | Contribution |
|--------|-------------|
| **Anthropic Managed Agents** | Session/Harness/Sandbox three-layer infrastructure |
| **GStack** | 7-stage sprint, role-driven commands, multi-review pipeline |
| **Superpowers** | Mandatory TDD, subagent parallelism, structured plans |

Each stage config has: `dimensions` (toggle chips), `depth`/`strategy` (select), and `gates` (string array). See `src/types/index.ts` for full interfaces (`ThinkConfig`, `BuildConfig`, etc.).
