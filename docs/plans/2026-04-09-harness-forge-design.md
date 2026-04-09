# Harness Forge — Design Document

## Overview

**Harness Forge** is an open-source Web application that provides a visual, wizard-based project configuration tool for AI coding agents (Claude Code, Codex). It combines:

- **Anthropic's Managed Agents architecture** — Session/Harness/Sandbox decoupled design, Brain vs Hands separation
- **GStack/Superpowers' constraint feedback approach** — Multi-role agents, structured Sprint flow (Think → Plan → Build → Review → Test → Ship → Reflect)

Users configure their project through a step-by-step wizard, and the tool generates CLAUDE.md, project scaffold code, and Agent architecture configuration files.

## Core Concepts

### Anthropic Managed Agents: Three Interfaces

| Interface | Responsibility | Key Decisions |
|-----------|---------------|---------------|
| **Session** | Append-only event log, durable state | Storage type, event retention, recovery strategy |
| **Harness** | The loop that calls AI and routes tool calls | AI engine, context strategy, retry policy |
| **Sandbox** | Execution environment for code/tools | Environment type, MCP tools, credential policy |

The harness (brain) is decoupled from the sandbox (hands). Sessions survive crashes. Credentials never reach the sandbox.

### GStack Constraint Flow: Sprint Structure

```
Think → Plan → Build → Review → Test → Ship → Reflect
```

Each stage has assigned roles (CEO, Designer, Eng Manager, QA, Security, etc.) with constraint rules (checklists, gates, output requirements). Stage outputs feed into the next stage automatically.

## Architecture

### System Layers

```
┌─────────────────────────────────────────────┐
│              Frontend (Next.js)              │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Template │ │  Wizard  │ │   Preview &  │ │
│  │ Gallery  │ │  Engine  │ │   Generate   │ │
│  └────┬─────┘ └────┬─────┘ └──────┬───────┘ │
│       │            │               │         │
│  ┌────▼────────────▼───────────────▼───────┐ │
│  │          Config Store (Zustand)         │ │
│  └────────────────────┬────────────────────┘ │
└───────────────────────┼──────────────────────┘
                        │
┌───────────────────────▼──────────────────────┐
│           Generator Layer (Server)           │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ Scaffold │ │  Config  │ │  Architecture│  │
│  │Generator │ │ Generator│ │  Generator   │  │
│  └──────────┘ └──────────┘ └─────────────┘  │
│           │           │            │          │
│  ┌────────▼───────────▼────────────▼───────┐ │
│  │         Template Engine (EJS)            │ │
│  └────────────────────┬────────────────────┘ │
└───────────────────────┼──────────────────────┘
                        │
                   Output: ZIP Download
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js App Router + TypeScript |
| State Management | Zustand |
| UI Components | Tailwind CSS + shadcn/ui |
| Packaging | JSZip (client-side ZIP generation) |
| Templates | EJS |
| Deployment | Vercel / self-hosted |

## Pages & Flow

### Home — Template Gallery

4 preset templates:
- **Solo Dev** — Claude Code + basic harness + simple flow
- **GStack Sprint** — Full Think→Plan→Build→Review→Test→Ship flow with multi-role constraints
- **Managed Agents** — Session/Harness/Sandbox decoupled architecture
- **Custom** — Start from scratch

Selecting a template pre-fills the config; users can modify from there.

### Wizard (5 Steps)

#### Step 1: Project Basics
- Project name, description
- Tech stack (framework, language, package manager)
- Git initialization options
- Directory structure preview

#### Step 2: Agent Architecture
Visual configuration of three core components:

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Session  │     │ Harness  │     │ Sandbox  │
│ ──────── │     │ ──────── │     │ ──────── │
│ Storage  │◄───►│ AI Model │◄───►│ Env Type │
│ Retention│     │ Context  │     │ MCP Tools│
│ Recovery │     │ Retry    │     │ Security │
└──────────┘     └──────────┘     └──────────┘
```

**Session config:**
- Storage type: local-file | git-based | custom
- Event retention policy
- Recovery strategy: last-event | last-checkpoint | custom

**Harness config:**
- AI engine: claude-code | codex | custom
- Context strategy: compaction | sliding-window | full
- Max retries

**Sandbox config:**
- Type: local | docker | remote
- MCP servers (name, command, args)
- Credential policy: vault | bundled | none

#### Step 3: Constraint Flow
Visual Sprint flow editor:

```
Think → Plan → Build → Review → Test → Ship → Reflect
  │       │       │       │       │      │       │
  ▼       ▼       ▼       ▼       ▼      ▼       ▼
Roles   Roles   Roles   Roles   Roles  Roles   Roles
```

