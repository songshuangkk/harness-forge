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

// ── Role check script (P1: Hands 层权限守卫) ──

function renderRoleCheckScript(): string {
  return [
    '#!/usr/bin/env bash',
    '# role-check.sh — PreToolUse role permission verification',
    '# Reads .harness/current-stage and .harness/current-role, checks tool',
    '# permissions against the role definition file.',
    '# Exit 0 = allow, exit 2 = block.',
    '',
    'set -uo pipefail',
    '',
    'INPUT=$(cat || true)',
    '',
    '# Read current stage and role',
    'STAGE=$(cat .harness/current-stage 2>/dev/null || echo "unknown")',
    'ROLE=$(cat .harness/current-role 2>/dev/null || echo "unknown")',
    '',
    'if [ "$STAGE" = "unknown" ] || [ "$ROLE" = "unknown" ]; then',
    '  exit 0',
    'fi',
    '',
    'ROLE_FILE=".harness/roles/${ROLE}.md"',
    '',
    'if [ ! -f "$ROLE_FILE" ]; then',
    '  exit 0',
    'fi',
    '',
    '# Extract tool_name from stdin JSON (jq if available, else grep)',
    'TOOL=""',
    'if command -v jq >/dev/null 2>&1; then',
    '  TOOL=$(echo "$INPUT" | jq -r ".tool_name // \\"\\\"" 2>/dev/null || echo "")',
    'else',
    '  TOOL=$(echo "$INPUT" | grep -o \'"tool_name":"[^"]*"\' | head -1 | sed \'s/"tool_name":"//;s/"//\' || echo "")',
    'fi',
    'if [ -z "$TOOL" ]; then',
    '  exit 0',
    'fi',
    '',
    '# Extract denied tool names from the role markdown "## Denied Tools" section',
    'DENIED_SECTION=$(sed -n \'/## Denied Tools/,/^## /{ /^## Denied Tools/d; /^## /q; p }\' "$ROLE_FILE" 2>/dev/null || true)',
    'if [ -n "$DENIED_SECTION" ]; then',
    '  if echo "$DENIED_SECTION" | grep -q "^- ${TOOL}$"; then',
    '    echo "BLOCKED: Role \'$ROLE\' cannot use tool \'$TOOL\' in stage \'$STAGE\'" >&2',
    '    exit 2',
    '  fi',
    'fi',
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

  // P1: Hands layer — role permission verification
  files.push({
    path: '.claude/hooks/role-check.sh',
    content: renderRoleCheckScript(),
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

  // P1: Role permission verification — check on all tool uses
  registrations['PreToolUse'].push({
    matcher: '',
    hooks: [
      {
        type: 'command',
        command: '.claude/hooks/role-check.sh',
      },
    ],
  });

  // P1: emitEvent — log every tool use to .harness/log/events.jsonl
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
