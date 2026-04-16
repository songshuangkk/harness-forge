# Stage Tracker + Gate Hooks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire `.harness/` gate scripts into `settings.json` hooks with stage-awareness so they only enforce during the correct sprint stage.

**Architecture:** Add a `.harness/current-stage` file as stage tracker. Gate scripts read this file before enforcing — mismatched stages exit 0 (pass). Each `/command` updates the file on completion. This bridges the gap between Claude Code's event-based hooks and the sprint stage model.

**Tech Stack:** TypeScript, Bash, Next.js generator pipeline (no test framework)

**Design doc:** `docs/plans/2026-04-10-stage-tracker-gate-hooks-design.md`

---

### Task 1: Add stage-awareness header to gate scripts

**Files:**
- Modify: `src/generators/engines/claude/gateRenderer.ts:100-165`

**Step 1: Update `renderGateScript` to inject stage-awareness header**

In `gateRenderer.ts`, the gate script section (non-`constraint-check` branch) builds `lines` array starting at line 142. Add a stage-awareness block before the `BLOCKED=0` line. The stage name is derived from the gate name (e.g., `build-gate` → `build`).

In the `renderGateScript` function, after the `constraint-check` early return (around line 98), the gate script builder starts. Add stage extraction and header injection:

```typescript
// Gate scripts: check artifacts with BLOCKED counter
const checkBlocks: string[] = [];

// Extract stage name from gate name (e.g., "build-gate" -> "build")
const stageMatch = name.match(/^(.+)-gate$/);
const stageName = stageMatch ? stageMatch[1] : null;
```

Then in the `lines` array construction (currently starting at line 142), add the stage-awareness block right after `set -uo pipefail`:

```typescript
const lines = [
  '#!/usr/bin/env bash',
  `# ${name}.sh — Gate verification`,
  `# Generated from checks: ${sourceIds}`,
  `# Stages: ${stages}`,
  '# Exit 0 = pass, exit 2 = block.',
  '',
  'set -uo pipefail',
  '',
];

// Add stage-awareness if this is a stage gate
if (stageName) {
  lines.push(
    `# Stage awareness: only enforce when current stage matches`,
    `STAGE_FILE=".harness/current-stage"`,
    `CURRENT=$(cat "$STAGE_FILE" 2>/dev/null || echo "idle")`,
    `if [ "$CURRENT" != "${stageName}" ]; then`,
    `  exit 0`,
    `fi`,
    ``,
  );
}

lines.push(
  'BLOCKED=0',
  '',
  checkBlocks.join('\n\n'),
  // ... rest unchanged
);
```

**Step 2: Verify with dev build**

Run: `npm run build`
Expected: Build succeeds, no TypeScript errors.

**Step 3: Commit**

```bash
git add src/generators/engines/claude/gateRenderer.ts
git commit -m "feat: add stage-awareness header to gate scripts"
```

---

### Task 2: Register gate hooks in settings.json

**Files:**
- Modify: `src/generators/engines/claude/hooks.ts:46-49`

**Step 1: Update `buildClaudeHookRegistrations` to register stage gates**

Replace the comment block at lines 46-49 with actual registration logic. Import `buildGateChecks` and `gateScriptPath` (already imported via `generateClaudeHooks`).

Add after the `constraint-check.sh` registration block (after line 44):

```typescript
// Register stage gate scripts with stage-awareness
const gateChecks = buildGateChecks(config);
for (const [gateName, checks] of gateChecks) {
  // Skip constraint-check (already registered above)
  if (gateName === 'constraint-check') continue;
  // Only register gates that have actual checks
  if (checks.length === 0) continue;

  const scriptPath = gateScriptPath(gateName);
  if (!registrations['PreToolUse']) {
    registrations['PreToolUse'] = [];
  }
  for (const matcher of ['Bash', 'Write', 'Edit']) {
    registrations['PreToolUse'].push({
      matcher,
      hooks: [{ type: 'command', command: scriptPath }],
    });
  }
}
```

Also add the import at the top of the file:

```typescript
import { buildGateChecks } from './gateBuilder';
import { gateScriptPath } from './gateRenderer';
```

**Step 2: Verify with dev build**

Run: `npm run build`
Expected: Build succeeds. Generated `settings.json` should now contain gate hook entries.

**Step 3: Commit**

```bash
git add src/generators/engines/claude/hooks.ts
git commit -m "feat: register stage gate hooks in settings.json"
```

---

### Task 3: Append stage transition step to commands

**Files:**
- Modify: `src/generators/engines/claude/commands.ts:500-518`

**Step 1: Add stage transition section to each command's content**

In the `generateClaudeCommands` function, after the `parts` array construction (around line 501) and before `files.push`, add a stage transition section:

```typescript
// Stage transition step
const transitionSection = [
  '## Stage Transition',
  '',
  'After completing all steps above:',
  `1. Write \`${stage.name}\` to \`.harness/current-stage\``,
  '2. This signals to gate hooks that subsequent operations are in this stage.',
  '',
].join('\n');
```

Insert `transitionSection` into the `parts` array, after `configSection`:

```typescript
const parts = [
  frontmatter,
  `# ${title}`,
  '',
  description,
  '',
  process,
  '',
  roleSection,
  gatesSection.join('\n'),
  constraintsSection.join('\n'),
  configSection,
  transitionSection,
].filter((p) => p !== '');
```

**Step 2: Verify with dev build**

Run: `npm run build`
Expected: Build succeeds. Generated command `.md` files should contain "Stage Transition" section.

**Step 3: Commit**

```bash
git add src/generators/engines/claude/commands.ts
git commit -m "feat: append stage transition step to sprint commands"
```

---

### Task 4: Generate `.harness/current-stage` scaffold file

**Files:**
- Modify: `src/generators/scaffold.ts:9-14`

**Step 1: Add stage tracker file to scaffold output**

In `generateScaffold`, add a second file to the return array:

```typescript
export function generateScaffold(config: ProjectConfig): OutputFile[] {
  return [
    generateReadme(config),
    generateArchitectureDoc(config),
    generateStageTracker(),
  ];
}
```

Add the generator function at the bottom of the file:

```typescript
function generateStageTracker(): OutputFile {
  return {
    path: '.harness/current-stage',
    content: 'idle',
  };
}
```

**Step 2: Verify with dev build**

Run: `npm run build`
Expected: Build succeeds. Generated ZIP should contain `.harness/current-stage` with content `idle`.

**Step 3: Commit**

```bash
git add src/generators/scaffold.ts
git commit -m "feat: generate .harness/current-stage scaffold file"
```

---

### Task 5: End-to-end verification

**Step 1: Run full build and dev server**

Run: `npm run build && npm run dev`

**Step 2: Manual smoke test**

1. Open `localhost:3000`
2. Select any template (e.g., gstack-sprint)
3. Go through wizard to Generate step
4. Verify in preview that:
   - `.harness/current-stage` file exists with content `idle`
   - `settings.json` contains gate hook registrations (`build-gate.sh`, `review-gate.sh`, `ship-gate.sh`)
   - Each gate script (e.g., `build-gate.sh`) starts with stage-awareness block reading `.harness/current-stage`
   - Each command `.md` file (e.g., `build.md`) contains "Stage Transition" section

**Step 3: Final commit (if any lint fixes needed)**

```bash
npm run lint
git add -A
git commit -m "feat: complete stage tracker + gate hooks wiring"
```
