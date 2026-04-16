# Stage Action Gates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add real executable command gates to all 7 sprint stages so that stage transitions trigger actual verification commands (lint, typecheck, build, etc.) instead of only checking document existence.

**Architecture:** Extend the existing `command_exit` gate mechanism from test-only to all stages. Add `blockOnFail` to gate definitions for configurable hard-block vs warn-only behavior. Add `LANGUAGE_ACTION_DEFAULTS` for language-specific command inference. Hook scripts (transition.sh, advance.sh) gain `blockOnFail` awareness.

**Tech Stack:** TypeScript, React 19, Next.js 16, Zustand, Bash hooks

---

### Task 1: Add `blockOnFail` to `OutputArtifact` type

**Files:**
- Modify: `src/types/index.ts:130-138`

**Step 1: Update OutputArtifact interface**

In `src/types/index.ts`, add `blockOnFail` to the `OutputArtifact` interface:

```typescript
/** 阶段输出的具体产物，驱动 gate 检查 */
export interface OutputArtifact {
  path: string;
  description: string;
  verification: 'exists' | 'non-empty' | 'contains-section' | 'command';
  sectionMarker?: string;
  /** Command to execute when verification is 'command'. Exit code 0 = pass. */
  command?: string;
  /** For command gates: true = block stage transition on failure, false = warn only. Default: true */
  blockOnFail?: boolean;
}
```

**Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add blockOnFail to OutputArtifact"
```

---

### Task 2: Add command artifacts to `DEFAULT_STAGE_ARTIFACTS`

**Files:**
- Modify: `src/generators/core/stageArtifacts.ts`

**Step 1: Add command gate artifacts to each stage**

Append command-type artifacts to each stage array in `DEFAULT_STAGE_ARTIFACTS`:

```typescript
think: [
  // ... existing file artifacts ...
  {
    path: '.harness/gates/think-docs-valid',
    description: 'Think stage documents have required sections',
    verification: 'command',
    command: '__THINK_VALIDATE__',
    blockOnFail: false,
  },
],
plan: [
  // ... existing file artifacts ...
  {
    path: '.harness/gates/plan-docs-valid',
    description: 'Plan documents have required task breakdown and risks',
    verification: 'command',
    command: '__PLAN_VALIDATE__',
    blockOnFail: false,
  },
],
build: [
  // ... existing file artifacts ...
  {
    path: '.harness/gates/build-lint',
    description: 'Lint check passes with exit code 0',
    verification: 'command',
    command: '__BUILD_LINT__',
    blockOnFail: true,
  },
  {
    path: '.harness/gates/build-typecheck',
    description: 'Type check passes with exit code 0',
    verification: 'command',
    command: '__BUILD_TYPECHECK__',
    blockOnFail: true,
  },
],
review: [
  // ... existing file artifacts ...
  {
    path: '.harness/gates/review-diff-lint',
    description: 'No lint errors in changed files',
    verification: 'command',
    command: '__REVIEW_DIFF_LINT__',
    blockOnFail: true,
  },
],
test: [
  // ... existing artifacts (already has __TEST_COMMAND__) ...
],
ship: [
  // ... existing file artifacts ...
  {
    path: '.harness/gates/ship-build',
    description: 'Production build succeeds',
    verification: 'command',
    command: '__SHIP_BUILD__',
    blockOnFail: true,
  },
],
reflect: [
  // ... existing file artifacts ...
  {
    path: '.harness/gates/reflect-docs-valid',
    description: 'Retrospective documents have required sections',
    verification: 'command',
    command: '__REFLECT_VALIDATE__',
    blockOnFail: false,
  },
],
```

**Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/generators/core/stageArtifacts.ts
git commit -m "feat(artifacts): add command gates to all 7 sprint stages"
```

---

### Task 3: Add `LANGUAGE_ACTION_DEFAULTS` and placeholder resolution

**Files:**
- Modify: `src/generators/core/constraints.ts`

**Step 1: Add `blockOnFail` to `GateDef` interface**

At line 53-60, update the interface:

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

