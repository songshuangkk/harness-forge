import type { ProjectConfig, OutputFile } from '@/types';

// ── State machine check script ──

function renderCheckScript(): string {
  return `#!/usr/bin/env bash
# check.sh — Display current harness state machine status
set -uo pipefail

HARNESS=".harness"

if [ ! -f "$HARNESS/state.json" ]; then
  echo "Harness not initialized. Run: bash .claude/scripts/session-init.sh"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  cat "$HARNESS/state.json"
  exit 0
fi

STATE=$(cat "$HARNESS/state.json")
STAGE=$(echo "$STATE" | jq -r '.sprint.current')
ROLE=$(echo "$STATE" | jq -r '.role.current')
NUMBER=$(echo "$STATE" | jq -r '.sprint.number // "N/A"')
HISTORY=$(echo "$STATE" | jq -r '.sprint.history | join(" → ")')

echo "╔══════════════════════════════════════╗"
echo "║        Harness State Machine         ║"
echo "╠══════════════════════════════════════╣"
echo "║ Sprint: #$NUMBER"
echo "║ Stage:  $STAGE"
echo "║ Role:   $ROLE"
echo "║ History: \${HISTORY:-none}"
echo "╠══════════════════════════════════════╣"
echo "║ Gates:"
echo "$STATE" | jq -r '.gates | to_entries[] | "║   \(.key): \(if .value.passed then "✅ PASSED" else "❌ pending" end)"'
echo "╚══════════════════════════════════════╝"
`;
}

// ── Session init script (all modes) ──

const SESSION_INIT_SCRIPT = `#!/usr/bin/env bash
# session-init.sh — Initialize harness state machine
# Only requires: jq, git (no yq needed — constraints are JSON)
set -euo pipefail

HARNESS=".harness"

# ── Dependency resolution ──
REQUIRED_DEPS=(jq git)
MISSING=()

for cmd in "\${REQUIRED_DEPS[@]}"; do
  if ! command -v "$cmd" &>/dev/null; then
    MISSING+=("$cmd")
  fi
done

if [ \${#MISSING[@]} -gt 0 ]; then
  echo "Missing required dependencies: \${MISSING[*]}"

  # Try auto-install
  if command -v brew &>/dev/null; then
    echo ""
    echo "Homebrew detected. Installing missing dependencies..."
    brew install \${MISSING[@]/git/} 2>/dev/null || true
    # git is typically pre-installed; install via Xcode CLT on macOS
    if ! command -v git &>/dev/null; then
      echo "git not found. Install via: xcode-select --install"
    fi

    # Re-check after install
    STILL_MISSING=()
    for cmd in "\${MISSING[@]}"; do
      if ! command -v "$cmd" &>/dev/null; then
        STILL_MISSING+=("$cmd")
      fi
    done

    if [ \${#STILL_MISSING[@]} -gt 0 ]; then
      echo "FATAL: Auto-install failed for: \${STILL_MISSING[*]}"
      echo "Install manually: brew install jq git"
      exit 1
    fi
    echo "Dependencies installed successfully."
  elif command -v apt-get &>/dev/null; then
    echo ""
    echo "apt detected. Attempting to install..."
    sudo apt-get update -qq && sudo apt-get install -y -qq jq git 2>/dev/null || true

    # Re-check after install
    STILL_MISSING=()
    for cmd in "\${MISSING[@]}"; do
      if ! command -v "$cmd" &>/dev/null; then
        STILL_MISSING+=("$cmd")
      fi
    done

    if [ \${#STILL_MISSING[@]} -gt 0 ]; then
      echo "FATAL: Auto-install failed for: \${STILL_MISSING[*]}"
      echo "Install manually: sudo apt-get install jq git"
      exit 1
    fi
    echo "Dependencies installed successfully."
  else
    echo "FATAL: No supported package manager found."
    echo "Install manually:"
    echo "  macOS:  brew install jq git"
    echo "  Ubuntu: sudo apt-get install jq git"
    exit 1
  fi
fi

# ── Archive previous sprint artifacts & reset state ──
# If state.json exists (previous sprint ran):
#   1. Read sprint number and started_at for archive naming
#   2. Rename artifact docs with sprint number + date suffix
#   3. Remove state.json so it gets re-created fresh below
if [ -f "$HARNESS/state.json" ] && [ -f "$HARNESS/stage-artifacts.json" ]; then
  PREV_NUMBER=$(jq -r '.sprint.number // 0' "$HARNESS/state.json" 2>/dev/null || echo "0")
  PREV_STARTED=$(jq -r '.sprint.started_at // empty' "$HARNESS/state.json" 2>/dev/null || true)
  if [ -n "$PREV_STARTED" ]; then
    ARCHIVE_DATE=$(echo "$PREV_STARTED" | cut -dT -f1)
  else
    ARCHIVE_DATE=$(date -u +%Y-%m-%d)
  fi
  ARCHIVE_TAG=$(printf "%03d" "$PREV_NUMBER")
  PATTERNS=$(jq -r '[.[] | .[].path] | unique[]' "$HARNESS/stage-artifacts.json" 2>/dev/null || true)
  ARCHIVED_COUNT=0
  for pattern in $PATTERNS; do
    if [ -f "$pattern" ]; then
      DIR=$(dirname "$pattern")
      BASE=$(basename "$pattern")
      NAME="\${BASE%.*}"
      EXT="\${BASE##*.}"
      ARCHIVE_PATH="\${DIR}/\${NAME}.\${ARCHIVE_TAG}.\${ARCHIVE_DATE}.\${EXT}"
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
  rm "$HARNESS/state.json"
  echo "Previous sprint state cleared."
fi

# Initialize state.json if not present
if [ ! -f "$HARNESS/state.json" ] && [ -f "$HARNESS/constraints.json" ]; then
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
  SPRINT_NUMBER=$(( \${PREV_NUMBER:-0} + 1 ))

  jq -n \\
    --arg p "$PROJECT" \\
    --arg s "$FIRST" \\
    --arg r "$FIRST_ROLE" \\
    --argjson t "$FIRST_TOOLS" \\
    --argjson pa "$FIRST_PATHS" \\
    --argjson g "$GATES_JSON" \\
    --argjson n "$SPRINT_NUMBER" \\
    '{version:1, project:$p, sprint:{number:$n,current:$s,history:[],started_at:""}, role:{current:$r,allowed_tools:$t,allowed_paths:$pa}, gates:$g}' \\
    > "$HARNESS/state.json"

  echo "State machine initialized (sprint #$SPRINT_NUMBER)."
fi

# Write started_at timestamp
if [ -f "$HARNESS/state.json" ]; then
  jq --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '.sprint.started_at = $t' \\
    "$HARNESS/state.json" > "$HARNESS/state.json.tmp" \\
    && mv "$HARNESS/state.json.tmp" "$HARNESS/state.json"
fi

# Create session directory and runtime directories
mkdir -p .claude/sessions
mkdir -p "$HARNESS/log"

# Also init legacy files for backward compat
echo "$(jq -r '.sprint.current' "$HARNESS/state.json" 2>/dev/null || echo 'think')" > .harness/current-stage 2>/dev/null || true
echo "$(jq -r '.role.current' "$HARNESS/state.json" 2>/dev/null || echo 'ceo')" > .harness/current-role 2>/dev/null || true

echo ""
echo "Harness initialized. Start with: /think"
echo "Check status anytime: bash .harness/scripts/check.sh"
`;

