import type { ProjectConfig, OutputFile, StageName, RoleName, RoleConfig, StageSpecificConfig, ThinkConfig, PlanConfig, BuildConfig, ReviewConfig, TestConfig, ShipConfig, ReflectConfig } from '@/types';
import { getRolePrompt } from '@/generators/core/rolePrompts';

// ── Stage process content (real methodology, not placeholders) ──

interface StageCommand {
  title: string;
  description: string;
  process: string;
}

// ── Dynamic process generators for plan and build ──

function generatePlanProcess(taskStructure: 'simple' | 'structured'): string {
  if (taskStructure === 'structured') {
    return `## Process

1. **Read the design document** from the Think stage. Confirm understanding.
2. **Break down into tasks** using this mandatory template:

\`\`\`yaml
- task_id: T001
  title: "Brief description"
  file_path: "src/path/to/file.ts"
  description: "What this task accomplishes"
  complexity: S|M|L
  verification_steps:
    - "Specific check to confirm this task is done"
    - "Another verification step"
  subagent_hint: "Independent | Blocked by T00X | Sequential"
  dependencies: [T00X]
  acceptance_criteria:
    - "Measurable criterion 1"
    - "Measurable criterion 2"
\`\`\`

   Every task MUST have all fields. \`subagent_hint\` determines parallel execution strategy in Build.
3. **Run multi-role review** (see Role Perspectives below for each role's focus).
4. **Order tasks** by dependency graph. Mark independent tasks with \`subagent_hint: Independent\`.
5. **Verify each task** has concrete file_path and at least 2 verification_steps.
6. **Estimate risk areas** and plan mitigation for each.
7. Output to \`docs/plans/implementation-plan.md\` with the structured task list.`;
  }

  return `## Process

1. **Read the design document** from the Think stage. Confirm understanding.
2. **Break down into tasks** with:
   - File paths that will be created or modified
   - Specific verification steps for each task
   - Estimated complexity (S/M/L)
3. **Run multi-role review** (see Role Perspectives below for each role's focus).
4. **Order tasks** by dependency. Identify what can run in parallel.
5. **Define acceptance criteria** for each task \u2014 concrete, testable.
6. **Estimate risk areas** and plan mitigation for each.
7. Output the implementation plan with task list, file paths, and verification steps.`;
}

function generateBuildProcess(
  executionStrategy: 'single-agent' | 'subagent-parallel',
  tddMode: 'enforced' | 'optional'
): string {
  const parts: string[] = [];

  // Core process
  parts.push(`## Process

1. **Read the implementation plan** from the Plan stage. Confirm all tasks are understood.`);

  // TDD section
  if (tddMode === 'enforced') {
    parts.push(`
## TDD Workflow (ENFORCED)

You MUST follow the Red-Green-Refactor cycle for every task:

1. **RED** \u2014 Write a failing test first. The test must reference a real acceptance criterion from the plan.

   Test stub structure:
   \`\`\`
   // test file: {corresponding_test_path}
   // Covers: {acceptance_criteria from plan}

   describe('{task_title}', () => {
     it('should {acceptance_criterion}', () => {
       // RED: This test should fail initially
     });
   });
   \`\`\`

2. **GREEN** \u2014 Write the minimum code to make the test pass. No gold-plating.
3. **REFACTOR** \u2014 Clean up while keeping all tests green. Move to next task.`);
  } else {
    parts.push(`
2. **Implement each task** from the plan sequentially.
3. **Write tests** after implementation for critical paths.`);
  }

  // Subagent parallel section
  if (executionStrategy === 'subagent-parallel') {
    parts.push(`
## Subagent Parallel Execution

Tasks marked \`subagent_hint: Independent\` can run in parallel using the Agent tool.

### Protocol

1. **Classify tasks** from the plan:
   - \`Independent\` tasks \u2192 spawn as parallel subagents (max 3 concurrent)
   - Tasks with dependencies \u2192 queue after their dependencies complete
   - Sequential tasks \u2192 execute in plan order
2. **Spawn subagents** for each parallel group using a single message with multiple Agent tool calls:
   - Each subagent receives: task definition + file context + verification steps
   - Each subagent works in isolation (\`isolation: "worktree"\`)
3. **Collect results** \u2014 wait for all subagents in the current group to complete
4. **Merge and validate** \u2014 resolve any conflicts between parallel changes
5. **Run integration tests** after all parallel tasks in a group complete
6. **Proceed to next group** until all tasks are done`);
  }

  // Closing steps
  parts.push(`
${tddMode === 'enforced' ? '4' : '4'}. **Follow the task order** from the plan unless there is a clear reason to deviate.
${tddMode === 'enforced' ? '5' : '5'}. **Commit incrementally** \u2014 one logical change per commit with a clear message.
${tddMode === 'enforced' ? '6' : '6'}. **Run existing tests** after each task to catch regressions early.
${tddMode === 'enforced' ? '7' : '7'}. **Document any deviations** from the plan and why they were necessary.
${tddMode === 'enforced' ? '8' : '8'}. Write build report to \`docs/reports/build-report.md\`.`);

  return parts.join('\n');
}

