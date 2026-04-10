'use client';

import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useProjectConfig } from '@/store/useProjectConfig';
import type {
  SessionStorage,
  RecoveryStrategy,
  AIEngine,
  ContextStrategy,
  SandboxType,
  CredentialPolicy,
} from '@/types';
import { Database, Brain, Box } from 'lucide-react';

const STEP_PATHS = [
  '/wizard',
  '/wizard/architecture',
  '/wizard/flow',
  '/wizard/integration',
  '/wizard/generate',
];

const ARCHITECTURE_BLOCKS = [
  {
    id: 'session' as const,
    icon: Database,
    title: 'Session',
    tagline: 'State & event persistence',
    accent: 'oklch(0.55 0.12 160)',
    accentLight: 'oklch(0.95 0.03 160)',
  },
  {
    id: 'harness' as const,
    icon: Brain,
    title: 'Harness',
    tagline: 'AI engine & context loop',
    accent: 'oklch(0.52 0.13 50)',
    accentLight: 'oklch(0.95 0.03 50)',
  },
  {
    id: 'sandbox' as const,
    icon: Box,
    title: 'Sandbox',
    tagline: 'Execution environment',
    accent: 'oklch(0.55 0.14 300)',
    accentLight: 'oklch(0.95 0.035 300)',
  },
] as const;

