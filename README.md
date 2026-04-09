# Harness Forge

Visual project configuration tool for AI coding agents (Claude Code, OpenAI Codex). Generate CLAUDE.md, project scaffold, and Agent architecture configs through a step-by-step wizard.

## What It Does

Combines two powerful ideas:

- **Anthropic's Managed Agents architecture** — Session/Harness/Sandbox decoupled design where the brain (AI + harness) is separated from the hands (sandboxes + tools)
- **GStack's constraint feedback flow** — Multi-role sprint process: Think → Plan → Build → Review → Test → Ship → Reflect

Configure your project visually, then download a ZIP with everything your AI agent needs.

## Quick Start

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

Open http://localhost:3000 and start configuring.

## How It Works

1. **Choose a template** — Solo Dev, GStack Sprint, Managed Agents, or start from scratch
2. **Configure architecture** — Set up Session storage, Harness engine, Sandbox type
3. **Define your sprint flow** — Pick stages, assign roles, set gates and constraints
4. **Add integrations** — MCP servers, hooks
5. **Preview & generate** — See all output files, download as ZIP

## Tech Stack

- Next.js 15 + TypeScript
- Tailwind CSS + shadcn/ui
- Zustand (state management)
- JSZip (client-side ZIP generation)

## Architecture

```
Frontend (Next.js)
├── Template Gallery → pre-fills config
├── Wizard (5 steps) → Zustand store
└── Preview & Generate → generators → ZIP

Generators
├── CLAUDE.md generator
├── Settings generator (.claude/settings.json)
├── Scaffold generator (package.json, README, boilerplate)
└── ZIP packager (JSZip + file-saver)
```

## License

MIT