// ── Static process text for other stages ──

const STATIC_COMMANDS: Partial<Record<StageName, StageCommand>> = {
  think: {
    title: 'Think \u2014 Problem Redefinition',
    description: 'Redefine the problem through forcing questions before jumping to solutions.',
    process: `## Process

1. **Restate the request** in your own words. Write it down explicitly.
2. **Ask forcing questions** (not form-filling):
   - What is the real problem behind this request?
   - What does success look like in measurable terms?
   - What constraints are non-negotiable vs. assumed?
   - What alternatives were considered and rejected? Why?
   - What is the smallest useful scope that delivers value?
   - What could go wrong? List top 3 risks.
3. **Analyze historical context** from session events. Check if similar problems were solved before.
4. **Identify hidden assumptions** the requester may not have stated.
5. **Scope the work** \u2014 define what is in-scope and explicitly what is out-of-scope.
6. **Write a refined problem statement** with success metrics and constraints.
7. Output the design document to feed into the Plan stage.`,
  },
  review: {
    title: 'Review \u2014 Multi-Dimensional Quality Audit',
    description: 'Two-stage quality review: spec compliance first, then code quality.',
    process: `## Process

1. **Stage 1: Spec Compliance**
   - Compare each implemented task against the plan\u2019s acceptance criteria
   - Verify all file paths from the plan were addressed
   - Check that all verification steps from the plan pass
   - List any missing or incomplete items
2. **Stage 2: Code Quality** (see Role Perspectives below for each reviewer's focus)
3. **Severity Rating** \u2014 classify each issue:
   - **Critical**: Security vulnerability, data loss risk, broken core functionality
   - **Major**: Performance degradation, poor error handling, missing tests for critical paths
   - **Minor**: Code style, naming, minor optimization opportunities
4. **Auto-fix** obvious issues if configured (formatting, simple refactors).
5. Write the review report to \`docs/reviews/review-report.md\`.
6. Output: review report with severity-rated issues and fix recommendations.`,
  },
  test: {
    title: 'Test \u2014 Evidence-Based Verification',
    description: 'Verify through evidence, not claims. Run the configured test methodologies.',
    process: `## Process

1. **Run unit tests** \u2014 execute the full test suite. Record pass/fail counts.
2. **Run integration tests** \u2014 verify component interactions work correctly.
3. **Run E2E tests** if configured \u2014 test critical user flows end-to-end.
4. **Measure coverage** against the configured target. Identify uncovered critical paths.
5. **Exploratory testing** (if configured):
   - Test edge cases not covered by automated tests
   - Test error states and recovery paths
   - Test with invalid/malformed input
6. **Performance testing** (if configured):
   - Measure load times for key operations
   - Check for memory leaks under sustained use
7. **Collect evidence** \u2014 screenshots, logs, metrics. No claims without evidence.
8. Write test report to \`docs/reports/test-report.md\` with:
   - Test results summary (pass/fail/skip)
   - Coverage percentage vs. target
   - Evidence package for each test type
   - Known issues and their severity`,
  },
  ship: {
    title: 'Ship \u2014 Release',
    description: 'Execute the release pipeline from PR to deployment.',
    process: `## Process

1. **Verify gates** \u2014 confirm review report and test report both exist and pass.
2. **Run final tests** \u2014 execute the full test suite one last time. All must pass.
3. **Bump version** according to the configured strategy (patch/minor/major).
4. **Generate release notes**:
   - Summarize changes since last release
   - List breaking changes (if any)
   - Include migration instructions (if needed)
5. **Create Pull Request** with:
   - Clear title following conventional commits
   - Description linking to the plan and design doc
   - Release notes in the PR body
6. **Merge** after CI passes (if configured).
7. **Deploy** to configured targets (staging/production/canary).
8. **Verify deployment** \u2014 smoke test the deployed version.
9. Output: release notes and deployment manifest.`,
  },
  reflect: {
    title: 'Reflect \u2014 Retrospective',
    description: 'Team-aware retrospective using session event logs as data source.',
    process: `## Process

1. **Review the session event log** \u2014 trace through all stages that were executed.
2. **Analyze velocity**:
   - How long did each stage take?
   - Were there unexpected bottlenecks?
   - Did any stage require more iterations than expected?
3. **Analyze quality**:
   - How many issues were found in review?
   - What severity levels? Were any critical?
   - How many bugs escaped to test phase?
4. **Analyze test health**:
   - Did tests catch real issues or just confirm happy paths?
   - Is coverage meaningful or just numbers?
   - What areas need better test coverage?
5. **Identify improvements** \u2014 specific, actionable items for next sprint.
6. **Persist learnings** (if configured) to project memory for future sessions.
7. Output: retrospective report with improvement items.`,
  },
};

