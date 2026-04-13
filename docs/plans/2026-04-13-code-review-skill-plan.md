# Code Review Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dynamically generated `/code-review` command to Harness Forge that replaces superpowers:requesting-code-review with a main-agent + on-demand sub-agent workflow.

**Architecture:** New generator `codeReview.ts` reads ReviewConfig + roles + constraints from ProjectConfig, produces a `.claude/commands/code-review.md` slash command. Integrated via `index.ts`. Transition hint added to `hooks.ts`.

**Tech Stack:** TypeScript, Next.js, existing Harness Forge generator patterns

---

### Task 1: Create codeReview.ts — renderScanChecklist

**Files:**
- Create: `src/generators/engines/claude/codeReview.ts`

**Context:**
- `ReviewConfig` (from `src/types/index.ts:91-100`) has fields: `reviewDimensions: string[]`, `autoFix`, `severityThreshold`
- `RoleConfig` has `reviewFocus: string[]`
- `getRolePrompt(roleId, roles)` returns `{ label, reviewFocus, systemPrompt }`

**Step 1: Create the file with imports and renderScanChecklist**

```typescript
import type { ProjectConfig, OutputFile, RoleName, RoleConfig, ReviewConfig } from '@/types';
import { getRolePrompt } from '@/generators/core/rolePrompts';

// ── Scan checklist from roles and dimensions ──

function renderScanChecklist(
  roles: RoleName[],
  configuredRoles: RoleConfig[],
  dimensions: string[]
): string {
  const lines: string[] = ['## Scan Checklist', ''];
  lines.push('Perform a systematic scan across all areas. For each item, mark ✅ or ❌:');

  // Dimension-based checklist
  if (dimensions.length > 0) {
    lines.push('');
    lines.push('### Configured Dimensions');
    for (const dim of dimensions) {
      lines.push(`- [ ] ${dim}`);
    }
  }

  // Role-specific checklist
  if (roles.length > 0) {
    lines.push('');
    lines.push('### Role Focus Areas');
    for (const roleId of roles) {
      const prompt = getRolePrompt(roleId, configuredRoles);
      for (const focus of prompt.reviewFocus) {
        lines.push(`- [ ] **${prompt.label}**: ${focus}`);
      }
    }
  }

  // Always-include checklist
  lines.push('');
  lines.push('### Standard Checks');
  lines.push('- [ ] All planned file paths implemented');
  lines.push('- [ ] No hardcoded secrets or credentials');
  lines.push('- [ ] Error handling covers edge cases');
  lines.push('- [ ] No unused imports or dead code');
  lines.push('- [ ] Consistent naming conventions');

  lines.push('');
  return lines.join('\n');
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/generators/engines/claude/codeReview.ts 2>&1 | head -20`
Expected: May show errors for missing exports — that's OK, we add them in subsequent tasks.

**Step 3: Commit**

```bash
git add src/generators/engines/claude/codeReview.ts
git commit -m "feat(code-review): add renderScanChecklist generator"
```

---

### Task 2: Add renderSpawnProtocol and renderOutputTemplate

**Files:**
- Modify: `src/generators/engines/claude/codeReview.ts`

**Context:**
- `ReviewConfig.severityThreshold` is `'all' | 'critical-major' | 'critical-only'`
- Spawn decision maps: `'critical-only'` → spawn on any Critical, `'critical-major'` → spawn on 3+ Major/Critical, `'all'` → spawn on 5+ total findings
- Sub-agents use `subagent_type: "general-purpose"` (no superpowers dependency)

**Step 1: Add renderSpawnProtocol after renderScanChecklist**

