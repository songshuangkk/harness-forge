'use client';

import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useProjectConfig } from '@/store/useProjectConfig';
import type {
  SessionStorage,
  RecoveryStrategy,
  AIEngine,
  ContextStrategy,
  SandboxType,
  CredentialPolicy,
} from '@/types';

const STEP_PATHS = [
  '/wizard',
  '/wizard/architecture',
  '/wizard/flow',
  '/wizard/integration',
  '/wizard/generate',
];

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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Session */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="text-2xl">📋</span> Session
            </CardTitle>
            <CardDescription>Event log & state persistence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Storage</Label>
              <Select
                value={session.storage}
                onValueChange={(v) => updateSession({ storage: v as SessionStorage })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local-file">Local File</SelectItem>
                  <SelectItem value="git-based">Git Based</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Event Retention: {session.eventRetention}</Label>
              <Slider
                value={[session.eventRetention]}
                onValueChange={(v) => updateSession({ eventRetention: Array.isArray(v) ? v[0] : v })}
                min={10}
                max={500}
                step={10}
              />
            </div>
            <div className="space-y-2">
              <Label>Recovery Strategy</Label>
              <Select
                value={session.recoveryStrategy}
                onValueChange={(v) => updateSession({ recoveryStrategy: v as RecoveryStrategy })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="last-event">Last Event</SelectItem>
                  <SelectItem value="last-checkpoint">Last Checkpoint</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Harness */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="text-2xl">🧠</span> Harness
            </CardTitle>
            <CardDescription>AI engine & context management</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>AI Engine</Label>
              <Select
                value={harness.engine}
                onValueChange={(v) => updateHarness({ engine: v as AIEngine })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-code">Claude Code</SelectItem>
                  <SelectItem value="codex">Codex</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Context Strategy</Label>
              <Select
                value={harness.contextStrategy}
                onValueChange={(v) => updateHarness({ contextStrategy: v as ContextStrategy })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compaction">Compaction</SelectItem>
                  <SelectItem value="sliding-window">Sliding Window</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Max Retries: {harness.maxRetries}</Label>
              <Slider
                value={[harness.maxRetries]}
                onValueChange={(v) => updateHarness({ maxRetries: Array.isArray(v) ? v[0] : v })}
                min={1}
                max={10}
                step={1}
              />
            </div>
          </CardContent>
        </Card>

        {/* Sandbox */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="text-2xl">🔧</span> Sandbox
            </CardTitle>
            <CardDescription>Execution environment & security</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={sandbox.type}
                onValueChange={(v) => updateSandbox({ type: v as SandboxType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="docker">Docker</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Credential Policy</Label>
              <Select
                value={sandbox.credentialPolicy}
                onValueChange={(v) => updateSandbox({ credentialPolicy: v as CredentialPolicy })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vault">Vault</SelectItem>
                  <SelectItem value="bundled">Bundled</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              MCP servers can be configured in Step 4.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={goPrev}>Previous</Button>
        <Button onClick={goNext}>Next: Flow →</Button>
      </div>
    </div>
  );
}
