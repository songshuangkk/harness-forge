import type { ProjectConfig, StageName, SprintStage } from '@/types';
import { getStageArtifacts } from '@/generators/core/stageArtifacts';

// ── Internal types ──

export interface GateCheck {
  id: string;
  description: string;
  forStage: StageName;
  checkType: 'file-exists' | 'file-non-empty' | 'file-contains-section' | 'command-blocklist';
  params: {
    paths?: string[];
    sectionHeader?: string;
    patterns?: string[];
  };
  exitCode: number;
}

// ── Default dangerous command patterns ──

const DEFAULT_BLOCKED_PATTERNS = [
  'rm -rf',
  'rm -r /',
  'drop table',
  'truncate table',
  'delete from',
  ':(){ :|:& };:',
  'dd if=/dev/zero',
  'mkfs.',
  '> /dev/sd',
];

// ── Artifact verification → GateCheck checkType mapping ──

function artifactVerificationToCheckType(
  verification: string
): GateCheck['checkType'] {
  switch (verification) {
    case 'non-empty':
      return 'file-non-empty';
    case 'contains-section':
      return 'file-contains-section';
    default:
      return 'file-exists';
  }
}

// ── Build constraint-check gate ──

function buildConstraintCheckGate(config: ProjectConfig): GateCheck[] {
  // Look for constraints with command-blocklist enforcement
  const blocklistConstraints = config.flow.constraints.filter(
    (c) => c.enforced && c.enforcement?.checkType === 'command-blocklist'
  );

  const patterns: string[] = [...DEFAULT_BLOCKED_PATTERNS];

  // Merge custom patterns from constraints
  for (const c of blocklistConstraints) {
    if (c.enforcement?.pattern) {
      patterns.push(c.enforcement.pattern);
    }
  }

  return [
    {
      id: 'dangerous-commands',
      description: 'Block dangerous shell commands',
      forStage: 'build', // conceptually global, but needs a stage reference
      checkType: 'command-blocklist',
      params: { patterns: [...new Set(patterns)] },
      exitCode: 2,
    },
  ];
}

// ── Build artifact gates for each stage ──

function buildArtifactGates(config: ProjectConfig): Map<string, GateCheck[]> {
  const gates = new Map<string, GateCheck[]>();
  const enabledStages = config.flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  for (let i = 0; i < enabledStages.length; i++) {
    const stage = enabledStages[i];

    // Skip the first stage — it has no predecessor to check
    if (i === 0) continue;

    const prevStage = enabledStages[i - 1];
    const artifacts = getStageArtifacts(prevStage);
    const checks: GateCheck[] = [];

    // Artifact checks
    for (const artifact of artifacts) {
      checks.push({
        id: `artifact-${prevStage.name}-${artifact.path}`,
        description: `${prevStage.name} stage artifact: ${artifact.description}`,
        forStage: stage.name,
        checkType: artifactVerificationToCheckType(artifact.verification),
        params: {
          paths: [artifact.path],
          sectionHeader: artifact.sectionMarker,
        },
        exitCode: 2,
      });
    }

    // Enforced gate constraints targeting this stage
    const stageConstraints = config.flow.constraints.filter(
      (c) =>
        c.enforced &&
        c.type === 'gate' &&
        (c.stageId === stage.id || c.stageId === stage.name)
    );

    for (const constraint of stageConstraints) {
      if (constraint.enforcement) {
        const { enforcement } = constraint;
        const checkType =
          enforcement.checkType === 'file-exists'
            ? 'file-exists' as const
            : enforcement.checkType === 'file-contains'
              ? 'file-contains-section' as const
              : undefined;

        if (checkType && enforcement.targets) {
          checks.push({
            id: `constraint-${constraint.id}`,
            description: constraint.enforcement.message ?? constraint.description,
            forStage: stage.name,
            checkType,
            params: {
              paths: enforcement.targets,
              sectionHeader: enforcement.pattern,
            },
            exitCode: 2,
          });
        }
      }
      // Constraints without enforcement become advisory (handled in commands, not hooks)
    }

    if (checks.length > 0) {
      gates.set(stage.name, checks);
    }
  }

  // Ship gate: aggregate ALL prior stage artifacts
  const shipStage = enabledStages.find((s) => s.name === 'ship');
  if (shipStage) {
    const shipIndex = enabledStages.indexOf(shipStage);
    const priorStages = enabledStages.slice(0, shipIndex);
    const shipChecks: GateCheck[] = [];

    for (const priorStage of priorStages) {
      const artifacts = getStageArtifacts(priorStage);
      for (const artifact of artifacts) {
        shipChecks.push({
          id: `ship-artifact-${priorStage.name}-${artifact.path}`,
          description: `${priorStage.name} stage artifact: ${artifact.description}`,
          forStage: 'ship',
          checkType: artifactVerificationToCheckType(artifact.verification),
          params: {
            paths: [artifact.path],
            sectionHeader: artifact.sectionMarker,
          },
          exitCode: 2,
        });
      }
    }

    // Ship-specific enforced constraints
    const shipConstraints = config.flow.constraints.filter(
      (c) =>
        c.enforced &&
        c.type === 'gate' &&
        (c.stageId === shipStage.id || c.stageId === 'ship')
    );

    for (const constraint of shipConstraints) {
      if (constraint.enforcement && constraint.enforcement.targets) {
        const { enforcement } = constraint;
        const checkType =
          enforcement.checkType === 'file-exists'
            ? 'file-exists' as const
            : enforcement.checkType === 'file-contains'
              ? 'file-contains-section' as const
              : undefined;

        if (checkType) {
          shipChecks.push({
            id: `ship-constraint-${constraint.id}`,
            description: constraint.enforcement.message ?? constraint.description,
            forStage: 'ship',
            checkType,
            params: {
              paths: enforcement.targets,
              sectionHeader: enforcement.pattern,
            },
            exitCode: 2,
          });
        }
      }
    }

    if (shipChecks.length > 0) {
      gates.set('ship', shipChecks);
    }
  }

  return gates;
}

// ── Main export ──

export function buildGateChecks(
  config: ProjectConfig
): Map<string, GateCheck[]> {
  const result = new Map<string, GateCheck[]>();

  // 1. Constraint check (dangerous commands)
  result.set('constraint-check', buildConstraintCheckGate(config));

  // 2. Stage artifact gates
  const artifactGates = buildArtifactGates(config);
  for (const [stageName, checks] of artifactGates) {
    // Ship gate is handled separately, other stages get their own gate
    if (stageName === 'ship') {
      result.set('ship-gate', checks);
    } else {
      result.set(`${stageName}-gate`, checks);
    }
  }

  return result;
}
