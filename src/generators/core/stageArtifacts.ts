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
  ],
};

/**
 * Returns output artifacts for a stage.
 * Uses stage-specific overrides if defined, otherwise falls back to defaults.
 */
export function getStageArtifacts(stage: SprintStage): OutputArtifact[] {
  if (stage.outputArtifacts && stage.outputArtifacts.length > 0) {
    return stage.outputArtifacts;
  }
  return DEFAULT_STAGE_ARTIFACTS[stage.name] ?? [];
}
