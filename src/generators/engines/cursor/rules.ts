import type { OutputFile, ProjectConfig, StageName, SprintStage, StageSpecificConfig } from '@/types';

const STAGE_TOOL_RULES: Record<string, { allow: string[]; deny: string[]; writePaths: string[] }> = {
  think: { allow: ['Read', 'Grep', 'Glob', 'Agent'], deny: ['Write', 'Edit', 'Bash'], writePaths: ['docs/**'] },
  plan: { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Agent'], deny: ['Bash'], writePaths: ['docs/**'] },
  build: { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash', 'Agent'], deny: [], writePaths: ['src/**', 'test/**', 'docs/**'] },
  review: { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit'], deny: ['Bash'], writePaths: ['docs/**'] },
  test: { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash'], deny: [], writePaths: ['test/**', 'docs/**'] },
  ship: { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash'], deny: [], writePaths: ['**'] },
  reflect: { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit'], deny: ['Bash'], writePaths: ['docs/**'] },
};

const STAGE_ORDER: StageName[] = ['think', 'plan', 'build', 'review', 'test', 'ship', 'reflect'];

const STAGE_TITLES: Record<StageName, string> = {
  think: 'Think',
  plan: 'Plan',
  build: 'Build',
  review: 'Review',
  test: 'Test',
  ship: 'Ship',
  reflect: 'Reflect',
};

const STAGE_DESCRIPTIONS: Record<StageName, string> = {
  think: 'Analyze the problem through forcing questions. Cover all enabled dimensions. Produce design doc.',
  plan: 'Create implementation plan with multi-role review. Break into structured tasks.',
  build: 'Implement the plan. Use TDD if enforced. Execute with subagents if configured.',
  review: 'Audit implementation against plan. Check each enabled dimension.',
  test: 'Run all configured test types. Measure coverage against target.',
  ship: 'Execute release pipeline steps. Bump version, update changelog, deploy.',
  reflect: 'Conduct retrospective. Review sprint dimensions.',
};

function buildAlwaysRule(config: ProjectConfig): OutputFile {
  const { project, architecture, flow } = config;

  const lines: string[] = [
    '---',
    'description: Project architecture and global constraints',
    'alwaysApply: true',
    '---',
    '',
    `# ${project.name || 'Project'}`,
  ];

  if (project.description) {
    lines.push(project.description);
  }

  lines.push('', '## Architecture');
  lines.push(`- Session: ${architecture.session.storage}`);
  lines.push(`- Harness: ${architecture.harness.engine}`);
  lines.push(`- Sandbox: ${architecture.sandbox.type}`);

  const enabledStages = STAGE_ORDER
    .filter((name) => flow.sprint.some((s) => s.name === name && s.enabled));

  lines.push('', '## Sprint Flow');
  for (const name of enabledStages) {
    lines.push(`- ${STAGE_TITLES[name]}`);
  }

  const enforced = flow.constraints.filter((c) => c.enforced);
  if (enforced.length > 0) {
    lines.push('', '## Enforced Constraints');
    for (const c of enforced) {
      lines.push(`- ${c.description}`);
    }
  }

  return {
    path: '.cursor/rules/always.mdc',
    content: lines.join('\n') + '\n',
  };
}

function buildStageRule(stage: SprintStage, globalConstraints: string[]): OutputFile {
  const { name, gates, stageConfig } = stage;
  const title = STAGE_TITLES[name];
  const description = STAGE_DESCRIPTIONS[name];

  const lines: string[] = [
    '---',
    `description: ${title} stage rules`,
    'alwaysApply: false',
    '---',
    '',
    `# ${title}`,
    '',
    description,
    '',
    '## Process',
  ];

  // Process steps derived from stage config
  const processSteps = buildProcessSteps(name, stageConfig);
  for (const step of processSteps) {
    lines.push(step);
  }

  // State machine constraint advisory
  const stageToolRules = STAGE_TOOL_RULES[stage.name];
  if (stageToolRules) {
    lines.push('', '## Constraints (Auto-enforced in Claude Code, advisory here)', '');
    lines.push('State file: `.harness/state.json`');
    lines.push(`Current stage: ${stage.name}`);
    lines.push('');
    if (stageToolRules.deny.length > 0) {
      lines.push(`**Blocked tools**: ${stageToolRules.deny.join(', ')}`);
    }
    if (stageToolRules.writePaths.length > 0) {
      lines.push(`**Write allowed only in**: ${stageToolRules.writePaths.join(', ')}`);
    }
    lines.push('');
    lines.push('Read `.harness/constraints.json` for the full constraint rules.');
  }

  // Gates
  if (gates.length > 0) {
    lines.push('', '## Gates');
    for (const gate of gates) {
      lines.push(`- [ ] ${gate}`);
    }
  }

  // Constraints: stage-specific + global
  const allConstraints = [...getStageConstraints(stage), ...globalConstraints];
  if (allConstraints.length > 0) {
    lines.push('', '## Constraints');
    for (const c of allConstraints) {
      lines.push(`- ${c}`);
    }
  }

  // Stage config as JSON block
  if (stageConfig) {
    lines.push('', '## Configuration', '', '```json');
    lines.push(JSON.stringify(stageConfig, null, 2));
    lines.push('```');
  }

  return {
    path: `.cursor/rules/${name}.mdc`,
    content: lines.join('\n') + '\n',
  };
}

function buildProcessSteps(name: StageName, config?: StageSpecificConfig): string[] {
  switch (name) {
    case 'think': {
      const c = config as import('@/types').ThinkConfig | undefined;
      const dims = c?.dimensions ?? [];
      const steps = ['1. Define the problem scope'];
      if (dims.length > 0) {
        steps.push(`2. Explore dimensions: ${dims.join(', ')}`);
      } else {
        steps.push('2. Explore all relevant dimensions');
      }
      steps.push('3. Produce design document');
      return steps;
    }
    case 'plan': {
      const c = config as import('@/types').PlanConfig | undefined;
      const reviews = c?.reviewTypes ?? [];
      const steps = ['1. Break down into tasks'];
      if (reviews.length > 0) {
        steps.push(`2. Run reviews: ${reviews.join(', ')}`);
      } else {
        steps.push('2. Run all configured reviews');
      }
      steps.push('3. Finalize implementation plan');
      return steps;
    }
    case 'build': {
      const c = config as import('@/types').BuildConfig | undefined;
      const steps = ['1. Review plan and task list'];
      if (c?.tddMode === 'enforced') {
        steps.push('2. Write failing tests (RED)');
        steps.push('3. Implement to pass (GREEN)');
        steps.push('4. Refactor (REFACTOR)');
      } else {
        steps.push('2. Implement changes');
      }
      return steps;
    }
    case 'review': {
      const c = config as import('@/types').ReviewConfig | undefined;
      const dims = c?.reviewDimensions ?? [];
      if (dims.length > 0) {
        return dims.map((d, i) => `${i + 1}. Review: ${d}`);
      }
      return ['1. Review implementation against plan'];
    }
    case 'test': {
      const c = config as import('@/types').TestConfig | undefined;
      const types = c?.testTypes ?? [];
      if (types.length > 0) {
        return types.map((t, i) => `${i + 1}. Run ${t} tests`);
      }
      return ['1. Run test suite'];
    }
    case 'ship': {
      const c = config as import('@/types').ShipConfig | undefined;
      const pipeline = c?.pipeline ?? [];
      if (pipeline.length > 0) {
        return pipeline.map((p, i) => `${i + 1}. ${p}`);
      }
      return ['1. Prepare release'];
    }
    case 'reflect': {
      const c = config as import('@/types').ReflectConfig | undefined;
      const dims = c?.dimensions ?? [];
      if (dims.length > 0) {
        return dims.map((d, i) => `${i + 1}. Review ${d}`);
      }
      return ['1. Conduct retrospective'];
    }
  }
}

function getStageConstraints(stage: SprintStage): string[] {
  // Extract constraint descriptions from the stage's enforced constraints
  // This is handled at the caller level via flow.constraints filtering
  return [];
}

export function generateCursorRules(config: ProjectConfig): OutputFile[] {
  const files: OutputFile[] = [buildAlwaysRule(config)];

  const globalEnforced = config.flow.constraints
    .filter((c) => c.enforced)
    .map((c) => c.description);

  const enabledStages = config.flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  for (const stage of enabledStages) {
    // Collect stage-specific enforced constraints
    const stageConstraints = config.flow.constraints
      .filter((c) => c.stageId === stage.id && c.enforced)
      .map((c) => c.description);

    files.push(buildStageRule(stage, stageConstraints.length > 0 ? stageConstraints : globalEnforced));
  }

  return files;
}
