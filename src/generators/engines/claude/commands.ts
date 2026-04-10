import type { ProjectConfig, OutputFile, StageName, StageSpecificConfig, ThinkConfig, PlanConfig, BuildConfig, ReviewConfig, TestConfig, ShipConfig, ReflectConfig } from '@/types';

// ── Stage process content (real methodology, not placeholders) ──

interface StageCommand {
  title: string;
  description: string;
  process: string;
}

const STAGE_COMMANDS: Record<StageName, StageCommand> = {
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
  plan: {
    title: 'Plan \u2014 Multi-Role Architecture Review',
    description: 'Create an implementation plan reviewed from multiple role perspectives.',
    process: `## Process

1. **Read the design document** from the Think stage. Confirm understanding.
2. **Break down into tasks** with:
   - File paths that will be created or modified
   - Specific verification steps for each task
   - Estimated complexity (S/M/L)
3. **Run multi-role review**:
   - **CEO perspective**: Does this plan deliver user value? Is scope right?
   - **Eng perspective**: Is the technical approach sound? Any architectural concerns?
   - **Design perspective**: Does this affect UX? Are there design system implications?
   - **DX perspective**: Is the developer experience considered? Docs needed?
4. **Order tasks** by dependency. Identify what can run in parallel.
5. **Define acceptance criteria** for each task \u2014 concrete, testable.
6. **Estimate risk areas** and plan mitigation for each.
7. Output the implementation plan with task list, file paths, and verification steps.`,
  },
  build: {
    title: 'Build \u2014 Implementation',
    description: 'Execute the implementation plan with disciplined engineering practices.',
    process: `## Process

1. **Read the implementation plan** from the Plan stage. Confirm all tasks are understood.
2. **If TDD is enforced**:
   - Write a failing test first (RED phase)
   - Write the minimum code to make it pass (GREEN phase)
   - Refactor while keeping tests green (REFACTOR phase)
   - Repeat for each task
3. **If TDD is optional**:
   - Implement each task from the plan sequentially
   - Write tests after implementation for critical paths
4. **Follow the task order** from the plan unless there is a clear reason to deviate.
5. **Commit incrementally** \u2014 one logical change per commit with a clear message.
6. **Run existing tests** after each task to catch regressions early.
7. **Document any deviations** from the plan and why they were necessary.
8. Output: source code and test files ready for review.`,
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
2. **Stage 2: Code Quality**
   - Read all changed files. Assess readability and maintainability.
   - Check for security issues: hardcoded secrets, SQL injection, XSS, improper auth
   - Check for performance issues: N+1 queries, unnecessary re-renders, memory leaks
   - Verify error handling is robust (no swallowed errors, meaningful messages)
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
      obj = { testMethods: c.testMethods, coverageTarget: c.coverageTarget, testTypes: c.testTypes, environment: c.environment };
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

  return enabledStages.map((stage) => {
    const cmd = STAGE_COMMANDS[stage.name];

    // YAML frontmatter
    const frontmatter = `---\ndescription: ${cmd.title}\n---\n`;

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

    const content = [
      frontmatter,
      `# ${cmd.title}`,
      '',
      cmd.description,
      '',
      cmd.process,
      '',
      gatesSection.join('\n'),
      constraintsSection.join('\n'),
      configSection,
    ].join('\n');

    return {
      path: `.claude/commands/${stage.name}.md`,
      content: content.replace(/\n{3,}/g, '\n\n'),
    };
  });
}