**Step 2: Add `LANGUAGE_ACTION_DEFAULTS` and `VALIDATE_COMMANDS`**

After the existing `LANGUAGE_TEST_DEFAULTS` (around line 283), add:

```typescript
// ── Language-based action command defaults ──

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

// Document validation commands (language-agnostic)
const VALIDATE_COMMANDS: Record<string, string> = {
  think: 'grep -q "## Problem Statement" docs/design/problem-statement.md && grep -q "## Scope" docs/design/scope.md && grep -q "## Success Metrics" docs/design/success-metrics.md',
  plan: 'grep -q "## Tasks" docs/plans/implementation-plan.md && grep -q "## Risks" docs/plans/risk-assessment.md',
  reflect: 'grep -q "## Action Items" docs/retrospectives/retro-report.md',
};
```

**Step 3: Replace the command placeholder resolution in `generateConstraintsJson`**

Find the block at ~line 125-137 that resolves `__TEST_COMMAND__`. Replace it with a unified placeholder resolver:

```typescript
// Command gates: resolve placeholder with tech-stack-specific command
if (artifact.verification === 'command') {
  const lang = config.project.techStack.language;
  const actionDefaults = LANGUAGE_ACTION_DEFAULTS[lang] ?? LANGUAGE_ACTION_DEFAULTS.typescript;
  let resolvedCommand: string;

  // Resolve placeholder → actual command
  const cmd = artifact.command ?? '';
  switch (cmd) {
    case '__TEST_COMMAND__':
      resolvedCommand = LANGUAGE_TEST_DEFAULTS[lang]?.test ?? 'echo "skip"';
      break;
    case '__BUILD_LINT__':
      resolvedCommand = actionDefaults.build_lint ?? 'echo "skip"';
      break;
    case '__BUILD_TYPECHECK__':
      resolvedCommand = actionDefaults.build_typecheck ?? 'echo "skip"';
      break;
    case '__REVIEW_DIFF_LINT__':
      resolvedCommand = actionDefaults.review_diff_lint ?? 'echo "skip"';
      break;
    case '__SHIP_BUILD__':
      resolvedCommand = actionDefaults.ship_build ?? 'echo "skip"';
      break;
    case '__THINK_VALIDATE__':
      resolvedCommand = VALIDATE_COMMANDS.think;
      break;
    case '__PLAN_VALIDATE__':
      resolvedCommand = VALIDATE_COMMANDS.plan;
      break;
    case '__REFLECT_VALIDATE__':
      resolvedCommand = VALIDATE_COMMANDS.reflect;
      break;
    default:
      resolvedCommand = cmd || 'echo "skip"';
  }

  gates.push({
    id: gateId,
    type: 'command_exit',
    pattern: artifact.path,
    description: artifact.description,
    command: resolvedCommand,
    blockOnFail: artifact.blockOnFail ?? true,
  });
  continue;
}
```

**Step 4: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 5: Commit**

```bash
git add src/generators/core/constraints.ts
git commit -m "feat(constraints): add LANGUAGE_ACTION_DEFAULTS and resolve all command placeholders"
```

---

### Task 4: Update `transition.sh` for `blockOnFail` support

**Files:**
- Modify: `src/generators/engines/claude/hooks.ts:409-425`

**Step 1: Update the command gate execution loop in `renderTransitionScript`**

Find the block that runs command gates (starts at `# Run command_exit gates`). Replace the for loop with:

