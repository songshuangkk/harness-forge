import type { ProjectConfig, OutputFile } from '@/types';
import { buildGateChecks } from './gateBuilder';
import { renderGateScript, gateScriptPath } from './gateRenderer';
import { hasSecretCheck } from './sandboxScripts';

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
