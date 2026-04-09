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

export default function GeneratePage() {
  const router = useRouter();
  const setCurrentStep = useProjectConfig((s) => s.setCurrentStep);

  const goPrev = () => {
    setCurrentStep(3);
    router.push(STEP_PATHS[3]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview & Generate</CardTitle>
        <CardDescription>Review your configuration and generate project files.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Step 5 form will go here</p>
        <div className="mt-6 flex justify-start">
          <button
            onClick={goPrev}
            className="rounded-lg border border-border px-6 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Previous
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
