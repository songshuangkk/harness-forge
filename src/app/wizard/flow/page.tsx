'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useProjectConfig } from '@/store/useProjectConfig';
import { FlowEditor } from '@/components/wizard/FlowEditor';
import type { StageName, SprintStage } from '@/types';

const STEP_PATHS = [
  '/wizard',
  '/wizard/architecture',
  '/wizard/flow',
  '/wizard/integration',
  '/wizard/generate',
];

const DEFAULT_STAGES: { name: StageName; order: number }[] = [
  { name: 'think', order: 0 },
  { name: 'plan', order: 1 },
  { name: 'build', order: 2 },
  { name: 'review', order: 3 },
  { name: 'test', order: 4 },
  { name: 'ship', order: 5 },
  { name: 'reflect', order: 6 },
];

function buildDefaultSprint(): SprintStage[] {
  return DEFAULT_STAGES.map(({ name, order }) => ({
    id: name,
    name,
    order,
    enabled: true,
    roles: [],
    gates: [],
    outputFormat: '',
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
    <Card>
      <CardHeader>
        <CardTitle>Constraint Flow</CardTitle>
        <CardDescription>
          Define sprint stages, assign roles, and configure quality gates for each stage.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {flow.sprint.length > 0 && (
          <FlowEditor sprint={flow.sprint} onChange={handleSprintChange} />
        )}
        <div className="mt-6 flex justify-between">
          <button
            onClick={goPrev}
            className="rounded-lg border border-border px-6 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Previous
          </button>
          <button
            onClick={goNext}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Next
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