export default function ArchitecturePage() {
  const router = useRouter();
  const config = useProjectConfig((s) => s.config);
  const setArchitecture = useProjectConfig((s) => s.setArchitecture);
  const setCurrentStep = useProjectConfig((s) => s.setCurrentStep);

  const session = config.architecture.session;
  const harness = config.architecture.harness;
  const sandbox = config.architecture.sandbox;

  const updateSession = (patch: Partial<typeof session>) => {
    setArchitecture({ session: { ...session, ...patch } });
  };
  const updateHarness = (patch: Partial<typeof harness>) => {
    setArchitecture({ harness: { ...harness, ...patch } });
  };
  const updateSandbox = (patch: Partial<typeof sandbox>) => {
    setArchitecture({ sandbox: { ...sandbox, ...patch } });
  };

  const goPrev = () => {
    setCurrentStep(0);
    router.push(STEP_PATHS[0]);
  };
  const goNext = () => {
    setCurrentStep(2);
    router.push(STEP_PATHS[2]);
  };

  return (
    <div className="space-y-10">
      {/* Section header */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-copper">
          Architecture
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-ink">
          Agent Infrastructure
        </h1>
        <p className="mt-2 text-base text-ink-secondary">
          Configure the three core components of your agent system.
        </p>
      </div>

      {/* Architecture diagram — three interconnected blocks */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Session Block */}
        <div
          className="surface-etched rounded-xl overflow-hidden"
          style={{ '--block-accent': ARCHITECTURE_BLOCKS[0].accent } as React.CSSProperties}
        >
          <div className="px-6 pt-6 pb-4">
            <div
              className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: ARCHITECTURE_BLOCKS[0].accentLight, color: ARCHITECTURE_BLOCKS[0].accent }}
            >
              <Database className="size-5" />
            </div>
            <h2 className="font-heading text-lg font-semibold text-ink">Session</h2>
            <p className="mt-1 text-xs text-ink-muted">{ARCHITECTURE_BLOCKS[0].tagline}</p>
          </div>
          <div className="space-y-5 border-t border-border px-6 py-5">
            <div className="space-y-2">
              <Label className="text-xs text-ink-muted">Storage</Label>
              <Select
                value={session.storage}
                onValueChange={(v) => updateSession({ storage: v as SessionStorage })}
              >
                <SelectTrigger className="h-10 bg-paper-warm text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local-file">Local File</SelectItem>
                  <SelectItem value="git-based">Git Based</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-ink-muted">
                Event Retention: <span className="font-semibold text-ink">{session.eventRetention}</span>
              </Label>
              <Slider
                value={[session.eventRetention]}
                onValueChange={(v) => updateSession({ eventRetention: Array.isArray(v) ? v[0] : v })}
                min={10}
                max={500}
                step={10}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-ink-muted">Recovery Strategy</Label>
              <Select
                value={session.recoveryStrategy}
                onValueChange={(v) => updateSession({ recoveryStrategy: v as RecoveryStrategy })}
              >
                <SelectTrigger className="h-10 bg-paper-warm text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last-event">Last Event</SelectItem>
                  <SelectItem value="last-checkpoint">Last Checkpoint</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Harness Block */}
        <div className="surface-etched rounded-xl overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <div
              className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: ARCHITECTURE_BLOCKS[1].accentLight, color: ARCHITECTURE_BLOCKS[1].accent }}
            >
              <Brain className="size-5" />
            </div>
            <h2 className="font-heading text-lg font-semibold text-ink">Harness</h2>
            <p className="mt-1 text-xs text-ink-muted">{ARCHITECTURE_BLOCKS[1].tagline}</p>
          </div>
          <div className="space-y-5 border-t border-border px-6 py-5">
            <div className="space-y-2">
              <Label className="text-xs text-ink-muted">AI Engine</Label>
              <Select
                value={harness.engine}
                onValueChange={(v) => updateHarness({ engine: v as AIEngine })}
              >
                <SelectTrigger className="h-10 bg-paper-warm text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-code">Claude Code</SelectItem>
                  <SelectItem value="codex">Codex</SelectItem>
                  <SelectItem value="cursor">Cursor</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-ink-muted">Context Strategy</Label>
              <Select
                value={harness.contextStrategy}
                onValueChange={(v) => updateHarness({ contextStrategy: v as ContextStrategy })}
              >
                <SelectTrigger className="h-10 bg-paper-warm text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compaction">Compaction</SelectItem>
                  <SelectItem value="sliding-window">Sliding Window</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-ink-muted">
                Max Retries: <span className="font-semibold text-ink">{harness.maxRetries}</span>
              </Label>
              <Slider
                value={[harness.maxRetries]}
                onValueChange={(v) => updateHarness({ maxRetries: Array.isArray(v) ? v[0] : v })}
                min={1}
                max={10}
                step={1}
              />
            </div>
          </div>
        </div>

        {/* Sandbox Block */}
        <div className="surface-etched rounded-xl overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <div
              className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: ARCHITECTURE_BLOCKS[2].accentLight, color: ARCHITECTURE_BLOCKS[2].accent }}
            >
              <Box className="size-5" />
            </div>
            <h2 className="font-heading text-lg font-semibold text-ink">Sandbox</h2>
            <p className="mt-1 text-xs text-ink-muted">{ARCHITECTURE_BLOCKS[2].tagline}</p>
          </div>
          <div className="space-y-5 border-t border-border px-6 py-5">
            <div className="space-y-2">
              <Label className="text-xs text-ink-muted">Type</Label>
              <Select
                value={sandbox.type}
                onValueChange={(v) => updateSandbox({ type: v as SandboxType })}
              >
                <SelectTrigger className="h-10 bg-paper-warm text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="docker">Docker</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-ink-muted">Credential Policy</Label>
              <Select
                value={sandbox.credentialPolicy}
                onValueChange={(v) => updateSandbox({ credentialPolicy: v as CredentialPolicy })}
              >
                <SelectTrigger className="h-10 bg-paper-warm text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vault">Vault</SelectItem>
                  <SelectItem value="bundled">Bundled</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-ink-muted">
              MCP servers can be configured in Step 4.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between border-t border-border pt-6">
        <button
          onClick={goPrev}
          className="rounded-md px-5 py-2.5 text-sm font-medium text-ink-secondary transition-precise hover:bg-secondary"
        >
          ← Back
        </button>
        <button
          onClick={goNext}
          className="rounded-md bg-copper px-6 py-2.5 text-sm font-medium text-primary-foreground transition-precise hover:bg-copper/90 active:scale-[0.98]"
        >
          Continue to Flow →
        </button>
      </div>
    </div>
  );
}
