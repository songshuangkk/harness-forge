'use client';

import { cn } from '@/lib/utils';

const STEPS = [
  { label: 'Project', path: '/wizard' },
  { label: 'Architecture', path: '/wizard/architecture' },
  { label: 'Flow', path: '/wizard/flow' },
  { label: 'Integration', path: '/wizard/integration' },
  { label: 'Generate', path: '/wizard/generate' },
];

interface StepIndicatorProps {
  currentStep: number;
  onStepClick: (step: number) => void;
}

export function StepIndicator({ currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <nav className="flex items-center justify-center gap-2 py-6">
      {STEPS.map((step, index) => (
        <button
          key={step.path}
          onClick={() => onStepClick(index)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            index === currentStep
              ? 'bg-primary text-primary-foreground'
              : index < currentStep
                ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                : 'text-muted-foreground hover:bg-muted/50'
          )}
        >
          <span
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-xs',
              index === currentStep
                ? 'bg-primary-foreground text-primary'
                : 'bg-muted-foreground/20'
            )}
          >
            {index + 1}
          </span>
          {step.label}
        </button>
      ))}
    </nav>
  );
}
