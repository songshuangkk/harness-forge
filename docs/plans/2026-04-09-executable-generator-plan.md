# Executable Generator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign generators to output a layered structure — engine-agnostic core (`.harness/`) + per-engine adapter — so users download executable AI agent infrastructure, not just documentation.

**Architecture:** Core generators produce `.harness/` files (config, roles, flows, constraints). Engine adapters read core output and produce engine-specific files (Claude Code commands+hooks, Cursor rules, Codex skills+hooks). `generateAll()` orchestrates: core first, then the selected engine's adapter.

**Tech Stack:** Next.js 16, TypeScript, JSZip (existing). No new dependencies.

**Design doc:** `docs/plans/2026-04-09-executable-generator-design.md`

---

## Task 1: Create core generator — `.harness/config.yaml`

**Files:**
- Create: `src/generators/core/config.ts`

**Step 1: Create `src/generators/core/config.ts`**

```typescript
import type { ProjectConfig, OutputFile } from '@/types';
import YAML from 'json2yaml'; // 手动序列化即可，不引入依赖

export function generateCoreConfig(config: ProjectConfig): OutputFile {
  // 简单 YAML 序列化，不引入新依赖
  const content = objectToYaml(config);
  return { path: '.harness/config.yaml', content };
}

function objectToYaml(obj: unknown, indent = 0): string {
  const prefix = '  '.repeat(indent);
  if (obj === null || obj === undefined) return prefix + 'null\n';
  if (typeof obj === 'string') {
    // 包含特殊字符时加引号
    if (/[:#\n{}[\],&*?|>!%@`]/.test(obj) || obj === '') {
      return `${prefix}"${obj.replace(/"/g, '\\"')}"\n`;
    }
    return prefix + obj + '\n';
  }
  if (typeof obj === 'number' || typeof obj === 'boolean') return prefix + String(obj) + '\n';
  if (Array.isArray(obj)) {
    if (obj.length === 0) return prefix + '[]\n';
    return obj.map(item => {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const inner = objectToYaml(item, indent + 1);
        return `${prefix}- ${inner.trimStart()}`;
      }
      return `${prefix}- ${objectToYaml(item, 0).trim()}`;
    }).join('\n') + '\n';
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return prefix + '{}\n';
    return entries.map(([key, val]) => {
      const valStr = objectToYaml(val, indent + 1);
      // 如果值是多行的，key 后面直接换行
      if (valStr.includes('\n') && valStr.trim() !== String(val)) {
        return `${prefix}${key}:\n${valStr}`;
      }
      return `${prefix}${key}: ${valStr.trim()}\n`;
    }).join('');
  }
  return prefix + String(obj) + '\n';
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/generators/core/config.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/generators/core/config.ts
git commit -m "feat: add core config generator (.harness/config.yaml)"
```

---

## Task 2: Create core generator — `.harness/roles/*.md`

**Files:**
- Create: `src/generators/core/roles.ts`

**Step 1: Create `src/generators/core/roles.ts`**

```typescript
import type { ProjectConfig, OutputFile, RoleConfig } from '@/types';

// 如果模板没定义角色的默认描述，用这套 fallback
const DEFAULT_ROLE_DEFINITIONS: Record<string, { label: string; description: string; defaultConstraints: string[] }> = {
  'ceo': {
    label: 'CEO / Product Lead',
    description: 'Defines vision, prioritizes features, makes go/no-go decisions. Owns the "what" and "why".',
    defaultConstraints: ['Must approve all scope changes'],
  },
  'designer': {
    label: 'Designer',
    description: 'Owns UX flows, wireframes, and design system consistency. Ensures user-centric solutions.',
    defaultConstraints: ['All designs must pass accessibility audit'],
  },
  'eng-manager': {
    label: 'Engineering Manager',
    description: 'Leads development, reviews code, manages technical debt. Orchestrates sub-agents in Build stage.',
    defaultConstraints: ['Must maintain test coverage above configured target'],
  },
  'qa': {
    label: 'QA Engineer',
    description: 'Ensures quality through testing strategies and defect triage. Owns evidence-based verification.',
    defaultConstraints: ['Must log all test results'],
  },
  'security': {
    label: 'Security Officer',
    description: 'Reviews code for vulnerabilities, enforces credential policies, validates sandbox isolation.',
    defaultConstraints: ['Must flag all security-sensitive operations'],
  },
  'release': {
    label: 'Release Engineer',
    description: 'Manages CI/CD pipelines, deployments, and release artifacts. Owns the Ship stage.',
    defaultConstraints: ['Must follow semantic versioning'],
  },
  'doc-engineer': {
    label: 'Documentation Engineer',
    description: 'Maintains project documentation, API references, and changelogs.',
    defaultConstraints: ['All public APIs must have documentation'],
  },
};

function resolveRole(roleConfig: RoleConfig | undefined, roleId: string): RoleConfig {
  const fallback = DEFAULT_ROLE_DEFINITIONS[roleId];
  return roleConfig || {
    id: roleId as RoleConfig['id'],
    label: fallback?.label || roleId,
    description: fallback?.description || '',
    defaultConstraints: fallback?.defaultConstraints || [],
  };
}

function generateRoleMd(role: RoleConfig): string {
  const lines: string[] = [
    `# ${role.label}`,
    '',
    role.description,
    '',
  ];

  if (role.defaultConstraints.length > 0) {
    lines.push('## Default Constraints', '');
    for (const c of role.defaultConstraints) {
      lines.push(`- ${c}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function generateCoreRoles(config: ProjectConfig): OutputFile[] {
  // 收集所有被引用的角色 ID
  const usedRoleIds = new Set<string>();
  for (const stage of config.flow.sprint) {
    if (stage.enabled) {
      for (const role of stage.roles) {
        usedRoleIds.add(role);
      }
    }
  }

  const roleConfigMap = new Map<string, RoleConfig>();
  for (const role of config.flow.roles) {
    roleConfigMap.set(role.id, role);
  }

  const files: OutputFile[] = [];
  for (const roleId of usedRoleIds) {
    const resolved = resolveRole(roleConfigMap.get(roleId), roleId);
    files.push({
      path: `.harness/roles/${roleId}.md`,
      content: generateRoleMd(resolved),
    });
  }

  return files;
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/generators/core/roles.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/generators/core/roles.ts
git commit -m "feat: add core roles generator (.harness/roles/)"
```

---

## Task 3: Create core generator — `.harness/flows/*.md`

**Files:**
- Create: `src/generators/core/flows.ts`

**Step 1: Create `src/generators/core/flows.ts`**

```typescript
import type {
  ProjectConfig, OutputFile, StageName, SprintStage,
  ThinkConfig, PlanConfig, BuildConfig, ReviewConfig, TestConfig, ShipConfig, ReflectConfig,
} from '@/types';

const STAGE_TITLES: Record<StageName, string> = {
  think: 'Think — Problem Redefinition',
  plan: 'Plan — Multi-Role Architecture Review',
  build: 'Build — Implementation',
  review: 'Review — Multi-Dimensional Quality Audit',
  test: 'Test — Evidence-Based Verification',
  ship: 'Ship — Release Pipeline',
  reflect: 'Reflect — Retrospective',
};

const STAGE_DESCRIPTIONS: Record<StageName, string> = {
  think: 'Redefine the problem through forcing questions. Analyze dimensions, assess depth, produce a design doc that feeds into Plan.',
  plan: 'Multi-role architecture review. CEO, Designer, Eng Manager, and DX Lead review the design. Produce an implementation plan with per-task file paths and verification steps.',
  build: 'Implement the plan. Choose single-agent or subagent-parallel execution. Optionally enforce TDD RED-GREEN-REFACTOR cycle.',
  review: 'Multi-dimensional quality audit. Check spec compliance, code quality, security, performance. Auto-fix or report issues by severity.',
  test: 'Evidence-based verification. Run TDD, exploratory, and regression tests. Track coverage against target. Execute in configured environment.',
  ship: 'Release pipeline. Run tests, create PR, merge, deploy to targets. Follow semantic versioning.',
  reflect: 'Retrospective with cross-session learning. Analyze velocity, quality, test health. Persist learnings for future sessions.',
};

const STAGE_OUTPUTS: Record<StageName, string> = {
  think: 'Design document with problem statement, success metrics, constraints, and scope',
  plan: 'Implementation plan with structured tasks (file paths + verification steps per task)',
  build: 'Source code + tests',
  review: 'Review report with severity-rated issues',
  test: 'Test results + coverage report',
  ship: 'Release notes + deployment manifest',
  reflect: 'Retrospective report + improvement items',
};

const STAGE_INPUTS: Record<StageName, string> = {
  think: 'User request / feature description',
  plan: 'Design doc from Think stage',
  build: 'Implementation plan from Plan stage',
  review: 'Source code from Build stage',
  test: 'Reviewed code from Review stage',
  ship: 'Tested code from Test stage',
  reflect: 'Completed sprint cycle data',
};

const ROLE_LABELS: Record<string, string> = {
  'ceo': 'CEO / Product Lead',
  'designer': 'Designer',
  'eng-manager': 'Eng Manager',
  'qa': 'QA Lead',
  'security': 'Security Officer',
  'release': 'Release Engineer',
  'doc-engineer': 'Doc Engineer',
};

function formatStageConfigSection(stage: SprintStage): string {
  if (!stage.stageConfig) return '';

  const name = stage.name;
  const configLines: string[] = [];

  switch (name) {
    case 'think': {
      const c = stage.stageConfig as ThinkConfig;
      configLines.push(`- **Dimensions**: ${c.dimensions.join(', ') || 'none'}`);
      configLines.push(`- **Depth**: ${c.depth}`);
      break;
    }
    case 'plan': {
      const c = stage.stageConfig as PlanConfig;
      configLines.push(`- **Review types**: ${c.reviewTypes.join(', ') || 'none'}`);
      configLines.push(`- **Task structure**: ${c.taskStructure}`);
      break;
    }
    case 'build': {
      const c = stage.stageConfig as BuildConfig;
      configLines.push(`- **Execution strategy**: ${c.executionStrategy}`);
      configLines.push(`- **TDD mode**: ${c.tddMode}`);
      break;
    }
    case 'review': {
      const c = stage.stageConfig as ReviewConfig;
      configLines.push(`- **Review dimensions**: ${c.reviewDimensions.join(', ') || 'none'}`);
      configLines.push(`- **Auto-fix**: ${c.autoFix}`);
      configLines.push(`- **Severity threshold**: ${c.severityThreshold}`);
      break;
    }
    case 'test': {
      const c = stage.stageConfig as TestConfig;
      configLines.push(`- **Methods**: ${c.testMethods.join(', ') || 'none'}`);
      configLines.push(`- **Coverage target**: ${c.coverageTarget}%`);
      configLines.push(`- **Test types**: ${c.testTypes.join(', ') || 'none'}`);
      configLines.push(`- **Environment**: ${c.environment}`);
      break;
    }
    case 'ship': {
      const c = stage.stageConfig as ShipConfig;
      configLines.push(`- **Pipeline**: ${c.pipeline.join(' → ') || 'none'}`);
      configLines.push(`- **Version strategy**: ${c.versionStrategy}`);
      configLines.push(`- **Deployment targets**: ${c.deploymentTargets.join(', ') || 'none'}`);
      break;
    }
    case 'reflect': {
      const c = stage.stageConfig as ReflectConfig;
      configLines.push(`- **Dimensions**: ${c.dimensions.join(', ') || 'none'}`);
      configLines.push(`- **Persist learning**: ${c.persistLearning}`);
      break;
    }
  }

  return `## Configuration\n\n${configLines.join('\n')}\n`;
}

export function generateCoreFlows(config: ProjectConfig): OutputFile[] {
  const enabledStages = config.flow.sprint
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  // 收集该阶段相关的约束
  const constraintsByStage = new Map<string, typeof config.flow.constraints>();
  for (const c of config.flow.constraints) {
    const list = constraintsByStage.get(c.stageId) || [];
    list.push(c);
    constraintsByStage.set(c.stageId, list);
  }

  return enabledStages.map(stage => {
    const name = stage.name;
    const roles = stage.roles.map(r => ROLE_LABELS[r] || r);
    const gates = stage.gates;
    const stageConstraints = [
      ...(constraintsByStage.get(stage.id) || []),
      ...(constraintsByStage.get('*') || []),
    ];

    const lines: string[] = [
      `# ${STAGE_TITLES[name]}`,
      '',
      STAGE_DESCRIPTIONS[name],
      '',
      '## Input',
      '',
      STAGE_INPUTS[name],
      '',
      '## Output',
      '',
      STAGE_OUTPUTS[name],
      '',
      '## Roles',
      '',
      ...roles.map(r => `- ${r}`),
      '',
    ];

    if (gates.length > 0) {
      lines.push('## Gates', '');
      lines.push(...gates.map(g => `- [ ] ${g}`));
      lines.push('');
    }

    if (stageConstraints.length > 0) {
      lines.push('## Constraints', '');
      for (const c of stageConstraints) {
        const badge = c.enforced ? '[ENFORCED]' : '[ADVISORY]';
        lines.push(`- ${badge} (${c.type}) ${c.description}`);
      }
      lines.push('');
    }

    const configSection = formatStageConfigSection(stage);
    if (configSection) {
      lines.push(configSection);
    }

    return {
      path: `.harness/flows/${name}.md`,
      content: lines.join('\n'),
    };
  });
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/generators/core/flows.ts
git commit -m "feat: add core flows generator (.harness/flows/)"
```

---

## Task 4: Create core generator — `.harness/constraints/*.yaml`

**Files:**
- Create: `src/generators/core/constraints.ts`

**Step 1: Create `src/generators/core/constraints.ts`**

```typescript
import type { ProjectConfig, OutputFile, ConstraintType } from '@/types';

// 从 core/config.ts 复用简单 YAML 序列化
function toYamlValue(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') {
    if (/[:#\n{}[\],&*?|>!%@`]/.test(val) || val === '') return `"${val.replace(/"/g, '\\"')}"`;
    return val;
  }
  return String(val);
}

export function generateCoreConstraints(config: ProjectConfig): OutputFile[] {
  const constraints = config.flow.constraints;
  if (constraints.length === 0) return [];

  const grouped = new Map<ConstraintType, typeof constraints>();
  for (const c of constraints) {
    const list = grouped.get(c.type) || [];
    list.push(c);
    grouped.set(c.type, list);
  }

  const files: OutputFile[] = [];

  for (const [type, items] of grouped) {
    const filename = type === 'gate' ? 'gates' : type === 'checklist' ? 'checklists' : 'outputs';
    const lines: string[] = [`# Constraint type: ${type}`, ''];

    for (const item of items) {
      lines.push(`- id: ${toYamlValue(item.id)}`);
      lines.push(`  stageId: ${toYamlValue(item.stageId)}`);
      lines.push(`  type: ${toYamlValue(item.type)}`);
      lines.push(`  description: ${toYamlValue(item.description)}`);
      lines.push(`  enforced: ${item.enforced}`);
      lines.push('');
    }

    files.push({
      path: `.harness/constraints/${filename}.yaml`,
      content: lines.join('\n'),
    });
  }

  return files;
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/generators/core/constraints.ts
git commit -m "feat: add core constraints generator (.harness/constraints/)"
```

---

## Task 5: Create Claude Code adapter — CLAUDE.md

**Files:**
- Create: `src/generators/engines/claude/claudeMd.ts`

**Step 1: Create `src/generators/engines/claude/claudeMd.ts`**

```typescript
import type { ProjectConfig, OutputFile } from '@/types';

// 复用 agentConfig.ts 中的标签映射，但简化 — 只保留入口文档需要的部分
const LANGUAGE_LABELS: Record<string, string> = {
  typescript: 'TypeScript', javascript: 'JavaScript', python: 'Python',
  go: 'Go', java: 'Java', rust: 'Rust', dart: 'Dart',
};

const STAGE_LABELS: Record<string, string> = {
  think: 'Think', plan: 'Plan', build: 'Build',
  review: 'Review', test: 'Test', ship: 'Ship', reflect: 'Reflect',
};

const ROLE_LABELS: Record<string, string> = {
  'ceo': 'CEO / Product Lead', 'designer': 'Designer', 'eng-manager': 'Eng Manager',
  'qa': 'QA Lead', 'security': 'Security Officer', 'release': 'Release Engineer', 'doc-engineer': 'Doc Engineer',
};

export function generateClaudeMd(config: ProjectConfig): OutputFile {
  const { project, architecture, flow, integration } = config;
  const enabledStages = flow.sprint
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  const flowDiagram = enabledStages.map(s => STAGE_LABELS[s.name] || s.name).join(' → ');

  // 约束汇总
  const enforcedConstraints = flow.constraints.filter(c => c.enforced);
  const advisoryConstraints = flow.constraints.filter(c => !c.enforced);

  const lines: string[] = [
    `# ${project.name || 'Project'}`,
    '',
    project.description || '',
    '',
    '## Tech Stack',
    '',
    `- **Language**: ${LANGUAGE_LABELS[project.techStack.language] || project.techStack.language}`,
  ];

  if (project.techStack.stackDescription) {
    lines.push(`- **Stack**: ${project.techStack.stackDescription}`);
  }

  lines.push(
    '',
    '## Architecture',
    '',
    'Three-layer decoupled design (Session / Harness / Sandbox). See `.harness/config.yaml` for full configuration.',
    '',
    `- **Session**: ${architecture.session.storage} storage, ${architecture.session.eventRetention} events, ${architecture.session.recoveryStrategy} recovery`,
    `- **Harness**: ${architecture.harness.engine}, ${architecture.harness.contextStrategy} context, ${architecture.harness.maxRetries} retries`,
    `- **Sandbox**: ${architecture.sandbox.type}, ${architecture.sandbox.credentialPolicy} credentials`,
    '',
    '## Sprint Flow',
    '',
    `\`${flowDiagram}\``,
    '',
    'Use slash commands to drive each stage:',
  );

  for (const stage of enabledStages) {
    const label = STAGE_LABELS[stage.name];
    const roles = stage.roles.map(r => ROLE_LABELS[r] || r).join(', ');
    lines.push(`- \`/${stage.name}\` — ${label} (${roles})`);
  }

  if (enforcedConstraints.length > 0) {
    lines.push('', '## Enforced Constraints', '');
    for (const c of enforcedConstraints) {
      lines.push(`- **[${c.type}]** ${c.description} (stage: ${c.stageId})`);
    }
  }

  if (advisoryConstraints.length > 0) {
    lines.push('', '## Advisory Constraints', '');
    for (const c of advisoryConstraints) {
      lines.push(`- (${c.type}) ${c.description} (stage: ${c.stageId})`);
    }
  }

  if (integration.mcpServers.length > 0) {
    lines.push('', '## MCP Servers', '');
    for (const server of integration.mcpServers) {
      const args = server.args.length > 0 ? ` ${server.args.join(' ')}` : '';
      lines.push(`- **${server.name}**: \`${server.command}${args}\``);
    }
  }

  lines.push(
    '',
    '## File Structure',
    '',
    '```',
    '.harness/          ← Engine-agnostic definitions (config, roles, flows, constraints)',
    '.claude/           ← Claude Code adapter (commands, hooks, settings)',
    'CLAUDE.md          ← This file',
    '```',
    '',
  );

  return { path: 'CLAUDE.md', content: lines.join('\n') };
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/generators/engines/claude/claudeMd.ts
git commit -m "feat: add Claude Code CLAUDE.md generator"
```

---

## Task 6: Create Claude Code adapter — slash commands

**Files:**
- Create: `src/generators/engines/claude/commands.ts`

**Step 1: Create `src/generators/engines/claude/commands.ts`**

Each slash command reads from `.harness/flows/` content embedded at generation time.

```typescript
import type { ProjectConfig, OutputFile, StageName, SprintStage } from '@/types';

const STAGE_DESCRIPTIONS: Record<StageName, { title: string; prompt: string }> = {
  think: {
    title: 'Think — Problem Redefinition',
    prompt: `Analyze the problem from multiple angles. Ask forcing questions before filling in answers.

## Process

1. Read the project context (CLAUDE.md, .harness/config.yaml)
2. For each enabled dimension, formulate probing questions
3. Assess depth level (quick vs deep) and adjust rigor
4. Produce a design document covering:
   - Problem statement (redefined, not restated)
   - Success metrics (measurable)
   - Constraints (technical, business, time)
   - Alternatives considered
   - Scope boundaries
   - Risk assessment
5. Write output to docs/plans/design.md`,
  },
  plan: {
    title: 'Plan — Multi-Role Architecture Review',
    prompt: `Create an implementation plan reviewed from multiple roles.

## Process

1. Read the design doc from Think stage (docs/plans/design.md)
2. For each enabled review type, evaluate from that perspective:
   - CEO review: business value alignment, scope feasibility
   - Eng review: technical architecture, dependency risks
   - Design review: UX flow, component structure
   - DX review: developer experience, tooling needs
3. Break into tasks with:
   - Exact file paths to create/modify
   - Verification steps per task
   - Dependencies between tasks
4. Write plan to docs/plans/implementation-plan.md`,
  },
  build: {
    title: 'Build — Implementation',
    prompt: `Implement the plan from the Plan stage.

## Process

1. Read the implementation plan (docs/plans/implementation-plan.md)
2. For each task:
   a. If TDD enforced: write failing test first, then implement
   b. If subagent-parallel: dispatch independent tasks to subagents
   c. If single-agent: execute sequentially
3. Verify each task against its verification steps
4. Run linter and type checker after each task
5. Commit after each completed task`,
  },
  review: {
    title: 'Review — Multi-Dimensional Quality Audit',
    prompt: `Audit the implementation against the plan.

## Process

1. Read the implementation plan (docs/plans/implementation-plan.md)
2. For each enabled review dimension:
   - Spec compliance: does code match the plan?
   - Code quality: naming, structure, DRY, no dead code
   - Security: OWASP top 10, credential handling, input validation
   - Performance: N+1 queries, unnecessary re-renders, bundle size
3. Rate each issue by severity (critical / major / minor)
4. If auto-fix enabled: fix obvious issues and re-review
5. Write review report to docs/reviews/review-report.md`,
  },
  test: {
    title: 'Test — Evidence-Based Verification',
    prompt: `Verify the implementation with evidence, not claims.

## Process

1. Run all configured test types:
   - Unit tests: individual functions and components
   - Integration tests: module interactions
   - E2E tests: full user flows
   - Browser tests: cross-browser compatibility
   - Performance tests: load time, throughput
   - Security tests: vulnerability scanning
2. Measure coverage against target
3. If coverage below target: write additional tests
4. Document all test results with evidence
5. Write test report to docs/reports/test-report.md`,
  },
  ship: {
    title: 'Ship — Release Pipeline',
    prompt: `Execute the release pipeline.

## Process

1. Run the configured pipeline steps in order:
   - Run tests: verify all tests pass
   - Create PR: with description summarizing changes
   - Merge: after required approvals
   - Deploy: to configured targets
2. Determine version bump (patch / minor / major)
3. Update changelog
4. Create release tag
5. Deploy to staging first, then production
6. Verify deployment health`,
  },
  reflect: {
    title: 'Reflect — Retrospective',
    prompt: `Conduct a retrospective on the completed sprint.

## Process

1. Review the sprint from each enabled dimension:
   - Velocity: planned vs actual task completion
   - Quality: review findings, bugs found in test
   - Test health: coverage trends, flaky tests
   - Growth: skills developed, patterns learned
2. Identify:
   - What went well
   - What to improve
   - Action items for next sprint
3. If persistence enabled: save learnings to .claude/memory/
4. Write retrospective to docs/reports/retrospective.md`,
  },
};

export function generateClaudeCommands(config: ProjectConfig): OutputFile[] {
  const enabledStages = config.flow.sprint
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  // 收集该阶段的约束
  const constraintsByStage = new Map<string, typeof config.flow.constraints>();
  for (const c of config.flow.constraints) {
    const list = constraintsByStage.get(c.stageId) || [];
    list.push(c);
    constraintsByStage.set(c.stageId, list);
  }

  return enabledStages.map(stage => {
    const desc = STAGE_DESCRIPTIONS[stage.name];
    const stageConstraints = [
      ...(constraintsByStage.get(stage.id) || []),
      ...(constraintsByStage.get('*') || []),
    ];

    const lines: string[] = [
      '---',
      `description: ${desc.title}`,
      '---',
      '',
      desc.prompt,
      '',
    ];

    // 嵌入 gates 作为检查清单
    if (stage.gates.length > 0) {
      lines.push('## Gates (check before proceeding)', '');
      for (const gate of stage.gates) {
        lines.push(`- [ ] ${gate}`);
      }
      lines.push('');
    }

    // 嵌入约束
    if (stageConstraints.length > 0) {
      lines.push('## Constraints', '');
      for (const c of stageConstraints) {
        const prefix = c.enforced ? '**ENFORCED**' : '*advisory*';
        lines.push(`- ${prefix}: ${c.description}`);
      }
      lines.push('');
    }

    // 如果有 stageConfig，嵌入关键配置提示
    if (stage.stageConfig) {
      lines.push('## Stage Config', '');
      lines.push('```json');
      lines.push(JSON.stringify(stage.stageConfig, null, 2));
      lines.push('```');
      lines.push('');
    }

    return {
      path: `.claude/commands/${stage.name}.md`,
      content: lines.join('\n'),
    };
  });
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/generators/engines/claude/commands.ts
git commit -m "feat: add Claude Code slash commands generator"
```

---

## Task 7: Create Claude Code adapter — hooks scripts + settings

**Files:**
- Create: `src/generators/engines/claude/hooks.ts`
- Create: `src/generators/engines/claude/settings.ts`

**Step 1: Create `src/generators/engines/claude/hooks.ts`**

```typescript
import type { ProjectConfig, OutputFile } from '@/types';

export function generateClaudeHooks(config: ProjectConfig): OutputFile[] {
  const files: OutputFile[] = [];

  // 收集 enforced gates 用于生成 hook 脚本
  const enforcedGates = config.flow.constraints.filter(c => c.enforced && c.type === 'gate');

  // 通用约束检查 hook
  files.push({
    path: '.claude/hooks/constraint-check.sh',
    content: `#!/usr/bin/env bash
# Harness Forge — Constraint Check Hook
# Validates that enforced constraints are met before proceeding.
# Exit 0 = pass, exit 2 = block with message.

set -euo pipefail

# Read stdin JSON from Claude Code
INPUT=$(cat)
EVENT=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || echo "")

# Block dangerous commands
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")
if echo "$COMMAND" | grep -qiE 'rm\\s+-rf|DROP\\s+TABLE|truncate|DELETE\\s+FROM'; then
  echo "BLOCKED: Dangerous command detected: $COMMAND"
  exit 2
fi

exit 0
`,
  });

  // Review gate hook — 检查是否经过 review 阶段
  if (enforcedGates.some(c => c.stageId === 'review' || c.stageId === 'ship')) {
    files.push({
      path: '.claude/hooks/review-gate.sh',
      content: `#!/usr/bin/env bash
# Harness Forge — Review Gate Hook
# Checks that code has been reviewed before shipping.
set -euo pipefail

INPUT=$(cat)

# Check if review report exists (created by /review command)
if [ ! -f "docs/reviews/review-report.md" ]; then
  echo "BLOCKED: No review report found. Run /review before proceeding."
  exit 2
fi

exit 0
`,
    });
  }

  // Test gate hook — 检查测试报告
  if (enforcedGates.some(c => c.stageId === 'ship' || c.stageId === 'test')) {
    files.push({
      path: '.claude/hooks/test-gate.sh',
      content: `#!/usr/bin/env bash
# Harness Forge — Test Gate Hook
# Checks that tests have been run and pass before shipping.
set -euo pipefail

INPUT=$(cat)

if [ ! -f "docs/reports/test-report.md" ]; then
  echo "BLOCKED: No test report found. Run /test before proceeding."
  exit 2
fi

exit 0
`,
    });
  }

  // Ship gate hook — 确保 review + test 都通过
  if (config.flow.sprint.some(s => s.name === 'ship' && s.enabled)) {
    files.push({
      path: '.claude/hooks/ship-gate.sh',
      content: `#!/usr/bin/env bash
# Harness Forge — Ship Gate Hook
# Ensures review and test stages have completed before shipping.
set -euo pipefail

INPUT=$(cat)

if [ ! -f "docs/reviews/review-report.md" ]; then
  echo "BLOCKED: Review not completed. Run /review first."
  exit 2
fi

if [ ! -f "docs/reports/test-report.md" ]; then
  echo "BLOCKED: Tests not completed. Run /test first."
  exit 2
fi

exit 0
`,
    });
  }

  return files;
}

/**
 * 构建 settings.json 中的 hooks 注册配置
 */
