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

  return files;
}
