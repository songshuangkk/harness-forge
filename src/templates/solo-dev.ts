import type { TemplatePreset } from '@/types';

export const soloDev: TemplatePreset = {
  id: 'solo-dev',
  name: 'Solo Developer',
  description: 'Claude Code + basic harness + simple flow. Perfect for solo builders.',
  icon: '🧑‍💻',
  config: {
    architecture: {
      session: { storage: 'local-file', eventRetention: 50, recoveryStrategy: 'last-event' },
      harness: { engine: 'claude-code', contextStrategy: 'compaction', maxRetries: 3 },
      sandbox: { type: 'local', mcpServers: [], credentialPolicy: 'none' },
    },
    flow: {
      sprint: [
        { id: 'think', name: 'think', order: 0, enabled: true, roles: ['ceo'],
          gates: ['Design doc written'],
          stageConfig: { dimensions: ['problem-framing', 'success-metrics', 'scope'], depth: 'quick' } },
        { id: 'build', name: 'build', order: 1, enabled: true, roles: ['eng-manager'],
          gates: ['Tests pass'],
          stageConfig: { executionStrategy: 'single-agent', tddMode: 'optional', writePaths: ['**/src/**', '**/test/**', 'docs/**'] } },
        { id: 'review', name: 'review', order: 2, enabled: true, roles: ['qa'],
          gates: ['No critical bugs'],
          stageConfig: { reviewDimensions: ['spec-compliance', 'code-quality'], autoFix: 'report-only', severityThreshold: 'critical-major' } },
        { id: 'ship', name: 'ship', order: 3, enabled: true, roles: ['release'],
          gates: ['CI green'],
          stageConfig: { pipeline: ['run-tests', 'create-pr'], versionStrategy: 'semver-patch', deploymentTargets: [] } },
      ],
      roles: [],
      constraints: [],
    },
  },
};
