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

export default function IntegrationPage() {
  const router = useRouter();
  const setCurrentStep = useProjectConfig((s) => s.setCurrentStep);

  const goPrev = () => {
    setCurrentStep(2);
    router.push(STEP_PATHS[2]);
  };

  const goNext = () => {
    setCurrentStep(4);
    router.push(STEP_PATHS[4]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tools & Integration</CardTitle>
        <CardDescription>Set up MCP servers, hooks, and external tool connections.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Step 4 form will go here</p>
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
