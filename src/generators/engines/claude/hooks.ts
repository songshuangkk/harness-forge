import type { ProjectConfig, OutputFile } from '@/types';
import { buildGateChecks } from './gateBuilder';
import { renderGateScript, gateScriptPath } from './gateRenderer';
import { hasSecretCheck } from './sandboxScripts';

// ── emitEvent script (P1: Log 层接线) ──

function renderEmitEventScript(): string {
  return [
    '#!/usr/bin/env bash',
    '# emit-event.sh — Append structured event to .harness/log/events.jsonl',
    '# Fires on every PostToolUse to record runtime events for the Log layer.',
    '# Also parses tdd.yaml to surface coverage requirements during build stage.',
    '# Exit 0 always (never block — logging is best-effort).',
    '',
    'set -uo pipefail',
    '',
    'INPUT=$(cat || true)',
    'LOG_DIR=".harness/log"',
    'LOG_FILE="$LOG_DIR/events.jsonl"',
    '',
    'mkdir -p "$LOG_DIR"',
    '',
    '# Extract tool_name from stdin JSON (Claude Code format: {"tool_name":"Bash","tool_input":{...}})',
    'TOOL="unknown"',
    'if command -v jq >/dev/null 2>&1; then',
    '  TOOL=$(echo "$INPUT" | jq -r ".tool_name // \\"unknown\\"" 2>/dev/null || echo "unknown")',
    'else',
    '  TOOL=$(echo "$INPUT" | grep -o \'"tool_name":"[^"]*"\' | head -1 | sed \'s/"tool_name":"//;s/"//\' || echo "unknown")',
    'fi',
    '',
    '# Read current stage and role from files (written by CLAUDE.md protocol)',
    'STAGE=$(cat .harness/current-stage 2>/dev/null || echo "unknown")',
    'ROLE=$(cat .harness/current-role 2>/dev/null || echo "unknown")',
    '',
    '# Build event JSON',
    'EVENT=$(printf \'{"ts":"%s","tool":"%s","phase":"%s","role":"%s"}\\n\' \\',
    '  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \\',
    '  "$TOOL" \\',
    '  "$STAGE" \\',
    '  "$ROLE")',
    '',
    'echo "$EVENT" >> "$LOG_FILE"',
    '',
    '# P2: Auto-parse tdd.yaml during build stage to surface coverage gate',
    'CONSTRAINT_FILE=".harness/constraints/tdd.yaml"',
    'if [ -f "$CONSTRAINT_FILE" ] && [ "$STAGE" = "build" ] && [ "$TOOL" = "Bash" ]; then',
    '  MIN_COV=$(grep "min_percent" "$CONSTRAINT_FILE" 2>/dev/null | sed "s/.*: *//" | tr -d "[:space:]")',
    '  NO_SKIP=$(grep "no_skip" "$CONSTRAINT_FILE" 2>/dev/null | sed "s/.*: *//" | tr -d "[:space:]")',
    '  MAX_RETRY=$(grep "max_attempts" "$CONSTRAINT_FILE" 2>/dev/null | sed "s/.*: *//" | tr -d "[:space:]")',
    '  if [ -n "$MIN_COV" ]; then',
    '    echo "[Harness] TDD Gate: coverage >= ${MIN_COV}%, no_skip=${NO_SKIP:-true}, max_retry=${MAX_RETRY:-3}"',
    '  fi',
    'fi',
    '',
    'exit 0',
  ].join('\n');
}

// ── Guard script (P1: Hands 层权限守卫) ──