export function buildClaudeHookRegistrations(config: ProjectConfig): Record<string, Array<{
  matcher: string;
  hooks: Array<{ type: string; command: string }>;
}>> {
  const hooks: Record<string, Array<{
    matcher: string;
    hooks: Array<{ type: string; command: string }>;
  }>> = {};

  // PreToolUse(Bash) — 拦截危险命令
  hooks['PreToolUse'] = [{
    matcher: 'Bash',
    hooks: [{
      type: 'command',
      command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/constraint-check.sh',
    }],
  }];

  // 用户自定义 hooks
  for (const hook of config.integration.hooks) {
    if (!hooks[hook.event]) {
      hooks[hook.event] = [];
    }
    hooks[hook.event].push({
      matcher: '',
      hooks: [{ type: 'command', command: hook.command }],
    });
  }

  return hooks;
}
```

**Step 2: Create `src/generators/engines/claude/settings.ts`**

```typescript
import type { ProjectConfig, OutputFile } from '@/types';
import { buildClaudeHookRegistrations } from './hooks';

interface ClaudeSettings {
  permissions: { allow: string[]; deny: string[] };
  mcpServers: Record<string, { command: string; args: string[]; env?: Record<string, string> }>;
  hooks: Record<string, Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>>;
}

function buildMcpServers(config: ProjectConfig): ClaudeSettings['mcpServers'] {
  const mcpServers: ClaudeSettings['mcpServers'] = {};

  for (const server of config.integration.mcpServers) {
    const entry: ClaudeSettings['mcpServers'][string] = { command: server.command, args: server.args };
    if (server.env && Object.keys(server.env).length > 0) entry.env = server.env;
    mcpServers[server.name] = entry;
  }

  for (const server of config.architecture.sandbox.mcpServers) {
    if (!mcpServers[server.name]) {
      const entry: ClaudeSettings['mcpServers'][string] = { command: server.command, args: server.args };
      if (server.env && Object.keys(server.env).length > 0) entry.env = server.env;
      mcpServers[server.name] = entry;
    }
  }

  return mcpServers;
}

