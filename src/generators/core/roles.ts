import type { ProjectConfig, OutputFile, RoleConfig, RoleName } from '@/types';
import { getRolePrompt } from './rolePrompts';

// ── Fallback role definitions when not in config.flow.roles ──

const DEFAULT_ROLE_DEFINITIONS: Record<string, RoleConfig> = {
  ceo: {
    id: 'ceo',
    label: 'CEO / Founder',
    description: 'Owns the product vision and final decision authority. Ensures every sprint output aligns with business goals and user value.',
    defaultConstraints: [
      'Must approve scope changes before build starts',
      'Has veto power on any stage gate',
      'Must be consulted on priority conflicts',
    ],
  },
  designer: {
    id: 'designer',
    label: 'Designer',
    description: 'Guards user experience consistency. Reviews all output for UX quality, accessibility, and design system compliance.',
    defaultConstraints: [
      'Must review any UI-facing changes',
      'Can block release on accessibility grounds',
      'Owns the design system and component library',
    ],
  },
  'eng-manager': {
    id: 'eng-manager',
    label: 'Eng Manager',
    description: 'Coordinates technical execution across stages. Breaks down plans into tasks, manages subagent parallelism, and enforces engineering standards.',
    defaultConstraints: [
      'Must review implementation plans before build',
      'Owns task breakdown and assignment',
      'Responsible for code review assignments',
    ],
  },
  qa: {
    id: 'qa',
    label: 'QA Lead',
    description: 'Ensures quality through evidence-based verification. Owns test strategy, coverage targets, and regression prevention.',
    defaultConstraints: [
      'Must sign off on test coverage before ship',
      'Can block release on quality grounds',
      'Owns test strategy and test case maintenance',
    ],
  },
  security: {
    id: 'security',
    label: 'Security Officer',
    description: 'Reviews output for security vulnerabilities, credential handling, and compliance. Can block any stage on security grounds.',
    defaultConstraints: [
      'Must review changes involving credentials or auth',
      'Can block release on security vulnerabilities',
      'Owns threat model and security checklist',
    ],
  },
  release: {
    id: 'release',
    label: 'Release Engineer',
    description: 'Owns the release pipeline from PR to deployment. Manages versioning, CI/CD, and deployment verification.',
    defaultConstraints: [
      'Must verify all gates pass before deployment',
      'Owns version bumping strategy',
      'Responsible for rollback plan on every release',
    ],
  },
  'doc-engineer': {
    id: 'doc-engineer',
    label: 'Doc Engineer',
    description: 'Ensures documentation stays in sync with code. Reviews output for documentation completeness and quality.',
    defaultConstraints: [
      'Must review docs for any public API changes',
      'Owns documentation style guide',
      'Can block release on missing docs',
    ],
  },
};

function getRoleDefinition(roleId: string, configuredRoles: RoleConfig[]): RoleConfig {
  // Check if user defined this role in config
  const configured = configuredRoles.find((r) => r.id === roleId);
  if (configured) return configured;
  // Fallback to defaults
  return DEFAULT_ROLE_DEFINITIONS[roleId] || {
    id: roleId as RoleName,
    label: roleId,
    description: `Custom role: ${roleId}`,
    defaultConstraints: [],
  };
}

function generateRoleMarkdown(role: RoleConfig): string {
  const prompt = getRolePrompt(role.id, []);
  const lines: string[] = [
    `# ${role.label}`,
    '',
    role.description,
    '',
    '## Default Constraints',
    '',
  ];

  if (role.defaultConstraints.length > 0) {
    for (const c of role.defaultConstraints) {
      lines.push(`- ${c}`);
    }
  } else {
    lines.push('None configured.');
  }

  // Review Focus
  const focusItems = role.reviewFocus ?? prompt.reviewFocus;
  if (focusItems.length > 0) {
    lines.push('', '## Review Focus', '');
    for (const f of focusItems) {
      lines.push(`- ${f}`);
    }
  }

  // System Prompt
  const systemPrompt = role.systemPrompt ?? prompt.systemPrompt;
  if (systemPrompt) {
    lines.push('', '## System Prompt', '');
    lines.push(`> ${systemPrompt}`);
  }

  lines.push('');
  return lines.join('\n');
}

export function generateCoreRoles(config: ProjectConfig): OutputFile[] {
  const enabledStages = config.flow.sprint.filter((s) => s.enabled);
  const roleIds = new Set<string>();
  for (const stage of enabledStages) {
    for (const r of stage.roles) {
      roleIds.add(r);
    }
  }

  if (roleIds.size === 0) return [];

  const configuredRoles = config.flow.roles;
  const files: OutputFile[] = [];

  for (const roleId of roleIds) {
    const role = getRoleDefinition(roleId, configuredRoles);
    const slug = roleId.replace(/[^a-z0-9]+/g, '-');
    files.push({
      path: `.harness/roles/${slug}.md`,
      content: generateRoleMarkdown(role),
    });
  }

  return files;
}