function renderGuardScript(): string {
  return [
    '#!/usr/bin/env bash',
    '# guard.sh — PreToolUse: enforce stage/role constraints from constraints.yaml',
    '# Reads state.json + constraints.yaml → allow (exit 0) or block (exit 2)',
    '# .harness/ and .claude/hooks/ and .claude/scripts/ are never writable — AI cannot tamper.',
    '',
    'set -uo pipefail',
    '',
    'INPUT=$(cat || true)',
    'HARNESS=".harness"',
    '',
    '# Require state.json and constraints.yaml',
    'if [ ! -f "$HARNESS/state.json" ] || [ ! -f "$HARNESS/constraints.yaml" ]; then',
    '  exit 0',
    'fi',
    '',
    '# Extract tool_name and file_path from stdin JSON',
    'TOOL=""',
    'FILE=""',
    'if command -v jq >/dev/null 2>&1; then',
    '  TOOL=$(echo "$INPUT" | jq -r ".tool_name // \\"\\\"" 2>/dev/null || echo "")',
    '  FILE=$(echo "$INPUT" | jq -r ".tool_input.file_path // .tool_input.command // \\"\\\"" 2>/dev/null || echo "")',
    'else',
    '  TOOL=$(echo "$INPUT" | grep -o \'"tool_name":"[^"]*"\' | head -1 | sed \'s/"tool_name":"//;s/"//\' 2>/dev/null || echo "")',
    'fi',
    '',
    'if [ -z "$TOOL" ]; then',
    '  exit 0',
    'fi',
    '',
    '# Read current stage from state.json',
    'STATE=$(cat "$HARNESS/state.json")',
    'STAGE=$(echo "$STATE" | jq -r \'.sprint.current // "think"\')',
    '',
    '# Protect critical directories from writes (security boundary)',
    'if [[ "$TOOL" == "Write" || "$TOOL" == "Edit" ]]; then',
    '  case "$FILE" in',
    '    .harness/*)',
    '      echo "BLOCKED: Cannot modify .harness/ — state is managed by hooks only" >&2',
    '      exit 2',
    '      ;;',
    '    .claude/hooks/*|.claude/scripts/*)',
    '      echo "BLOCKED: Cannot modify .claude/hooks/ or .claude/scripts/ — enforcement scripts are read-only" >&2',
    '      exit 2',
    '      ;;',
    '  esac',
    'fi',
    '',
    '# Read stage rules from constraints.yaml',
    '# Fail-closed: if yq missing, block everything to prevent silent bypass',
    'if ! command -v yq >/dev/null 2>&1; then',
    '  echo "BLOCKED: yq is required for constraint enforcement. Install: brew install yq" >&2',
    '  exit 2',
    'fi',
    '',
    'STAGE_CFG=$(yq ".stages[] | select(.name == \\"$STAGE\\")" "$HARNESS/constraints.yaml" 2>/dev/null)',
    '',
    'if [ -z "$STAGE_CFG" ]; then',
    '  exit 0',
    'fi',
    '',
    '# Check deny list',
    'DENIED=$(echo "$STAGE_CFG" | yq \'.tools.deny[]\' 2>/dev/null)',
    'if echo "$DENIED" | grep -qx "$TOOL"; then',
    '  echo "BLOCKED: Tool \\"$TOOL\\" not allowed in $STAGE stage" >&2',
    '  exit 2',
    'fi',
    '',
    '# Check write path permissions',
    'if [[ "$TOOL" == "Write" || "$TOOL" == "Edit" ]]; then',
    '  if [ -n "$FILE" ]; then',
    '    ALLOWED_PATHS=$(echo "$STAGE_CFG" | yq \'.paths.write[]\' 2>/dev/null)',
    '    MATCH=false',
    '    while IFS= read -r pattern; do',
    '      [ -z "$pattern" ] && continue',
    '      # shellcheck disable=SC2254',
    '      case "$FILE" in',
    '        $pattern) MATCH=true; break ;;',
    '      esac',
    '    done <<< "$ALLOWED_PATHS"',
    '    if [[ "$MATCH" == false ]]; then',
    '      echo "BLOCKED: Writing to \\"$FILE\\" not allowed in $STAGE stage" >&2',
    '      echo "Allowed paths: $(echo "$ALLOWED_PATHS" | tr \'\\n\' \' \')" >&2',
    '      exit 2',
    '    fi',
    '  fi',
    'fi',
    '',
    'exit 0',
  ].join('\n');
}

// ── Advance script (PostToolUse: gate checking) ──

