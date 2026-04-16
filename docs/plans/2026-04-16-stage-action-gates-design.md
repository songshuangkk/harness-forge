# Stage Action Gates Design

**Date**: 2026-04-16
**Status**: Approved

## Problem

All 7 sprint stages (Think → Plan → Build → Review → Test → Ship → Reflect) currently only produce documentation artifacts. Gates only check file existence/contents. No real commands are executed to verify code quality, build integrity, or test results — except the test stage's `command_exit` gate.

## Solution

Extend the existing `command_exit` gate mechanism to all 7 stages. Each stage gets predefined command gates with language-specific defaults inferred from tech stack. Users can customize commands and block/warn behavior in the Generate preview step.

## Data Structure Changes

### OutputArtifact (types/index.ts)

Add `blockOnFail` field:

```typescript
export interface OutputArtifact {
  path: string;
  description: string;
  verification: 'exists' | 'non-empty' | 'contains-section' | 'command';
  sectionMarker?: string;
  command?: string;
  blockOnFail?: boolean;  // default true
}
```

### GateDef (constraints.ts)

Add `blockOnFail` field:

```typescript
interface GateDef {
  id: string;
  type: 'file_exists' | 'file_nonempty' | 'file_contains' | 'command_exit';
  pattern: string;
  description: string;
  marker?: string;
  command?: string;
  blockOnFail?: boolean;
}
```

### StageConfig actionOverrides

User customizations stored in `stageConfig.actionOverrides`:

```typescript
interface ActionOverride {
  command?: string;
  blockOnFail?: boolean;
}

// stageConfig.actionOverrides: Record<string, ActionOverride>
// e.g. { build_lint: { command: 'pnpm lint', blockOnFail: true } }
```

## Stage Default Actions

| Stage | Gate ID | Placeholder | Default (TypeScript) | blockOnFail |
|-------|---------|-------------|---------------------|-------------|
| Think | `think-docs-valid` | `__THINK_VALIDATE__` | `grep -q '## Problem Statement' docs/design/problem-statement.md && grep -q '## Scope' docs/design/scope.md && grep -q '## Success Metrics' docs/design/success-metrics.md` | false |
| Plan | `plan-docs-valid` | `__PLAN_VALIDATE__` | `grep -q '## Tasks' docs/plans/implementation-plan.md && grep -q '## Risks' docs/plans/risk-assessment.md` | false |
| Build | `build-lint` | `__BUILD_LINT__` | `npm run lint` | true |
| Build | `build-typecheck` | `__BUILD_TYPECHECK__` | `npx tsc --noEmit` | true |
| Review | `review-diff-lint` | `__REVIEW_DIFF_LINT__` | `npx eslint $(git diff --name-only HEAD~1 -- "*.ts" "*.tsx")` | true |
| Test | *(existing)* | `__TEST_COMMAND__` | `npm test` | true |
| Ship | `ship-build` | `__SHIP_BUILD__` | `npm run build` | true |
| Reflect | `reflect-docs-valid` | `__REFLECT_VALIDATE__` | `grep -q '## Action Items' docs/retrospectives/retro-report.md` | false |

## LANGUAGE_ACTION_DEFAULTS

```typescript
const LANGUAGE_ACTION_DEFAULTS: Record<string, Record<string, string>> = {
  typescript: {
    build_lint: 'npm run lint',
    build_typecheck: 'npx tsc --noEmit',
    review_diff_lint: 'npx eslint $(git diff --name-only HEAD~1 -- "*.ts" "*.tsx")',
    ship_build: 'npm run build',
  },
  javascript: {
    build_lint: 'npm run lint',
    review_diff_lint: 'npx eslint $(git diff --name-only HEAD~1 -- "*.js" "*.jsx")',
    ship_build: 'npm run build',
  },
  python: {
    build_lint: 'ruff check .',
    build_typecheck: 'mypy .',
    review_diff_lint: 'ruff check $(git diff --name-only HEAD~1 -- "*.py")',
    ship_build: 'python -m build',
  },
  go: {
    build_lint: 'golangci-lint run ./...',
    build_typecheck: 'go vet ./...',
    review_diff_lint: 'golangci-lint run $(git diff --name-only HEAD~1 -- "*.go")',
    ship_build: 'go build ./...',
  },
  java: {
    build_lint: './mvnw checkstyle:check',
    build_typecheck: './mvnw compile',
    review_diff_lint: './mvnw checkstyle:check',
    ship_build: './mvnw package -DskipTests',
  },
  rust: {
    build_lint: 'cargo clippy -- -D warnings',
    build_typecheck: 'cargo check',
    review_diff_lint: 'cargo clippy -- -D warnings',
    ship_build: 'cargo build --release',
  },
  dart: {
    build_lint: 'dart analyze',
    review_diff_lint: 'dart analyze $(git diff --name-only HEAD~1 -- "*.dart")',
    ship_build: 'flutter build apk',
  },
};
```

Document validation commands (Think/Plan/Reflect) are language-agnostic — they check markdown files.

## Placeholder Resolution

Extend the existing `__TEST_COMMAND__` resolution to a unified placeholder system:

```typescript
const COMMAND_PLACEHOLDERS: Record<string, (lang: string) => string> = {
  __TEST_COMMAND__:       (lang) => LANGUAGE_TEST_DEFAULTS[lang]?.test ?? 'echo "skip"',
  __BUILD_LINT__:         (lang) => LANGUAGE_ACTION_DEFAULTS[lang]?.build_lint ?? 'echo "skip"',
  __BUILD_TYPECHECK__:    (lang) => LANGUAGE_ACTION_DEFAULTS[lang]?.build_typecheck ?? 'echo "skip"',
  __REVIEW_DIFF_LINT__:  (lang) => LANGUAGE_ACTION_DEFAULTS[lang]?.review_diff_lint ?? 'echo "skip"',
  __SHIP_BUILD__:         (lang) => LANGUAGE_ACTION_DEFAULTS[lang]?.ship_build ?? 'echo "skip"',
  __THINK_VALIDATE__:    () => VALIDATE_COMMANDS.think,
  __PLAN_VALIDATE__:      () => VALIDATE_COMMANDS.plan,
  __REFLECT_VALIDATE__:  () => VALIDATE_COMMANDS.reflect,
};
```

Priority: user `actionOverrides` > tech stack inference > `echo "skip"` default.

## Hook Script Changes

### transition.sh

Read `blockOnFail` from each command gate. If command fails:
- `blockOnFail: true` → `exit 1` (hard block, existing behavior)
- `blockOnFail: false` → log warning to `.harness/log/gate-warnings.jsonl`, continue

### advance.sh

No structural change. Enhanced messaging when command gates are pending — list them with their commands.

### guard.sh / emit-event.sh

No changes needed.

## Generate Page Changes

Add "Stage Actions" section to the Generate preview:
- List all command gates per stage
- Editable command input field
- Block/Warn toggle switch
- Edits stored in `stageConfig.actionOverrides` in Zustand store
- Changes reflected in generated `constraints.json`
