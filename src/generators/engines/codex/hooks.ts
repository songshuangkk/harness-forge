import type { ProjectConfig, OutputFile } from '@/types';

// ── Hook script content ──

const PRE_BASH_POLICY_SCRIPT = `#!/usr/bin/env bash
# pre-bash-policy.sh — Block dangerous commands before execution
# Reads stdin JSON, extracts the command, and blocks destructive operations.
# Exit 0 = allow, exit 2 = block (Codex convention).

set -uo pipefail

INPUT=$(cat || true)
COMMAND=$(echo "$INPUT" | grep -o '"command":"[^"]*"' | head -1 | sed 's/"command":"//;s/"//' || true)

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
  "truncate"
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

const STOP_CONTINUE_SCRIPT = `#!/usr/bin/env bash
# stop-continue.sh — Verify docs/ directory exists before stopping
# Exit 0 = pass (with JSON on stdout), exit 2 = block with reason on stderr.

set -uo pipefail

if [ ! -d "docs" ]; then
  echo "BLOCKED: docs/ directory does not exist. Create it before stopping." >&2
  exit 2
fi

# Codex Stop hook requires JSON on stdout to continue
echo '{"decision":"block","reason":"docs/ exists, sprint artifacts verified"}'
exit 0
`;

// ── Hook script generator ──

export function generateCodexHookScripts(config: ProjectConfig): OutputFile[] {
  const files: OutputFile[] = [];

  // Always generate pre-bash-policy.sh
  files.push({
    path: '.codex/hooks/pre-bash-policy.sh',
    content: PRE_BASH_POLICY_SCRIPT,
  });

  // Generate stop-continue.sh if any stage is enabled
  const hasEnabledStages = config.flow.sprint.some((s) => s.enabled);
  if (hasEnabledStages) {
    files.push({
      path: '.codex/hooks/stop-continue.sh',
      content: STOP_CONTINUE_SCRIPT,
    });
  }

  return files;
}

// ── hooks.json generator ──

interface HookEntry {
  type: string;
  command: string;
}

interface HookGroup {
  matcher: string;
  hooks: HookEntry[];
}

interface HooksJson {
  hooks: Record<string, HookGroup[]>;
}

export function generateCodexHooksJson(config: ProjectConfig): OutputFile {
  const hooks: HooksJson['hooks'] = {};

  // PreToolUse -> Bash -> pre-bash-policy.sh
  hooks['PreToolUse'] = [
    {
      matcher: 'Bash',
      hooks: [
        {
          type: 'command',
          command: 'bash .codex/hooks/pre-bash-policy.sh',
        },
      ],
    },
  ];

  // Stop -> stop-continue.sh (if any stage enabled)
  const hasEnabledStages = config.flow.sprint.some((s) => s.enabled);
  if (hasEnabledStages) {
    hooks['Stop'] = [
      {
        matcher: '',
        hooks: [
          {
            type: 'command',
            command: 'bash .codex/hooks/stop-continue.sh',
          },
        ],
      },
    ];
  }

  return {
    path: '.codex/hooks.json',
    content: JSON.stringify({ hooks }, null, 2),
  };
}