export function generateClaudeSettings(config: ProjectConfig): OutputFile {
  const settings: ClaudeSettings = {
    permissions: {
      allow: ['Bash(npm run *)', 'Bash(npx *)', 'Bash(git *)', 'Read', 'Write', 'Edit'],
      deny: ['Bash(rm -rf *)', 'Bash(DROP *)'],
    },
    mcpServers: buildMcpServers(config),
    hooks: buildClaudeHookRegistrations(config),
  };

  return {
    path: '.claude/settings.json',
    content: JSON.stringify(settings, null, 2),
  };
}
```

**Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/generators/engines/claude/hooks.ts src/generators/engines/claude/settings.ts
git commit -m "feat: add Claude Code hooks and settings generators"
```

---

## Task 8: Create Cursor adapter — rules + mcp + cursorrules

**Files:**
- Create: `src/generators/engines/cursor/cursorrules.ts`
- Create: `src/generators/engines/cursor/rules.ts`
- Create: `src/generators/engines/cursor/mcp.ts`

**Step 1: Create `src/generators/engines/cursor/cursorrules.ts`**

```typescript
import type { ProjectConfig, OutputFile } from '@/types';

export function generateCursorrules(config: ProjectConfig): OutputFile {
  // cursorrules 内容等同于 CLAUDE.md 的精简版
  const { project, architecture, flow } = config;
  const enabledStages = flow.sprint
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  const flowDiagram = enabledStages.map(s => s.name).join(' → ');

  const lines: string[] = [
    `# ${project.name || 'Project'}`,
    '',
    project.description || '',
    '',
    '## Architecture',
    '',
    `Session: ${architecture.session.storage} | Harness: ${architecture.harness.engine} | Sandbox: ${architecture.sandbox.type}`,
    '',
    '## Sprint Flow',
    '',
    flowDiagram,
    '',
    'Reference stage rules via @think, @plan, @build, @review, @test, @ship, @reflect in your prompts.',
    '',
  ];

  if (flow.constraints.filter(c => c.enforced).length > 0) {
    lines.push('## Enforced Constraints', '');
    for (const c of flow.constraints.filter(c => c.enforced)) {
      lines.push(`- ${c.description} (stage: ${c.stageId})`);
    }
    lines.push('');
  }

  return { path: '.cursorrules', content: lines.join('\n') };
}
```

**Step 2: Create `src/generators/engines/cursor/rules.ts`**

```typescript
import type { ProjectConfig, OutputFile, StageName } from '@/types';

