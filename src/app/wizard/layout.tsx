'use client';

import { useRouter, usePathname } from 'next/navigation';
import { StepIndicator } from '@/components/wizard/StepIndicator';
import { useProjectConfig } from '@/store/useProjectConfig';

const STEP_PATHS = [
  '/wizard',
  '/wizard/architecture',
  '/wizard/flow',
  '/wizard/integration',
  '/wizard/generate',
];

export default function WizardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const currentStep = STEP_PATHS.indexOf(pathname);
  const setCurrentStep = useProjectConfig((s) => s.setCurrentStep);

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
    router.push(STEP_PATHS[step]);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4">
        <StepIndicator currentStep={currentStep} onStepClick={handleStepClick} />
        <main className="py-4">{children}</main>
      </div>
    </div>
  );
}
