import type { ProjectConfig, OutputFile, StageName, StageSpecificConfig, ThinkConfig, PlanConfig, BuildConfig, ReviewConfig, TestConfig, ShipConfig, ReflectConfig, RoleName } from '@/types';

// ── Stage metadata (descriptions, inputs, outputs) ──

interface StageMeta {
  title: string;
  description: string;
  input: string;
  output: string;
}

const STAGE_META: Record<StageName, StageMeta> = {
  think: {
    title: 'Think \u2014 Problem Redefinition',
    description: 'Redefine the problem through forcing questions and Socratic refinement. Analyze historical context, success metrics, constraints, and alternatives before committing to a plan.',
    input: 'User request or feature description. Historical session events for context analysis.',
    output: 'Design document with refined problem statement, success metrics, identified constraints, and scope boundaries. Auto-feeds into the Plan stage.',
  },
  plan: {
    title: 'Plan \u2014 Multi-Role Architecture Review',
    description: 'Multi-role architecture review with structured task breakdown. CEO, Designer, Eng Manager, and DX Lead each review from their perspective. Tasks include file paths and verification steps.',
    input: 'Design document from Think stage. Project architecture config and constraint rules.',
    output: 'Implementation plan with per-task file paths and verification steps. Review sign-offs from each configured role.',
  },
  build: {
    title: 'Build \u2014 Implementation',
    description: 'Execute the implementation plan using the configured execution strategy. Supports single-agent sequential or subagent parallel development with optional TDD enforcement.',
    input: 'Implementation plan from Plan stage. Sprint constraints and stage-specific build configuration.',
    output: 'Source code and test files. Build artifacts ready for review.',
  },
  review: {
    title: 'Review \u2014 Multi-Dimensional Quality Audit',
    description: 'Two-stage quality review: spec compliance verification followed by code quality assessment. Staff Engineer and Security Officer review from their dimensions. Auto-fix optional.',
    input: 'Build output (source code + tests). Implementation plan for spec compliance checking.',
    output: 'Review report with severity-rated issues. Auto-fixed code if configured.',
  },
  test: {
    title: 'Test \u2014 Evidence-Based Verification',
    description: 'Verify output through evidence, not claims. Run configured test methodologies against coverage targets. Evidence over assertions.',
    input: 'Reviewed code from Review stage. Test strategy from stage configuration.',
    output: 'Test results with coverage report. Evidence package for ship gate.',
  },
  ship: {
    title: 'Ship \u2014 Release',
    description: 'Execute the release pipeline: run final tests, create PR, merge, and deploy. Session replay serves as audit trail. Version bumping and deployment target management.',
    input: 'Test evidence package from Test stage. All gate approvals.',
    output: 'Release notes and deployment manifest. Version bump commit.',
  },
  reflect: {
    title: 'Reflect \u2014 Retrospective',
    description: 'Team-aware retrospective using session event logs as data source. Analyze velocity, quality, test health, and growth dimensions. Optionally persist learnings to project memory.',
    input: 'Complete session event log. Sprint metrics from all previous stages.',
    output: 'Retrospective report with improvement items. Optional project memory updates.',
  },
};

// ── Role label map ──

const ROLE_LABELS: Record<string, string> = {
  ceo: 'CEO / Founder',
  designer: 'Designer',
  'eng-manager': 'Eng Manager',
  qa: 'QA Lead',
  security: 'Security Officer',
  release: 'Release Engineer',
  'doc-engineer': 'Doc Engineer',
};

// ── Stage-specific config formatting ──

