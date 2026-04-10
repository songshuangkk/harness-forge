'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const STEPS = [
  { label: 'Project', short: '01' },
  { label: 'Architecture', short: '02' },
  { label: 'Flow', short: '03' },
  { label: 'Integration', short: '04' },
  { label: 'Generate', short: '05' },
];

interface StepIndicatorProps {
  currentStep: number;
  onStepClick: (step: number) => void;
}

export function StepIndicator({ currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <nav className="flex items-center gap-0 py-6">
      {STEPS.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <button
            key={step.label}
            onClick={() => onStepClick(index)}
            className="group flex items-center"
          >
            {/* Step node */}
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold transition-all',
                  isActive && 'copper-glow bg-copper text-primary-foreground',
                  isCompleted && 'bg-copper/15 text-copper',
                  !isActive && !isCompleted && 'bg-secondary text-ink-muted'
                )}
              >
                {isCompleted ? <Check className="size-3.5" strokeWidth={2.5} /> : step.short}
              </span>
              <span
                className={cn(
                  'text-sm font-medium transition-colors hidden sm:inline',
                  isActive && 'text-ink',
                  isCompleted && 'text-ink-secondary',
                  !isActive && !isCompleted && 'text-ink-muted'
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-3 h-px w-8 transition-colors md:w-12',
                  index < currentStep ? 'bg-copper/40' : 'bg-border'
                )}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