// ── Local-file session save ──

function generateLocalFileSaveScript(eventRetention: number): string {
  return `#!/usr/bin/env bash
# session-save.sh — Save event to local file session storage
set -uo pipefail

SESSION_DIR=".claude/sessions"
EVENT_LOG="\${SESSION_DIR}/events.log"

mkdir -p "\$SESSION_DIR"

# Read stdin for event data
EVENT=\$(cat || true)

# Append event with timestamp
echo "\$(date -u +%Y-%m-%dT%H:%M:%SZ) \${EVENT}" >> "\$EVENT_LOG"

# Rotate if exceeding retention limit
LINE_COUNT=\$(wc -l < "\$EVENT_LOG" | tr -d ' ')
if [ "\$LINE_COUNT" -gt ${eventRetention} ]; then
  TEMP_FILE="\$(mktemp)"
  tail -n ${eventRetention} "\$EVENT_LOG" > "\$TEMP_FILE"
  mv "\$TEMP_FILE" "\$EVENT_LOG"
fi
`;
}

// ── Git-based session save ──

function generateGitBasedSaveScript(eventRetention: number): string {
  return `#!/usr/bin/env bash
# session-save.sh — Save event to git-based session storage
set -uo pipefail

SESSION_DIR=".claude/sessions"
EVENT_LOG="\${SESSION_DIR}/events.log"

mkdir -p "\$SESSION_DIR"

# Read stdin for event data
EVENT=\$(cat || true)

# Append event with timestamp
echo "\$(date -u +%Y-%m-%dT%H:%M:%SZ) \${EVENT}" >> "\$EVENT_LOG"

# Rotate if exceeding retention limit
LINE_COUNT=\$(wc -l < "\$EVENT_LOG" | tr -d ' ')
if [ "\$LINE_COUNT" -gt ${eventRetention} ]; then
  TEMP_FILE="\$(mktemp)"
  tail -n ${eventRetention} "\$EVENT_LOG" > "\$TEMP_FILE"
  mv "\$TEMP_FILE" "\$EVENT_LOG"
fi

# Auto-commit session log (non-blocking, never fail the hook)
git add "\$EVENT_LOG" 2>/dev/null || true
git commit -m "session: save event \$(date -u +%H%M%S)" --no-gpg-sign 2>/dev/null || true
`;
}

