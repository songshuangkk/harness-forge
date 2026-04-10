import type { ProjectConfig, OutputFile } from '@/types';

// ── Hook script content ──

const CONSTRAINT_CHECK_SCRIPT = `#!/usr/bin/env bash
# constraint-check.sh — Block dangerous commands
# Reads stdin JSON, extracts the command, and blocks destructive operations.
# Exit 0 = allow, exit 2 = block.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | grep -o '"command":"[^"]*"' | head -1 | sed 's/"command":"//;s/"//')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Normalize for matching
LOWER=$(echo "$COMMAND" | tr '[:upper:]' '[:lower:]')

# Block dangerous patterns
PATTERNS=(
  "rm -rf"
  "rm -r /"
  "drop table"
  "truncate table"
  "delete from"
  ":(){ :|:& };:"
  "dd if=/dev/zero"
  "mkfs."
  "> /dev/sd"
)

for PATTERN in "\${PATTERNS[@]}"; do
  if echo "$LOWER" | grep -q "$PATTERN"; then
    echo "BLOCKED: Command matches dangerous pattern: $PATTERN" >&2
    exit 2
  fi
done

exit 0
`;

const REVIEW_GATE_SCRIPT = `#!/usr/bin/env bash
# review-gate.sh — Verify review report exists before proceeding
# Exit 0 = pass, exit 2 = block.

set -euo pipefail

REPORT="docs/reviews/review-report.md"

if [ ! -f "$REPORT" ]; then
  echo "BLOCKED: Review report not found at $REPORT" >&2
  echo "Run the review stage first to generate the report." >&2
  exit 2
fi

echo "Review gate passed: $REPORT exists."
exit 0
`;

const TEST_GATE_SCRIPT = `#!/usr/bin/env bash
# test-gate.sh — Verify test report exists before proceeding
# Exit 0 = pass, exit 2 = block.

set -euo pipefail

REPORT="docs/reports/test-report.md"

if [ ! -f "$REPORT" ]; then
  echo "BLOCKED: Test report not found at $REPORT" >&2
  echo "Run the test stage first to generate the report." >&2
  exit 2
fi

echo "Test gate passed: $REPORT exists."
exit 0
`;

const SHIP_GATE_SCRIPT = `#!/usr/bin/env bash
# ship-gate.sh — Verify both review and test reports exist before shipping
# Exit 0 = pass, exit 2 = block.

set -euo pipefail

REVIEW_REPORT="docs/reviews/review-report.md"
TEST_REPORT="docs/reports/test-report.md"
BLOCKED=0

if [ ! -f "$REVIEW_REPORT" ]; then
  echo "BLOCKED: Review report not found at $REVIEW_REPORT" >&2
  BLOCKED=1
fi

if [ ! -f "$TEST_REPORT" ]; then
  echo "BLOCKED: Test report not found at $TEST_REPORT" >&2
  BLOCKED=1
fi

if [ "$BLOCKED" -eq 1 ]; then
  echo "Ship gate failed: missing required reports." >&2
  exit 2
fi

echo "Ship gate passed: both review and test reports exist."
exit 0
`;

// ── Main generator ──

export function generateClaudeHooks(config: ProjectConfig): OutputFile[] {
  const files: OutputFile[] = [];

  // Always generate constraint-check.sh
  files.push({
    path: '.claude/hooks/constraint-check.sh',
    content: CONSTRAINT_CHECK_SCRIPT,
  });

  const allConstraints = config.flow.constraints;
  const enforcedConstraints = allConstraints.filter((c) => c.enforced);

  // Find enabled stages
  const enabledStages = config.flow.sprint.filter((s) => s.enabled);
  const stageByName = (name: string) => enabledStages.find((s) => s.name === name);

  // review-gate.sh: if enforced gate constraints exist for review or ship stages
  const hasReviewGateConstraints = enforcedConstraints.some((c) => {
    const stage = config.flow.sprint.find((s) => s.id === c.stageId);
    return stage && (stage.name === 'review' || stage.name === 'ship');
  });
  if (hasReviewGateConstraints || stageByName('review')) {
    files.push({
      path: '.claude/hooks/review-gate.sh',
      content: REVIEW_GATE_SCRIPT,
    });
  }

  // test-gate.sh: if enforced gate constraints exist for ship or test stages
  const hasTestGateConstraints = enforcedConstraints.some((c) => {
    const stage = config.flow.sprint.find((s) => s.id === c.stageId);
    return stage && (stage.name === 'ship' || stage.name === 'test');
  });
  if (hasTestGateConstraints || stageByName('test')) {
    files.push({
      path: '.claude/hooks/test-gate.sh',
      content: TEST_GATE_SCRIPT,
    });
  }

  // ship-gate.sh: if ship stage is enabled
  if (stageByName('ship')) {
    files.push({
      path: '.claude/hooks/ship-gate.sh',
      content: SHIP_GATE_SCRIPT,
    });
  }

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
