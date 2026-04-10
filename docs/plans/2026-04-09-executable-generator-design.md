# Executable Generator Design

Date: 2026-04-09

## Problem

Current generators output 4 static files (CLAUDE.md, settings.json, README.md, ARCHITECTURE.md). The type system defines rich roles, constraints, and stage configs that are never materialized into executable structures. Users download documentation, not infrastructure.

## Decision

Redesign generators to output a layered structure: engine-agnostic core definitions + per-engine adapter implementations.

## Target User

Developers who download the ZIP, extract into their project, and immediately use it as executable AI agent infrastructure.

## Architecture

### Core Layer (`.harness/`)

Engine-agnostic "single source of truth". All three frameworks' design philosophy is stored here.

```
.harness/
├── config.yaml                   ← Serialized ProjectConfig
├── roles/                        ← Role definitions
│   ├── ceo.md
│   ├── product-lead.md
│   ├── designer.md
│   ├── eng-manager.md
│   ├── staff-engineer.md
│   ├── security-officer.md
│   ├── qa-lead.md
│   └── release-engineer.md
├── flows/                        ← 7 stage definitions
│   ├── think.md
│   ├── plan.md
│   ├── build.md
│   ├── review.md
│   ├── test.md
│   ├── ship.md
│   └── reflect.md
└── constraints/                  ← Constraint rules by type
    ├── gates.yaml
    ├── checklists.yaml
    └── outputs.yaml
```

Each `flows/*.md` contains: assigned roles (referencing `roles/`), input spec (from previous stage), execution steps (methodology), output spec (required deliverables), checklist (referencing `constraints/`).

Each `constraints/*.yaml` records: stage, type (gate/checklist/output-requirement), description, enforced flag. Adapters decide per-engine which become hard hooks vs soft prompts.

### Claude Code Adapter

Full commands + hooks + settings.

```
CLAUDE.md
.claude/
├── settings.json                  ← permissions + MCP + hooks registration
├── commands/                      ← 7 slash commands
│   ├── think.md                   ← /think
│   ├── plan.md
│   ├── build.md
│   ├── review.md
│   ├── test.md
│   ├── ship.md
│   └── reflect.md
└── hooks/                         ← Executable hook scripts
    ├── review-gate.sh
    ├── test-gate.sh
    ├── ship-gate.sh
    └── constraint-check.sh
```

Commands: frontmatter with `allowed-tools` + `description`; body reads from `.harness/flows/`; embeds role info, methodology steps, checklist.

Hooks (registered in settings.json):
- `PreToolUse` — block dangerous operations (rm -rf, DROP)
- `PostToolUse(Write|Edit)` — auto lint/type-check in Review stage
- `Stop` — verify stage deliverables, force continue if incomplete
- `TaskCompleted` — verify tests pass before closing task

Settings: permissions from sandbox/credential config, MCP from integration config, hooks from above.

### Cursor Adapter

Rules injection only (no commands, no hooks).

```
.cursorrules                       ← Entry doc (= CLAUDE.md content)
.cursor/
├── rules/
│   ├── always.mdc                 ← alwaysApply: true — architecture + global constraints + sprint overview
│   ├── think.mdc                  ← Manual @think reference
│   ├── plan.mdc
│   ├── build.mdc
│   ├── review.mdc
│   ├── test.mdc
│   ├── ship.mdc
│   └── reflect.mdc
└── mcp.json
```

Stage rules: `alwaysApply: false`, no globs, user references via `@think` etc. Content from `.harness/flows/`. All constraints are soft (text-only, no enforcement mechanism).

### Codex Adapter

Skills + experimental hooks.

```
AGENTS.md
.codex/
├── config.toml                    ← sandbox_mode, approval_policy, MCP, features.codex_hooks=true
├── hooks.json                     ← Experimental hooks (command type only)
├── skills/                        ← 7 skills
│   ├── think/SKILL.md
│   ├── plan/SKILL.md
│   ├── build/SKILL.md
│   ├── review/SKILL.md
│   ├── test/SKILL.md
│   ├── ship/SKILL.md
│   └── reflect/SKILL.md
└── hooks/
    ├── pre-bash-policy.sh         ← PreToolUse(Bash): block dangerous commands
    └── stop-continue.sh           ← Stop: check deliverable completeness
```

Hooks limited to Bash interception only. Other constraints degraded to skill text guidance.

### Scaffold (shared)

```
README.md
docs/plans/ARCHITECTURE.md
```

## Generator Code Structure

```
src/generators/
├── index.ts                       ← generateAll() entry point
├── core/                          ← Engine-agnostic generators
│   ├── config.ts                  ← .harness/config.yaml
│   ├── roles.ts                   ← .harness/roles/*.md
│   ├── flows.ts                   ← .harness/flows/*.md
│   └── constraints.ts             ← .harness/constraints/*.yaml
├── engines/                       ← Per-engine adapters
│   ├── claude/
│   │   ├── commands.ts            ← .claude/commands/*.md
│   │   ├── hooks.ts               ← .claude/hooks/*.sh + settings.json hooks
│   │   ├── settings.ts            ← .claude/settings.json
│   │   └── claudeMd.ts            ← CLAUDE.md
│   ├── cursor/
│   │   ├── rules.ts               ← .cursor/rules/*.mdc
│   │   ├── mcp.ts                 ← .cursor/mcp.json
│   │   └── cursorrules.ts         ← .cursorrules
│   └── codex/
│       ├── skills.ts              ← .codex/skills/*/SKILL.md
│       ├── hooks.ts               ← .codex/hooks.json + .codex/hooks/*.sh
│       ├── config.ts              ← .codex/config.toml
│       └── agentsMd.ts            ← AGENTS.md
└── scaffold.ts                    ← README.md + docs/plans/ARCHITECTURE.md
```

### Data Flow

```
ProjectConfig (Zustand Store)
       │
       ▼
  core/* ──→ .harness/ (engine-agnostic definitions)
       │
       ├──→ engines/claude/*  ──→ CLAUDE.md + .claude/
       ├──→ engines/cursor/*  ──→ .cursorrules + .cursor/
       └──→ engines/codex/*   ──→ AGENTS.md + .codex/
       │
       ▼
  scaffold.ts ──→ README.md + docs/plans/ARCHITECTURE.md
       │
       ▼
  generateAll() ──→ OutputFile[] ──→ JSZip ──→ Download
```

Key: adapter generators receive `.harness/` generation results as input, not raw ProjectConfig. Only the selected engine's adapter is invoked.

### Estimated Output (Claude Code + 7 stages)

- `.harness/`: ~12 files
- `.claude/`: ~12 files
- scaffold: 2 files
- **Total: ~26 files**