function renderAdvanceScript(): string {
  return [
    '#!/usr/bin/env bash',
    '# advance.sh — PostToolUse: check gates and update state.json',
    '# After each tool use, checks if current stage gates are satisfied.',
    '# Updates state.json gates.{stage}.passed = true when all gates pass.',
    '',
    'set -uo pipefail',
    '',
    'HARNESS=".harness"',
    '',
    'if [ ! -f "$HARNESS/state.json" ] || [ ! -f "$HARNESS/constraints.yaml" ]; then',
    '  exit 0',
    'fi',
    '',
    'if ! command -v yq >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then',
    '  # PostToolUse should not block — log warning only',
    '  echo "[Harness] WARNING: jq/yq missing, gate checking disabled. Install: brew install jq yq" >&2',
    '  exit 0',
    'fi',
    '',
    'STATE=$(cat "$HARNESS/state.json")',
    'STAGE=$(echo "$STATE" | jq -r \'.sprint.current // "think"\')',
    '',
    '# Skip if already passed',
    'ALREADY=$(echo "$STATE" | jq -r ".gates.\\"$STAGE\\".passed // false")',
    'if [ "$ALREADY" = "true" ]; then',
    '  exit 0',
    'fi',
    '',
    '# Get gates for current stage',
    'GATES=$(yq ".stages[] | select(.name == \\"$STAGE\\") | .gates" "$HARNESS/constraints.yaml" 2>/dev/null)',
    'if [ -z "$GATES" ] || [ "$GATES" = "null" ]; then',
    '  exit 0',
    'fi',
    '',
    'GATE_COUNT=$(echo "$GATES" | yq \'length\' 2>/dev/null || echo "0")',
    'if [ "$GATE_COUNT" -eq 0 ]; then',
    '  echo "$STATE" | jq --arg s "$STAGE" \'.gates[$s].passed = true\' > "$HARNESS/state.json.tmp" && mv "$HARNESS/state.json.tmp" "$HARNESS/state.json"',
    '  exit 0',
    'fi',
    '',
    'ALL_PASS=true',
    'ARTIFACTS="[]"',
    '',
    'for i in $(seq 0 $((GATE_COUNT - 1))); do',
    '  TYPE=$(echo "$GATES" | yq ".[$i].type" 2>/dev/null)',
    '  PATTERN=$(echo "$GATES" | yq ".[$i].pattern" 2>/dev/null)',
    '  ID=$(echo "$GATES" | yq ".[$i].id" 2>/dev/null)',
    '',
    '  PASS=false',
    '  case "$TYPE" in',
    '    file_exists)',
    '      if ls $PATTERN 1>/dev/null 2>&1; then',
    '        PASS=true',
    '      fi',
    '      ;;',
    '    file_nonempty)',
    '      if [ -s "$PATTERN" ] 2>/dev/null; then',
    '        PASS=true',
    '      fi',
    '      ;;',
    '    file_contains)',
    '      MARKER=$(echo "$GATES" | yq ".[$i].marker" 2>/dev/null)',
    '      if grep -q "$MARKER" "$PATTERN" 2>/dev/null; then',
    '        PASS=true',
    '      fi',
    '      ;;',
    '  esac',
    '',
    '  if [ "$PASS" = false ]; then',
    '    ALL_PASS=false',
    '  else',
    '    ARTIFACTS=$(echo "$ARTIFACTS" | jq --arg a "$ID" \'. += [$a]\')',
    '  fi',
    'done',
    '',
    'if [ "$ALL_PASS" = true ]; then',
    '  echo "$STATE" | jq --arg s "$STAGE" --argjson a "$ARTIFACTS" \'.gates[$s].passed = true | .gates[$s].artifacts = $a\' > "$HARNESS/state.json.tmp" && mv "$HARNESS/state.json.tmp" "$HARNESS/state.json"',
    '  echo "[Harness] Stage $STAGE gates PASSED. Ready to advance with next slash command."',
    'fi',
    '',
    'exit 0',
  ].join('\n');
}

// ── Transition script (stage transition) ──

