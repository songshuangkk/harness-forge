import type { ProjectConfig, OutputFile, ConstraintType, Language } from '@/types';
import { getStageArtifacts } from './stageArtifacts';

// ── Stage tool rules for hook state machine ──

interface StageToolRules {
  allow: string[];
  deny: string[];
  writePaths: string[];
}

function getStageToolRules(stageName: string): StageToolRules {
  switch (stageName) {
    case 'think':
      return { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Agent'], deny: ['Bash'], writePaths: ['docs/**'] };
    case 'plan':
      return { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Agent'], deny: ['Bash'], writePaths: ['docs/**'] };
    case 'build':
      return { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash', 'Agent'], deny: [], writePaths: ['**/src/**', '**/test/**', 'docs/**'] };
    case 'review':
      return { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit'], deny: ['Bash'], writePaths: ['docs/**'] };
    case 'test':
      return { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash'], deny: [], writePaths: ['**/test/**', 'docs/**'] };
    case 'ship':
      return { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash'], deny: [], writePaths: ['**'] };
    case 'reflect':
      return { allow: ['Read', 'Grep', 'Glob', 'Write', 'Edit'], deny: ['Bash'], writePaths: ['docs/**'] };
    default:
      return { allow: [], deny: [], writePaths: [] };
  }
}

/** Resolve write paths: user override from stageConfig, or flexible-glob defaults */
function resolveWritePaths(stageName: string, stageConfig?: Record<string, unknown>): string[] {
  const defaults = getStageToolRules(stageName).writePaths;
  if (stageConfig?.writePaths && Array.isArray(stageConfig.writePaths) && stageConfig.writePaths.length > 0) {
    return stageConfig.writePaths as string[];
  }
  return defaults;
}

// ── Unified constraints.json generator ──

interface GateDef {
  id: string;
  type: 'file_exists' | 'file_nonempty' | 'file_contains';
  pattern: string;
  description: string;
  marker?: string;
}

interface StageDef {
  name: string;
  roles: string[];
  tools: { allow: string[]; deny: string[] };
  paths: { write: string[] };
  gates: GateDef[];
  next: string | null;
}

interface TransitionDef {
  from: string;
  to: string;
  requires: string[];
}

interface ConstraintEntry {
  id: string;
  stageId: string;
  type: string;
  description: string;
  enforced: boolean;
  enforcement?: {
    checkType: string;
    targets?: string[];
    pattern?: string;
    message?: string;
  };
}

function generateConstraintsJson(config: ProjectConfig): string {
  const enabledStages = config.flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  if (enabledStages.length === 0) return '';

  const stages: StageDef[] = [];
  const transitions: TransitionDef[] = [];

  for (let i = 0; i < enabledStages.length; i++) {
    const stage = enabledStages[i];
    const nextStage = enabledStages[i + 1];
    const artifacts = getStageArtifacts(stage);
    const toolRules = getStageToolRules(stage.name);

    const gates: GateDef[] = [];

    // Artifact-based gates
    for (let j = 0; j < artifacts.length; j++) {
      const artifact = artifacts[j];
      const baseId = artifact.path.split('/').pop()?.replace(/\..*$/, '') ?? 'output';
      const gateId = `${stage.name}-${baseId}${j > 0 ? `-${j}` : ''}`;
      gates.push({
        id: gateId,
        type: artifact.verification === 'exists' ? 'file_exists' : artifact.verification === 'non-empty' ? 'file_nonempty' : 'file_contains',
        pattern: artifact.path,
        description: artifact.description,
        ...(artifact.verification === 'contains-section' && artifact.sectionMarker ? { marker: artifact.sectionMarker } : {}),
      });
    }

    // User-defined enforced constraints as gates
    const enforcedConstraints = config.flow.constraints.filter(
      (c) => c.enforced && (c.stageId === stage.id || c.stageId === stage.name)
    );
    for (const c of enforcedConstraints) {
      if (c.enforcement?.checkType === 'file-exists' && c.enforcement.targets) {
        for (const target of c.enforcement.targets) {
          gates.push({
            id: c.id,
            type: 'file_exists',
            pattern: target,
            description: c.enforcement.message ?? c.description,
          });
        }
      } else if (c.enforcement?.checkType === 'file-contains' && c.enforcement.targets) {
        for (const target of c.enforcement.targets) {
          gates.push({
            id: c.id,
            type: 'file_contains',
            pattern: target,
            description: c.enforcement.message ?? c.description,
            ...(c.enforcement.pattern ? { marker: c.enforcement.pattern } : {}),
          });
        }
      }
    }

    const resolvedWritePaths = resolveWritePaths(stage.name, stage.stageConfig as Record<string, unknown> | undefined);

    stages.push({
      name: stage.name,
      roles: [...stage.roles],
      tools: { allow: toolRules.allow, deny: toolRules.deny },
      paths: { write: resolvedWritePaths },
      gates,
      next: nextStage?.name ?? null,
    });

    // Transition rules
    if (nextStage) {
      const requires: string[] = [];
      for (let j = 0; j < artifacts.length; j++) {
        const artifact = artifacts[j];
        const baseId = artifact.path.split('/').pop()?.replace(/\..*$/, '') ?? 'output';
        const gateId = `${stage.name}-${baseId}${j > 0 ? `-${j}` : ''}`;
        requires.push(gateId);
      }
      for (const c of enforcedConstraints) {
        requires.push(c.id);
      }
      transitions.push({ from: stage.name, to: nextStage.name, requires });
    }
  }

  // Role definitions
  const roles: Record<string, { description: string; focus?: string[] }> = {};
  for (const role of config.flow.roles) {
    roles[role.id] = {
      description: role.description,
      ...(role.reviewFocus && role.reviewFocus.length > 0 ? { focus: role.reviewFocus } : {}),
    };
  }

  const doc = {
    _comment: '.harness/constraints.json — Declarative constraint rules for hook state machine. Generated by Harness Forge. DO NOT EDIT manually.',
    project: config.project.name || 'unnamed',
    stages,
    roles,
    transitions,
  };

  return JSON.stringify(doc, null, 2) + '\n';
}

// ── Initial state.json generator ──

function generateInitialState(config: ProjectConfig): string {
  const enabledStages = config.flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  const firstStage = enabledStages[0];
  const firstRole = firstStage?.roles[0] ?? 'ceo';
  const firstToolRules = firstStage ? getStageToolRules(firstStage.name) : { allow: [] as string[], writePaths: [] as string[] };

  const gates: Record<string, { passed: boolean; artifacts: string[] }> = {};
  for (const stage of enabledStages) {
    gates[stage.name] = { passed: false, artifacts: [] };
  }

  const state = {
    version: 1,
    project: config.project.name || 'unnamed',
    sprint: {
      current: firstStage?.name ?? 'think',
      history: [] as string[],
      started_at: '',
    },
    role: {
      current: firstRole,
      allowed_tools: firstToolRules.allow,
      allowed_paths: firstToolRules.writePaths,
    },
    gates,
  };

  return JSON.stringify(state, null, 2) + '\n';
}

// ── Constraint type to filename mapping ──

const CONSTRAINT_FILES: Record<ConstraintType, string> = {
  gate: 'gates.json',
  checklist: 'checklists.json',
  'output-requirement': 'outputs.json',
};

// ── Language-based test command defaults ──

const LANGUAGE_TEST_DEFAULTS: Record<string, { test: string; coverage: string }> = {
  typescript: { test: 'npm test', coverage: 'npm run coverage' },
  javascript: { test: 'npm test', coverage: 'npm run coverage' },
  python:     { test: 'pytest', coverage: 'pytest --cov --cov-report=term-missing' },
  go:         { test: 'go test ./...', coverage: 'go test -cover ./...' },
  java:       { test: 'mvn test', coverage: 'mvn test jacoco:report' },
  rust:       { test: 'cargo test', coverage: 'cargo tarpaulin' },
  dart:       { test: 'flutter test', coverage: 'flutter test --coverage' },
};

export function generateCoreConstraints(config: ProjectConfig): OutputFile[] {
  const files: OutputFile[] = [];

  // Generate the unified constraints.json for hook state machine (always, regardless of user constraints)
  const constraintsJson = generateConstraintsJson(config);
  if (constraintsJson) {
    files.push({
      path: '.harness/constraints.json',
      content: constraintsJson,
    });
  }

  // Generate initial state.json (always)
  files.push({
    path: '.harness/state.json',
    content: generateInitialState(config),
  });

  const constraints = config.flow.constraints;
  if (constraints.length === 0) return files;

  // Group by type
  const grouped = new Map<ConstraintType, ConstraintEntry[]>();
  for (const c of constraints) {
    const list = grouped.get(c.type) || [];
    list.push({
      id: c.id,
      stageId: c.stageId,
      type: c.type,
      description: c.description,
      enforced: c.enforced,
      enforcement: c.enforcement,
    });
    grouped.set(c.type, list);
  }

  // Generate per-type constraint files as JSON
  for (const [type, entries] of grouped) {
    const filename = CONSTRAINT_FILES[type];
    if (!filename) continue;
    files.push({
      path: `.harness/constraints/${filename}`,
      content: JSON.stringify(entries, null, 2) + '\n',
    });
  }

  // Generate tdd.json when build has tddMode=enforced
  const buildStage = config.flow.sprint.find(
    (s) => s.name === 'build' && s.enabled
  );
  const buildConfig = buildStage?.stageConfig as
    | { tddMode?: string; executionStrategy?: string }
    | undefined;

  if (buildConfig?.tddMode === 'enforced') {
    const testStage = config.flow.sprint.find(
      (s) => s.name === 'test' && s.enabled
    );
    const testConfig = testStage?.stageConfig as
      | { coverageTarget?: number; testTypes?: string[]; testCommand?: string; coverageCommand?: string }
      | undefined;

    const coverageTarget = testConfig?.coverageTarget ?? 80;
    const testTypes = testConfig?.testTypes ?? ['unit'];

    const defaults = LANGUAGE_TEST_DEFAULTS[config.project.techStack.language] ?? LANGUAGE_TEST_DEFAULTS.typescript;
    const testCommand = testConfig?.testCommand || defaults.test;
    const coverageCommand = testConfig?.coverageCommand || defaults.coverage;

    const tddConfig = {
      _comment: '.harness/constraints/tdd.json — Machine-readable TDD constraints parsed by hooks',
      version: '1.0',
      stage: 'build',
      coverage: {
        min_percent: coverageTarget,
        measure_command: coverageCommand,
        result_field: 'total.lines.pct',
      },
      tests: {
        must_pass: testTypes,
        no_skip: true,
        run_command: testCommand,
      },
      retry: {
        max_attempts: config.architecture.harness.maxRetries,
        on_failure: 'fix_and_retry',
      },
    };

    files.push({
      path: '.harness/constraints/tdd.json',
      content: JSON.stringify(tddConfig, null, 2) + '\n',
    });
  }

  return files;
}
