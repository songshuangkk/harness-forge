import type { ProjectConfig, OutputFile } from '@/types';

// ── Minimal YAML serializer (no npm dependency) ──

function needsQuoting(value: string): boolean {
  if (value === '') return true;
  // YAML special chars at start or content
  if (/^[{}[\],&*?|>!%@`#:'"\\\-]/.test(value)) return true;
  if (value.includes(': ')) return true;
  if (value.includes(' #')) return true;
  // YAML booleans / nulls that would be misinterpreted
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(value)) return true;
  return false;
}

function quoteString(value: string): string {
  if (!needsQuoting(value)) return value;
  // Use double-quoted style, escape backslashes and quotes
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function objectToYaml(value: unknown, indent: number = 0): string {
  const prefix = '  '.repeat(indent);

  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    return quoteString(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const lines: string[] = [];
    for (const item of value) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        // Inline object in array item
        const entries = Object.entries(item as Record<string, unknown>);
        if (entries.length === 0) {
          lines.push(`${prefix}- {}`);
        } else {
          const [firstKey, firstVal] = entries[0];
          lines.push(`${prefix}- ${firstKey}: ${objectToYaml(firstVal, indent + 1)}`);
          for (let i = 1; i < entries.length; i++) {
            const [k, v] = entries[i];
            if (typeof v === 'object' && v !== null) {
              lines.push(`${prefix}  ${k}:`);
              lines.push(objectToYaml(v, indent + 2));
            } else {
              lines.push(`${prefix}  ${k}: ${objectToYaml(v, 0)}`);
            }
          }
        }
      } else if (Array.isArray(item)) {
        lines.push(`${prefix}-`);
        lines.push(objectToYaml(item, indent + 1));
      } else {
        lines.push(`${prefix}- ${objectToYaml(item, 0)}`);
      }
    }
    return lines.join('\n');
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const lines: string[] = [];
    for (const [key, val] of entries) {
      if (typeof val === 'object' && val !== null) {
        lines.push(`${prefix}${key}:`);
        lines.push(objectToYaml(val, indent + 1));
      } else {
        lines.push(`${prefix}${key}: ${objectToYaml(val, 0)}`);
      }
    }
    return lines.join('\n');
  }

  return String(value);
}

export function generateCoreConfig(config: ProjectConfig): OutputFile {
  const yaml = objectToYaml(config, 0);
  return {
    path: '.harness/config.yaml',
    content: yaml + '\n',
  };
}