const STAGE_DESCRIPTIONS: Record<StageName, { title: string; body: string }> = {
  think: {
    title: 'Think Stage',
    body: `Analyze the problem through forcing questions. Cover all enabled dimensions. Produce a design document.\n\nProcess:\n1. Read project context\n2. Formulate probing questions for each dimension\n3. Assess at configured depth level\n4. Produce design doc at docs/plans/design.md`,
  },
  plan: {
    title: 'Plan Stage',
    body: `Create implementation plan with multi-role review.\n\nProcess:\n1. Read design doc\n2. Review from each enabled perspective (CEO/Eng/Design/DX)\n3. Break into structured tasks with file paths and verification steps\n4. Write plan to docs/plans/implementation-plan.md`,
  },
  build: {
    title: 'Build Stage',
    body: `Implement the plan.\n\nProcess:\n1. Read implementation plan\n2. Execute tasks (TDD if enforced, parallel if configured)\n3. Verify each task\n4. Run linter/type checker\n5. Commit after each task`,
  },
  review: {
    title: 'Review Stage',
    body: `Audit implementation quality.\n\nProcess:\n1. Read implementation plan\n2. Check each enabled dimension (spec/code quality/security/performance)\n3. Rate issues by severity\n4. Auto-fix if configured\n5. Write report to docs/reviews/review-report.md`,
  },
  test: {
    title: 'Test Stage',
    body: `Evidence-based verification.\n\nProcess:\n1. Run all configured test types\n2. Measure coverage against target\n3. Write additional tests if below target\n4. Document results\n5. Write report to docs/reports/test-report.md`,
  },
  ship: {
    title: 'Ship Stage',
    body: `Execute release pipeline.\n\nProcess:\n1. Execute pipeline steps in order\n2. Bump version\n3. Update changelog\n4. Deploy to configured targets`,
  },
  reflect: {
    title: 'Reflect Stage',
    body: `Retrospective on completed sprint.\n\nProcess:\n1. Review sprint from each enabled dimension\n2. Identify what went well and what to improve\n3. Create action items\n4. Write report to docs/reports/retrospective.md`,
  },
};