function renderTransitionScript(): string {
  return [
    '#!/usr/bin/env bash',
    '# transition.sh — Stage transition: check gates, update state, switch role',
    '# Called by slash commands: bash .claude/hooks/transition.sh <target-stage>',
    '# Exit 0 = success, exit 1 = blocked (gates not passed)',
    '',
    'set -uo pipefail',
    '',
    'TARGET="${1:-}"',
    'HARNESS=".harness"',
    '',
    'if [ -z "$TARGET" ]; then',
    '  echo "Usage: bash .claude/hooks/transition.sh <target-stage>" >&2',
    '  exit 1',
    'fi',
    '',
    'if [ ! -f "$HARNESS/state.json" ] || [ ! -f "$HARNESS/constraints.yaml" ]; then',
    '  echo "ERROR: .harness/ not initialized. Run session-init.sh first." >&2',
    '  exit 1',
    'fi',
    '',
    'if ! command -v jq >/dev/null 2>&1 || ! command -v yq >/dev/null 2>&1; then',
    '  echo "ERROR: jq and yq are required. Install with: brew install jq yq" >&2',
    '  exit 1',
    'fi',
    '',
    'STATE=$(cat "$HARNESS/state.json")',
    'CURRENT=$(echo "$STATE" | jq -r \'.sprint.current\')',
    '',
    'if [ "$CURRENT" = "$TARGET" ]; then',
    '  echo "Already in $TARGET stage."',
    '  exit 0',
    'fi',
    '',
    '# Check transition rules',
    'REQUIRES=$(yq ".transitions[] | select(.from == \\"$CURRENT\\" and .to == \\"$TARGET\\") | .requires[]" "$HARNESS/constraints.yaml" 2>/dev/null)',
    '',
    'if [ -z "$REQUIRES" ]; then',
    '  echo "BLOCKED: No valid transition from $CURRENT to $TARGET" >&2',
    '  echo "Check .harness/constraints.yaml for valid stage order." >&2',
    '  exit 1',
    'fi',
    '',
    '# Check all required gates passed',
    'BLOCKED=""',
    'for gate in $REQUIRES; do',
    '  PASSED=$(echo "$STATE" | jq -r ".gates.\\"$CURRENT\\".passed // false")',
    '  if [ "$PASSED" != "true" ]; then',
    '    BLOCKED="$BLOCKED  - $gate\\n"',
    '  fi',
    'done',
    '',
    'if [ -n "$BLOCKED" ]; then',
    '  echo "BLOCKED: Cannot advance from $CURRENT to $TARGET" >&2',
    '  echo "Required gates not passed:" >&2',
    '  echo -e "$BLOCKED" >&2',
    '  echo "Run: bash .harness/scripts/check.sh" >&2',
    '  exit 1',
    'fi',
    '',
    '# Transition allowed — update state',
    'NEW_STATE=$(echo "$STATE" | jq --arg t "$TARGET" \'',
    '  .sprint.history += [.sprint.current] |',
    '  .sprint.current = $t',
    '\')',
    '',
    '# Update role from target stage config',
    'NEW_ROLE=$(yq ".stages[] | select(.name == \\"$TARGET\\") | .roles[0]" "$HARNESS/constraints.yaml" 2>/dev/null)',
    'NEW_TOOLS=$(yq -o=j ".stages[] | select(.name == \\"$TARGET\\") | .tools.allow" "$HARNESS/constraints.yaml" 2>/dev/null)',
    'NEW_PATHS=$(yq -o=j ".stages[] | select(.name == \\"$TARGET\\") | .paths.write" "$HARNESS/constraints.yaml" 2>/dev/null)',
    '',
    'NEW_STATE=$(echo "$NEW_STATE" | jq --arg r "$NEW_ROLE" --argjson t "$NEW_TOOLS" --argjson p "$NEW_PATHS" \'',
    '  .role.current = $r |',
    '  .role.allowed_tools = $t |',
    '  .role.allowed_paths = $p',
    '\')',
    '',
    'echo "$NEW_STATE" > "$HARNESS/state.json.tmp" && mv "$HARNESS/state.json.tmp" "$HARNESS/state.json"',
    '',
    'echo "Transitioned: $CURRENT → $TARGET (role: $NEW_ROLE)"',
    'echo "Run /$TARGET to begin the next stage."',
    '',
    'exit 0',
  ].join('\n');
}

