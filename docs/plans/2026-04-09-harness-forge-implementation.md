# Harness Forge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a visual project configuration Web app that generates CLAUDE.md, scaffold code, and Agent architecture configs for Claude Code / Codex.

**Architecture:** Next.js App Router with Zustand state management. Wizard flow drives config into a store, generators render templates to files, JSZip packages output as downloadable ZIP.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Zustand, EJS, JSZip

---

## Phase 1: Foundation

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json` (via create-next-app)
- Create: `tailwind.config.ts`
- Create: `tsconfig.json`

**Step 1: Scaffold Next.js project**

```bash
cd /Users/songshuang/ai_app/harness_agent_project
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

When prompted: Yes to TypeScript, Tailwind, ESLint, App Router, src directory.

**Step 2: Verify dev server starts**

```bash
pnpm dev
```

Expected: Server starts at http://localhost:3000, default Next.js page renders.

**Step 3: Commit**

```bash
git init
git add .
git commit -m "chore: initialize Next.js project with TypeScript and Tailwind"
```

---

### Task 2: Install dependencies and init shadcn/ui

**Files:**
- Modify: `package.json`
- Create: `components.json`
- Create: `src/lib/utils.ts`

**Step 1: Install core dependencies**

```bash
pnpm add zustand jszip ejs file-saver
pnpm add -D @types/file-saver
```

**Step 2: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

Options: New York style, Zinc base color, CSS variables: yes.

**Step 3: Add shadcn/ui components we'll need**

```bash
npx shadcn@latest add button card input label select slider switch tabs textarea badge separator scroll-area collapsible accordion dropdown-menu dialog
```

**Step 4: Verify**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add .
git commit -m "chore: add zustand, jszip, ejs, shadcn/ui dependencies"
```

---

### Task 3: Define TypeScript types

**Files:**
- Create: `src/types/index.ts`

**Step 1: Write the type definitions**

```typescript
// src/types/index.ts

export type Framework = 'next' | 'react' | 'vue' | 'flutter' | 'custom';
export type Language = 'typescript' | 'javascript' | 'python' | 'dart' | 'go';
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

export type SessionStorage = 'local-file' | 'git-based' | 'custom';
export type RecoveryStrategy = 'last-event' | 'last-checkpoint' | 'custom';
export type AIEngine = 'claude-code' | 'codex' | 'custom';
export type ContextStrategy = 'compaction' | 'sliding-window' | 'full';
export type SandboxType = 'local' | 'docker' | 'remote';
export type CredentialPolicy = 'vault' | 'bundled' | 'none';

export interface TechStack {
  framework: Framework;
  language: Language;
  packageManager: PackageManager;
}

export interface ProjectInfo {
  name: string;
  description: string;
  techStack: TechStack;
  gitInit: boolean;
}

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface SessionConfig {
  storage: SessionStorage;
  eventRetention: number;
  recoveryStrategy: RecoveryStrategy;
}

export interface HarnessConfig {
  engine: AIEngine;
  contextStrategy: ContextStrategy;
  maxRetries: number;
}

export interface SandboxConfig {
  type: SandboxType;
  mcpServers: MCPServerConfig[];
  credentialPolicy: CredentialPolicy;
}

export interface ArchitectureConfig {
  session: SessionConfig;
  harness: HarnessConfig;
  sandbox: SandboxConfig;
}

export type StageName = 'think' | 'plan' | 'build' | 'review' | 'test' | 'ship' | 'reflect';
export type RoleName = 'ceo' | 'designer' | 'eng-manager' | 'qa' | 'security' | 'release' | 'doc-engineer';

export interface SprintStage {
  id: string;
  name: StageName;
  order: number;
  enabled: boolean;
  roles: RoleName[];
  gates: string[];
  outputFormat?: string;
}

export interface RoleConfig {
  id: RoleName;
  label: string;
  description: string;
  defaultConstraints: string[];
}

export type ConstraintType = 'gate' | 'checklist' | 'output-requirement';

