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
    description: 'Data-driven retrospective using event logs and constraint audit trail.',
    process: `## Process

1. **Generate session summary** \u2014 run \`bash .harness/scripts/session-summary.sh\` to get data-driven metrics.
2. **Analyze velocity** (from summary output):
   - How long did each stage take?
   - Were there unexpected bottlenecks?
   - Did any stage require more iterations than expected?
3. **Analyze quality** (from review docs):
   - How many issues were found in review?
   - What severity levels? Were any critical?
   - How many bugs escaped to test phase?
4. **Analyze test health**:
   - Did tests catch real issues or just confirm happy paths?
   - Is coverage meaningful or just numbers?
   - Did the command gate (test suite) pass on first try?
5. **Analyze compliance** (from summary "Constraint Blocks" section):
   - Were any constraints overridden during the sprint?
   - Which stages had the most blocks?
   - Are there bypasses that need investigation?
6. **Identify improvements** \u2014 specific, actionable items for next sprint.
7. **Persist learnings** (if configured) to project memory for future sessions.
8. Output: retrospective report with improvement items.`,
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

// ── Unified Sprint Command ──

export function generateSprintCommand(config: ProjectConfig): OutputFile | null {
  const enabledStages = config.flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  if (enabledStages.length === 0) return null;

  const allConstraints = config.flow.constraints;
  const configuredRoles = config.flow.roles;

  const flowDiagram = enabledStages
    .map((s) => s.name.charAt(0).toUpperCase() + s.name.slice(1))
    .join(' → ');

  const lines: string[] = [
    '---',
    'description: Execute a full sprint — auto-guides through all enabled stages',
    '---',
    '',
    '# Sprint — Full Development Cycle',
    '',
    `Auto-guides through: ${flowDiagram}`,
    'Resumes from wherever you left off, or starts fresh.',
    '',
    '## Initialization (MANDATORY — do this first)',
    '',
    '1. Run: `bash .claude/scripts/session-init.sh` (idempotent — safe to re-run)',
    '2. Run: `bash .harness/scripts/check.sh` to see current state',
    '3. Read `.harness/state.json` to determine your position:',
    '   - If `sprint.started_at` is empty → fresh start, begin at **Stage 1** below',
    '   - If `sprint.current` is set and `gates.{current}.passed` is true → advance to next stage',
    '   - If `sprint.current` is set and `gates.{current}.passed` is false → continue current stage',
    '',
    'Now execute each stage in order. For each stage, follow its Entry Protocol, execute its Process, then advance.',
    '',
  ];

  // Render each enabled stage as a section
  let renderedIdx = 0;
  for (let i = 0; i < enabledStages.length; i++) {
    const stage = enabledStages[i];
    const isLast = i === enabledStages.length - 1;
    const nextStage = enabledStages[i + 1];

    // Get stage title and process (reuse existing generators)
    let title: string;
    let process: string;

    if (stage.name === 'plan') {
      title = 'Plan — Multi-Role Architecture Review';
      const planConfig = stage.stageConfig as PlanConfig | undefined;
      process = generatePlanProcess(planConfig?.taskStructure ?? 'simple');
    } else if (stage.name === 'build') {
      title = 'Build — Implementation';
      const buildConfig = stage.stageConfig as BuildConfig | undefined;
      process = generateBuildProcess(
        buildConfig?.executionStrategy ?? 'single-agent',
        buildConfig?.tddMode ?? 'optional'
      );
    } else {
      const cmd = STATIC_COMMANDS[stage.name];
      if (!cmd) continue;
      title = cmd.title;
      process = cmd.process;
    }

    renderedIdx++;
    const stageNum = renderedIdx;

    const primaryRole = stage.roles[0];
    if (!primaryRole) continue;
    const primaryRoleLabel = getRolePrompt(primaryRole, configuredRoles).label;

    // Section separator
    lines.push('---');
    lines.push('');
    lines.push(`## Stage ${stageNum}: ${title}`);
    lines.push('');

    // Entry protocol
    lines.push('### Entry Protocol');
    lines.push('');
    lines.push(`1. Run: \`bash .claude/hooks/transition.sh ${stage.name}\``);
    lines.push('   - If it fails, DO NOT proceed. Tell the user which gates are blocking.');
    lines.push(`2. You are now in stage **${title}** acting as **${primaryRoleLabel}**.`);
    lines.push(`3. Read \`.harness/roles/${primaryRole}.md\` for your role definition.`);
    lines.push('');

    // Process (reuse existing content generators)
    lines.push(process);
    lines.push('');

    // Role perspectives
    const roleSection = renderRolePerspectives(stage.roles, configuredRoles);
    if (roleSection) {
      lines.push(roleSection);
    }

    // Gates
    lines.push('### Gates (must pass before advancing)');
    lines.push('');
    if (stage.gates.length > 0) {
      for (const gate of stage.gates) {
        lines.push(`- [ ] ${gate}`);
      }
    } else {
      lines.push('None configured.');
    }
    lines.push('');

    // Constraints
    const stageConstraints = allConstraints.filter(
      (c) => c.stageId === stage.id || c.stageId === '*'
    );
    lines.push('### Constraints');
    lines.push('');
    if (stageConstraints.length > 0) {
      for (const c of stageConstraints) {
        const marker = c.enforced ? '[ENFORCED]' : '[advisory]';
        lines.push(`- ${marker} ${c.description}`);
      }
    } else {
      lines.push('None.');
    }
    lines.push('');

    // Stage config
    if (stage.stageConfig) {
      const json = formatStageConfigJson(stage.name, stage.stageConfig);
      if (json) {
        lines.push('### Stage Config');
        lines.push('');
        lines.push('```json');
        lines.push(json);
        lines.push('```');
        lines.push('');
      }
    }

    // Stage completion / advance
    lines.push('### Stage Completion');
    lines.push('');
    lines.push('When all gates pass:');
    lines.push('- Run `bash .harness/scripts/check.sh` to confirm');
    if (isLast) {
      lines.push('- This is the final stage. Proceed to **Sprint Completion** below.');
    } else {
      const nextTitle = nextStage!.name.charAt(0).toUpperCase() + nextStage!.name.slice(1);
      lines.push(`- Proceed to **Stage ${stageNum + 1}: ${nextTitle}** below.`);
    }
    lines.push('');
  }

  // Sprint completion
  lines.push('---');
  lines.push('');
  lines.push('## Sprint Completion');
  lines.push('');
  lines.push('When all stages are complete:');
  lines.push('1. Announce: "Sprint complete. All stages passed."');
  lines.push('2. Summarize what was delivered (key files changed, tests passing, release status)');
  lines.push('3. Ask: "Start a new sprint? Run `bash .claude/scripts/session-init.sh` then `/sprint`."');
  lines.push('');

  // Error recovery
  lines.push('## Error Recovery');
  lines.push('');
  lines.push('If you get stuck at any point:');
  lines.push('- Run `bash .harness/scripts/check.sh` to see current state');
  lines.push('- If a gate is blocking, review the gate requirements in the current stage section above');
  lines.push('- If `guard.sh` blocks a write, check the allowed paths for the current stage');
  lines.push('- To force-restart the sprint: run `bash .claude/scripts/session-init.sh`, then `/sprint`');
  lines.push('');

  return {
    path: '.claude/commands/sprint.md',
    content: lines.join('\n').replace(/\n{3,}/g, '\n\n'),
  };
}

