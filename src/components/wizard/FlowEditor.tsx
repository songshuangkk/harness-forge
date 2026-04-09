'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { SprintStage, StageName, RoleName } from '@/types';

const STAGE_META: Record<StageName, { label: string; icon: string }> = {
  think: { label: 'Think', icon: '💡' },
  plan: { label: 'Plan', icon: '📋' },
  build: { label: 'Build', icon: '🔨' },
  review: { label: 'Review', icon: '🔍' },
  test: { label: 'Test', icon: '🧪' },
  ship: { label: 'Ship', icon: '🚀' },
  reflect: { label: 'Reflect', icon: '🪞' },
};

const ALL_ROLES: { id: RoleName; label: string }[] = [
  { id: 'ceo', label: 'CEO' },
  { id: 'designer', label: 'Designer' },
  { id: 'eng-manager', label: 'Eng Manager' },
  { id: 'qa', label: 'QA' },
  { id: 'security', label: 'Security' },
  { id: 'release', label: 'Release' },
  { id: 'doc-engineer', label: 'Doc Engineer' },
];

interface FlowEditorProps {
  sprint: SprintStage[];
  onChange: (sprint: SprintStage[]) => void;
}

export function FlowEditor({ sprint, onChange }: FlowEditorProps) {
  const updateStage = useCallback(
    (stageId: string, patch: Partial<SprintStage>) => {
      const next = sprint.map((s) =>
        s.id === stageId ? { ...s, ...patch } : s
      );
      onChange(next);
    },
    [sprint, onChange]
  );

  const toggleRole = useCallback(
    (stageId: string, role: RoleName) => {
      const stage = sprint.find((s) => s.id === stageId);
      if (!stage) return;
      const roles = stage.roles.includes(role)
        ? stage.roles.filter((r) => r !== role)
        : [...stage.roles, role];
      updateStage(stageId, { roles });
    },
    [sprint, updateStage]
  );

  const addGate = useCallback(
    (stageId: string, value: string) => {
      const stage = sprint.find((s) => s.id === stageId);
      if (!stage || !value.trim()) return;
      updateStage(stageId, { gates: [...stage.gates, value.trim()] });
    },
    [sprint, updateStage]
  );

  const removeGate = useCallback(
    (stageId: string, index: number) => {
      const stage = sprint.find((s) => s.id === stageId);
      if (!stage) return;
      updateStage(stageId, { gates: stage.gates.filter((_, i) => i !== index) });
    },
    [sprint, updateStage]
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
      {sprint.map((stage) => (
        <StageCard
          key={stage.id}
          stage={stage}
          onToggleEnabled={(enabled) => updateStage(stage.id, { enabled })}
          onToggleRole={(role) => toggleRole(stage.id, role)}
          onAddGate={(value) => addGate(stage.id, value)}
          onRemoveGate={(index) => removeGate(stage.id, index)}
          onOutputFormatChange={(fmt) => updateStage(stage.id, { outputFormat: fmt })}
        />
      ))}
    </div>
  );
}

interface StageCardProps {
  stage: SprintStage;
  onToggleEnabled: (enabled: boolean) => void;
  onToggleRole: (role: RoleName) => void;
  onAddGate: (value: string) => void;
  onRemoveGate: (index: number) => void;
  onOutputFormatChange: (value: string) => void;
}

function StageCard({
  stage,
  onToggleEnabled,
  onToggleRole,
  onAddGate,
  onRemoveGate,
  onOutputFormatChange,
}: StageCardProps) {
  const meta = STAGE_META[stage.name];
  const [gateInput, setGateInput] = useState('');

  const handleAddGate = () => {
    if (gateInput.trim()) {
      onAddGate(gateInput);
      setGateInput('');
    }
  };

  const handleGateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddGate();
    }
  };

  return (
    <Card
      className={`min-w-[280px] shrink-0 snap-start transition-opacity ${
        stage.enabled ? 'opacity-100' : 'opacity-50'
      }`}
    >
      <CardContent className="flex flex-col gap-3 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{meta.icon}</span>
            <span className="font-medium">{meta.label}</span>
          </div>
          <Switch
            size="sm"
            checked={stage.enabled}
            onCheckedChange={onToggleEnabled}
          />
        </div>

        {/* Roles */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Roles</p>
          <div className="flex flex-wrap gap-1">
            {ALL_ROLES.map((role) => {
              const selected = stage.roles.includes(role.id);
              return (
                <Badge
                  key={role.id}
                  variant={selected ? 'default' : 'outline'}
                  className="cursor-pointer select-none"
                  onClick={() => onToggleRole(role.id)}
                >
                  {role.label}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Gates */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Gates</p>
          {stage.gates.length > 0 && (
            <ul className="mb-2 space-y-1">
              {stage.gates.map((gate, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                >
                  <span className="truncate">{gate}</span>
                  <button
                    onClick={() => onRemoveGate(i)}
                    className="shrink-0 rounded text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-1">
            <Input
              placeholder="Add gate..."
              value={gateInput}
              onChange={(e) => setGateInput(e.target.value)}
              onKeyDown={handleGateKeyDown}
              className="h-7 text-xs"
            />
            <Button
              variant="outline"
              size="xs"
              onClick={handleAddGate}
              disabled={!gateInput.trim()}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Output format */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Output format
          </p>
          <Input
            placeholder="e.g. markdown, json..."
            value={stage.outputFormat ?? ''}
            onChange={(e) => onOutputFormatChange(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
      </CardContent>
    </Card>
  );
}
