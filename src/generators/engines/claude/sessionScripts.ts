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
HISTORY=$(echo "$STATE" | jq -r '.sprint.history | join(" → ")')

echo "╔══════════════════════════════════════╗"
echo "║        Harness State Machine         ║"
echo "╠══════════════════════════════════════╣"
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

  jq -n \\
    --arg p "$PROJECT" \\
    --arg s "$FIRST" \\
    --arg r "$FIRST_ROLE" \\
    --argjson t "$FIRST_TOOLS" \\
    --argjson pa "$FIRST_PATHS" \\
    --argjson g "$GATES_JSON" \\
    '{version:1, project:$p, sprint:{current:$s,history:[],started_at:""}, role:{current:$r,allowed_tools:$t,allowed_paths:$pa}, gates:$g}' \\
    > "$HARNESS/state.json"

  echo "State machine initialized."
fi

# Write started_at timestamp
if [ -f "$HARNESS/state.json" ]; then
  jq --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '.sprint.started_at = $t' \\
    "$HARNESS/state.json" > "$HARNESS/state.json.tmp" \\
    && mv "$HARNESS/state.json.tmp" "$HARNESS/state.json"
fi

# Create session directory
mkdir -p .claude/sessions

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

  return files;
}