// ── Git-based session recovery ──

function generateGitBasedRecoverScript(
  recoveryStrategy: 'last-event' | 'last-checkpoint' | 'custom'
): string {
  const recoverLogic = recoveryStrategy === 'last-checkpoint'
    ? `# Recovery strategy: last-checkpoint
# Find the most recent checkpoint tag and restore state
LATEST_CHECKPOINT=\$(git tag -l "checkpoint-*" --sort=-version:refname | head -1)

if [ -z "\$LATEST_CHECKPOINT" ]; then
  echo "No checkpoint tags found. Falling back to last event." >&2
  if [ -f "\$EVENT_LOG" ]; then
    tail -1 "\$EVENT_LOG"
    echo "Recovered from last event."
  else
    echo "No session data found." >&2
    exit 1
  fi
else
  echo "Restoring from checkpoint: \$LATEST_CHECKPOINT"
  git checkout "\$LATEST_CHECKPOINT" -- .claude/sessions/ 2>/dev/null || true
  echo "Session restored from checkpoint: \$LATEST_CHECKPOINT"
fi`
    : `# Recovery strategy: last-event
# Read the last event from the session log
if [ -f "\$EVENT_LOG" ]; then
  LAST_EVENT=\$(tail -1 "\$EVENT_LOG")
  echo "Last event: \$LAST_EVENT"
  echo "Session recovered from last event."
else
  echo "No session data found." >&2
  exit 1
fi`;

  return `#!/usr/bin/env bash
# session-recover.sh — Recover session state
set -euo pipefail

SESSION_DIR=".claude/sessions"
EVENT_LOG="\${SESSION_DIR}/events.log"

mkdir -p "\$SESSION_DIR"

${recoverLogic}
`;
}

// ── Custom session placeholder ──

const CUSTOM_SAVE_SCRIPT = `#!/usr/bin/env bash
# session-save.sh — Custom session save (implement your own logic)
set -euo pipefail

echo "TODO: Implement custom session save logic" >&2
exit 1
`;

const CUSTOM_RECOVER_SCRIPT = `#!/usr/bin/env bash
# session-recover.sh — Custom session recovery (implement your own logic)
set -euo pipefail

echo "TODO: Implement custom session recovery logic" >&2
exit 1
`;

// ── Main generator ──

// ── Session summary script (data-driven retrospective) ──

