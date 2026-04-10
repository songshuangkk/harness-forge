'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
      {/* Top bar */}
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 text-ink transition-opacity hover:opacity-70">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-copper text-xs font-bold text-primary-foreground">
              HF
            </div>
            <span className="font-heading text-sm font-semibold tracking-tight">Harness Forge</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-ink-muted">
              Step {currentStep + 1} of {STEP_PATHS.length}
            </span>
            <Link
              href="/"
              className="group flex items-center gap-1.5 rounded-md border border-border bg-paper-warm px-3 py-1.5 text-xs font-medium text-ink-muted transition-precise hover:border-copper/30 hover:bg-copper-subtle hover:text-copper active:scale-[0.97]"
            >
              <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />
              Home
            </Link>
          </div>
        </div>
      </div>

      {/* Step indicator + content */}
      <div className="mx-auto max-w-5xl px-6">
        <StepIndicator currentStep={currentStep} onStepClick={handleStepClick} />
        <main className="pb-16">{children}</main>
      </div>
    </div>
  );
}
