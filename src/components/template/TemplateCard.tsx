'use client';

import type { TemplatePreset } from '@/types';

interface TemplateCardProps {
  template: TemplatePreset;
  onSelect: (template: TemplatePreset) => void;
}

export function TemplateCard({ template, onSelect }: TemplateCardProps) {
  return (
    <button
      onClick={() => onSelect(template)}
      className="surface-etched group rounded-xl p-5 text-left transition-all hover:border-copper/40 hover:shadow-sm"
    >
      <div className="mb-3 text-3xl">{template.icon}</div>
      <h3 className="font-heading text-base font-semibold text-ink">{template.name}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">{template.description}</p>
      <div className="mt-4 flex items-center gap-1 text-xs font-medium text-copper opacity-0 transition-opacity group-hover:opacity-100">
        Use template
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </div>
    </button>
  );
}