```bash
# Run command_exit gates for current stage (deferred from advance.sh for performance)
COMMAND_GATES=$(jq --arg name "$CURRENT" '[.stages[] | select(.name == $name) | .gates[] | select(.type == "command_exit")]' "$HARNESS/constraints.json" 2>/dev/null)
CMD_COUNT=$(echo "$COMMAND_GATES" | jq 'length' 2>/dev/null)
if [ "$CMD_COUNT" -gt 0 ] 2>/dev/null; then
  for i in $(seq 0 $((CMD_COUNT - 1))); do
    CMD=$(echo "$COMMAND_GATES" | jq -r ".[$i].command // empty" 2>/dev/null)
    CMD_ID=$(echo "$COMMAND_GATES" | jq -r ".[$i].id // empty" 2>/dev/null)
    BLOCK=$(echo "$COMMAND_GATES" | jq -r ".[$i].blockOnFail // true" 2>/dev/null)
    if [ -n "$CMD" ]; then
      echo "[Harness] Running command gate: $CMD"
      if ! eval "$CMD"; then
        if [ "$BLOCK" = "true" ]; then
          echo "BLOCKED: Command gate \"$CMD_ID\" failed: $CMD" >&2
          exit 1
        else
          echo "[Harness] WARNING: Command gate \"$CMD_ID\" failed (non-blocking): $CMD" >&2
          mkdir -p "$HARNESS/log"
          printf '{"ts":"%s","gate":"%s","command":"%s","status":"warn"}\n' \
            "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$CMD_ID" "$CMD" >> "$HARNESS/log/gate-warnings.jsonl"
        fi
      else
        echo "[Harness] Command gate passed: $CMD_ID"
      fi
    fi
  done
fi
```

**Step 2: Verify dev server starts**

Run: `npm run dev`
Expected: Server starts without errors

**Step 3: Commit**

```bash
git add src/generators/engines/claude/hooks.ts
git commit -m "feat(hooks): transition.sh supports blockOnFail for command gates"
```

---

### Task 5: Update `advance.sh` to list pending command gates

**Files:**
- Modify: `src/generators/engines/claude/hooks.ts:318-328`

**Step 1: Enhance the command gate pending message in `renderAdvanceScript`**

Find the block after `if [ "$HAS_COMMAND_GATE" = true ]; then`. Replace with:

```bash
if [ "$HAS_COMMAND_GATE" = true ]; then
  # File gates passed but command gates pending — update artifacts only, not passed flag.
  # transition.sh will run command gates and set passed=true on success.
  echo "$STATE" | jq --arg s "$STAGE" --argjson a "$ARTIFACTS" '.gates[$s].artifacts = $a' > "$HARNESS/state.json.tmp" && mv "$HARNESS/state.json.tmp" "$HARNESS/state.json"
  echo "[Harness] Stage $STAGE file gates passed. Command gates pending — run transition to verify."
  # List pending command gates for visibility
  PENDING_CMDS=$(jq --arg name "$STAGE" -r '.stages[] | select(.name == $name) | .gates[] | select(.type == "command_exit") | "  - \(.id): \(.command) (\(if .blockOnFail // true then "block" else "warn" end))"' "$HARNESS/constraints.json" 2>/dev/null)
  if [ -n "$PENDING_CMDS" ]; then
    echo "$PENDING_CMDS"
  fi
else
  echo "$STATE" | jq --arg s "$STAGE" --argjson a "$ARTIFACTS" '.gates[$s].passed = true | .gates[$s].artifacts = $a' > "$HARNESS/state.json.tmp" && mv "$HARNESS/state.json.tmp" "$HARNESS/state.json"
  echo "[Harness] Stage $STAGE gates PASSED. Ready to advance with next slash command."
fi
```

**Step 2: Verify dev server starts**

Run: `npm run dev`
Expected: Server starts without errors

**Step 3: Commit**

```bash
git add src/generators/engines/claude/hooks.ts
git commit -m "feat(hooks): advance.sh lists pending command gates with block/warn status"
```

---

### Task 6: Visual verification — generate output and verify constraints.json

**Files:** None (verification only)

**Step 1: Start dev server and run through wizard**

Run: `npm run dev`

1. Open `http://localhost:3000/wizard`
2. Fill Project Basics (name, TypeScript)
3. Skip through Architecture
4. Verify Flow page shows stages with config options
5. Skip through Integration
6. On Generate page, open the `.harness/constraints.json` file preview

**Step 2: Verify constraints.json contains expected content**

Check that the generated `constraints.json` includes:
- Each stage has command_exit gates in its `gates` array
- `build` stage has two command gates: `build-lint` and `build-typecheck`
- Command values are resolved (not placeholders) — e.g., `"npm run lint"` for TypeScript
- `blockOnFail` field is present on command gates
- `review` has `review-diff-lint` gate
- `ship` has `ship-build` gate
- `think`, `plan`, `reflect` have validation gates with `blockOnFail: false`
- `test` still has its existing `__TEST_COMMAND__` gate (resolved to `npm test`)

