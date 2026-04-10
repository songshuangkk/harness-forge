'use client';

import Link from 'next/link';
import { templates } from '@/templates';
import type { TemplatePreset } from '@/types';

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(oklch(0.42 0.01 55) 1px, transparent 1px), linear-gradient(90deg, oklch(0.42 0.01 55) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6">
        {/* Header */}
        <header className="flex items-center justify-between py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-copper text-sm font-bold text-primary-foreground">
              HF
            </div>
            <span className="font-heading text-lg font-semibold tracking-tight text-ink">
              Harness Forge
            </span>
          </div>
          <Link
            href="/wizard"
            className="rounded-md px-4 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-secondary"
          >
            Skip to builder →
          </Link>
        </header>

        {/* Hero */}
        <main className="flex flex-1 flex-col justify-center pb-16 pt-8">
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-widest text-copper">
              AI Agent Project Configurator
            </p>
            <h1 className="font-heading text-5xl font-bold leading-[1.1] tracking-tight text-ink md:text-6xl">
              Forge your
              <br />
              agent workflow
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-secondary">
              Configure Session, Harness, and Sandbox architecture. Define sprint
              constraints. Generate everything your AI agent needs — in one download.
            </p>
          </div>

          {/* Template selection */}
          <div className="mt-16">
            <p className="mb-6 text-xs font-medium uppercase tracking-widest text-ink-muted">
              Start with a template
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {templates.map((template) => (
                <TemplatePreviewCard key={template.id} template={template} />
              ))}
              <Link
                href="/wizard"
                className="group flex items-center justify-center rounded-xl border border-dashed border-border px-6 py-8 text-sm font-medium text-ink-muted transition-all hover:border-copper hover:text-copper"
              >
                <span className="mr-2 text-lg leading-none">+</span>
                Start from scratch
              </Link>
            </div>
          </div>
        </main>

        {/* Footer note */}
        <footer className="border-t border-border py-6">
          <p className="text-xs text-ink-muted">
            Built on Anthropic Managed Agents architecture + GStack constraint feedback flow
          </p>
        </footer>
      </div>
    </div>
  );
}

const TEMPLATE_THEME: Record<string, { bg: string; iconBg: string; border: string; hoverBorder: string; action: string }> = {
  'solo-dev': {
    bg: 'oklch(0.970 0.008 70)',
    iconBg: 'oklch(0.92 0.04 70)',
    border: 'oklch(0.90 0.015 70)',
    hoverBorder: 'oklch(0.70 0.08 70)',
    action: 'oklch(0.45 0.10 70)',
  },
  'gstack-sprint': {
    bg: 'oklch(0.970 0.008 160)',
    iconBg: 'oklch(0.92 0.04 160)',
    border: 'oklch(0.90 0.015 160)',
    hoverBorder: 'oklch(0.60 0.08 160)',
    action: 'oklch(0.40 0.10 160)',
  },
  'managed-agents': {
    bg: 'oklch(0.970 0.008 270)',
    iconBg: 'oklch(0.92 0.04 270)',
    border: 'oklch(0.90 0.015 270)',
    hoverBorder: 'oklch(0.58 0.08 270)',
    action: 'oklch(0.42 0.10 270)',
  },
};

function TemplatePreviewCard({ template }: { template: TemplatePreset }) {
  const t = TEMPLATE_THEME[template.id];

  return (
    <Link href="/wizard" className="group">
      <div
        className="template-card flex h-full flex-col rounded-xl p-6 transition-all"
        style={{
          background: t.bg,
          border: `1px solid ${t.border}`,
          '--tc-hover-border': t.hoverBorder,
          '--tc-action': t.action,
        } as React.CSSProperties}
      >
        <div
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-xl"
          style={{ background: t.iconBg }}
        >
          {template.icon}
        </div>
        <h3 className="font-heading text-base font-semibold text-ink">{template.name}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-secondary">{template.description}</p>
        <div
          className="mt-4 flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: t.action }}
        >
          Use template
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </div>
      </div>
    </Link>
  );
}