export interface ConstraintRule {
  id: string;
  stageId: string;
  type: ConstraintType;
  description: string;
  enforced: boolean;
}

export interface FlowConfig {
  sprint: SprintStage[];
  roles: RoleConfig[];
  constraints: ConstraintRule[];
}

export interface IntegrationConfig {
  mcpServers: MCPServerConfig[];
  hooks: HookConfig[];
}

export interface HookConfig {
  event: string;
  command: string;
}

export interface ProjectConfig {
  project: ProjectInfo;
  architecture: ArchitectureConfig;
  flow: FlowConfig;
  integration: IntegrationConfig;
}

export interface OutputFile {
  path: string;
  content: string;
}

export interface TemplatePreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: Partial<ProjectConfig>;
}
```

**Step 2: Verify types compile**

```bash
npx tsc --noEmit src/types/index.ts
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/types/
git commit -m "feat: add TypeScript type definitions for project config"
```

---

### Task 4: Create Zustand store

**Files:**
- Create: `src/store/useProjectConfig.ts`

**Step 1: Write the Zustand store**

```typescript
// src/store/useProjectConfig.ts
import { create } from 'zustand';
import type {
  ProjectConfig,
  ProjectInfo,
  ArchitectureConfig,
  FlowConfig,
  IntegrationConfig,
} from '@/types';

const defaultConfig: ProjectConfig = {
  project: {
    name: '',
    description: '',
    techStack: {
      framework: 'next',
      language: 'typescript',
      packageManager: 'pnpm',
    },
    gitInit: true,
  },
  architecture: {
    session: {
      storage: 'local-file',
      eventRetention: 100,
      recoveryStrategy: 'last-event',
    },
    harness: {
      engine: 'claude-code',
      contextStrategy: 'compaction',
      maxRetries: 3,
    },
    sandbox: {
      type: 'local',
      mcpServers: [],
      credentialPolicy: 'none',
    },
  },
  flow: {
    sprint: [],
    roles: [],
    constraints: [],
  },
  integration: {
    mcpServers: [],
    hooks: [],
  },
};

interface ProjectConfigStore {
  config: ProjectConfig;
  currentStep: number;

  setProject: (project: Partial<ProjectInfo>) => void;
  setArchitecture: (architecture: Partial<ArchitectureConfig>) => void;
  setFlow: (flow: Partial<FlowConfig>) => void;
  setIntegration: (integration: Partial<IntegrationConfig>) => void;
  loadTemplate: (config: Partial<ProjectConfig>) => void;
  setCurrentStep: (step: number) => void;
  reset: () => void;
}

export const useProjectConfig = create<ProjectConfigStore>((set) => ({
  config: defaultConfig,
  currentStep: 0,

  setProject: (project) =>
    set((state) => ({
      config: { ...state.config, project: { ...state.config.project, ...project } },
    })),

  setArchitecture: (architecture) =>
    set((state) => ({
      config: { ...state.config, architecture: { ...state.config.architecture, ...architecture } },
    })),

  setFlow: (flow) =>
    set((state) => ({
      config: { ...state.config, flow: { ...state.config.flow, ...flow } },
    })),

  setIntegration: (integration) =>
    set((state) => ({
      config: { ...state.config, integration: { ...state.config.integration, ...integration } },
    })),

  loadTemplate: (template) =>
    set((state) => ({
      config: {
        ...state.config,
        ...template,
        project: { ...state.config.project, ...template.project },
        architecture: { ...state.config.architecture, ...template.architecture },
        flow: { ...state.config.flow, ...template.flow },
        integration: { ...state.config.integration, ...template.integration },
      },
    })),

  setCurrentStep: (step) => set({ currentStep: step }),

  reset: () => set({ config: defaultConfig, currentStep: 0 }),
}));
```

**Step 2: Verify store compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/store/
git commit -m "feat: add Zustand store for project configuration state"
```

---

