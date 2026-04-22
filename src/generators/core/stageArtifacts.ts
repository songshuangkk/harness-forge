import type { StageName, SprintStage, OutputArtifact } from '@/types';

/**
 * Default output artifacts for each stage.
 * These define what files each stage must produce, driving gate enforcement.
 */
export const DEFAULT_STAGE_ARTIFACTS: Record<StageName, OutputArtifact[]> = {
  think: [
    {
      path: 'docs/design/problem-statement.md',
      description: 'Refined problem statement with context, stakeholders, and success criteria',
      verification: 'contains-section',
      sectionMarker: '## Problem Statement',
    },
    {
      path: 'docs/design/scope.md',
      description: 'Scoped boundaries: in-scope, out-of-scope, and constraints',
      verification: 'contains-section',
      sectionMarker: '## Scope',
    },
    {
      path: 'docs/design/success-metrics.md',
      description: 'Quantifiable success metrics and acceptance criteria',
      verification: 'contains-section',
      sectionMarker: '## Success Metrics',
    },
    {
      path: '.harness/gates/think-docs-valid',
      description: 'Think stage documents have required sections',
      verification: 'command',
      command: '__THINK_VALIDATE__',
      blockOnFail: false,
    },
  ],
  plan: [
    {
      path: 'docs/plans/architecture.md',
      description: 'Architecture decision record with component diagram and data flow',
      verification: 'contains-section',
      sectionMarker: '## Architecture',
    },
    {
      path: 'docs/plans/implementation-plan.md',
      description: 'Task breakdown with dependencies and estimated effort',
      verification: 'contains-section',
      sectionMarker: '## Tasks',
    },
    {
      path: 'docs/plans/risk-assessment.md',
      description: 'Risk identification with mitigation strategies',
      verification: 'contains-section',
      sectionMarker: '## Risks',
    },
    {
      path: '.harness/gates/plan-docs-valid',
      description: 'Plan documents have required task breakdown and risks',
      verification: 'command',
      command: '__PLAN_VALIDATE__',
      blockOnFail: false,
    },
  ],
  build: [
    {
      path: 'docs/reports/build-report.md',
      description: 'Build report: what was implemented, files changed, design decisions',
      verification: 'contains-section',
      sectionMarker: '## Implementation',
    },
    {
      path: 'docs/reports/build-report.md',
      description: 'Test coverage report for implemented code',
      verification: 'contains-section',
      sectionMarker: '## Test Coverage',
    },
    {
      path: '.harness/gates/build-lint',
      description: 'Lint check passes with exit code 0',
      verification: 'command',
      command: '__BUILD_LINT__',
      blockOnFail: true,
    },
    {
      path: '.harness/gates/build-typecheck',
      description: 'Type check passes with exit code 0',
      verification: 'command',
      command: '__BUILD_TYPECHECK__',
      blockOnFail: true,
    },
  ],
  review: [
    {
      path: 'docs/reviews/quality-audit.md',
      description: 'Code quality audit: naming, structure, DRY, error handling',
      verification: 'contains-section',
      sectionMarker: '## Quality Findings',
    },
    {
      path: 'docs/reviews/spec-compliance.md',
      description: 'Specification compliance check against plan requirements',
      verification: 'contains-section',
      sectionMarker: '## Compliance',
    },
    {
      path: 'docs/reviews/security-scan.md',
      description: 'Security scan: OWASP top 10, injection, auth, data exposure',
      verification: 'contains-section',
      sectionMarker: '## Security Findings',
    },
    {
      path: '.harness/gates/review-diff-lint',
      description: 'No lint errors in changed files',
      verification: 'command',
      command: '__REVIEW_DIFF_LINT__',
      blockOnFail: true,
    },
  ],
  test: [
    {
      path: 'docs/reports/test-report.md',
      description: 'Test execution results: pass/fail/skip counts per test type',
      verification: 'contains-section',
      sectionMarker: '## Results',
    },
    {
      path: 'docs/reports/test-report.md',
      description: 'Code coverage analysis with uncovered areas',
      verification: 'contains-section',
      sectionMarker: '## Coverage',
    },
    {
      path: '.harness/gates/test-suite-pass',
      description: 'Test suite passes with exit code 0 (command gate)',
      verification: 'command',
      command: '__TEST_COMMAND__',
    },
  ],
  ship: [
    {
      path: 'docs/releases/release-notes.md',
      description: 'Release notes: changes, breaking changes, migration guide',
      verification: 'contains-section',
      sectionMarker: '## Changes',
    },
    {
      path: 'docs/releases/deployment-checklist.md',
      description: 'Pre-deployment checklist: CI green, version bumped, configs verified',
      verification: 'contains-section',
      sectionMarker: '## Checklist',
    },
    {
      path: '.harness/gates/ship-build',
      description: 'Production build succeeds',
      verification: 'command',
      command: '__SHIP_BUILD__',
      blockOnFail: true,
    },
  ],
  reflect: [
    {
      path: 'docs/retrospectives/retro-report.md',
      description: 'Retrospective: what went well, what to improve, action items',
      verification: 'contains-section',
      sectionMarker: '## Action Items',
    },
    {
      path: 'docs/retrospectives/lessons-learned.md',
      description: 'Lessons learned for future sprints and team knowledge base',
      verification: 'contains-section',
      sectionMarker: '## Lessons',
    },
    {
      path: '.harness/gates/reflect-docs-valid',
      description: 'Retrospective documents have required sections',
      verification: 'command',
      command: '__REFLECT_VALIDATE__',
      blockOnFail: false,
    },
  ],
};

/**
 * Returns output artifacts for a stage.
 * Uses stage-specific overrides if defined, otherwise falls back to defaults.
 */
export function getStageArtifacts(stage: SprintStage): OutputArtifact[] {
  const artifacts = stage.outputArtifacts && stage.outputArtifacts.length > 0
    ? [...stage.outputArtifacts]
    : [...(DEFAULT_STAGE_ARTIFACTS[stage.name] ?? [])];

  // Multi-role stages: add consensus artifact — blocking for Think/Plan
  if (stage.roles.length >= 2) {
    const hasConsensus = artifacts.some((a) => a.path === 'docs/negotiation/consensus.md');
    if (!hasConsensus) {
      artifacts.push({
        path: 'docs/negotiation/consensus.md',
        description: 'Multi-role negotiation consensus',
        verification: 'contains-section',
        sectionMarker: '## Consensus',
        blockOnFail: stage.name === 'think' || stage.name === 'plan',
      });
    }
  }

  return artifacts;
}