Per stage:
- Select roles (CEO, Designer, Eng Manager, QA, Security, Release Engineer, etc.)
- Configure constraint rules (checklist items, required gates, output format)
- Define data passing rules between stages

#### Step 4: Tools & Integration
- MCP servers configuration
- Security policies (credential management, sandbox isolation level)
- Custom hooks configuration

#### Step 5: Preview & Generate
- Real-time file preview (CLAUDE.md, settings.json, project structure)
- File tree view + code preview with syntax highlighting
- One-click ZIP download or copy config to clipboard

## Data Model

```typescript
interface ProjectConfig {
  project: {
    name: string;
    description: string;
    techStack: {
      framework: 'next' | 'react' | 'vue' | 'flutter' | 'custom';
      language: 'typescript' | 'javascript' | 'python' | 'dart' | 'go';
      packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
    };
    gitInit: boolean;
  };

  architecture: {
    session: {
      storage: 'local-file' | 'git-based' | 'custom';
      eventRetention: number;
      recoveryStrategy: 'last-event' | 'last-checkpoint' | 'custom';
    };
    harness: {
      engine: 'claude-code' | 'codex' | 'custom';
      contextStrategy: 'compaction' | 'sliding-window' | 'full';
      maxRetries: number;
    };
    sandbox: {
      type: 'local' | 'docker' | 'remote';
      mcpServers: MCPServerConfig[];
      credentialPolicy: 'vault' | 'bundled' | 'none';
    };
  };

  flow: {
    sprint: SprintStage[];
    roles: RoleConfig[];
    constraints: ConstraintRule[];
  };
}

interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface SprintStage {
  id: string;
  name: string; // think | plan | build | review | test | ship | reflect
  order: number;
  roles: string[];
  gates: string[]; // checklist items that must pass
  outputFormat?: string;
}

interface RoleConfig {
  id: string;
  name: string; // ceo | designer | eng-manager | qa | security | release
  description: string;
  constraints: string[];
}

interface ConstraintRule {
  id: string;
  stage: string;
  type: 'gate' | 'checklist' | 'output-requirement';
  description: string;
  enforced: boolean;
}
```

## Output Files

```
project-name/
├── CLAUDE.md                  # AI behavior specification
├── .claude/
│   ├── settings.json          # Claude Code configuration
│   ├── skills/                # Custom skills (if configured)
│   │   └── custom-flow.md
│   └── hooks/                 # Custom hooks
├── .codex/                    # Codex config (if Codex selected)
│   └── config.yaml
├── docs/
│   └── plans/
│       └── ARCHITECTURE.md    # Architecture documentation
├── src/                       # Project scaffold code
│   └── ...                    # (generated per framework)
└── README.md
```

## Project Structure

```
harness-forge/
├── app/                        # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                # Home - Template Gallery
│   ├── wizard/
│   │   ├── layout.tsx          # Wizard layout (sidebar progress + content)
│   │   ├── page.tsx            # Step 1: Project Basics
│   │   ├── architecture/
│   │   │   └── page.tsx        # Step 2: Agent Architecture
│   │   ├── flow/
│   │   │   └── page.tsx        # Step 3: Constraint Flow
│   │   ├── integration/
│   │   │   └── page.tsx        # Step 4: Tools & Integration
│   │   └── generate/
│   │       └── page.tsx        # Step 5: Preview & Generate
│   └── api/
│       └── generate/
│           └── route.ts        # ZIP generation API
├── src/
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── wizard/             # Wizard-specific components
│   │   │   ├── StepIndicator.tsx
│   │   │   ├── ArchitectureDiagram.tsx
│   │   │   ├── FlowEditor.tsx
│   │   │   └── FilePreview.tsx
│   │   └── template/
│   │       └── TemplateCard.tsx
│   ├── store/
│   │   └── useProjectConfig.ts
│   ├── generators/
│   │   ├── scaffold.ts
│   │   ├── claudeMd.ts
│   │   ├── settings.ts
│   │   ├── architecture.ts
│   │   └── index.ts
│   ├── templates/
│   │   ├── solo-dev.ts
│   │   ├── gstack-sprint.ts
│   │   └── managed-agents.ts
│   └── types/
│       └── index.ts
├── public/
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

## Implementation Phases

1. **Phase 1 — Foundation**: Next.js project init, shadcn/ui, Zustand store, routing
2. **Phase 2 — Wizard Pages**: 5 step pages with UI and interaction logic
3. **Phase 3 — Generators**: CLAUDE.md / settings.json / scaffold code template engine
4. **Phase 4 — Template System**: Preset templates + template gallery
5. **Phase 5 — Visual Components**: Architecture diagram, flow editor, file preview