### Task 5: Set up routing and wizard layout

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/wizard/layout.tsx`
- Create: `src/components/wizard/StepIndicator.tsx`

**Step 1: Update root layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Harness Forge — AI Agent Project Configurator',
  description: 'Visual project configuration tool for Claude Code and Codex',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

**Step 2: Create StepIndicator component**

```tsx
// src/components/wizard/StepIndicator.tsx
'use client';

import { cn } from '@/lib/utils';

const STEPS = [
  { label: 'Project', path: '/wizard' },
  { label: 'Architecture', path: '/wizard/architecture' },
  { label: 'Flow', path: '/wizard/flow' },
  { label: 'Integration', path: '/wizard/integration' },
  { label: 'Generate', path: '/wizard/generate' },
];

interface StepIndicatorProps {
  currentStep: number;
  onStepClick: (step: number) => void;
}

export function StepIndicator({ currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <nav className="flex items-center justify-center gap-2 py-6">
      {STEPS.map((step, index) => (
        <button
          key={step.path}
          onClick={() => onStepClick(index)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            index === currentStep
              ? 'bg-primary text-primary-foreground'
              : index < currentStep
                ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                : 'text-muted-foreground hover:bg-muted/50'
          )}
        >
          <span
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-xs',
              index === currentStep
                ? 'bg-primary-foreground text-primary'
                : 'bg-muted-foreground/20'
            )}
          >
            {index + 1}
          </span>
          {step.label}
        </button>
      ))}
    </nav>
  );
}
```

**Step 3: Create wizard layout**

```tsx
// src/app/wizard/layout.tsx
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { StepIndicator } from '@/components/wizard/StepIndicator';
import { useProjectConfig } from '@/store/useProjectConfig';

const STEP_PATHS = [
  '/wizard',
  '/wizard/architecture',
  '/wizard/flow',
  '/wizard/integration',
  '/wizard/generate',
];

export default function WizardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const currentStep = STEP_PATHS.indexOf(pathname);
  const setCurrentStep = useProjectConfig((s) => s.setCurrentStep);

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
    router.push(STEP_PATHS[step]);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4">
        <StepIndicator currentStep={currentStep} onStepClick={handleStepClick} />
        <main className="py-4">{children}</main>
      </div>
    </div>
  );
}
```

**Step 4: Create a placeholder wizard page**

```tsx
// src/app/wizard/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function WizardProjectPage() {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Basics</CardTitle>
        <CardDescription>Configure your project name, tech stack, and preferences.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Step 1 form will go here.</p>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => router.push('/wizard/architecture')}>
            Next: Architecture →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 5: Create placeholder pages for remaining steps**

Create minimal pages at:
- `src/app/wizard/architecture/page.tsx`
- `src/app/wizard/flow/page.tsx`
- `src/app/wizard/integration/page.tsx`
- `src/app/wizard/generate/page.tsx`

Each with same structure as above but different titles.

**Step 6: Verify routing works**

```bash
pnpm dev
```

Navigate to http://localhost:3000/wizard — step indicator and navigation should work.

**Step 7: Commit**

```bash
git add .
git commit -m "feat: add wizard layout, step indicator, and routing"
```

---

## Phase 2: Wizard Pages

### Task 6: Step 1 — Project Basics form

**Files:**
- Modify: `src/app/wizard/page.tsx`

**Step 1: Build the project basics form**

Replace `src/app/wizard/page.tsx` with a form containing:
- Project name (Input)
- Description (Textarea)
- Framework selector (Select: next, react, vue, flutter, custom)
- Language selector (Select: typescript, javascript, python, dart, go)
- Package manager selector (Select: npm, yarn, pnpm, bun)
- Git init toggle (Switch)

Each field updates the Zustand store via `useProjectConfig().setProject()`.

**Step 2: Verify**

Navigate to /wizard, fill form fields, check Zustand devtools shows updated state.

**Step 3: Commit**

```bash
git add .
git commit -m "feat: implement Step 1 project basics form"
```

---

### Task 7: Step 2 — Agent Architecture page

