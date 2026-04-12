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
    '# Also parses tdd.json to surface coverage requirements during build stage.',
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
    '  TOOL=$(echo "$INPUT" | grep -o \'"tool_name":"[^"]*"\' | head-1 | sed \'s/"tool_name":"//;s/"//\' || echo "unknown")',
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
    '# Auto-parse tdd.json during build stage to surface coverage gate',
    'TDD_FILE=".harness/constraints/tdd.json"',
    'if [ -f "$TDD_FILE" ] && [ "$STAGE" = "build" ] && [ "$TOOL" = "Bash" ]; then',
    '  if command -v jq >/dev/null 2>&1; then',
    '    MIN_COV=$(jq -r ".coverage.min_percent // 0" "$TDD_FILE" 2>/dev/null)',
    '    NO_SKIP=$(jq -r ".tests.no_skip // true" "$TDD_FILE" 2>/dev/null)',
    '    MAX_RETRY=$(jq -r ".retry.max_attempts // 3" "$TDD_FILE" 2>/dev/null)',
    '    if [ "$MIN_COV" != "0" ]; then',
    '      echo "[Harness] TDD Gate: coverage >= ${MIN_COV}%, no_skip=${NO_SKIP}, max_retry=${MAX_RETRY}"',
    '    fi',
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
    '# guard.sh — PreToolUse: enforce stage/role constraints from constraints.json',
    '# Reads state.json + constraints.json → allow (exit 0) or block (exit 2)',
    '# .harness/ and .claude/hooks/ and .claude/scripts/ are never writable — AI cannot tamper.',
    '',
    'set -uo pipefail',
    '',
    'INPUT=$(cat || true)',
    'HARNESS=".harness"',
    '',
    '# Require state.json and constraints.json',
    'if [ ! -f "$HARNESS/state.json" ] || [ ! -f "$HARNESS/constraints.json" ]; then',
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
    '# Covers Write, Edit, and Bash (command-level inspection)',
    '',
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
    '# Bash tool: inspect command string for writes to protected directories',
    'if [[ "$TOOL" == "Bash" ]]; then',
    '  CMD="$FILE"',
    '  # Detect redirect/append targets: > or >> followed by a protected path',
    '  if echo "$CMD" | grep -qE \'(>|>>)\\s*.harness/|cat\\s+>\\s*.harness/|tee\\s+.harness/|cp\\s+.*\\.harness/|mv\\s+.*\\.harness/|install\\s+.*\\.harness/\'; then',
    '    echo "BLOCKED: Cannot write to .harness/ via Bash — state is managed by hooks only" >&2',
    '    exit 2',
    '  fi',
    '  if echo "$CMD" | grep -qE \'(>|>>)\\s*.claude/hooks/|cat\\s+>\\s*.claude/hooks/|tee\\s+.claude/hooks/|cp\\s+.*\\.claude/hooks/|mv\\s+.*\\.claude/hooks/\'; then',
    '    echo "BLOCKED: Cannot write to .claude/hooks/ via Bash — enforcement scripts are read-only" >&2',
    '    exit 2',
    '  fi',
    '  if echo "$CMD" | grep -qE \'(>|>>)\\s*.claude/scripts/|cat\\s+>\\s*.claude/scripts/|tee\\s+.claude/scripts/|cp\\s+.*\\.claude/scripts/|mv\\s+.*\\.claude/scripts/\'; then',
    '    echo "BLOCKED: Cannot write to .claude/scripts/ via Bash — enforcement scripts are read-only" >&2',
    '    exit 2',
    '  fi',
    '  # Also catch: jq in-place writes to state.json (jq ... > file.tmp && mv pattern)',
    '  if echo "$CMD" | grep -qE \'state\\.json(\\.tmp)?|constraints\\.json\'; then',
    '    echo "BLOCKED: Cannot modify state.json or constraints.json via Bash — managed by hooks only" >&2',
    '    exit 2',
    '  fi',
    'fi',
    '',
    '# Fail-closed: if jq missing, block everything to prevent silent bypass',
    'if ! command -v jq >/dev/null 2>&1; then',
    '  echo "BLOCKED: jq is required for constraint enforcement. Install: brew install jq" >&2',
    '  exit 2',
    'fi',
    '',
    '# Read stage rules from constraints.json using jq',
    'STAGE_CFG=$(jq --arg name "$STAGE" \'.stages[] | select(.name == $name)\' "$HARNESS/constraints.json" 2>/dev/null)',
    '',
    'if [ -z "$STAGE_CFG" ]; then',
    '  exit 0',
    'fi',
    '',
    '# Check deny list — but exempt harness-managed scripts from Bash deny',
    '# Slash commands invoke bash .claude/hooks/transition.sh which must always work',
    'SKIP_DENY=false',
    'if [[ "$TOOL" == "Bash" ]] && echo "$FILE" | grep -qE \'\.(claude/(hooks|scripts)/|harness/scripts/)\'; then',
    '  SKIP_DENY=true',
    'fi',
    '',
    'if [[ "$SKIP_DENY" == false ]]; then',
    '  DENIED=$(echo "$STAGE_CFG" | jq -r \'.tools.deny[]\' 2>/dev/null)',
    '  if echo "$DENIED" | grep -qx "$TOOL"; then',
    '    echo "BLOCKED: Tool \\"$TOOL\\" not allowed in $STAGE stage" >&2',
    '    exit 2',
    '  fi',
    'fi',
    '',
    '# Check write path permissions',
    'if [[ "$TOOL" == "Write" || "$TOOL" == "Edit" ]]; then',
    '  if [ -n "$FILE" ]; then',
    '    # Normalize to relative path — Write/Edit tools may pass absolute paths',
    '    MATCH_FILE="${FILE#$(pwd)/}"',
    '    ALLOWED_PATHS=$(echo "$STAGE_CFG" | jq -r \'.paths.write[]\' 2>/dev/null)',
    '    MATCH=false',
    '    while IFS= read -r pattern; do',
    '      [ -z "$pattern" ] && continue',
    '      # shellcheck disable=SC2254',
    '      case "$MATCH_FILE" in',
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
    'if [ ! -f "$HARNESS/state.json" ] || [ ! -f "$HARNESS/constraints.json" ]; then',
    '  exit 0',
    'fi',
    '',
    'if ! command -v jq >/dev/null 2>&1; then',
    '  # PostToolUse should not block — log warning only',
    '  echo "[Harness] WARNING: jq missing, gate checking disabled. Install: brew install jq" >&2',
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
    '# Get gates for current stage from constraints.json',
    'GATES=$(jq --arg name "$STAGE" \'.stages[] | select(.name == $name) | .gates\' "$HARNESS/constraints.json" 2>/dev/null)',
    'if [ -z "$GATES" ] || [ "$GATES" = "null" ]; then',
    '  exit 0',
    'fi',
    '',
    'GATE_COUNT=$(echo "$GATES" | jq \'length\' 2>/dev/null)',
    'if [ "$GATE_COUNT" -eq 0 ]; then',
    '  echo "$STATE" | jq --arg s "$STAGE" \'.gates[$s].passed = true\' > "$HARNESS/state.json.tmp" && mv "$HARNESS/state.json.tmp" "$HARNESS/state.json"',
    '  exit 0',
    'fi',
    '',
    'ALL_PASS=true',
    'ARTIFACTS="[]"',
    '',
    'for i in $(seq 0 $((GATE_COUNT - 1))); do',
    '  TYPE=$(echo "$GATES" | jq -r ".[$i].type" 2>/dev/null)',
    '  PATTERN=$(echo "$GATES" | jq -r ".[$i].pattern" 2>/dev/null)',
    '  ID=$(echo "$GATES" | jq -r ".[$i].id" 2>/dev/null)',
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
    '      MARKER=$(echo "$GATES" | jq -r ".[$i].marker // empty" 2>/dev/null)',
    '      if [ -n "$MARKER" ] && grep -q "$MARKER" "$PATTERN" 2>/dev/null; then',
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
    'if [ ! -f "$HARNESS/state.json" ] || [ ! -f "$HARNESS/constraints.json" ]; then',
    '  echo "ERROR: .harness/ not initialized. Run session-init.sh first." >&2',
    '  exit 1',
    'fi',
    '',
    'if ! command -v jq >/dev/null 2>&1; then',
    '  echo "ERROR: jq is required. Install with: brew install jq" >&2',
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
    '# Check if transition rule exists',
    'TRANSITION_COUNT=$(jq --arg from "$CURRENT" --arg to "$TARGET" \\',
    '  \'[.transitions[] | select(.from == $from and .to == $to)] | length\' \\',
    '  "$HARNESS/constraints.json" 2>/dev/null)',
    '',
    'if [ "$TRANSITION_COUNT" -eq 0 ] 2>/dev/null; then',
    '  echo "BLOCKED: No valid transition from $CURRENT to $TARGET" >&2',
    '  echo "Check .harness/constraints.json for valid stage order." >&2',
    '  exit 1',
    'fi',
    '',
    '# Check required gates — empty requires means auto-advance',
    'REQUIRES=$(jq --arg from "$CURRENT" --arg to "$TARGET" \\',
    '  \'.transitions[] | select(.from == $from and .to == $to) | .requires[]\' \\',
    '  "$HARNESS/constraints.json" 2>/dev/null)',
    '',
    'if [ -n "$REQUIRES" ]; then',
    '  BLOCKED=""',
    '  for gate in $REQUIRES; do',
    '    PASSED=$(echo "$STATE" | jq -r ".gates.\\"$CURRENT\\".passed // false")',
    '    if [ "$PASSED" != "true" ]; then',
    '      BLOCKED="$BLOCKED  - $gate\\n"',
    '    fi',
    '  done',
    '',
    '  if [ -n "$BLOCKED" ]; then',
    '    echo "BLOCKED: Cannot advance from $CURRENT to $TARGET" >&2',
    '    echo "Required gates not passed:" >&2',
    '    echo -e "$BLOCKED" >&2',
    '    echo "Run: bash .harness/scripts/check.sh" >&2',
    '    exit 1',
    '  fi',
    'fi',
    '',
    '# Transition allowed — update state',
    'NEW_STATE=$(echo "$STATE" | jq --arg t "$TARGET" \'',
    '  .sprint.history += [.sprint.current] |',
    '  .sprint.current = $t',
    '\')',
    '',
    '# Update role from target stage config',
    'NEW_ROLE=$(jq --arg name "$TARGET" \'.stages[] | select(.name == $name) | .roles[0]\' "$HARNESS/constraints.json" 2>/dev/null)',
    'NEW_TOOLS=$(jq --arg name "$TARGET" \'.stages[] | select(.name == $name) | .tools.allow\' "$HARNESS/constraints.json" 2>/dev/null)',
    'NEW_PATHS=$(jq --arg name "$TARGET" \'.stages[] | select(.name == $name) | .paths.write\' "$HARNESS/constraints.json" 2>/dev/null)',
    '',
    'NEW_STATE=$(echo "$NEW_STATE" | jq --arg r "$NEW_ROLE" --argjson t "$NEW_TOOLS" --argjson p "$NEW_PATHS" \'',
    '  .role.current = $r |',
    '  .role.allowed_tools = $t |',
    '  .role.allowed_paths = $p',
    '\')',
    '',
    'echo "$NEW_STATE" > "$HARNESS/state.json.tmp" && mv "$HARNESS/state.json.tmp" "$HARNESS/state.json"',
    '',
    '# Update legacy files for backward compatibility (emit-event.sh reads these)',
    'echo "$TARGET" > .harness/current-stage',
    'echo "$NEW_ROLE" > .harness/current-role',
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

  // P1: Hands layer — guard enforces stage/role constraints from constraints.json
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

  // PreToolUse: guard.sh — enforce stage/role/tool constraints
  registrations['PreToolUse'] = [
    // Constraint check for Bash commands (dangerous command blocking)
    {
      matcher: 'Bash',
      hooks: [{ type: 'command', command: '.claude/hooks/constraint-check.sh' }],
    },
    // State machine guard — check tool permissions and write paths
    {
      matcher: '',
      hooks: [{ type: 'command', command: '.claude/hooks/guard.sh' }],
    },
  ];

  // PostToolUse: advance.sh — check gates after each tool use
  registrations['PostToolUse'] = [
    {
      matcher: '',
      hooks: [{ type: 'command', command: '.claude/hooks/advance.sh' }],
    },
  ];

  // Keep emit-event for logging (on write-like operations only)
  for (const tool of ['Write', 'Edit', 'Bash']) {
    registrations['PostToolUse'].push({
      matcher: tool,
      hooks: [{ type: 'command', command: '.claude/hooks/emit-event.sh' }],
    });
  }

  // Secret detection hook (vault credential policy)
  if (hasSecretCheck(config)) {
    registrations['PreToolUse'].push({
      matcher: 'Write',
      hooks: [{ type: 'command', command: '.claude/hooks/secret-check.sh' }],
    });
  }

  // Session save hook (git-based session storage)
  if (config.architecture.session.storage === 'git-based') {
    for (const tool of ['Write', 'Edit', 'Bash']) {
      registrations['PostToolUse'].push({
        matcher: tool,
        hooks: [{ type: 'command', command: '.claude/scripts/session-save.sh' }],
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
      hooks: [{ type: 'command', command: hook.command }],
    });
  }

  return registrations;
}
