import type { StageName, SprintStage, OutputArtifact } from '@/types';

/**
 * Default output artifacts for each stage.
 * These define what files each stage must produce, driving gate enforcement.
 */
export const DEFAULT_STAGE_ARTIFACTS: Record<StageName, OutputArtifact[]> = {
  think: [
    {
      path: 'docs/design/problem-statement.md',
      description: 'Refined problem statement with success metrics and scope',
      verification: 'contains-section',
      sectionMarker: '## Problem Statement',
    },
  ],
  plan: [
    {
      path: 'docs/plans/implementation-plan.md',
      description: 'Structured implementation plan with task breakdown',
      verification: 'contains-section',
      sectionMarker: '## Tasks',
    },
  ],
  build: [
    {
      path: 'docs/reports/build-report.md',
      description: 'Build report summarizing what was implemented',
      verification: 'exists',
    },
  ],
  review: [
    {
      path: 'docs/reviews/review-report.md',
      description: 'Review report with severity-rated issues',
      verification: 'contains-section',
      sectionMarker: '## Issues',
    },
  ],
  test: [
    {
      path: 'docs/reports/test-report.md',
      description: 'Test results with coverage report',
      verification: 'contains-section',
      sectionMarker: '## Results',
    },
  ],
  ship: [
    {
      path: 'docs/releases/release-notes.md',
      description: 'Release notes and deployment manifest',
      verification: 'exists',
    },
  ],
  reflect: [
    {
      path: 'docs/retrospectives/retro-report.md',
      description: 'Retrospective report with action items',
      verification: 'contains-section',
      sectionMarker: '## Action Items',
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
