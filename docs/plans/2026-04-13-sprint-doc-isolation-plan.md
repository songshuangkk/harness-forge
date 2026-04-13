# Sprint Document Isolation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure each new sprint creates fresh documents instead of modifying previous sprint's files, using sprint number tracking and robust archiving.

**Architecture:** session-init.sh archives existing artifact files (renamed with sprint number + date suffix) before creating a new state.json. Commands instruct AI to create new files instead of appending. Archive source changes from constraints.json gate patterns to stage-artifacts.json manifest.

**Tech Stack:** TypeScript (generators), Bash (session-init.sh shell script template)

---

### Task 1: Rewrite archive logic in sessionScripts.ts

**Files:**
- Modify: `src/generators/engines/claude/sessionScripts.ts:114-149` (archive block)
- Modify: `src/generators/engines/claude/sessionScripts.ts:151-177` (state.json init block)

**Step 1: Replace the archive block**

In `sessionScripts.ts`, replace the archive section (lines 114-149) with the new logic that:

1. Reads sprint number from existing state.json (defaults to 0 if missing)
2. Reads `stage-artifacts.json` instead of `constraints.json` for artifact paths
3. Archives whenever state.json exists (no `started_at` dependency)
4. Uses `{name}.{number}.{date}.{ext}` suffix format

Replace lines 114-149 with:

```typescript
// ── Archive previous sprint artifacts & reset state ──
// Always archives when state.json exists (no started_at dependency).
// Uses stage-artifacts.json as the artifact manifest.
// Suffix format: {name}.{number}.{date}.{ext}
const ARCHIVE_BLOCK = `# ── Archive previous sprint artifacts & reset state ──
if [ -f "$HARNESS/state.json" ] && [ -f "$HARNESS/stage-artifacts.json" ]; then
  PREV_NUMBER=$(jq -r '.sprint.number // 0' "$HARNESS/state.json" 2>/dev/null || echo "0")
  PREV_STARTED=$(jq -r '.sprint.started_at // empty' "$HARNESS/state.json" 2>/dev/null || true)
  if [ -n "$PREV_STARTED" ]; then
    ARCHIVE_DATE=$(echo "$PREV_STARTED" | cut -dT -f1)
  else
    ARCHIVE_DATE=$(date -u +%Y-%m-%d)
  fi
  ARCHIVE_TAG=$(printf "%03d" "$PREV_NUMBER")

  # Extract all unique artifact paths from stage-artifacts.json
  PATTERNS=$(jq -r '[.[] | .[].path] | unique[]' "$HARNESS/stage-artifacts.json" 2>/dev/null || true)
  ARCHIVED_COUNT=0
  for pattern in $PATTERNS; do
    if [ -f "$pattern" ]; then
      DIR=$(dirname "$pattern")
      BASE=$(basename "$pattern")
      NAME="\${BASE%.*}"
      EXT="\${BASE##*.}"
      ARCHIVE_PATH="\${DIR}/\${NAME}.\${ARCHIVE_TAG}.\${ARCHIVE_DATE}.\${EXT}"
      # Handle collision with counter
      COUNTER=1
      while [ -f "$ARCHIVE_PATH" ]; do
        ARCHIVE_PATH="\${DIR}/\${NAME}.\${ARCHIVE_TAG}.\${ARCHIVE_DATE}.\${COUNTER}.\${EXT}"
        COUNTER=$((COUNTER + 1))
      done
      mkdir -p "$DIR"
      mv "$pattern" "$ARCHIVE_PATH"
      ARCHIVED_COUNT=$((ARCHIVED_COUNT + 1))
    fi
  done
  if [ "$ARCHIVED_COUNT" -gt 0 ]; then
    echo "Archived $ARCHIVED_COUNT previous sprint doc(s) as .\${ARCHIVE_TAG}.\${ARCHIVE_DATE}.*"
  fi
  # Remove state.json → triggers fresh creation below (number increments, gates reset)
  rm "$HARNESS/state.json"
  echo "Previous sprint state cleared."
fi`;
```

**Step 2: Update state.json initialization to include sprint.number**

Replace lines 151-177 with:

```typescript
const STATE_INIT_BLOCK = `# Initialize state.json if not present
if [ ! -f "$HARNESS/state.json" ] && [ -f "$HARNESS/constraints.json" ]; then
  # Calculate next sprint number (default 1 if no prior state existed)
  SPRINT_NUMBER=1

  STAGES=$(jq -r '.stages[].name' "$HARNESS/constraints.json")
  FIRST=$(echo "$STAGES" | head -1)
  FIRST_ROLE=$(jq -r ".stages[] | select(.name == \\"$FIRST\\") | .roles[0]" "$HARNESS/constraints.json")
  FIRST_TOOLS=$(jq ".stages[] | select(.name == \\"$FIRST\\") | .tools.allow" "$HARNESS/constraints.json")
  FIRST_PATHS=$(jq ".stages[] | select(.name == \\"$FIRST\\") | .paths.write" "$HARNESS/constraints.json")

  GATES_JSON="{}"
  for s in $STAGES; do
    GATES_JSON=$(echo "$GATES_JSON" | jq --arg s "$s" '. + {($s): {"passed": false, "artifacts": []}}')
  done

  PROJECT=$(jq -r '.project // "unnamed"' "$HARNESS/constraints.json")

  jq -n \\
    --arg p "$PROJECT" \\
    --arg s "$FIRST" \\
    --argjson n "$SPRINT_NUMBER" \\
    --arg r "$FIRST_ROLE" \\
    --argjson t "$FIRST_TOOLS" \\
    --argjson pa "$FIRST_PATHS" \\
    --argjson g "$GATES_JSON" \\
    '{version:1, project:$p, sprint:{current:$s,number:$n,history:[],started_at:""}, role:{current:$r,allowed_tools:$t,allowed_paths:$pa}, gates:$g}' \\
    > "$HARNESS/state.json"

  echo "State machine initialized (sprint #$SPRINT_NUMBER)."
fi`;
```

**Step 3: Integrate into SESSION_INIT_SCRIPT template**

Replace the `SESSION_INIT_SCRIPT` constant to use the new archive block and state init block. The new archive block replaces lines 114-149, the new state init block replaces lines 151-177. The dependency resolution (lines 49-112) and post-init (lines 179-196) stay unchanged.

**Step 4: Verify the generated script compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/generators/engines/claude/sessionScripts.ts
git commit -m "feat(session-scripts): rewrite archive logic with sprint number tracking"
```

---

### Task 2: Update check.sh to display sprint number

**Files:**
- Modify: `src/generators/engines/claude/sessionScripts.ts:5-38` (renderCheckScript function)

**Step 1: Add sprint number to check.sh output**

In `renderCheckScript()`, add a line to display `sprint.number` after the existing STAGE/ROLE lines:

```typescript
NUMBER=$(echo "$STATE" | jq -r '.sprint.number // "N/A"')
```

And add to the display:
```
echo "║ Sprint: #$NUMBER"
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/generators/engines/claude/sessionScripts.ts
git commit -m "feat(check-script): display sprint number in harness status"
```

---

### Task 3: Change command artifact instructions to "create new"

**Files:**
- Modify: `src/generators/engines/claude/commands.ts:127` (build process)
- Modify: `src/generators/engines/claude/commands.ts:170` (review process)
- Modify: `src/generators/engines/claude/commands.ts:190` (test process)

**Step 1: Update build process**

In `generateBuildProcess()`, change line 127 from:

```
Create or **update** the build report at \`docs/reports/build-report.md\`. If the file already exists from a previous task, **append** new entries \u2014 do not overwrite previous content.
```

To:

```
Create a **new** build report at \`docs/reports/build-report.md\`. If the file already exists, run \`bash .claude/scripts/session-init.sh\` to archive the previous sprint first, then retry.
```

**Step 2: Update review process**

In `STATIC_COMMANDS.review.process`, change line 170 from:

```
Create or **update** the review report at \`docs/reviews/review-report.md\`. If the file already exists, **append** new findings \u2014 do not overwrite previous sections.
```

To:

```
Create a **new** review report at \`docs/reviews/quality-audit.md\`. If the file already exists, run \`bash .claude/scripts/session-init.sh\` to archive the previous sprint first, then retry.
```

**Step 3: Update test process**

In `STATIC_COMMANDS.test.process`, change lines 190-194 from:

```
Create or **update** the test report at \`docs/reports/test-report.md\`. If the file already exists, **append** new results \u2014 do not overwrite previous test runs.
```

To:

```
Create a **new** test report at \`docs/reports/test-report.md\`. If the file already exists, run \`bash .claude/scripts/session-init.sh\` to archive the previous sprint first, then retry.
```

**Step 4: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/generators/engines/claude/commands.ts
git commit -m "feat(commands): change artifact instructions to create-new instead of append"
```

---

### Task 4: Verify end-to-end behavior

**Step 1: Build the project**

Run: `npm run build`
Expected: Successful build with no errors

**Step 2: Run dev server and check generated output**

Run: `npm run dev`

Open the wizard, complete all 5 steps, generate output ZIP. Verify:
1. `.claude/scripts/session-init.sh` contains the new archive logic using `stage-artifacts.json`
2. `.claude/scripts/session-init.sh` creates `sprint.number` field in state.json
3. `.harness/scripts/check.sh` displays sprint number
4. `.claude/commands/think.md`, `build.md`, `review.md`, `test.md` all say "create a **new** file"

**Step 3: Commit final state if any adjustments were needed**

```bash
git add -A
git commit -m "fix: adjust generated output after e2e verification"
```