**Step 3: Download ZIP and verify hook scripts**

1. Download the generated ZIP
2. Extract and open `.claude/hooks/transition.sh`
3. Verify the command gate loop reads `blockOnFail` and handles both block and warn cases
4. Open `.claude/hooks/advance.sh`
5. Verify it lists pending command gates with block/warn labels

**Step 4: Commit (no code changes, just verification)**

No commit needed — this is a verification step.

---

### Task 7: Add Stage Actions display to Generate page

**Files:**
- Modify: `src/app/wizard/generate/page.tsx`

**Step 1: Add Stage Actions preview section**

Add a collapsible section above the file preview that shows inferred stage actions. This section reads from the generated `constraints.json` output file and displays each stage's command gates.

This is a read-only display for now — users see what commands will run at each stage. Full editing (actionOverrides) can be added later.

Add a `StageActionsPreview` component that:
1. Finds `.harness/constraints.json` in the generated files
2. Parses the JSON to extract command_exit gates per stage
3. Displays them in a table: Stage | Gate ID | Command | Block/Warn

```tsx
function StageActionsPreview({ files }: { files: OutputFile[] }) {
  const constraintsFile = files.find(f => f.path === '.harness/constraints.json');
  if (!constraintsFile) return null;

  try {
    const constraints = JSON.parse(constraintsFile.content);
    const actionGates: { stage: string; id: string; command: string; block: boolean }[] = [];
    for (const stage of constraints.stages ?? []) {
      for (const gate of stage.gates ?? []) {
        if (gate.type === 'command_exit') {
          actionGates.push({
            stage: stage.name,
            id: gate.id,
            command: gate.command,
            block: gate.blockOnFail ?? true,
          });
        }
      }
    }
    if (actionGates.length === 0) return null;

    return (
      <div className="rounded-xl border border-border/40 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">Stage Actions</p>
        <p className="text-xs text-ink-muted">Commands that will execute during stage transitions</p>
        <div className="space-y-2">
          {actionGates.map((gate) => (
            <div key={gate.id} className="flex items-center gap-3 text-xs">
              <span className="w-16 font-mono text-ink-muted shrink-0">{gate.stage}</span>
              <code className="flex-1 font-mono text-[11px] bg-muted/50 rounded px-2 py-1 truncate">{gate.command}</code>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${gate.block ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {gate.block ? 'Block' : 'Warn'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  } catch {
    return null;
  }
}
```

Place `<StageActionsPreview files={files} />` above the `<FilePreview>` component in the Generate page.

**Step 2: Verify in browser**

Run: `npm run dev`
1. Navigate through wizard to Generate page
2. Verify Stage Actions section appears
3. Verify it lists all command gates with correct commands and block/warn badges
4. Verify changing language in Project Basics changes the inferred commands

**Step 3: Commit**

```bash
git add src/app/wizard/generate/page.tsx
git commit -m "feat(generate): add Stage Actions preview with command gates display"
```

---

## File Change Summary

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `blockOnFail?: boolean` to `OutputArtifact` |
| `src/generators/core/stageArtifacts.ts` | Add command artifacts to all 7 stages |
| `src/generators/core/constraints.ts` | Add `blockOnFail` to `GateDef`, add `LANGUAGE_ACTION_DEFAULTS`, `VALIDATE_COMMANDS`, update placeholder resolution |
| `src/generators/engines/claude/hooks.ts` | Update `transition.sh` for `blockOnFail`, update `advance.sh` to list pending gates |
| `src/app/wizard/generate/page.tsx` | Add `StageActionsPreview` component |

## Dependency Chain

```
Task 1 (types) → Task 2 (artifacts) → Task 3 (constraints) → Task 4 (transition.sh)
                                                            → Task 5 (advance.sh)
Task 6 (verification) — depends on Tasks 1-5
Task 7 (UI) — depends on Task 6
```
