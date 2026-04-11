import type { ProjectConfig, OutputFile, StageName } from '@/types';

const STAGE_TOOL_RULES: Record<string, { allow: string[]; deny: string[]; writePaths: string[] }> = {
  think: { allow: ['Read', 'Grep', 'Glob', 'Agent'], deny: ['Write', 'Edit', 'Bash'], writePaths: ['docs/**'] },
  plan: { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Agent'], deny: ['Bash'], writePaths: ['docs/**'] },
  build: { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash', 'Agent'], deny: [], writePaths: ['src/**', 'test/**', 'docs/**'] },
  review: { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit'], deny: ['Bash'], writePaths: ['docs/**'] },
  test: { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash'], deny: [], writePaths: ['test/**', 'docs/**'] },
  ship: { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash'], deny: [], writePaths: ['**'] },
  reflect: { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit'], deny: ['Bash'], writePaths: ['docs/**'] },
};

function formatStateMachineConstraints(stageName: string): string {
  const rules = STAGE_TOOL_RULES[stageName];
  if (!rules) return '';

  const lines: string[] = [
    '## Constraints (Auto-enforced in Claude Code, advisory here)',
    '',
    'State file: `.harness/state.json`',
    `Current stage: ${stageName}`,
    '',
  ];

  if (rules.deny.length > 0) {
    lines.push(`- DO NOT use: ${rules.deny.join(', ')}`);
  }
  if (rules.allow.length > 0) {
    lines.push(`- Allowed tools: ${rules.allow.join(', ')}`);
  }

  lines.push('', '### Write Restrictions');
  for (const p of rules.writePaths) {
    lines.push(`- Write allowed: ${p}`);
  }
  lines.push('');

  return lines.join('\n');
}

const STAGE_LABELS: Record<StageName, string> = {
  think: 'Think',
  plan: 'Plan',
  build: 'Build',
  review: 'Review',
  test: 'Test',
  ship: 'Ship',
  reflect: 'Reflect',
};

const STAGE_DESCRIPTIONS: Record<StageName, string> = {
  think: 'Analyze the problem through forcing questions. Cover all enabled dimensions. Produce design doc at docs/plans/design.md.',
  plan: 'Create implementation plan reviewed from multiple perspectives. Break into tasks with file paths and verification steps. Write to docs/plans/implementation-plan.md.',
  build: 'Implement the plan. Use TDD if enforced. Execute with subagents if configured. Commit after each task.',
  review: 'Audit implementation against plan. Check each enabled dimension. Rate issues by severity. Write report to docs/reviews/review-report.md.',
  test: 'Run all configured test types. Measure coverage. Write report to docs/reports/test-report.md.',
  ship: 'Execute release pipeline steps. Bump version, update changelog, deploy to targets.',
  reflect: 'Conduct retrospective. Review sprint dimensions. Write report to docs/reports/retrospective.md.',
};

function formatGates(stage: { gates: string[] }): string {
  if (stage.gates.length === 0) return '';
  const lines: string[] = ['## Gates', ''];
  for (const gate of stage.gates) {
    lines.push(`- [ ] ${gate}`);
  }
  lines.push('');
  return lines.join('\n');
}

function formatConstraints(config: ProjectConfig, stageId: string): string {
  const stageConstraints = config.flow.constraints.filter((c) => c.stageId === stageId);
  const globalConstraints = config.flow.constraints.filter((c) => c.stageId === '' || c.stageId === 'global');
  const all = [...stageConstraints, ...globalConstraints];
  if (all.length === 0) return '';

  const lines: string[] = ['## Constraints', ''];
  for (const c of all) {
    const badge = c.enforced ? '[ENFORCED]' : '[ADVISORY]';
    lines.push(`- ${badge} (${c.type}) ${c.description}`);
  }
  lines.push('');
  return lines.join('\n');
}

function formatConfig(stageConfig: unknown): string {
  if (!stageConfig) return '';
  return [
    '## Config',
    '',
    '```json',
    JSON.stringify(stageConfig, null, 2),
    '```',
    '',
  ].join('\n');
}

export function generateCodexSkills(config: ProjectConfig): OutputFile[] {
  const enabledStages = config.flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  if (enabledStages.length === 0) return [];

  return enabledStages.map((stage) => {
    const label = STAGE_LABELS[stage.name];
    const description = STAGE_DESCRIPTIONS[stage.name];

    const sections = [
      `# ${label}`,
      '',
      description,
      '',
      formatStateMachineConstraints(stage.name),
      formatGates(stage),
      formatConstraints(config, stage.id),
      formatConfig(stage.stageConfig),
    ].filter(Boolean);

    return {
      path: `.codex/skills/${stage.name}/SKILL.md`,
      content: sections.join('\n'),
    };
  });
}
