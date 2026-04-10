import type { ProjectConfig, OutputFile } from '@/types';

// ── Session init script (all modes) ──

const SESSION_INIT_SCRIPT = `#!/usr/bin/env bash
# session-init.sh — Initialize session storage
set -euo pipefail

mkdir -p .claude/sessions
echo "Session initialized at .claude/sessions/"
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

  return files;
}