// ── Main generator ──

export function generateClaudeHooks(config: ProjectConfig): OutputFile[] {
  const gateChecks = buildGateChecks(config);
  const files: OutputFile[] = [];

  for (const [gateName, checks] of gateChecks) {
    files.push({
      path: gateScriptPath(gateName),
      content: renderGateScript(gateName, checks),
    });
  }

  // P1: Log layer — emitEvent on every tool use
  files.push({
    path: '.claude/hooks/emit-event.sh',
    content: renderEmitEventScript(),
  });

  // P1: Hands layer — guard enforces stage/role constraints from constraints.yaml
  files.push({
    path: '.claude/hooks/guard.sh',
    content: renderGuardScript(),
  });

  // PostToolUse: check gates and update state.json
  files.push({
    path: '.claude/hooks/advance.sh',
    content: renderAdvanceScript(),
  });

  // Stage transition: check gates, update state, switch role
  files.push({
    path: '.claude/hooks/transition.sh',
    content: renderTransitionScript(),
  });

  return files;
}

// ── Hook registrations for settings.json ──

export function buildClaudeHookRegistrations(
  config: ProjectConfig
): Record<string, Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>> {
  const registrations: Record<
    string,
    Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>
  > = {};

  // Always register PreToolUse(Bash) -> constraint-check.sh
  if (!registrations['PreToolUse']) {
    registrations['PreToolUse'] = [];
  }
  registrations['PreToolUse'].push({
    matcher: 'Bash',
    hooks: [
      {
        type: 'command',
        command: '.claude/hooks/constraint-check.sh',
      },
    ],
  });

  // P1: Guard — enforce stage/role constraints from constraints.yaml on all tool uses
  registrations['PreToolUse'].push({
    matcher: '',
    hooks: [
      {
        type: 'command',
        command: '.claude/hooks/guard.sh',
      },
    ],
  });

  // P1: emitEvent — log every tool use to .harness/log/events.jsonl
  // PostToolUse: advance — check gates and update state.json after each tool use
  if (!registrations['PostToolUse']) {
    registrations['PostToolUse'] = [];
  }
  for (const tool of ['Write', 'Edit', 'Bash']) {
    registrations['PostToolUse'].push({
      matcher: tool,
      hooks: [
        {
          type: 'command',
          command: '.claude/hooks/emit-event.sh',
        },
        {
          type: 'command',
          command: '.claude/hooks/advance.sh',
        },
      ],
    });
  }

  // Note: Stage gate scripts (build-gate, review-gate, ship-gate) are
  // generated as files but NOT registered as auto-hooks. They check for
  // artifacts that may not exist yet, which would block ALL commands.
  // Users invoke them manually: bash .claude/hooks/<gate>.sh

  // Secret detection hook (vault credential policy)
  if (hasSecretCheck(config)) {
    if (!registrations['PreToolUse']) {
      registrations['PreToolUse'] = [];
    }
    registrations['PreToolUse'].push({
      matcher: 'Write',
      hooks: [
        {
          type: 'command',
          command: '.claude/hooks/secret-check.sh',
        },
      ],
    });
  }

  // Session save hook (git-based session storage)
  // Only fire on write-like operations, not on every read/search
  if (config.architecture.session.storage === 'git-based') {
    if (!registrations['PostToolUse']) {
      registrations['PostToolUse'] = [];
    }
    for (const tool of ['Write', 'Edit', 'Bash']) {
      registrations['PostToolUse'].push({
        matcher: tool,
        hooks: [
          {
            type: 'command',
            command: '.claude/scripts/session-save.sh',
          },
        ],
      });
    }
  }

  // Merge user-defined hooks from config.integration.hooks
  for (const hook of config.integration.hooks) {
    if (!registrations[hook.event]) {
      registrations[hook.event] = [];
    }
    registrations[hook.event].push({
      matcher: '',
      hooks: [
        {
          type: 'command',
          command: hook.command,
        },
      ],
    });
  }

  return registrations;
}
