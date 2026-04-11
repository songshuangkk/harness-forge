import type { ProjectConfig, OutputFile, ConstraintType } from '@/types';

// ── Simple YAML helpers (reuse pattern from config.ts) ──

function yamlString(value: string): string {
  if (value === '') return '""';
  if (/^[{}[\],&*?|>!%@`#:'"\\\-]/.test(value) || value.includes(': ') || value.includes(' #') || /^(true|false|null|yes|no|on|off|~)$/i.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

function yamlValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return yamlString(value);
  return yamlString(String(value));
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

function serializeConstraintList(entries: ConstraintEntry[]): string {
  if (entries.length === 0) return '';
  const lines: string[] = [];
  for (const entry of entries) {
    lines.push(`- id: ${yamlValue(entry.id)}`);
    lines.push(`  stageId: ${yamlValue(entry.stageId)}`);
    lines.push(`  type: ${yamlValue(entry.type)}`);
    lines.push(`  description: ${yamlValue(entry.description)}`);
    lines.push(`  enforced: ${yamlValue(entry.enforced)}`);
    if (entry.enforcement) {
      lines.push(`  enforcement:`);
      lines.push(`    checkType: ${yamlValue(entry.enforcement.checkType)}`);
      if (entry.enforcement.targets) {
        lines.push(`    targets:`);
        for (const t of entry.enforcement.targets) {
          lines.push(`      - ${yamlValue(t)}`);
        }
      }
      if (entry.enforcement.pattern) {
        lines.push(`    pattern: ${yamlValue(entry.enforcement.pattern)}`);
      }
      if (entry.enforcement.message) {
        lines.push(`    message: ${yamlValue(entry.enforcement.message)}`);
      }
    }
  }
  return lines.join('\n') + '\n';
}

// ── Constraint type to filename mapping ──

const CONSTRAINT_FILES: Record<ConstraintType, string> = {
  gate: 'gates.yaml',
  checklist: 'checklists.yaml',
  'output-requirement': 'outputs.yaml',
};

export function generateCoreConstraints(config: ProjectConfig): OutputFile[] {
  const constraints = config.flow.constraints;
  if (constraints.length === 0) return [];

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

  const files: OutputFile[] = [];
  for (const [type, entries] of grouped) {
    const filename = CONSTRAINT_FILES[type];
    if (!filename) continue;
    files.push({
      path: `.harness/constraints/${filename}`,
      content: serializeConstraintList(entries),
    });
  }

  // P2-1: Generate machine-readable tdd.yaml when build has tddMode=enforced
  const buildStage = config.flow.sprint.find(
    (s) => s.name === 'build' && s.enabled
  );
  const buildConfig = buildStage?.stageConfig as
    | { tddMode?: string; executionStrategy?: string }
    | undefined;

  if (buildConfig?.tddMode === 'enforced') {
    // Extract test config from the test stage
    const testStage = config.flow.sprint.find(
      (s) => s.name === 'test' && s.enabled
    );
    const testConfig = testStage?.stageConfig as
      | { coverageTarget?: number; testTypes?: string[] }
      | undefined;

    const coverageTarget = testConfig?.coverageTarget ?? 80;
    const testTypes = testConfig?.testTypes ?? ['unit'];

    const tddYaml = [
      '# .harness/constraints/tdd.yaml',
      '# Machine-readable TDD constraints — parsed by hooks for automated enforcement',
      `version: "1.0"`,
      `stage: build`,
      `coverage:`,
      `  min_percent: ${coverageTarget}`,
      `  measure_command: "npm run coverage -- --json 2>/dev/null || echo {}"`,
      `  result_field: "total.lines.pct"`,
      `tests:`,
      `  must_pass:`,
      ...testTypes.map((t) => `    - ${t}`),
      `  no_skip: true`,
      `  run_command: "npm test"`,
      `retry:`,
      `  max_attempts: ${config.architecture.harness.maxRetries}`,
      `  on_failure: "fix_and_retry"`,
      '',
    ].join('\n');

    files.push({
      path: '.harness/constraints/tdd.yaml',
      content: tddYaml,
    });
  }

  return files;
}
