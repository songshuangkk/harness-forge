'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, Zap, Terminal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectConfig } from '@/store/useProjectConfig';
import type { MCPServerConfig, HookConfig } from '@/types';

const STEP_PATHS = [
  '/wizard',
  '/wizard/architecture',
  '/wizard/flow',
  '/wizard/integration',
  '/wizard/generate',
];

const HOOK_EVENTS = ['pre-step', 'post-step', 'on-error', 'on-complete'] as const;

export default function IntegrationPage() {
  const router = useRouter();
  const setCurrentStep = useProjectConfig((s) => s.setCurrentStep);
  const integration = useProjectConfig((s) => s.config.integration);
  const setIntegration = useProjectConfig((s) => s.setIntegration);

  const mcpServers = integration.mcpServers;
  const hooks = integration.hooks;

  const addServer = useCallback(() => {
    const newServer: MCPServerConfig = { name: '', command: '', args: [] };
    setIntegration({ mcpServers: [...mcpServers, newServer] });
  }, [mcpServers, setIntegration]);

  const removeServer = useCallback(
    (index: number) => {
      const updated = mcpServers.filter((_, i) => i !== index);
      setIntegration({ mcpServers: updated });
    },
    [mcpServers, setIntegration]
  );

  const updateServer = useCallback(
    (index: number, field: keyof MCPServerConfig, value: string | string[]) => {
      const updated = mcpServers.map((server, i) =>
        i === index ? { ...server, [field]: value } : server
      );
      setIntegration({ mcpServers: updated });
    },
    [mcpServers, setIntegration]
  );

  const addHook = useCallback(() => {
    const newHook: HookConfig = { event: '', command: '' };
    setIntegration({ hooks: [...hooks, newHook] });
  }, [hooks, setIntegration]);

  const removeHook = useCallback(
    (index: number) => {
      const updated = hooks.filter((_, i) => i !== index);
      setIntegration({ hooks: updated });
    },
    [hooks, setIntegration]
  );

  const updateHook = useCallback(
    (index: number, field: keyof HookConfig, value: string) => {
      const updated = hooks.map((hook, i) =>
        i === index ? { ...hook, [field]: value } : hook
      );
      setIntegration({ hooks: updated });
    },
    [hooks, setIntegration]
  );

  const goPrev = () => {
    setCurrentStep(2);
    router.push(STEP_PATHS[2]);
  };

  const goNext = () => {
    setCurrentStep(4);
    router.push(STEP_PATHS[4]);
  };

  return (
    <div className="space-y-10">
      {/* Section header */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-copper">
          Integration
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-ink">
          Tools & Hooks
        </h1>
        <p className="mt-2 text-base text-ink-secondary">
          Connect MCP servers and define lifecycle hooks.
        </p>
      </div>

      {/* MCP Servers */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-copper/10 text-copper">
            <Zap className="size-4" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-ink">MCP Servers</h2>
            <p className="text-xs text-ink-muted">Model Context Protocol server connections</p>
          </div>
        </div>

        <div className="space-y-3">
          {mcpServers.length === 0 && (
            <div className="rounded-lg bg-paper-warm px-5 py-6 text-center">
              <p className="text-sm text-ink-muted">No servers configured yet.</p>
              <p className="mt-1 text-xs text-ink-muted">
                Add MCP servers to connect external tools to your agent.
              </p>
            </div>
          )}
          {mcpServers.map((server, index) => (
            <div
              key={index}
              className="surface-etched rounded-lg flex items-start gap-3 px-4 py-3"
            >
              <div className="grid flex-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs text-ink-muted">Name</Label>
                  <Input
                    placeholder="server-name"
                    value={server.name}
                    onChange={(e) => updateServer(index, 'name', e.target.value)}
                    className="h-9 bg-paper-warm text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-ink-muted">Command</Label>
                  <Input
                    placeholder="npx @example/mcp-server"
                    value={server.command}
                    onChange={(e) => updateServer(index, 'command', e.target.value)}
                    className="h-9 bg-paper-warm text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-ink-muted">Args</Label>
                  <Input
                    placeholder="arg1, arg2, arg3"
                    value={server.args.join(', ')}
                    onChange={(e) =>
                      updateServer(
                        index,
                        'args',
                        e.target.value
                          .split(',')
                          .map((a) => a.trim())
                          .filter(Boolean)
                      )
                    }
                    className="h-9 bg-paper-warm text-sm font-mono"
                  />
                </div>
              </div>
              <button
                onClick={() => removeServer(index)}
                className="mt-5 rounded p-1 text-ink-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <button
            onClick={addServer}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-copper transition-colors hover:bg-copper/5"
          >
            <Plus className="size-3.5" />
            Add Server
          </button>
        </div>
      </section>

      {/* Hooks */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-copper/10 text-copper">
            <Terminal className="size-4" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-ink">Hooks</h2>
            <p className="text-xs text-ink-muted">Lifecycle commands at agent events</p>
          </div>
        </div>

        <div className="space-y-3">
          {hooks.length === 0 && (
            <div className="rounded-lg bg-paper-warm px-5 py-6 text-center">
              <p className="text-sm text-ink-muted">No hooks configured yet.</p>
              <p className="mt-1 text-xs text-ink-muted">
                Add hooks to run commands when agent events fire.
              </p>
            </div>
          )}
          {hooks.map((hook, index) => (
            <div
              key={index}
              className="surface-etched rounded-lg flex items-start gap-3 px-4 py-3"
            >
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-ink-muted">Event</Label>
                  {hook.event !== '__custom__' &&
                  HOOK_EVENTS.includes(hook.event as (typeof HOOK_EVENTS)[number]) ? (
                    <Select
                      value={hook.event}
                      onValueChange={(val) => updateHook(index, 'event', val ?? '')}
                    >
                      <SelectTrigger className="h-9 bg-paper-warm text-sm">
                        <SelectValue placeholder="Select event" />
                      </SelectTrigger>
                      <SelectContent>
                        {HOOK_EVENTS.map((evt) => (
                          <SelectItem key={evt} value={evt}>
                            {evt}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__">Custom...</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="custom-event-name"
                        value={hook.event === '__custom__' ? '' : hook.event}
                        onChange={(e) => updateHook(index, 'event', e.target.value)}
                        className="h-9 bg-paper-warm text-sm font-mono"
                      />
                      <button
                        onClick={() => updateHook(index, 'event', '')}
                        className="shrink-0 rounded-md px-2 text-xs text-ink-muted hover:bg-secondary"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-ink-muted">Command</Label>
                  <Input
                    placeholder="echo 'hook executed'"
                    value={hook.command}
                    onChange={(e) => updateHook(index, 'command', e.target.value)}
                    className="h-9 bg-paper-warm text-sm font-mono"
                  />
                </div>
              </div>
              <button
                onClick={() => removeHook(index)}
                className="mt-5 rounded p-1 text-ink-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <button
            onClick={addHook}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-copper transition-colors hover:bg-copper/5"
          >
            <Plus className="size-3.5" />
            Add Hook
          </button>
        </div>
      </section>

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
          Preview & Generate →
        </button>
      </div>
    </div>
  );
}