// ── New-Task Command ──

export function generateNewTaskCommand(): OutputFile {
  const content = `---
description: Handle a new task during an active sprint — auto-decides execution mode
arguments:
  - name: task
    description: "Task description"
    required: true
---

# New Task — Smart Dispatch

You received a new task: **$ARGUMENTS**

## Step 1: Assess Current Sprint State

1. Read \`.harness/state.json\` to get current stage and gate status.
2. Read \`.harness/constraints.json\` to understand the sprint scope (stages, transitions).

## Step 2: Classify the Task

Analyze the task and classify it into one of three categories:

### Category A: Quick Fix (execute immediately, bypass stages)

Criteria (ANY of these):
- Typo fix, config tweak, one-line change
- Hotfix / emergency bug fix
- Unrelated to the current sprint scope (e.g., fixing a CI config while sprint builds a feature)
- Takes < 5 minutes, no design decisions needed

**Action:** Execute directly. Do NOT transition stages. The sprint state stays untouched.

Process:
1. Execute the fix using Read/Edit/Write/Bash as needed.
2. Confirm the change works (run relevant test/lint if applicable).
3. Tell the user: "Quick fix done. Sprint continues from the current stage."

### Category B: Sprint Append (insert into current sprint)

Criteria (ALL of these):
- Directly related to the current sprint's goal/scope
- Medium complexity — needs implementation + verification, but not a full design cycle
- Fits into the current or next stage without disrupting flow

**Action:** Append to the current sprint. No state reset.

Process:
1. Note the current stage and gate status.
2. If currently in Think/Plan: add the task to the existing plan documents.
3. If currently in Build: implement the task as part of the current build, update build-report.
4. If currently in Review/Test: note the task for review/test inclusion.
5. Continue the sprint normally from the current stage.

### Category C: New Sprint (recommend restart)

Criteria (ANY of these):
- Entirely new feature, different scope from current sprint
- Requires a full Think → Plan → Build cycle
- Would invalidate or conflict with existing sprint artifacts
- Large scope — multiple files, new architecture decisions

**Action:** Recommend a new sprint. Do NOT execute yet.

Process:
1. Tell the user: "This task warrants a new sprint cycle."
2. Suggest: "Complete the current sprint first, then run \`bash .claude/scripts/session-init.sh\` followed by \`/sprint\`."
3. If the user insists on proceeding now: warn that this will reset sprint state, then execute \`bash .claude/scripts/session-init.sh\` and start a fresh sprint.

## Step 3: Execute

Based on your classification, execute the appropriate action above.

## Important Rules

- NEVER silently change sprint state for Category A tasks.
- For Category B, update the relevant sprint artifacts (plan docs, build-report, etc.) to reflect the added task.
- For Category C, always ask for confirmation before resetting the sprint.
- If unsure between A and B, prefer A (less disruptive).
- If unsure between B and C, prefer B (can always escalate later).
`;

  return {
    path: '.claude/commands/new-task.md',
    content,
  };
}