function formatStageConfigBullets(name: StageName, config: StageSpecificConfig): string[] {
  const bullets: string[] = [];
  switch (name) {
    case 'think': {
      const c = config as ThinkConfig;
      if (c.dimensions.length > 0) bullets.push(`- Dimensions: ${c.dimensions.join(', ')}`);
      bullets.push(`- Depth: ${c.depth}`);
      break;
    }
    case 'plan': {
      const c = config as PlanConfig;
      if (c.reviewTypes.length > 0) bullets.push(`- Review types: ${c.reviewTypes.join(', ')}`);
      bullets.push(`- Task structure: ${c.taskStructure}`);
      break;
    }
    case 'build': {
      const c = config as BuildConfig;
      bullets.push(`- Execution strategy: ${c.executionStrategy}`);
      bullets.push(`- TDD mode: ${c.tddMode}`);
      break;
    }
    case 'review': {
      const c = config as ReviewConfig;
      if (c.reviewDimensions.length > 0) bullets.push(`- Review dimensions: ${c.reviewDimensions.join(', ')}`);
      bullets.push(`- Auto-fix: ${c.autoFix}`);
      bullets.push(`- Severity threshold: ${c.severityThreshold}`);
      break;
    }
    case 'test': {
      const c = config as TestConfig;
      if (c.testMethods.length > 0) bullets.push(`- Test methods: ${c.testMethods.join(', ')}`);
      bullets.push(`- Coverage target: ${c.coverageTarget}%`);
      if (c.testTypes.length > 0) bullets.push(`- Test types: ${c.testTypes.join(', ')}`);
      if (c.environment) bullets.push(`- Environment: ${c.environment}`);
      break;
    }
    case 'ship': {
      const c = config as ShipConfig;
      if (c.pipeline.length > 0) bullets.push(`- Pipeline: ${c.pipeline.join(' \u2192 ')}`);
      bullets.push(`- Version strategy: ${c.versionStrategy}`);
      if (c.deploymentTargets.length > 0) bullets.push(`- Deployment targets: ${c.deploymentTargets.join(', ')}`);
      break;
    }
    case 'reflect': {
      const c = config as ReflectConfig;
      if (c.dimensions.length > 0) bullets.push(`- Dimensions: ${c.dimensions.join(', ')}`);
      bullets.push(`- Persist learning: ${c.persistLearning}`);
      break;
    }
  }
  return bullets;
}

// ── Main generator ──

export function generateCoreFlows(config: ProjectConfig): OutputFile[] {
  const enabledStages = config.flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  if (enabledStages.length === 0) return [];

  const allConstraints = config.flow.constraints;

  return enabledStages.map((stage) => {
    const meta = STAGE_META[stage.name];
    const roleLabels = stage.roles.map((r: RoleName) => ROLE_LABELS[r] || r);

    // Constraints for this stage + global constraints (stageId: '*')
    const stageConstraints = allConstraints.filter(
      (c) => c.stageId === stage.id || c.stageId === '*'
    );

    const lines: string[] = [
      `# ${meta.title}`,
      '',
      meta.description,
      '',
      '## Input',
      '',
      meta.input,
      '',
      '## Output',
      '',
      meta.output,
      '',
      '## Roles',
      '',
    ];

    for (const label of roleLabels) {
      lines.push(`- ${label}`);
    }

    // Gates
    lines.push('', '## Gates', '');
    if (stage.gates.length > 0) {
      for (const gate of stage.gates) {
        lines.push(`- [ ] ${gate}`);
      }
    } else {
      lines.push('None configured.');
    }

    // Constraints
    lines.push('', '## Constraints', '');
    if (stageConstraints.length > 0) {
      for (const c of stageConstraints) {
        const badge = c.enforced ? '[ENFORCED]' : '[ADVISORY]';
        lines.push(`- ${badge} ${c.description}`);
      }
    } else {
      lines.push('None.');
    }

    // Configuration
    if (stage.stageConfig) {
      const configBullets = formatStageConfigBullets(stage.name, stage.stageConfig);
      if (configBullets.length > 0) {
        lines.push('', '## Configuration', '');
        lines.push(...configBullets);
      }
    }

    lines.push('');
    return {
      path: `.harness/flows/${stage.name}.md`,
      content: lines.join('\n'),
    };
  });
}