export function generateCursorRules(config: ProjectConfig): OutputFile[] {
  const enabledStages = config.flow.sprint
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  const files: OutputFile[] = [];

  // always.mdc — 全局规则
  const globalLines: string[] = [
    '---',
    'description: Project architecture and global constraints',
    'alwaysApply: true',
    '---',
    '',
    `# ${config.project.name} — Global Rules`,
    '',
    config.project.description || '',
    '',
    '## Architecture',
    '',
    `- Session: ${config.architecture.session.storage}`,
    `- Harness: ${config.architecture.harness.engine}, ${config.architecture.harness.contextStrategy} context`,
    `- Sandbox: ${config.architecture.sandbox.type}, ${config.architecture.sandbox.credentialPolicy} credentials`,
    '',
    '## Sprint Flow',
    '',
    enabledStages.map(s => `- ${s.name}`).join('\n'),
    '',
    'Use @think, @plan, etc. to load stage-specific rules.',
    '',
  ];

  const enforced = config.flow.constraints.filter(c => c.enforced);
  if (enforced.length > 0) {
    globalLines.push('## Enforced Constraints', '');
    for (const c of enforced) {
      globalLines.push(`- ${c.description} (stage: ${c.stageId})`);
    }
    globalLines.push('');
  }

  files.push({ path: '.cursor/rules/always.mdc', content: globalLines.join('\n') });

  // 每阶段一个 rule
  const constraintsByStage = new Map<string, typeof config.flow.constraints>();
  for (const c of config.flow.constraints) {
    const list = constraintsByStage.get(c.stageId) || [];
    list.push(c);
    constraintsByStage.set(c.stageId, list);
  }

  for (const stage of enabledStages) {
    const desc = STAGE_DESCRIPTIONS[stage.name];
    const stageConstraints = [
      ...(constraintsByStage.get(stage.id) || []),
      ...(constraintsByStage.get('*') || []),
    ];

    const lines: string[] = [
      '---',
      `description: ${desc.title} stage rules`,
      'alwaysApply: false',
      '---',
      '',
      `# ${desc.title}`,
      '',
      desc.body,
      '',
    ];

    if (stage.gates.length > 0) {
      lines.push('## Gates', '');
      for (const g of stage.gates) {
        lines.push(`- [ ] ${g}`);
      }
      lines.push('');
    }

    if (stageConstraints.length > 0) {
      lines.push('## Constraints', '');
      for (const c of stageConstraints) {
        const badge = c.enforced ? '[ENFORCED]' : '[advisory]';
        lines.push(`- ${badge} ${c.description}`);
      }
      lines.push('');
    }

    if (stage.stageConfig) {
      lines.push('## Config', '', '```json', JSON.stringify(stage.stageConfig, null, 2), '```', '');
    }

    files.push({ path: `.cursor/rules/${stage.name}.mdc`, content: lines.join('\n') });
  }

  return files;
}
```

**Step 3: Create `src/generators/engines/cursor/mcp.ts`**

```typescript
import type { ProjectConfig, OutputFile } from '@/types';

