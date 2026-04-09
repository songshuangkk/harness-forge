'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

  // --- MCP Server handlers ---

  const addServer = useCallback(() => {
    const newServer: MCPServerConfig = { name: '', command: '', args: [] };
    setIntegration({ mcpServers: [...mcpServers, newServer] });
  }, [mcpServers, setIntegration]);

  const removeServer = useCallback(
    (index: number) => {
      const updated = mcpServers.filter((_, i) => i !== index);
      setIntegration({ mcpServers: updated });
    },
    [mcpServers, setIntegration],
  );

  const updateServer = useCallback(
    (index: number, field: keyof MCPServerConfig, value: string | string[]) => {
      const updated = mcpServers.map((server, i) =>
        i === index ? { ...server, [field]: value } : server,
      );
      setIntegration({ mcpServers: updated });
    },
    [mcpServers, setIntegration],
  );

  // --- Hook handlers ---

  const addHook = useCallback(() => {
    const newHook: HookConfig = { event: '', command: '' };
    setIntegration({ hooks: [...hooks, newHook] });
  }, [hooks, setIntegration]);

  const removeHook = useCallback(
    (index: number) => {
      const updated = hooks.filter((_, i) => i !== index);
      setIntegration({ hooks: updated });
    },
    [hooks, setIntegration],
  );

  const updateHook = useCallback(
    (index: number, field: keyof HookConfig, value: string) => {
      const updated = hooks.map((hook, i) =>
        i === index ? { ...hook, [field]: value } : hook,
      );
      setIntegration({ hooks: updated });
    },
    [hooks, setIntegration],
  );

  // --- Navigation ---

  const goPrev = () => {
    setCurrentStep(2);
    router.push(STEP_PATHS[2]);
  };

  const goNext = () => {
    setCurrentStep(4);
    router.push(STEP_PATHS[4]);
  };

  return (
    <div className="space-y-6">
      {/* Section 1: MCP Servers */}
      <Card>
        <CardHeader>
          <CardTitle>MCP Servers</CardTitle>
          <CardDescription>
            Configure Model Context Protocol servers for external tool connections.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mcpServers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No MCP servers configured. Click &quot;Add Server&quot; to get started.
            </p>
          )}
          {mcpServers.map((server, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-lg border border-border p-4"
            >
              <div className="grid flex-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input
                    placeholder="server-name"
                    value={server.name}
                    onChange={(e) => updateServer(index, 'name', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Command</Label>
                  <Input
                    placeholder="npx @example/mcp-server"
                    value={server.command}
                    onChange={(e) => updateServer(index, 'command', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Args (comma-separated)</Label>
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
                          .filter(Boolean),
                      )
                    }
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="mt-5 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeServer(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addServer}>
            + Add Server
          </Button>
        </CardContent>
      </Card>

      {/* Section 2: Hooks */}
      <Card>
        <CardHeader>
          <CardTitle>Hooks</CardTitle>
          <CardDescription>
            Define lifecycle hooks to run commands at specific agent events.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hooks.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hooks configured. Click &quot;Add Hook&quot; to get started.
            </p>
          )}
          {hooks.map((hook, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-lg border border-border p-4"
            >
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Event</Label>
                  {hook.event !== '__custom__' &&
                  HOOK_EVENTS.includes(hook.event as (typeof HOOK_EVENTS)[number]) ? (
                    <Select
                      value={hook.event}
                      onValueChange={(val) => {
                        if (val === '__custom__') {
                          updateHook(index, 'event', '__custom__');
                        } else {
                          updateHook(index, 'event', val as string);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
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
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => updateHook(index, 'event', '')}
                      >
                        Reset
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Command</Label>
                  <Input
                    placeholder="echo 'hook executed'"
                    value={hook.command}
                    onChange={(e) => updateHook(index, 'command', e.target.value)}
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="mt-5 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeHook(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addHook}>
            + Add Hook
          </Button>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={goPrev}>
          Previous
        </Button>
        <Button onClick={goNext}>Next</Button>
      </div>
    </div>
  );
}
