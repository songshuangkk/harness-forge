# Stage Tracker + Gate Hooks Design

**Date**: 2026-04-10

## Problem

Gate scripts (`build-gate.sh`, `review-gate.sh`, `ship-gate.sh`) are generated but not mounted in `settings.json`. The reason: hooks fire on `PreToolUse`/`PostToolUse` events regardless of sprint stage, so a build-gate checking for `build-report.md` would block ALL commands during the think stage.

## Solution

Add a stage tracking file (`.harness/current-stage`) that gate scripts read before enforcing checks.

## Design

### 1. Stage Tracker File

- Path: `.harness/current-stage`
- Initial value: `idle` (written at generation time)
- Updated by each stage command upon completion
- Content: single line with the stage name (`think`, `plan`, `build`, `review`, `test`, `ship`, `reflect`)

### 2. Gate Script Changes (`gateRenderer.ts`)

Each gate script gets a stage-awareness header:

```bash
STAGE_FILE=".harness/current-stage"
CURRENT=$(cat "$STAGE_FILE" 2>/dev/null || echo "idle")
if [ "$CURRENT" != "{stage_name}" ]; then
  exit 0
fi
```

- `constraint-check.sh` — unchanged (global, no stage awareness needed)
- `{stage}-gate.sh` — checks `current-stage` matches before enforcing

### 3. Hook Registration (`hooks.ts`)

Register stage gates in `buildClaudeHookRegistrations`:

- Each `{stage}-gate.sh` → `PreToolUse` with matchers `Bash`, `Write`, `Edit`
- Remove the comment block that explicitly skips gate registration

### 4. Command Stage Transition (`commands.ts`)

Append to each stage command's process:

```markdown
## Stage Transition

After completing all steps above:
1. Write the stage name to `.harness/current-stage`
2. This signals to gate hooks that subsequent operations are in this stage.
```

### 5. Relationship to `.harness/`

`.harness/` remains the blueprint / design-time source. Commands embed its definitions at generation time. No runtime reads from `.harness/flows/` needed.

## Files Changed

| File | Change |
|------|--------|
| `src/generators/engines/claude/gateRenderer.ts` | Add stage-awareness header to gate scripts |
| `src/generators/engines/claude/hooks.ts` | Register gate hooks in settings.json |
| `src/generators/engines/claude/commands.ts` | Append stage transition step to each command |
| `src/generators/scaffold.ts` | Generate `.harness/current-stage` with initial value `idle` |

## Not Changed

- Types, templates, other engine adapters (cursor, codex)
- `constraint-check.sh` behavior
- `gateBuilder.ts` logic
