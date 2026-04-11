import type { ProjectConfig, OutputFile, StageName } from '@/types';

const STAGE_LABELS: Record<StageName, string> = {
  think: 'Think',
  plan: 'Plan',
  build: 'Build',
  review: 'Review',
  test: 'Test',
  ship: 'Ship',
  reflect: 'Reflect',
};

const ROLE_LABELS: Record<string, string> = {
  ceo: 'CEO / Founder',
  designer: 'Designer',
  'eng-manager': 'Eng Manager',
  qa: 'QA Lead',
  security: 'Security Officer',
  release: 'Release Engineer',
  'doc-engineer': 'Doc Engineer',
};

function architectureSection(config: ProjectConfig): string {
  const { session, harness, sandbox } = config.architecture;
  return [
    '## Architecture',
    '',
    `- **Session**: ${session.storage} storage, ${session.eventRetention} events retained, recovery via ${session.recoveryStrategy}`,
    `- **Harness**: ${harness.engine} engine, ${harness.contextStrategy} context strategy, ${harness.maxRetries} max retries`,
    `- **Sandbox**: ${sandbox.type} execution, ${sandbox.credentialPolicy} credential policy`,
    '',
  ].join('\n');
}

function sprintFlowSection(config: ProjectConfig): string {
  const enabledStages = config.flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  if (enabledStages.length === 0) {
    return '## Sprint Flow\n\nNo sprint stages configured.\n';
  }

  const flowDiagram = enabledStages
    .map((s) => STAGE_LABELS[s.name])
    .join(' → ');

  const stageDetails = enabledStages.map((stage) => {
    const label = STAGE_LABELS[stage.name];
    const roles = stage.roles.map((r) => ROLE_LABELS[r] || r).join(', ') || '—';
    return `- **${label}**: ${roles}`;
  });

  return [
    '## Sprint Flow',
    '',
    `\`${flowDiagram}\``,
    '',
    ...stageDetails,
    '',
  ].join('\n');
}

function enforcedConstraintsSection(config: ProjectConfig): string {
  const enforced = config.flow.constraints.filter((c) => c.enforced);
  if (enforced.length === 0) return '';

  const lines: string[] = ['## Enforced Constraints', ''];
  for (const c of enforced) {
    lines.push(`- [${c.type}] ${c.description}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function generateAgentsMd(config: ProjectConfig): OutputFile {
  const sections = [
    `# ${config.project.name || 'Project'}`,
    '',
    config.project.description || '',
    '',
    '> **Enforcement Level: Advisory** — Codex does not support runtime hooks. Constraints below are prompt-level guidelines, not hard blocks. For full enforcement, use Claude Code engine.',
    '',
    architectureSection(config),
    sprintFlowSection(config),
    enforcedConstraintsSection(config),
    '## Skills',
    '',
    'Stage-specific skills are defined in `.codex/skills/`. Each skill directory contains a `SKILL.md` with gates, constraints, and configuration for its sprint stage.',
    '',
  ].filter(Boolean);

  return {
    path: 'AGENTS.md',
    content: sections.join('\n'),
  };
}