export function generateCursorMcp(config: ProjectConfig): OutputFile {
  const mcpServers: Record<string, { command: string; args?: string[]; env?: Record<string, string> }> = {};

  for (const server of config.integration.mcpServers) {
    const entry: typeof mcpServers[string] = { command: server.command };
    if (server.args.length > 0) entry.args = server.args;
    if (server.env) entry.env = server.env;
    mcpServers[server.name] = entry;
  }

  for (const server of config.architecture.sandbox.mcpServers) {
    if (!mcpServers[server.name]) {
      const entry: typeof mcpServers[string] = { command: server.command };
      if (server.args.length > 0) entry.args = server.args;
      if (server.env) entry.env = server.env;
      mcpServers[server.name] = entry;
    }
  }

  return {
    path: '.cursor/mcp.json',
    content: JSON.stringify({ mcpServers }, null, 2),
  };
}
```

**Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/generators/engines/cursor/cursorrules.ts src/generators/engines/cursor/rules.ts src/generators/engines/cursor/mcp.ts
git commit -m "feat: add Cursor adapter (rules, mcp, cursorrules)"
```

---

## Task 9: Create Codex adapter — skills + hooks + config + AGENTS.md

**Files:**
- Create: `src/generators/engines/codex/agentsMd.ts`
- Create: `src/generators/engines/codex/skills.ts`
- Create: `src/generators/engines/codex/hooks.ts`
- Create: `src/generators/engines/codex/config.ts`

**Step 1: Create `src/generators/engines/codex/agentsMd.ts`**