**Files:**
- Modify: `src/app/wizard/architecture/page.tsx`
- Create: `src/components/wizard/ArchitectureDiagram.tsx`

**Step 1: Build ArchitectureDiagram component**

Three-column card layout for Session / Harness / Sandbox. Each card contains form fields per the design doc's architecture config.

**Step 2: Build architecture page**

Wire ArchitectureDiagram to Zustand store via `setArchitecture()`.

**Step 3: Verify**

Navigate to /wizard/architecture, configure options, check store updates.

**Step 4: Commit**

```bash
git add .
git commit -m "feat: implement Step 2 agent architecture configuration"
```

---

### Task 8: Step 3 — Constraint Flow page

**Files:**
- Modify: `src/app/wizard/flow/page.tsx`
- Create: `src/components/wizard/FlowEditor.tsx`

**Step 1: Build FlowEditor component**

Horizontal pipeline of Sprint stages (Think → Plan → Build → ...). Each stage card has:
- Enable/disable toggle
- Role multi-select
- Gate checklist (add/remove items)
- Output format input

**Step 2: Build flow page**

Initialize default 7 Sprint stages. Wire to store via `setFlow()`.

**Step 3: Verify**

Toggle stages, add roles, add gates. Check store reflects changes.

**Step 4: Commit**

```bash
git add .
git commit -m "feat: implement Step 3 constraint flow editor"
```

---

### Task 9: Step 4 — Tools & Integration page

**Files:**
- Modify: `src/app/wizard/integration/page.tsx`

**Step 1: Build integration page**

Form sections:
- MCP Servers — dynamic list (add/remove), each with name, command, args fields
- Hooks — dynamic list (add/remove), each with event selector and command input

**Step 2: Verify**

Add/remove MCP servers and hooks, check store updates.

**Step 3: Commit**

```bash
git add .
git commit -m "feat: implement Step 4 tools and integration page"
```

---

### Task 10: Home page — Template Gallery

**Files:**
- Create: `src/templates/solo-dev.ts`
- Create: `src/templates/gstack-sprint.ts`
- Create: `src/templates/managed-agents.ts`
- Create: `src/components/template/TemplateCard.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create template presets**

Each template exports a `TemplatePreset` with pre-filled config. Example for `solo-dev.ts`:

```typescript
import type { TemplatePreset } from '@/types';

export const soloDev: TemplatePreset = {
  id: 'solo-dev',
  name: 'Solo Developer',
  description: 'Claude Code + basic harness + simple flow. Perfect for solo builders.',
  icon: '🧑‍💻',
  config: {
    architecture: {
      session: { storage: 'local-file', eventRetention: 50, recoveryStrategy: 'last-event' },
      harness: { engine: 'claude-code', contextStrategy: 'compaction', maxRetries: 3 },
      sandbox: { type: 'local', mcpServers: [], credentialPolicy: 'none' },
    },
    flow: {
      sprint: [
        { id: 'think', name: 'think', order: 0, enabled: true, roles: ['ceo'], gates: ['Design doc written'] },
        { id: 'build', name: 'build', order: 1, enabled: true, roles: ['eng-manager'], gates: ['Tests pass'] },
        { id: 'review', name: 'review', order: 2, enabled: true, roles: ['qa'], gates: ['No critical bugs'] },
        { id: 'ship', name: 'ship', order: 3, enabled: true, roles: ['release'], gates: ['CI green'] },
      ],
      roles: [],
      constraints: [],
    },
  },
};
```

**Step 2: Build TemplateCard component**

Card with icon, name, description, and "Use Template" button.

**Step 3: Build home page**

Grid of TemplateCards + "Custom" option. Clicking loads template into store and navigates to /wizard.

**Step 4: Verify**

Click each template, verify store is pre-filled with template config.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add template gallery home page with 3 presets"
```

---

## Phase 3: Generators

### Task 11: CLAUDE.md generator

**Files:**
- Create: `src/generators/claudeMd.ts`

**Step 1: Write the CLAUDE.md generator**