```typescript
// ── Sub-agent spawn protocol ──

function renderSpawnProtocol(severityThreshold: string): string {
  const triggerMap: Record<string, string> = {
    'critical-only': '1+ Critical findings',
    'critical-major': '3+ Critical or Major findings',
    'all': '5+ findings of any severity',
  };
  const trigger = triggerMap[severityThreshold] ?? triggerMap['critical-major'];

  return [
    '## Deep-Dive Protocol',
    '',
    'After completing the scan above, evaluate whether a deep-dive is needed.',
    '',
    `**Spawn trigger**: ${trigger}`,
    '',
    'If triggered, spawn sub-agents for specific domains using the Agent tool:',
    '',
    '| Domain | Agent task | subagent_type |',
    '|--------|-----------|---------------|',
    '| Security | OWASP Top 10 audit, credential exposure, injection vectors | `general-purpose` |',
    '| Architecture | Module coupling, dependency analysis, interface boundaries | `general-purpose` |',
    '| Test coverage | Gap analysis, missing edge cases, assertion quality | `general-purpose` |',
    '',
    '### Spawn Rules',
    '',
    '1. Only spawn for domains where you found Major or Critical issues',
    '2. Use a single message with multiple Agent tool calls to spawn in parallel',
    '3. Each sub-agent receives: the specific findings + file context + verification steps',
    '4. Do NOT use `isolation: "worktree"` — sub-agents need read access to the project',
    '5. Collect all sub-agent results before writing the final report',
    '',
  ].join('\n');
}

// ── Output format template ──

function renderOutputTemplate(autoFix: string): string {
  const autoFixNote = autoFix === 'auto'
    ? '> **Auto-fix enabled**: Fix obvious issues (formatting, simple refactors) during the scan. Log each fix in the report.'
    : '> **Report-only mode**: Document all findings. Do NOT make code changes.';

  return [
    '## Output Format',
    '',
    autoFixNote,
    '',
    'Append your findings to `docs/reviews/review-report.md` using this structure:',
    '',
    '```markdown',
    '## Code Review — {timestamp}',
    '',
    '### Spec Compliance',
    '',
    '| # | Criterion | Status | Notes |',
    '|---|-----------|--------|-------|',
    '| 1 | {acceptance criterion} | ✅/❌ | {detail} |',
    '',
    '### Quality Findings',
    '',
    '| # | Severity | Area | Description | File:Line |',
    '|---|----------|------|-------------|-----------|',
    '| 1 | Critical/Major/Minor | {area} | {description} | {path}:{line} |',
    '',
    '### Deep-Dive Reports',
    '',
    '(If sub-agents were spawned, summarize their findings here)',
    '',
    '### Sign-off',
    '',
    '- [ ] No Critical issues remaining',
    '- [ ] No Major issues remaining (or all triaged)',
    '- [ ] All acceptance criteria met',
    '```',
    '',
  ].join('\n');
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors for this file (unused functions OK for now).

**Step 3: Commit**

```bash
git add src/generators/engines/claude/codeReview.ts
git commit -m "feat(code-review): add spawn protocol and output template renderers"
```

---

### Task 3: Add generateCodeReviewCommand entry function

**Files:**
- Modify: `src/generators/engines/claude/codeReview.ts`

**Context:**
- Review stage in sprint: `config.flow.sprint.find(s => s.name === 'review' && s.enabled)`
- ReviewConfig from stage: `stage.stageConfig as ReviewConfig`
- Roles: `stage.roles`
- Constraints: `config.flow.constraints.filter(c => c.stageId === stage.id || c.stageId === '*')`
- Returns `null` if review stage not enabled

**Step 1: Add the main generator function at end of file**