function renderSessionSummaryScript(): string {
  return `#!/usr/bin/env bash
# session-summary.sh — Parse events.jsonl + blocks.jsonl for Reflect stage
# Outputs a structured sprint summary for data-driven retrospectives.
set -uo pipefail

HARNESS=".harness"
EVENTS="$HARNESS/log/events.jsonl"
BLOCKS="$HARNESS/log/blocks.jsonl"

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq required. Install: brew install jq" >&2
  exit 1
fi

echo "╔══════════════════════════════════════════════════╗"
echo "║          Sprint Session Summary                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Sprint Duration ──
if [ -f "$HARNESS/state.json" ]; then
  STARTED=$(jq -r '.sprint.started_at // empty' "$HARNESS/state.json" 2>/dev/null)
  CURRENT=$(jq -r '.sprint.current // "unknown"' "$HARNESS/state.json" 2>/dev/null)
  HISTORY=$(jq -r '.sprint.history | join(" → ") // "none"' "$HARNESS/state.json" 2>/dev/null)
  echo "## Sprint Info"
  echo "- Started: \${STARTED:-unknown}"
  echo "- Final stage: $CURRENT"
  echo "- Path: \${HISTORY:-none}"
  echo ""
fi

# ── Stage Distribution ──
if [ -f "$EVENTS" ]; then
  TOTAL=$(wc -l < "$EVENTS" | tr -d ' ')
  echo "## Tool Calls by Stage (\${TOTAL} total)"
  echo ""
  jq -r '.phase' "$EVENTS" 2>/dev/null | sort | uniq -c | sort -rn | while read count stage; do
    pct=$((count * 100 / TOTAL))
    printf "  %-12s %4d calls (%2d%%)\\n" "$stage" "$count" "$pct"
  done
  echo ""

  # ── Tool Usage Breakdown ──
  echo "## Tool Usage"
  echo ""
  jq -r '.tool' "$EVENTS" 2>/dev/null | sort | uniq -c | sort -rn | while read count tool; do
    printf "  %-12s %4d\\n" "$tool" "$count"
  done
  echo ""

  # ── Stage Timing ──
  echo "## Estimated Stage Duration"
  echo ""
  STAGES=$(jq -r '.phase' "$EVENTS" 2>/dev/null | sort -u)
  for s in $STAGES; do
    FIRST=$(jq -r "select(.phase == \\"$s\\") | .ts" "$EVENTS" 2>/dev/null | head -1)
    LAST=$(jq -r "select(.phase == \\"$s\\") | .ts" "$EVENTS" 2>/dev/null | tail -1)
    if [ -n "$FIRST" ] && [ -n "$LAST" ]; then
      FIRST_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$FIRST" "+%s" 2>/dev/null || echo "0")
      LAST_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$LAST" "+%s" 2>/dev/null || echo "0")
      DIFF=$((LAST_EPOCH - FIRST_EPOCH))
      if [ "$DIFF" -gt 0 ]; then
        MINS=$((DIFF / 60))
        SECS=$((DIFF % 60))
        printf "  %-12s ~%dm %ds (%s → %s)\\n" "$s" "$MINS" "$SECS" "$FIRST" "$LAST"
      else
        printf "  %-12s <1s\\n" "$s"
      fi
    fi
  done
  echo ""
else
  echo "## No event log found ($EVENTS)"
  echo ""
fi

# ── Constraint Violations ──
if [ -f "$BLOCKS" ]; then
  BLOCK_COUNT=$(wc -l < "$BLOCKS" | tr -d ' ')
  echo "## Constraint Blocks (\${BLOCK_COUNT} total)"
  echo ""
  jq -r '"\\(.stage) | \\(.tool) | \\(.reason)"' "$BLOCKS" 2>/dev/null | sort | uniq -c | sort -rn | while read count rest; do
    printf "  %2dx  %s\\n" "$count" "$rest"
  done
  echo ""

  # ── Bypass Detection ──
  echo "## Potential Bypasses"
  echo ""
  echo "Stages with blocks but gates still passed:"
  if [ -f "$HARNESS/state.json" ]; then
    BLOCKED_STAGES=$(jq -r '.stage' "$BLOCKS" 2>/dev/null | sort -u)
    for s in $BLOCKED_STAGES; do
      PASSED=$(jq -r ".gates.\\"$s\\".passed // false" "$HARNESS/state.json" 2>/dev/null)
      if [ "$PASSED" = "true" ]; then
        BC=$(grep -c "\\"stage\\":\\"$s\\"" "$BLOCKS" 2>/dev/null || echo "0")
        echo "  ⚠ $s: $BC block(s) but gate passed — possible override"
      fi
    done
  fi
  echo ""
else
  echo "## No constraint blocks recorded"
  echo ""
fi

echo "---"
echo "End of session summary."
`;
}

export function generateSessionScripts(config: ProjectConfig): OutputFile[] {
  const { session } = config.architecture;
  const files: OutputFile[] = [];

  // Always generate session-init.sh
  files.push({
    path: '.claude/scripts/session-init.sh',
    content: SESSION_INIT_SCRIPT,
  });

  // Generate session-save.sh based on storage type
  switch (session.storage) {
    case 'local-file':
      files.push({
        path: '.claude/scripts/session-save.sh',
        content: generateLocalFileSaveScript(session.eventRetention),
      });
      break;
    case 'git-based':
      files.push({
        path: '.claude/scripts/session-save.sh',
        content: generateGitBasedSaveScript(session.eventRetention),
      });
      files.push({
        path: '.claude/scripts/session-recover.sh',
        content: generateGitBasedRecoverScript(session.recoveryStrategy),
      });
      break;
    case 'custom':
      files.push({
        path: '.claude/scripts/session-save.sh',
        content: CUSTOM_SAVE_SCRIPT,
      });
      files.push({
        path: '.claude/scripts/session-recover.sh',
        content: CUSTOM_RECOVER_SCRIPT,
      });
      break;
  }

  // State machine check script
  files.push({
    path: '.harness/scripts/check.sh',
    content: renderCheckScript(),
  });

  // Session summary script (consumes events.jsonl + blocks.jsonl for Reflect stage)
  files.push({
    path: '.harness/scripts/session-summary.sh',
    content: renderSessionSummaryScript(),
  });

  return files;
}