```typescript
import type { ProjectConfig, OutputFile } from '@/types';

export function generateAgentsMd(config: ProjectConfig): OutputFile {
  const { project, architecture, flow } = config;
  const enabledStages = flow.sprint
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  const lines: string[] = [
    `# ${project.name || 'Project'}`,
    '',
    project.description || '',
    '',
    '## Architecture',
    '',
    `- Session: ${architecture.session.storage}, ${architecture.session.eventRetention} events`,
    `- Harness: ${architecture.harness.engine}, ${architecture.harness.contextStrategy} context`,
    `- Sandbox: ${architecture.sandbox.type}, ${architecture.sandbox.credentialPolicy} credentials`,
    '',
    '## Sprint Flow',
    '',
  ];

  for (const stage of enabledStages) {
    const roles = stage.roles.join(', ');
    lines.push(`- **${stage.name}** — roles: ${roles}`);
  }

  if (flow.constraints.filter(c => c.enforced).length > 0) {
    lines.push('', '## Enforced Constraints', '');
    for (const c of flow.constraints.filter(c => c.enforced)) {
      lines.push(`- ${c.description} (stage: ${c.stageId})`);
    }
  }

  lines.push(
    '',
    '## Skills',
    '',
    'Stage-specific skills are in .codex/skills/. Each skill can be triggered by name.',
    '',
  );

  return { path: 'AGENTS.md', content: lines.join('\n') };
}
```

**Step 2: Create `src/generators/engines/codex/skills.ts`**

```typescript
import type { ProjectConfig, OutputFile, StageName } from '@/types';

const STAGE_SKILLS: Record<StageName, { title: string; body: string }> = {
  think: {
    title: 'Think — Problem Redefinition',
    body: 'Analyze the problem through forcing questions. Cover all enabled dimensions. Produce design doc at docs/plans/design.md.',
  },
  plan: {
    title: 'Plan — Multi-Role Architecture Review',
    body: 'Create implementation plan reviewed from multiple perspectives. Break into tasks with file paths and verification steps. Write to docs/plans/implementation-plan.md.',
  },
  build: {
    title: 'Build — Implementation',
    body: 'Implement the plan. Use TDD if enforced. Execute with subagents if configured. Commit after each task.',
  },
  review: {
    title: 'Review — Quality Audit',
    body: 'Audit implementation against plan. Check each enabled dimension. Rate issues by severity. Write report to docs/reviews/review-report.md.',
  },
  test: {
    title: 'Test — Evidence-Based Verification',
    body: 'Run all configured test types. Measure coverage. Write report to docs/reports/test-report.md.',
  },
  ship: {
    title: 'Ship — Release Pipeline',
    body: 'Execute release pipeline steps. Bump version, update changelog, deploy to targets.',
  },
  reflect: {
    title: 'Reflect — Retrospective',
    body: 'Conduct retrospective. Review sprint dimensions. Write report to docs/reports/retrospective.md.',
  },
};

export function generateCodexSkills(config: ProjectConfig): OutputFile[] {
  const enabledStages = config.flow.sprint
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  const constraintsByStage = new Map<string, typeof config.flow.constraints>();
  for (const c of config.flow.constraints) {
    const list = constraintsByStage.get(c.stageId) || [];
    list.push(c);
    constraintsByStage.set(c.stageId, list);
  }

  return enabledStages.map(stage => {
    const skill = STAGE_SKILLS[stage.name];
    const stageConstraints = [
      ...(constraintsByStage.get(stage.id) || []),
      ...(constraintsByStage.get('*') || []),
    ];

    const lines: string[] = [
      `# ${skill.title}`,
      '',
      skill.body,
      '',
    ];

    if (stage.gates.length > 0) {
      lines.push('## Gates', '');
      for (const g of stage.gates) lines.push(`- [ ] ${g}`);
      lines.push('');
    }

    if (stageConstraints.length > 0) {
      lines.push('## Constraints', '');
      for (const c of stageConstraints) {
        const badge = c.enforced ? '[ENFORCED]' : '[advisory]';
        lines.push(`- ${badge} ${c.description}`);
      }
      lines.push('');
    }

    if (stage.stageConfig) {
      lines.push('## Config', '', '```json', JSON.stringify(stage.stageConfig, null, 2), '```', '');
    }

    return {
      path: `.codex/skills/${stage.name}/SKILL.md`,
      content: lines.join('\n'),
    };
  });
}
```

**Step 3: Create `src/generators/engines/codex/hooks.ts`**

```typescript
import type { ProjectConfig, OutputFile } from '@/types';

export function generateCodexHookScripts(config: ProjectConfig): OutputFile[] {
  const files: OutputFile[] = [];

  // Pre-bash policy
  files.push({
    path: '.codex/hooks/pre-bash-policy.sh',
    content: `#!/usr/bin/env bash
# Harness Forge — Pre-Bash Policy
# Blocks dangerous shell commands.
set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")

if echo "$COMMAND" | grep -qiE 'rm\\s+-rf|DROP\\s+TABLE|truncate|DELETE\\s+FROM'; then
  echo "BLOCKED: Dangerous command: $COMMAND"
  exit 1
fi

exit 0
`,
  });

  // Stop-continue
  if (config.flow.sprint.some(s => s.enabled)) {
    files.push({
      path: '.codex/hooks/stop-continue.sh',
      content: `#!/usr/bin/env bash
# Harness Forge — Stop Continue Check
# If deliverables are missing, block stop to force continuation.
set -euo pipefail

# Simple check: if no docs/ directory exists, suggest continuing
if [ ! -d "docs" ]; then
  echo "CONTINUE: No docs/ directory found. Complete the current stage first."
  exit 1
fi

exit 0
`,
    });
  }

  return files;
}

export function generateCodexHooksJson(config: ProjectConfig): OutputFile {
  const hooks: Record<string, Array<{
    matcher: string;
    hooks: Array<{ type: string; command: string }>;
  }>> = {
    'PreToolUse': [{
      matcher: 'Bash',
      hooks: [{ type: 'command', command: 'bash .codex/hooks/pre-bash-policy.sh' }],
    }],
  };

  if (config.flow.sprint.some(s => s.enabled)) {
    hooks['Stop'] = [{
      matcher: '',
      hooks: [{ type: 'command', command: 'bash .codex/hooks/stop-continue.sh' }],
    }];
  }

  return {
    path: '.codex/hooks.json',
    content: JSON.stringify({ hooks }, null, 2),
  };
}
```

**Step 4: Create `src/generators/engines/codex/config.ts`**

```typescript
import type { ProjectConfig, OutputFile } from '@/types';

