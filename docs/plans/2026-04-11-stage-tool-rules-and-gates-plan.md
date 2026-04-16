# Stage Tool Rules & Professional Gates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the dead-lock where think stage denies Write/Edit but requires document output, and upgrade each stage with professional default gates.

**Architecture:** Remove Write/Edit from deny lists, let guard.sh's existing path-level enforcement become the primary write control. Expand DEFAULT_STAGE_ARTIFACTS to 3-5 professional gates per stage. This ensures AI can write docs in think/plan but can never touch src/** until build stage.

**Tech Stack:** TypeScript (generators), Bash (guard.sh hooks)

---

### Task 1: Update getStageToolRules — remove Write/Edit from deny, keep path-based control

**Files:**
- Modify: `src/generators/core/constraints.ts:12-31`

**Step 1: Rewrite getStageToolRules**

Current deny lists block Write/Edit entirely in think/plan/review/reflect. Remove Write/Edit from all deny lists — guard.sh's path check (already implemented) will enforce write permissions per path pattern.

Keep Bash denied in think/plan/review/reflect (these stages don't need shell commands).

```typescript
function getStageToolRules(stageName: string): StageToolRules {
  switch (stageName) {
    case 'think':
      return { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Agent'], deny: ['Bash'], writePaths: ['docs/**'] };
    case 'plan':
      return { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Agent'], deny: ['Bash'], writePaths: ['docs/**'] };
    case 'build':
      return { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash', 'Agent'], deny: [], writePaths: ['src/**', 'test/**', 'docs/**'] };
    case 'review':
      return { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit'], deny: ['Bash'], writePaths: ['docs/**'] };
    case 'test':
      return { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash'], deny: [], writePaths: ['test/**', 'docs/**'] };
    case 'ship':
      return { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash'], deny: [], writePaths: ['**'] };
    case 'reflect':
      return { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit'], deny: ['Bash'], writePaths: ['docs/**'] };
    default:
      return { allow: [], deny: [], writePaths: [] };
  }
}
```

**Effect:** think stage can now Write/Edit to `docs/**`, but guard.sh blocks any attempt to write to `src/**`. Same for plan/review/reflect.

**Step 2: Build and verify**

Run: `npx next build`
Expected: build passes with no errors

**Step 3: Commit**

```bash
git add src/generators/core/constraints.ts
git commit -m "fix: remove Write/Edit from deny lists, rely on path-level enforcement in guard.sh"
```

---

### Task 2: Expand DEFAULT_STAGE_ARTIFACTS with professional gates

**Files:**
- Modify: `src/generators/core/stageArtifacts.ts:7-62`

**Step 1: Replace DEFAULT_STAGE_ARTIFACTS**

Expand from 1 artifact per stage to 3-5 professional artifacts. Each gate enforces a meaningful quality checkpoint.

```typescript
export const DEFAULT_STAGE_ARTIFACTS: Record<StageName, OutputArtifact[]> = {
  think: [
    {
      path: 'docs/design/problem-statement.md',
      description: 'Refined problem statement with context, stakeholders, and success criteria',
      verification: 'contains-section',
      sectionMarker: '## Problem Statement',
    },
    {
      path: 'docs/design/scope.md',
      description: 'Scoped boundaries: in-scope, out-of-scope, and constraints',
      verification: 'contains-section',
      sectionMarker: '## Scope',
    },
    {
      path: 'docs/design/success-metrics.md',
      description: 'Quantifiable success metrics and acceptance criteria',
      verification: 'contains-section',
      sectionMarker: '## Success Metrics',
    },
  ],
  plan: [
    {
      path: 'docs/plans/architecture.md',
      description: 'Architecture decision record with component diagram and data flow',
      verification: 'contains-section',
      sectionMarker: '## Architecture',
    },
    {
      path: 'docs/plans/implementation-plan.md',
      description: 'Task breakdown with dependencies and estimated effort',
      verification: 'contains-section',
      sectionMarker: '## Tasks',
    },
    {
      path: 'docs/plans/risk-assessment.md',
      description: 'Risk identification with mitigation strategies',
      verification: 'contains-section',
      sectionMarker: '## Risks',
    },
  ],
  build: [
    {
      path: 'docs/reports/build-report.md',
      description: 'Build report: what was implemented, files changed, design decisions',
      verification: 'contains-section',
      sectionMarker: '## Implementation',
    },
    {
      path: 'docs/reports/build-report.md',
      description: 'Test coverage report for implemented code',
      verification: 'contains-section',
      sectionMarker: '## Test Coverage',
    },
  ],
  review: [
    {
      path: 'docs/reviews/quality-audit.md',
      description: 'Code quality audit: naming, structure, DRY, error handling',
      verification: 'contains-section',
      sectionMarker: '## Quality Findings',
    },
    {
      path: 'docs/reviews/spec-compliance.md',
      description: 'Specification compliance check against plan requirements',
      verification: 'contains-section',
      sectionMarker: '## Compliance',
    },
    {
      path: 'docs/reviews/security-scan.md',
      description: 'Security scan: OWASP top 10, injection, auth, data exposure',
      verification: 'contains-section',
      sectionMarker: '## Security Findings',
    },
  ],
  test: [
    {
      path: 'docs/reports/test-report.md',
      description: 'Test execution results: pass/fail/skip counts per test type',
      verification: 'contains-section',
      sectionMarker: '## Results',
    },
    {
      path: 'docs/reports/test-report.md',
      description: 'Code coverage analysis with uncovered areas',
      verification: 'contains-section',
      sectionMarker: '## Coverage',
    },
  ],
  ship: [
    {
      path: 'docs/releases/release-notes.md',
      description: 'Release notes: changes, breaking changes, migration guide',
      verification: 'contains-section',
      sectionMarker: '## Changes',
    },
    {
      path: 'docs/releases/deployment-checklist.md',
      description: 'Pre-deployment checklist: CI green, version bumped, configs verified',
      verification: 'contains-section',
      sectionMarker: '## Checklist',
    },
  ],
  reflect: [
    {
      path: 'docs/retrospectives/retro-report.md',
      description: 'Retrospective: what went well, what to improve, action items',
      verification: 'contains-section',
      sectionMarker: '## Action Items',
    },
    {
      path: 'docs/retrospectives/lessons-learned.md',
      description: 'Lessons learned for future sprints and team knowledge base',
      verification: 'contains-section',
      sectionMarker: '## Lessons',
    },
  ],
};
```

**Step 2: Build and verify**

Run: `npx next build`
Expected: build passes with no errors

**Step 3: Commit**

```bash
git add src/generators/core/stageArtifacts.ts
git commit -m "feat: expand default stage artifacts to professional multi-gate checkpoints"
```

---

### Task 3: Fix gate ID uniqueness for multi-artifact per same file

**Files:**
- Modify: `src/generators/core/constraints.ts:88-100`

**Context:** When multiple artifacts point to the same file (e.g., build-report.md has 2 sections), the current gate ID generation produces duplicate IDs. The gate ID is `${stage.name}-${filename_without_ext}`, so two artifacts for `build-report.md` would both become `build-build-report`.

**Step 1: Add index to gate ID generation**

In the artifact-based gates loop (line 91-100), append index to ensure uniqueness:

```typescript
    // Artifact-based gates
    for (let j = 0; j < artifacts.length; j++) {
      const artifact = artifacts[j];
      const baseId = artifact.path.split('/').pop()?.replace(/\..*$/, '') ?? 'output';
      const gateId = `${stage.name}-${baseId}${j > 0 ? `-${j}` : ''}`;
      gates.push({
        id: gateId,
        // ... rest unchanged
      });
    }
```

Also update the transition requires loop to use the same ID generation:

```typescript
      const requires: string[] = [];
      for (let j = 0; j < artifacts.length; j++) {
        const artifact = artifacts[j];
        const baseId = artifact.path.split('/').pop()?.replace(/\..*$/, '') ?? 'output';
        const gateId = `${stage.name}-${baseId}${j > 0 ? `-${j}` : ''}`;
        requires.push(gateId);
      }
```

**Step 2: Build and verify**

Run: `npx next build`
Expected: build passes

**Step 3: Commit**

```bash
git add src/generators/core/constraints.ts
git commit -m "fix: ensure gate ID uniqueness for multi-artifact per same file"
```

---

### Task 4: End-to-end verification

**Step 1: Build the project**

Run: `npx next build`
Expected: clean build

**Step 2: Manual smoke test — check generated constraints.json structure**

Start dev server, go through wizard with defaults, check the generate page preview for:
1. `.harness/constraints.json` — exists, has stages with correct allow/deny/writePaths
2. `.harness/state.json` — exists, initialized to first stage
3. Gates per stage — 3-5 professional gates, unique IDs
4. think stage tools.deny — only `["Bash"]`, not `["Write","Edit","Bash"]`

Run: `npm run dev`

**Step 3: Commit if any fixes needed**
