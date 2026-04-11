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
    '## Protocol',
    '',
    '1. Initialize: `bash .claude/scripts/session-init.sh`',
    '2. Use slash commands (`/think`, `/plan`, etc.) to advance stages',
    '3. Each slash command calls `transition.sh` to enforce gate checks',
    '4. `guard.sh` blocks disallowed tools per stage; `advance.sh` checks gates after each action',
    '5. Stage/role details: read `.harness/roles/{role}.md` and `.harness/flows/{stage}.md` on entry',
    '',
    '## Security Boundary',
    '',
    '- **NEVER** modify `.harness/state.json` or `.harness/constraints.json`',
    '- **NEVER** modify `.claude/hooks/` or `.claude/scripts/`',
    '- If a gate blocks you, complete the current stage requirements first',
    '- Check status: `bash .harness/scripts/check.sh`',
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
