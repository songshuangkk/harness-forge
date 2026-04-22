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

  // Slash command list — /sprint is primary
  const commandList = ['`/sprint`'].concat(
    enabledStages.map((s) => `\`/${s.name}\``)
  ).join(', ');

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
    '## Sprint Protocol',
    '',
    '**Use `/sprint` as the primary command** for any development task — it auto-guides through all enabled stages.',
    'Individual stage commands (`/think`, `/build`, etc.) remain available for direct access.',
    '',
    '1. Start: type `/sprint` — initializes if needed, resumes from current stage',
    '2. Each stage has its own write-path scope — `guard.sh` enforces this via `.harness/sprint-guard-active` marker',
    '3. `advance.sh` checks gates after each tool use and auto-marks stage as passed',
    '4. `transition.sh` validates gates before stage advancement',
    '5. Check status anytime: `bash .harness/scripts/check.sh`',
    '',
    '### Skill Bypass',
    '',
    'When invoking any skill (via `/command`), sprint restrictions auto-pause.',
    'The guard creates `.harness/skill-bypass` — sprint rules resume on next stage transition.',
    '',
    '### Role Negotiation (Think + Plan — MANDATORY when multi-role)',
    '',
    'Think and Plan stages with 2+ assigned roles MUST complete negotiation before advancing:',
    '',
    '1. **Init**: `bash .claude/scripts/negotiate.sh init <stage> <role1,role2,...>`',
    '2. **Round 1**: Spawn sub-agents in parallel — each role independently reviews stage docs, writes to `docs/negotiation/round-1/<role>.md`',
    '3. **Verify Round 1**: `bash .claude/scripts/negotiate.sh check-round 1`',
    '4. **Round 2**: Spawn sub-agents — each role reads ALL Round 1 perspectives, writes revised assessment to `docs/negotiation/round-2/<role>.md`',
    '5. **Verify Round 2**: `bash .claude/scripts/negotiate.sh check-round 2`',
    '6. **Synthesize**: Read all Round 2 files, write `docs/negotiation/consensus.md` with agreed points, trade-offs, and resolution',
    '7. **Gate check**: `transition.sh` will block advancement if consensus.md is missing `## Consensus` section',
    '',
    '## Security Boundary',
    '',
    '- `.harness/state.json`, `.harness/constraints.json` — managed by hooks only, do not modify directly',
    '- `.claude/hooks/`, `.claude/scripts/` — enforcement scripts, read-only',
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
