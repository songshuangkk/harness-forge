'use client';

import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useProjectConfig } from '@/store/useProjectConfig';

const STEP_PATHS = [
  '/wizard',
  '/wizard/architecture',
  '/wizard/flow',
  '/wizard/integration',
  '/wizard/generate',
];

export default function ArchitecturePage() {
  const router = useRouter();
  const setCurrentStep = useProjectConfig((s) => s.setCurrentStep);

  const goPrev = () => {
    setCurrentStep(0);
    router.push(STEP_PATHS[0]);
  };

  const goNext = () => {
    setCurrentStep(2);
    router.push(STEP_PATHS[2]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Architecture</CardTitle>
        <CardDescription>
          Configure session storage, harness engine, and sandbox settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Step 2 form will go here</p>
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