Function that takes `ProjectConfig` and returns a string containing the full CLAUDE.md content. Sections:
- Project info
- Architecture description (Session/Harness/Sandbox)
- Sprint flow rules
- Constraint checklist
- Integration notes

Use template literals (not EJS) since the structure is straightforward.

**Step 2: Verify with a test config**

Create a quick test script or console.log a sample output.

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add CLAUDE.md generator"
```

---

### Task 12: Settings generator

**Files:**
- Create: `src/generators/settings.ts`

**Step 1: Write the settings.json generator**

Generate `.claude/settings.json` with:
- permissions (based on sandbox config)
- mcpServers (from integration config)
- hooks (from integration config)

**Step 2: Write the Codex config generator (conditional)**

If engine is 'codex', generate `.codex/config.yaml`.

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add settings.json and codex config generators"
```

---

### Task 13: Scaffold generator

**Files:**
- Create: `src/generators/scaffold.ts`

**Step 1: Write scaffold generator**

Generate basic project scaffold based on tech stack:
- `package.json` (with name, scripts, dependencies per framework)
- `README.md`
- `docs/plans/ARCHITECTURE.md`
- Framework-specific boilerplate (minimal — just enough to start)

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add project scaffold generator"
```

---

### Task 14: Generator index + ZIP packaging

**Files:**
- Create: `src/generators/index.ts`

**Step 1: Write the unified generator**

Combines all generators into an `OutputFile[]` array:

```typescript
import type { ProjectConfig, OutputFile } from '@/types';
import { generateClaudeMd } from './claudeMd';
import { generateSettings } from './settings';
import { generateScaffold } from './scaffold';

export function generateAll(config: ProjectConfig): OutputFile[] {
  return [
    ...generateClaudeMd(config),
    ...generateSettings(config),
    ...generateScaffold(config),
  ];
}
```

**Step 2: Write the ZIP packager**

Client-side function using JSZip:

```typescript
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { OutputFile } from '@/types';

export async function downloadZip(files: OutputFile[], projectName: string) {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${projectName}.zip`);
}
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add unified generator and ZIP download"
```

---

## Phase 4: Preview & Generate Page

### Task 15: Step 5 — Preview & Generate page

**Files:**
- Modify: `src/app/wizard/generate/page.tsx`
- Create: `src/components/wizard/FilePreview.tsx`

**Step 1: Build FilePreview component**

Two-panel layout:
- Left: file tree (collapsible)
- Right: code preview with syntax highlighting (use a simple `<pre>` with CSS for now)

**Step 2: Build generate page**

- Reads full config from store
- Calls `generateAll(config)` on render
- Shows FilePreview with generated files
- "Download ZIP" button triggers `downloadZip()`
- "Copy to Clipboard" button copies individual file content

**Step 3: Verify**

Walk through entire wizard, generate files, download ZIP, verify contents.

**Step 4: Commit**

```bash
git add .
git commit -m "feat: implement preview and generate page with ZIP download"
```

---

## Phase 5: Polish & Visual Components

### Task 16: Polish UI and responsive design

**Files:**
- Modify: all wizard pages for responsive layout
- Modify: `src/app/globals.css` for custom styles

**Step 1: Add responsive breakpoints**

Ensure all pages work on mobile (single column) and desktop (multi-column where appropriate).

**Step 2: Add transition animations**

Smooth step transitions when navigating wizard.

**Step 3: Verify on different viewports**

Test at 375px, 768px, 1024px, 1440px widths.

**Step 4: Commit**

```bash
git add .
git commit -m "feat: polish UI with responsive design and transitions"
```

---

### Task 17: Add documentation and README

**Files:**
- Create: `README.md`
- Modify: `src/app/page.tsx` (add footer with GitHub link)

**Step 1: Write README**

Sections: What is Harness Forge, Quick Start, Architecture, Contributing, License (MIT).

**Step 2: Commit**

```bash
git add .
git commit -m "docs: add project README"
```
