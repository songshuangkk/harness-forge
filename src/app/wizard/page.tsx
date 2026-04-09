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

export default function ProjectBasicsPage() {
  const router = useRouter();
  const setCurrentStep = useProjectConfig((s) => s.setCurrentStep);

  const goNext = () => {
    setCurrentStep(1);
    router.push(STEP_PATHS[1]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Basics</CardTitle>
        <CardDescription>Define your project name, description, and tech stack.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Step 1 form will go here</p>
        <div className="mt-6 flex justify-end">
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
