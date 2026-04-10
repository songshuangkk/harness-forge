# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Harness Forge** — A visual wizard-based project configuration tool for AI coding agents (Claude Code, OpenAI Codex). Users walk through a 5-step wizard to configure Session/Harness/Sandbox architecture and Sprint constraint flows, then download a ZIP containing CLAUDE.md, settings.json, and project scaffolding.

## Commands

```bash
npm run dev      # Development server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npm run start    # Serve production build
```

No test framework is configured.

## Architecture

### Wizard Flow (5 steps)

1. **Project Basics** (`/wizard`) — name, description, tech stack
2. **Architecture** (`/wizard/architecture`) — Session/Harness/Sandbox config
3. **Flow** (`/wizard/flow`) — Sprint stages (Think→Plan→Build→Review→Test→Ship→Reflect), roles, constraints
4. **Integration** (`/wizard/integration`) — MCP servers, hooks
5. **Generate** (`/wizard/generate`) — preview all output files, download ZIP

### Key Data Flow

```
Template Presets (src/templates/) → Zustand Store (src/store/) → Generators (src/generators/) → JSZip → Download
```

- **State**: Single Zustand store (`src/store/useProjectConfig.ts`) holds `ProjectConfig` + current wizard step. Templates call `loadTemplate()` to merge partial configs.
- **Types**: All type definitions in `src/types/index.ts` — `ProjectConfig` is the central shape.
- **Generators**: `src/generators/` — `claudeMd.ts`, `settings.ts`, `scaffold.ts` each return `OutputFile[]`. Unified via `generateAll()` in `index.ts`.
- **Templates**: `src/templates/` — preset configs (`solo-dev`, `gstack-sprint`, `managed-agents`) that pre-fill the wizard.

### UI Stack

- **Next.js 16 App Router** with React 19 and TypeScript
- **Tailwind CSS v4** + **shadcn/ui** (base-nova style, lucide icons)
- Path alias: `@/*` → `./src/*`
- shadcn/ui components in `src/components/ui/`, wizard components in `src/components/wizard/`

### Generators

Output files are generated from `ProjectConfig`. Generator functions receive a config and produce `OutputFile[]` (path + content pairs).

- `agentConfig.ts` — generates `CLAUDE.md` / `AGENTS.md` / `.cursorrules` / `AI_CONFIG.md` based on selected AI engine
- `settings.ts` — generates engine-specific settings (`.claude/settings.json`, `.codex/config.yaml`, `.cursor/mcp.json`)
- `scaffold.ts` — generates `README.md` and `docs/plans/ARCHITECTURE.md`

## Sprint Stage Design — Three-Framework Fusion

The 7 sprint stages (Think → Plan → Build → Review → Test → Ship → Reflect) are synthesized from three sources. Each stage's configuration reflects three dimensions: **Architecture** (how Session/Harness/Sandbox apply), **Roles** (who participates), and **Methodology** (what approach to use).

### Design Sources

| Source | Layer | Core Contribution |
|--------|-------|-------------------|
| **Anthropic Managed Agents** | Infrastructure | Session/Harness/Sandbox three-layer decoupling; meta-harness philosophy |
| **GStack** (garrytan/gstack) | Sprint Flow | 7-stage sprint, role-driven slash commands, multi-review pipeline |
| **Superpowers** (obra/superpowers) | Methodology | Mandatory TDD, subagent parallelism, structured plans (file paths + verification steps) |

### Stage Configuration Reference

#### Think — Problem Redefinition
- **Methodology**: GStack `/office-hours` forcing questions (not form-filling); Superpowers Socratic refinement
- **Roles**: CEO / Product Lead
- **Architecture**: Session — which historical events to analyze for context
- **Config Fields**:
  - `dimensions`: toggle chips — problem framing, success metrics, constraints, alternatives, scope, risks
  - `depth`: select — quick assessment / deep analysis
- **Output**: Design doc → auto-feeds into Plan stage

#### Plan — Multi-Role Architecture Review
- **Methodology**: GStack 4-review pipeline (CEO / Eng / Design / DX); Superpowers structured tasks (file paths + verification steps per task)
- **Roles**: CEO + Designer + Eng Manager + DX Lead
- **Architecture**: Harness context strategy affects plan complexity
- **Config Fields**:
  - `reviewTypes`: toggle chips — ceo review, eng review, design review, dx review
  - `taskStructure`: select — simple task list / structured (file paths + verification steps)
- **Output**: Implementation plan with per-task file paths and verification steps

#### Build — Implementation
- **Methodology**: Superpowers subagent-driven development + TDD; GStack parallel sprints
- **Roles**: Eng Manager
- **Architecture**: Sandbox type (local/docker/remote) determines execution; Harness max retries
- **Config Fields**:
  - `executionStrategy`: select — single agent / subagent parallel
  - `tddMode`: select — enforced RED-GREEN-REFACTOR / optional
- **Output**: Source code + tests

#### Review — Multi-Dimensional Quality Audit
- **Methodology**: Superpowers two-stage review (spec compliance + code quality); GStack Staff Engineer review with auto-fix
- **Roles**: Staff Engineer + Security Officer
- **Architecture**: Harness retry behavior on review failures
- **Config Fields**:
  - `reviewDimensions`: toggle chips — spec compliance, code quality, security, performance
  - `autoFix`: select — auto-fix obvious issues / report only
  - `severityThreshold`: select — all issues / critical+major / critical only
- **Output**: Review report with severity ratings

#### Test — Verification
- **Methodology**: Superpowers "evidence over claims"; GStack real-browser QA with regression tests
- **Roles**: QA Lead
- **Architecture**: Sandbox isolation level determines test environment
- **Config Fields**:
  - `testMethods`: toggle chips — TDD, exploratory, regression
  - `coverageTarget`: slider 0-100%
  - `testTypes`: toggle chips — unit, integration, e2e, browser, performance, security
  - `environment`: select — local / staging / production
- **Output**: Test results + coverage report

#### Ship — Release
- **Methodology**: GStack `/ship` (tests+coverage+PR) + `/land-and-deploy` (merge+CI+verify)
- **Roles**: Release Engineer
- **Architecture**: Session replay as audit trail; Vault for deployment credentials
- **Config Fields**:
  - `pipeline`: toggle chips — run tests, create PR, merge, deploy
  - `versionStrategy`: select — patch / minor / major / custom
  - `deploymentTargets`: toggle chips — staging, production, canary
- **Output**: Release notes + deployment manifest

#### Reflect — Retrospective
- **Methodology**: GStack `/retro` team-aware retrospective; Superpowers cross-session learning
- **Roles**: Eng Manager
- **Architecture**: Session event log as retrospective data source
- **Config Fields**:
  - `dimensions`: toggle chips — velocity, quality, test health, growth
  - `persistLearning`: select — save to project memory / session only
- **Output**: Retrospective report + improvement items

### Data Model

Stage-specific configs are defined in `src/types/index.ts` as individual interfaces (`ThinkConfig`, `PlanConfig`, etc.) stored in the optional `stageConfig` field of `SprintStage`. The `FlowEditor` component renders a different configuration UI for each stage based on `stage.name`.