export function generateCodexConfig(config: ProjectConfig): OutputFile {
  const { architecture, integration } = config;

  // Sandbox mode mapping
  const sandboxMode: Record<string, string> = {
    'local': 'workspace-write',
    'docker': 'docker',
    'remote': 'danger-full-access',
  };

  // Approval policy mapping
  const approvalPolicy: Record<string, string> = {
    'vault': 'on-request',
    'bundled': 'on-request',
    'none': 'untrusted',
  };

  const lines: string[] = [
    '# Codex configuration — generated by Harness Forge',
    'model: o3',
    `sandbox_mode: ${sandboxMode[architecture.sandbox.type] || 'workspace-write'}`,
    `approval_policy: ${approvalPolicy[architecture.sandbox.credentialPolicy] || 'untrusted'}`,
    '',
    '[features]',
    'codex_hooks = true',
    '',
  ];

  // MCP servers
  const allServers = [...integration.mcpServers, ...architecture.sandbox.mcpServers];
  if (allServers.length > 0) {
    lines.push('[mcp_servers]');
    for (const server of allServers) {
      lines.push(`[mcp_servers.${server.name}]`);
      lines.push(`command = "${server.command}"`);
      if (server.args.length > 0) {
        lines.push(`args = ${JSON.stringify(server.args)}`);
      }
      if (server.env) {
        for (const [key, val] of Object.entries(server.env)) {
          lines.push(`env.${key} = "${val}"`);
        }
      }
      lines.push('');
    }
  }

  return { path: '.codex/config.toml', content: lines.join('\n') };
}
```

**Step 5: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/generators/engines/codex/
git commit -m "feat: add Codex adapter (skills, hooks, config, AGENTS.md)"
```

---

## Task 10: Update `scaffold.ts` — reference `.harness/`

**Files:**
- Modify: `src/generators/scaffold.ts`

**Step 1: Update scaffold to reference new structure**

In `generateReadme`, update the getting started section to mention `.harness/` directory and slash commands. In `generateArchitectureDoc`, add a section showing the file structure.

Key changes:
- README getting started section mentions `/<stage>` slash commands
- ARCHITECTURE.md adds file structure overview showing `.harness/` + engine-specific dirs

**Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/generators/scaffold.ts
git commit -m "feat: update scaffold to reference .harness/ structure"
```

---

## Task 11: Rewrite `index.ts` — new generateAll pipeline

**Files:**
- Modify: `src/generators/index.ts`
- Delete: `src/generators/agentConfig.ts` (replaced by engine adapters)
- Delete: `src/generators/settings.ts` (replaced by engine adapters)

**Step 1: Rewrite `src/generators/index.ts`**

```typescript
import type { ProjectConfig, OutputFile, AIEngine } from '@/types';
import { generateCoreConfig } from './core/config';
import { generateCoreRoles } from './core/roles';
import { generateCoreFlows } from './core/flows';
import { generateCoreConstraints } from './core/constraints';
import { generateClaudeMd } from './engines/claude/claudeMd';
import { generateClaudeCommands } from './engines/claude/commands';
import { generateClaudeHooks, buildClaudeHookRegistrations } from './engines/claude/hooks';
import { generateClaudeSettings } from './engines/claude/settings';
import { generateCursorrules } from './engines/cursor/cursorrules';
import { generateCursorRules } from './engines/cursor/rules';
import { generateCursorMcp } from './engines/cursor/mcp';
import { generateAgentsMd } from './engines/codex/agentsMd';
import { generateCodexSkills } from './engines/codex/skills';
import { generateCodexHookScripts, generateCodexHooksJson } from './engines/codex/hooks';
import { generateCodexConfig } from './engines/codex/config';
import { generateScaffold } from './scaffold';

function generateCore(config: ProjectConfig): OutputFile[] {
  return [
    ...generateCoreConfig(config),
    ...generateCoreRoles(config),
    ...generateCoreFlows(config),
    ...generateCoreConstraints(config),
  ];
}

function generateEngineAdapter(engine: AIEngine, config: ProjectConfig): OutputFile[] {
  switch (engine) {
    case 'claude-code':
      return [
        generateClaudeMd(config),
        ...generateClaudeCommands(config),
        ...generateClaudeHooks(config),
        generateClaudeSettings(config),
      ];
    case 'cursor':
      return [
        generateCursorrules(config),
        ...generateCursorRules(config),
        generateCursorMcp(config),
      ];
    case 'codex':
      return [
        generateAgentsMd(config),
        ...generateCodexSkills(config),
        ...generateCodexHookScripts(config),
        generateCodexHooksJson(config),
        generateCodexConfig(config),
      ];
    case 'custom':
      // Custom engine: only core + scaffold
      return [];
    default:
      return [];
  }
}

export function generateAll(config: ProjectConfig): OutputFile[] {
  const engine = config.architecture.harness.engine;

  return [
    ...generateCore(config),
    ...generateEngineAdapter(engine, config),
    ...generateScaffold(config),
  ];
}

// Re-export for backward compatibility if needed
export { getConfigFilename } from './engines/claude/claudeMd';
```

Note: `getConfigFilename` is currently in `agentConfig.ts` and used by `scaffold.ts`. Move it to `claudeMd.ts` (or a shared util) and update the import in `scaffold.ts`.

**Step 2: Delete old generators**

```bash
rm src/generators/agentConfig.ts
rm src/generators/settings.ts
```

**Step 3: Fix any import errors in scaffold.ts**

Update the `getConfigFilename` import path from `./agentConfig` to the new location.

**Step 4: Verify full build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add -A src/generators/
git commit -m "feat: rewrite generateAll() with core + engine adapter pipeline"
```

---

## Task 12: Update FilePreview for directory tree view

**Files:**
- Modify: `src/components/wizard/FilePreview.tsx`

**Step 1: Update FilePreview to show files in a tree structure**

With ~26 files, the flat list becomes unwieldy. Convert to a directory tree view:
- Group files by directory
- Show indentation for nested paths
- Keep the same preview-on-click behavior

**Step 2: Verify in browser**

Run: `npm run dev`
Navigate to `/wizard/generate` with a template loaded.
Expected: File tree shows `.harness/`, `.claude/`, root files organized by directory.

**Step 3: Commit**

```bash
git add src/components/wizard/FilePreview.tsx
git commit -m "feat: update FilePreview with directory tree view"
```

---

## Task 13: Update generate page summary

**Files:**
- Modify: `src/app/wizard/generate/page.tsx`

**Step 1: Update summary bar**

Show file count by category: "N core files, N engine files, N scaffold files". Also show engine name.

**Step 2: Verify in browser**

Run: `npm run dev`
Expected: Summary shows categorized file counts.

**Step 3: Commit**

```bash
git add src/app/wizard/generate/page.tsx
git commit -m "feat: update generate page summary with categorized counts"
```

---

## Task 14: Manual end-to-end verification

**Step 1: Run dev server**

```bash
npm run dev
```

**Step 2: Test all 3 templates**

For each template (Solo Dev, GStack Sprint, Managed Agents):
1. Select template on `/wizard`
2. Walk through all 5 wizard steps
3. On Generate page, verify:
   - `.harness/` files present (config, roles, flows, constraints)
   - Engine-specific files present (varies by engine)
   - README.md and ARCHITECTURE.md present
   - File contents are correct and complete

**Step 3: Download ZIP and verify structure**

1. Click download
2. Extract ZIP
3. Verify directory structure matches design doc
4. Verify hook scripts have correct content
5. Verify slash commands have correct frontmatter

**Step 4: Run production build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete executable generator system with core + engine adapters"
```