```typescript
// ── Main generator ──

export function generateCodeReviewCommand(config: ProjectConfig): OutputFile | null {
  const reviewStage = config.flow.sprint.find(
    (s) => s.name === 'review' && s.enabled
  );
  if (!reviewStage) return null;

  const reviewConfig = reviewStage.stageConfig as ReviewConfig | undefined;
  const dimensions = reviewConfig?.reviewDimensions ?? [];
  const autoFix = reviewConfig?.autoFix ?? 'report-only';
  const severity = reviewConfig?.severityThreshold ?? 'critical-major';
  const configuredRoles = config.flow.roles;

  // Stage entry protocol
  const stageEntry = [
    '## Stage Entry (MANDATORY)',
    '',
    'Before doing anything else:',
    '',
    '1. Run: `bash .claude/hooks/transition.sh review`',
    '   - If it fails, DO NOT proceed. Tell the user which gates are blocking.',
    '2. Confirm you are in the **review** stage.',
    '',
  ].join('\n');

  // Two-phase process
  const process = [
    '## Process',
    '',
    '### Phase 1: Spec Compliance',
    '',
    '1. Read `docs/plans/implementation-plan.md` from the Plan stage.',
    '2. For each task in the plan, verify:',
    '   - All file paths exist and contain the expected changes',
    '   - Acceptance criteria are met',
    '   - Verification steps pass',
    '3. Record each as ✅ (pass) or ❌ (fail) with details.',
    '',
    '### Phase 2: Code Quality Scan',
    '',
    '1. Run through the Scan Checklist below.',
    '2. Classify each finding by severity:',
    '   - **Critical**: Security vulnerability, data loss risk, broken core functionality',
    '   - **Major**: Performance degradation, poor error handling, missing tests for critical paths',
    '   - **Minor**: Code style, naming, minor optimization opportunities',
    '3. Evaluate spawn trigger (see Deep-Dive Protocol below).',
    '4. If triggered, spawn sub-agents for the affected domains.',
    '5. Collect sub-agent results.',
    '6. Write the final report to `docs/reviews/review-report.md` (append, do not overwrite).',
    '',
  ].join('\n');

  // Constraints section
  const stageConstraints = config.flow.constraints.filter(
    (c) => c.stageId === reviewStage.id || c.stageId === '*'
  );
  const constraintsSection = ['## Constraints', ''];
  if (stageConstraints.length > 0) {
    for (const c of stageConstraints) {
      const marker = c.enforced ? '[ENFORCED]' : '[advisory]';
      constraintsSection.push(`- ${marker} ${c.description}`);
    }
  } else {
    constraintsSection.push('None.');
  }
  constraintsSection.push('');

  // Assemble the full command
  const parts = [
    '---\ndescription: "Code review — spec compliance + quality audit with on-demand deep-dive agents"\n---\n',
    '# Code Review — Deep Quality Audit\n',
    'Structured code review: spec compliance first, then quality scan with on-demand deep-dive sub-agents.\n',
    stageEntry,
    process,
    renderScanChecklist(reviewStage.roles, configuredRoles, dimensions),
    renderSpawnProtocol(severity),
    renderOutputTemplate(autoFix),
    constraintsSection.join('\n'),
  ];

  return {
    path: '.claude/commands/code-review.md',
    content: parts.join('\n').replace(/\n{3,}/g, '\n\n'),
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean compile.

**Step 3: Commit**

```bash
git add src/generators/engines/claude/codeReview.ts
git commit -m "feat(code-review): add generateCodeReviewCommand entry function"
```

---

### Task 4: Wire into index.ts

**Files:**
- Modify: `src/generators/index.ts:11` (add import)
- Modify: `src/generators/index.ts:58` (add call)

**Step 1: Add import**

In `src/generators/index.ts`, after line 11:

```typescript
import { generateCodeReviewCommand } from './engines/claude/codeReview';
```

**Step 2: Add call in claude-code case**

In `src/generators/index.ts`, after line 58 (`files.push(generateNewTaskCommand());`), add:

```typescript
      const codeReviewCmd = generateCodeReviewCommand(config);
      if (codeReviewCmd) files.push(codeReviewCmd);
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean compile.

**Step 4: Commit**

```bash
git add src/generators/index.ts
git commit -m "feat(code-review): wire codeReview generator into claude-code engine"
```

---

### Task 5: Add transition hint in hooks.ts

**Files:**
- Modify: `src/generators/engines/claude/hooks.ts:455-456`

**Context:**
- `renderTransitionScript()` returns a bash script as a joined string array
- The last echo lines (455-456) are: `'echo "Transitioned: $CURRENT → $TARGET (role: $NEW_ROLE)"'` and `'echo "Run /$TARGET to begin the next stage."'`
- Need to add a conditional hint when target is review

**Step 1: Add review hint after line 456**

Replace:

```typescript
    'echo "Transitioned: $CURRENT → $TARGET (role: $NEW_ROLE)"',
    'echo "Run /$TARGET to begin the next stage."',
```

With:

```typescript
    'echo "Transitioned: $CURRENT → $TARGET (role: $NEW_ROLE)"',
    'echo "Run /$TARGET to begin the next stage."',
    'if [ "$TARGET" = "review" ]; then',
    '  echo "Tip: Run /code-review for a deep code quality audit."',
    'fi',
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean compile.

**Step 3: Commit**

```bash
git add src/generators/engines/claude/hooks.ts
git commit -m "feat(code-review): add /code-review hint on review stage transition"
```

---

### Task 6: Build verification and manual test

**Step 1: Run production build**

Run: `npm run build`
Expected: Clean build with no errors.

**Step 2: Run linter**

Run: `npm run lint`
Expected: No new warnings.

**Step 3: Manual smoke test — start dev server**

Run: `npm run dev`

Open `http://localhost:3000/wizard`, go through the 5-step wizard with review stage enabled, verify that the generated ZIP contains `.claude/commands/code-review.md` with the expected content structure.

**Step 4: Commit**

```bash
git commit --allow-empty -m "chore: code-review skill implementation complete"
```
