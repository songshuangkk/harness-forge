import type { ProjectConfig, OutputFile, AIEngine, Language, RoleName } from '@/types';
import { getRolePrompt } from '@/generators/core/rolePrompts';

// ── Engine-to-config-filename mapping (shared across generators) ──

const ENGINE_CONFIG_FILE: Record<AIEngine, string> = {
  'claude-code': 'CLAUDE.md',
  codex: 'AGENTS.md',
  cursor: '.cursorrules',
  custom: 'AI_CONFIG.md',
};

export function getConfigFilename(engine: AIEngine): string {
  return ENGINE_CONFIG_FILE[engine];
}

// ── Label maps ──

const LANGUAGE_LABELS: Record<Language, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  go: 'Go',
  java: 'Java',
  rust: 'Rust',
  dart: 'Dart',
};

// ── Main export — slim CLAUDE.md (< 100 lines) ──

export function generateClaudeMd(config: ProjectConfig): OutputFile {
  const enabledStages = config.flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  const projectName = config.project.name || 'Project';
  const projectDesc = config.project.description || '';
  const { techStack } = config.project;
  const { session, harness, sandbox } = config.architecture;

  // Sprint flow diagram
  const flowDiagram = enabledStages
    .map((s) => s.name.charAt(0).toUpperCase() + s.name.slice(1))
    .join(' → ');

  // Slash command list
  const commandList = enabledStages
    .map((s) => `- \`/${s.name}\``)
    .join(', ');

  // Stage → role mapping (one-liner each)
  const configuredRoles = config.flow.roles;
  const roleLines = enabledStages
    .filter((s) => s.roles.length > 0)
    .map((s) => {
      const label = s.name.charAt(0).toUpperCase() + s.name.slice(1);
      const roles = s.roles.map((r: RoleName) => getRolePrompt(r, configuredRoles).label).join('+');
      return `- ${label}: ${roles}`;
    });

  // Enforced constraints (short list)
  const enforced = config.flow.constraints.filter((c) => c.enforced);
  const constraintLines = enforced.length > 0
    ? enforced.map((c) => `- [${c.type}] ${c.description}`)
    : [];

  const lines = [
    `# ${projectName}`,
    '',
    ...(projectDesc ? [projectDesc, ''] : []),
    '## Architecture',
    '',
    `- **Stack**: ${LANGUAGE_LABELS[techStack.language]}${techStack.stackDescription ? ` — ${techStack.stackDescription}` : ''}`,
    `- **Session**: ${session.storage} | **Harness**: ${harness.engine} | **Sandbox**: ${sandbox.type}`,
    '',
    '## Sprint Flow',
    '',
    '```',
    flowDiagram,
    '```',
    '',
    `Commands: ${commandList}`,
    '',
    ...(roleLines.length > 0 ? ['### Roles', '', ...roleLines, ''] : []),
    ...(constraintLines.length > 0 ? ['## Enforced Constraints', '', ...constraintLines, ''] : []),
    '## State Machine Protocol',
    '',
    '**MANDATORY — guard.sh will BLOCK any violation at runtime.**',
    '',
    '1. Initialize: `bash .claude/scripts/session-init.sh`',
    '2. You **MUST** use slash commands (`/think`, `/build`, etc.) to enter each stage',
    '3. You **MUST NOT** skip stages — complete all gates before requesting advancement',
    '4. You **MUST NOT** modify source code files (`src/**`, `*.java`, `*.ts`, etc.) during think, plan, review, or reflect stages',
    '5. Only the build stage allows writing to `src/**` and `test/**`',
    '6. If guard.sh blocks you, stop and complete the current stage deliverables instead of retrying',
    '7. Each slash command calls `transition.sh` to validate gates before advancing',
    '8. `advance.sh` checks gates after each tool use and auto-marks stage as passed',
    '9. Check status: `bash .harness/scripts/check.sh`',
    '',
    '## Security Boundary',
    '',
    '- **NEVER** modify `.harness/state.json` or `.harness/constraints.json`',
    '- **NEVER** modify `.claude/hooks/` or `.claude/scripts/`',
    '- **NEVER** bypass guard.sh by using alternative write methods',
    '',
    '## File Structure',
    '',
    '```',
    `${projectName}/`,
    '  CLAUDE.md              ← you are here',
    '  .claude/',
    '    settings.json        ← hooks + permissions + MCP',
    '    commands/*.md        ← slash command definitions',
    '    hooks/*.sh           ← guard.sh, advance.sh, transition.sh',
    '    scripts/*.sh         ← session-init, session-save',
    '  .harness/',
    '    config.yaml          ← project config',
    '    constraints.json     ← state machine rules',
    '    state.json           ← runtime state (read-only to you)',
    '    roles/*.md           ← role definitions',
    '    flows/*.md           ← stage definitions',
    '```',
    '',
  ];

  return {
    path: 'CLAUDE.md',
    content: lines.join('\n'),
  };
}
