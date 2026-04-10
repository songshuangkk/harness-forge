'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectConfig } from '@/store/useProjectConfig';
import { FlowEditor } from '@/components/wizard/FlowEditor';
import type { StageName, SprintStage, StageSpecificConfig, RoleName } from '@/types';

const STEP_PATHS = [
  '/wizard',
  '/wizard/architecture',
  '/wizard/flow',
  '/wizard/integration',
  '/wizard/generate',
];

const DEFAULT_STAGES: { name: StageName; order: number; roles: RoleName[] }[] = [
  { name: 'think', order: 0, roles: ['ceo'] },
  { name: 'plan', order: 1, roles: ['ceo', 'designer'] },
  { name: 'build', order: 2, roles: ['eng-manager'] },
  { name: 'review', order: 3, roles: ['eng-manager', 'security'] },
  { name: 'test', order: 4, roles: ['qa'] },
  { name: 'ship', order: 5, roles: ['release'] },
  { name: 'reflect', order: 6, roles: ['eng-manager'] },
];

const DEFAULT_STAGE_CONFIGS: Record<StageName, StageSpecificConfig> = {
  think:   { dimensions: ['problem-framing', 'success-metrics', 'constraints'], depth: 'deep' },
  plan:    { reviewTypes: ['ceo-review', 'eng-review'], taskStructure: 'simple' },
  build:   { executionStrategy: 'single-agent', tddMode: 'optional' },
  review:  { reviewDimensions: ['spec-compliance', 'code-quality'], autoFix: 'report-only', severityThreshold: 'all' },
  test:    { testMethods: ['tdd'], coverageTarget: 80, testTypes: ['unit', 'integration'], environment: 'local' },
  ship:    { pipeline: ['run-tests', 'create-pr'], versionStrategy: 'semver-patch', deploymentTargets: [] },
  reflect: { dimensions: ['velocity', 'quality'], persistLearning: 'project-memory' },
};

function buildDefaultSprint(): SprintStage[] {
  return DEFAULT_STAGES.map(({ name, order, roles }) => ({
    id: name,
    name,
    order,
    enabled: true,
    roles,
    gates: [],
    outputFormat: '',
    stageConfig: DEFAULT_STAGE_CONFIGS[name],
  }));
}

export default function FlowPage() {
  const router = useRouter();
  const setCurrentStep = useProjectConfig((s) => s.setCurrentStep);
  const flow = useProjectConfig((s) => s.config.flow);
  const setFlow = useProjectConfig((s) => s.setFlow);

  useEffect(() => {
    if (flow.sprint.length === 0) {
      setFlow({ sprint: buildDefaultSprint() });
    }
  }, [flow.sprint.length, setFlow]);

  const handleSprintChange = (sprint: SprintStage[]) => {
    setFlow({ sprint });
  };

  const goPrev = () => {
    setCurrentStep(1);
    router.push(STEP_PATHS[1]);
  };

  const goNext = () => {
    setCurrentStep(3);
    router.push(STEP_PATHS[3]);
  };

  return (
    <div className="space-y-10">
      {/* Section header */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-copper">
          Constraint Flow
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-ink">
          Sprint Pipeline
        </h1>
        <p className="mt-2 text-base text-ink-secondary">
          Define stages, assign roles, and set quality gates for each phase.
        </p>
      </div>

      {/* Flow editor */}
      {flow.sprint.length > 0 && (
        <FlowEditor sprint={flow.sprint} onChange={handleSprintChange} />
      )}

      {/* Navigation */}
      <div className="flex justify-between border-t border-border pt-6">
        <button
          onClick={goPrev}
          className="rounded-md px-5 py-2.5 text-sm font-medium text-ink-secondary transition-precise hover:bg-secondary"
        >
          ← Back
        </button>
        <button
          onClick={goNext}
          className="rounded-md bg-copper px-6 py-2.5 text-sm font-medium text-primary-foreground transition-precise hover:bg-copper/90 active:scale-[0.98]"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