// ── Role Perspectives rendering ──

function renderRolePerspectives(
  stageRoles: RoleName[],
  configuredRoles: RoleConfig[]
): string {
  if (stageRoles.length === 0) return '';

  const lines: string[] = ['## Role Perspectives', ''];

  for (const roleId of stageRoles) {
    const prompt = getRolePrompt(roleId, configuredRoles);
    const roleConfig = configuredRoles.find((r) => r.id === roleId);

    lines.push(`### ${prompt.label}`);
    lines.push('');

    if (prompt.reviewFocus.length > 0) {
      lines.push(`**Focus**: ${prompt.reviewFocus.join(', ')}`);
      lines.push('');
    }

    // Use constraints from roleConfig if available
    const constraints = roleConfig?.defaultConstraints ?? [];
    if (constraints.length > 0) {
      lines.push('**Behavioral constraints**:');
      for (const c of constraints) {
        lines.push(`- ${c}`);
      }
      lines.push('');
    }

    // Generate role-specific review questions based on focus areas
    lines.push('**When reviewing this stage, ask**:');
    for (const focus of prompt.reviewFocus) {
      lines.push(`- Is ${focus} properly addressed?`);
    }
    lines.push('');

    // System prompt as a quoted block
    if (prompt.systemPrompt) {
      lines.push('> ' + prompt.systemPrompt);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ── Role-specific sub-commands for multi-role stages ──

function renderRoleSubCommand(
  stageName: StageName,
  roleId: RoleName,
  configuredRoles: RoleConfig[]
): OutputFile | null {
  const prompt = getRolePrompt(roleId, configuredRoles);
  const roleConfig = configuredRoles.find((r) => r.id === roleId);

  // Only generate sub-commands for plan and review stages
  if (stageName !== 'plan' && stageName !== 'review') return null;

  const stageTitle = stageName === 'plan' ? 'Plan' : 'Review';
  const action = stageName === 'plan' ? 'architecture review' : 'quality audit';
  const slug = roleId.replace(/[^a-z0-9]+/g, '-');

  const lines: string[] = [
    '---',
    `description: ${stageTitle} \u2014 ${prompt.label} perspective`,
    '---',
    '',
    `# ${stageTitle} \u2014 ${prompt.label} Review`,
    '',
    `You are performing the ${action} from the **${prompt.label}** perspective.`,
    '',
    '## Stage Entry (MANDATORY)',
    '',
    'Before doing anything else:',
    '',
    `1. Confirm you are already in stage **${stageName}** (run: \`bash .harness/scripts/check.sh\`)`,
    `2. Read \`.harness/roles/${roleId}.md\` for your role definition`,
    `3. Adopt the **${prompt.label}** perspective for this review`,
    '',
    `## System Prompt`,
    '',
    `> ${prompt.systemPrompt}`,
    '',
    '## Review Focus',
    '',
  ];

  for (const focus of prompt.reviewFocus) {
    lines.push(`- ${focus}`);
  }
  lines.push('');

  if (stageName === 'plan') {
    lines.push('## Review Checklist', '');
    lines.push('- Does this plan deliver user value?');
    lines.push('- Is the technical approach sound?');
    lines.push('- Are dependencies and risks identified?');
    lines.push('- Can tasks be parallelized effectively?');
    lines.push('- Are acceptance criteria concrete and testable?');
  } else {
    lines.push('## Review Checklist', '');
    lines.push('- Are all planned changes implemented?');
    lines.push('- Is the code readable and maintainable?');
    lines.push('- Are there security vulnerabilities?');
    lines.push('- Is error handling robust?');
    lines.push('- Are tests adequate for the changes?');
  }
  lines.push('');

  // Role constraints
  const constraints = roleConfig?.defaultConstraints ?? [];
  if (constraints.length > 0) {
    lines.push('## Role Constraints', '');
    for (const c of constraints) {
      lines.push(`- ${c}`);
    }
    lines.push('');
  }

  lines.push('## Output', '');
  if (stageName === 'plan') {
    lines.push('Provide your review as a structured assessment:');
    lines.push('- **Approved items**: What looks good and why');
    lines.push('- **Concerns**: What needs attention, with severity');
    lines.push('- **Recommendations**: Specific changes to improve the plan');
  } else {
    lines.push('Append your findings to `docs/reviews/review-report.md`:');
    lines.push('- **Section header**: Use `## {Role Label} Review`');
    lines.push('- **Issues found**: List with severity (Critical/Major/Minor)');
    lines.push('- **Sign-off**: Add your sign-off under `## Sign-offs` if approved');
  }
  lines.push('');

  return {
    path: `.claude/commands/${stageName}:${slug}-review.md`,
    content: lines.join('\n'),
  };
}

// ── Stage config to JSON block ──

function formatStageConfigJson(name: StageName, config: StageSpecificConfig): string | null {
  let obj: Record<string, unknown> | null = null;
  switch (name) {
    case 'think': {
      const c = config as ThinkConfig;
      obj = { dimensions: c.dimensions, depth: c.depth };
      break;
    }
    case 'plan': {
      const c = config as PlanConfig;
      obj = { reviewTypes: c.reviewTypes, taskStructure: c.taskStructure };
      break;
    }
    case 'build': {
      const c = config as BuildConfig;
      obj = { executionStrategy: c.executionStrategy, tddMode: c.tddMode };
      break;
    }
    case 'review': {
      const c = config as ReviewConfig;
      obj = { reviewDimensions: c.reviewDimensions, autoFix: c.autoFix, severityThreshold: c.severityThreshold };
      break;
    }
    case 'test': {
      const c = config as TestConfig;
      obj = { testMethods: c.testMethods, coverageTarget: c.coverageTarget, testTypes: c.testTypes, environment: c.environment, testCommand: c.testCommand, coverageCommand: c.coverageCommand };
      break;
    }
    case 'ship': {
      const c = config as ShipConfig;
      obj = { pipeline: c.pipeline, versionStrategy: c.versionStrategy, deploymentTargets: c.deploymentTargets };
      break;
    }
    case 'reflect': {
      const c = config as ReflectConfig;
      obj = { dimensions: c.dimensions, persistLearning: c.persistLearning };
      break;
    }
  }
  return obj ? JSON.stringify(obj, null, 2) : null;
}

// ── Main generator ──

export function generateClaudeCommands(config: ProjectConfig): OutputFile[] {
  const enabledStages = config.flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  if (enabledStages.length === 0) return [];

  const allConstraints = config.flow.constraints;
  const configuredRoles = config.flow.roles;
  const files: OutputFile[] = [];

  for (const stage of enabledStages) {
    // Get title/description and process dynamically for plan/build
    let title: string;
    let description: string;
    let process: string;

    if (stage.name === 'plan') {
      title = 'Plan \u2014 Multi-Role Architecture Review';
      description = 'Create an implementation plan reviewed from multiple role perspectives.';
      const planConfig = (stage.stageConfig as PlanConfig | undefined);
      process = generatePlanProcess(planConfig?.taskStructure ?? 'simple');
    } else if (stage.name === 'build') {
      title = 'Build \u2014 Implementation';
      description = 'Execute the implementation plan with disciplined engineering practices.';
      const buildConfig = (stage.stageConfig as BuildConfig | undefined);
      process = generateBuildProcess(
        buildConfig?.executionStrategy ?? 'single-agent',
        buildConfig?.tddMode ?? 'optional'
      );
    } else {
      const cmd = STATIC_COMMANDS[stage.name];
      if (!cmd) continue;
      title = cmd.title;
      description = cmd.description;
      process = cmd.process;
    }

    // YAML frontmatter
    const frontmatter = `---\ndescription: ${title}\n---\n`;

    // Stage entry protocol — auto-write stage/role state files
    const primaryRole = stage.roles[0];
    const primaryRoleLabel = getRolePrompt(primaryRole, configuredRoles).label;
    const stageEntryProtocol = [
      '## Stage Entry (MANDATORY)',
      '',
      'Before doing anything else in this stage:',
      '',
      `1. Run: \`bash .claude/hooks/transition.sh ${stage.name}\``,
      '   - If it fails, DO NOT proceed. Tell the user which gates are blocking.',
      `2. If transition succeeds, you are now in stage **${title}** acting as **${primaryRoleLabel}**.`,
      `3. Read \`.harness/roles/${primaryRole}.md\` for your role definition.`,
      '',
    ].join('\n');

    // Role perspectives section (dynamic)
    const roleSection = renderRolePerspectives(stage.roles, configuredRoles);

    // Gates section
    const gatesSection = ['## Gates (check before proceeding)', ''];
    if (stage.gates.length > 0) {
      for (const gate of stage.gates) {
        gatesSection.push(`- [ ] ${gate}`);
      }
    } else {
      gatesSection.push('None configured.');
    }
    gatesSection.push('');

    // Constraints section
    const stageConstraints = allConstraints.filter(
      (c) => c.stageId === stage.id || c.stageId === '*'
    );
    const constraintsSection = ['## Constraints', ''];
    if (stageConstraints.length > 0) {
      for (const c of stageConstraints) {
        const marker = c.enforced ? '[ENFORCED]' : '[advisory]';
        constraintsSection.push(`- ${marker} ${c.description}`);
      }
    } else {
      constraintsSection.push('None.');
    }
    constraintsSection.push('');

    // Stage config section
    let configSection = '';
    if (stage.stageConfig) {
      const json = formatStageConfigJson(stage.name, stage.stageConfig);
      if (json) {
        configSection = ['## Stage Config', '', '```json', json, '```', ''].join('\n');
      }
    }

    const parts = [
      frontmatter,
      `# ${title}`,
      '',
      description,
      '',
      stageEntryProtocol,
      process,
      '',
      roleSection,
      gatesSection.join('\n'),
      constraintsSection.join('\n'),
      configSection,
    ].filter((p) => p !== '');

    files.push({
      path: `.claude/commands/${stage.name}.md`,
      content: parts.join('\n').replace(/\n{3,}/g, '\n\n'),
    });

    // Generate role-specific sub-commands for plan and review stages
    if ((stage.name === 'plan' || stage.name === 'review') && stage.roles.length > 1) {
      for (const roleId of stage.roles) {
        const subCmd = renderRoleSubCommand(stage.name, roleId, configuredRoles);
        if (subCmd) {
          files.push(subCmd);
        }
      }
    }
  }

  return files;
}
