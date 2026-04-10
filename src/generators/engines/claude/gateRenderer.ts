import type { GateCheck } from './gateBuilder';

// ── Bash check renderers ──

function renderFileExists(paths: string[], description: string): string {
  const path = paths[0];
  return `# ${description}
if [ ! -f "${path}" ]; then
  echo "BLOCKED: Artifact not found: ${path}" >&2
  BLOCKED=1
fi`;
}

function renderFileNonEmpty(paths: string[], description: string): string {
  const path = paths[0];
  return `# ${description}
if [ ! -s "${path}" ]; then
  echo "BLOCKED: Artifact is empty or missing: ${path}" >&2
  BLOCKED=1
fi`;
}

function renderFileContainsSection(
  paths: string[],
  sectionHeader: string | undefined,
  description: string
): string {
  const path = paths[0];
  const marker = sectionHeader ?? '## Unknown';
  return `# ${description}
if ! grep -q "${marker}" "${path}" 2>/dev/null; then
  echo "BLOCKED: Section '${marker}' not found in ${path}" >&2
  BLOCKED=1
fi`;
}

function renderCommandBlocklist(
  patterns: string[],
  _description: string
): string {
  const patternLines = patterns.map((p) => `  "${p}"`).join('\n');
  return `# Block dangerous commands
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | grep -o '"command":"[^"]*"' | head -1 | sed 's/"command":"//;s/"//')

if [ -z "$COMMAND" ]; then
  exit 0
fi

LOWER=$(echo "$COMMAND" | tr '[:upper:]' '[:lower:]')

PATTERNS=(
${patternLines}
)

for PATTERN in "\${PATTERNS[@]}"; do
  if echo "$LOWER" | grep -q "$PATTERN"; then
    echo "BLOCKED: Command matches dangerous pattern: $PATTERN" >&2
    exit 2
  fi
done

exit 0`;
}

// ── Main renderer ──

export function renderGateScript(
  name: string,
  checks: GateCheck[]
): string {
  // constraint-check has special structure (reads stdin, exits immediately)
  if (name === 'constraint-check') {
    const blocklistCheck = checks.find(
      (c) => c.checkType === 'command-blocklist'
    );
    if (!blocklistCheck) {
      // No blocklist patterns — generate a passthrough
      return `#!/usr/bin/env bash\n# ${name}.sh — No constraints configured\nexit 0\n`;
    }

    const body = renderCommandBlocklist(
      blocklistCheck.params.patterns ?? [],
      blocklistCheck.description
    );

    return [
      '#!/usr/bin/env bash',
      `# ${name}.sh — Block dangerous commands`,
      `# Generated from check: ${blocklistCheck.id}`,
      '# Reads stdin JSON, extracts the command, and blocks destructive operations.',
      '# Exit 0 = allow, exit 2 = block.',
      '',
      'set -euo pipefail',
      '',
      body,
    ].join('\n');
  }

  // Gate scripts: check artifacts with BLOCKED counter
  const checkBlocks: string[] = [];

  for (const check of checks) {
    switch (check.checkType) {
      case 'file-exists':
        checkBlocks.push(
          renderFileExists(
            check.params.paths ?? [],
            check.description
          )
        );
        break;
      case 'file-non-empty':
        checkBlocks.push(
          renderFileNonEmpty(
            check.params.paths ?? [],
            check.description
          )
        );
        break;
      case 'file-contains-section':
        checkBlocks.push(
          renderFileContainsSection(
            check.params.paths ?? [],
            check.params.sectionHeader,
            check.description
          )
        );
        break;
      default:
        break;
    }
  }

  if (checkBlocks.length === 0) {
    return `#!/usr/bin/env bash\n# ${name}.sh — No checks configured\nexit 0\n`;
  }

  const sourceIds = checks.map((c) => c.id).join(', ');
  const stages = [...new Set(checks.map((c) => c.forStage))].join(', ');

  const lines = [
    '#!/usr/bin/env bash',
    `# ${name}.sh — Gate verification`,
    `# Generated from checks: ${sourceIds}`,
    `# Stages: ${stages}`,
    '# Exit 0 = pass, exit 2 = block.',
    '',
    'set -euo pipefail',
    '',
    'BLOCKED=0',
    '',
    checkBlocks.join('\n\n'),
    '',
    'if [ "$BLOCKED" -eq 1 ]; then',
    `  echo "${name} failed: missing required artifacts or constraints." >&2`,
    '  exit 2',
    'fi',
    '',
    `echo "${name} passed."`,
    'exit 0',
  ];

  return lines.join('\n');
}

/**
 * Maps gate names to hook script filenames.
 */
export function gateScriptPath(gateName: string): string {
  return `.claude/hooks/${gateName}.sh`;
}
