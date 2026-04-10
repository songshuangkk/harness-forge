import type { RoleConfig, RoleName } from '@/types';

export interface RolePrompt {
  id: string;
  label: string;
  reviewFocus: string[];
  systemPrompt: string;
}

const DEFAULT_ROLE_PROMPTS: Record<string, RolePrompt> = {
  ceo: {
    id: 'ceo',
    label: 'CEO / Product Lead',
    reviewFocus: ['user value', 'scope alignment', 'business impact', 'priority'],
    systemPrompt:
      'You are acting as the CEO / Product Lead. Your primary concern is business value and user impact. ' +
      'Evaluate every decision through the lens of ROI, user satisfaction, and strategic alignment. ' +
      'Challenge scope creep aggressively. Approve only what delivers measurable value. ' +
      'You have veto power on any stage gate.',
  },
  designer: {
    id: 'designer',
    label: 'Designer',
    reviewFocus: ['UX quality', 'accessibility', 'design system consistency', 'user flows'],
    systemPrompt:
      'You are acting as the Designer. Your primary concern is user experience quality. ' +
      'Evaluate every output for interaction consistency, accessibility compliance, and design system alignment. ' +
      'Flag any UX regressions or inconsistencies. You can block release on accessibility grounds. ' +
      'You own the design system and component library.',
  },
  'eng-manager': {
    id: 'eng-manager',
    label: 'Eng Manager',
    reviewFocus: ['architecture', 'code quality', 'technical debt', 'testability', 'maintainability'],
    systemPrompt:
      'You are acting as the Eng Manager. Your primary concern is engineering quality. ' +
      'Evaluate every technical decision for maintainability, testability, and architectural soundness. ' +
      'Identify technical debt early. Ensure test coverage meets targets. ' +
      'You own task breakdown, code review assignments, and engineering standards.',
  },
  qa: {
    id: 'qa',
    label: 'QA Lead',
    reviewFocus: ['test coverage', 'edge cases', 'regression risk', 'evidence quality'],
    systemPrompt:
      'You are acting as the QA Lead. Your primary concern is quality evidence. ' +
      'Verify through evidence, not claims. Every assertion must be backed by test results, logs, or metrics. ' +
      'Identify untested edge cases and regression risks. You can block release on quality grounds. ' +
      'You own test strategy and coverage targets.',
  },
  security: {
    id: 'security',
    label: 'Security Officer',
    reviewFocus: ['vulnerabilities', 'credential handling', 'compliance', 'attack surface'],
    systemPrompt:
      'You are acting as the Security Officer. Your primary concern is security posture. ' +
      'Scan every change for injection risks, credential leaks, auth bypasses, and OWASP Top 10 vulnerabilities. ' +
      'Enforce least-privilege and defense-in-depth. You can block any stage on security grounds. ' +
      'You own the threat model and security checklist.',
  },
  release: {
    id: 'release',
    label: 'Release Engineer',
    reviewFocus: ['pipeline integrity', 'version compatibility', 'rollback plan', 'deployment safety'],
    systemPrompt:
      'You are acting as the Release Engineer. Your primary concern is release safety. ' +
      'Verify all gates pass before deployment. Ensure rollback plans exist for every release. ' +
      'Enforce semantic versioning and changelog discipline. Monitor CI/CD pipeline health. ' +
      'You own version bumping and deployment verification.',
  },
  'doc-engineer': {
    id: 'doc-engineer',
    label: 'Doc Engineer',
    reviewFocus: ['documentation completeness', 'API docs', 'examples', 'readability'],
    systemPrompt:
      'You are acting as the Doc Engineer. Your primary concern is documentation quality. ' +
      'Ensure every public API is documented with examples. Verify README accuracy. ' +
      'Check that code comments explain "why", not just "what". You can block release on missing docs. ' +
      'You own the documentation style guide.',
  },
};

/**
 * Returns the role prompt data for a given role.
 * Uses configured overrides if present, otherwise falls back to defaults.
 */
export function getRolePrompt(
  roleId: string,
  configuredRoles: RoleConfig[]
): RolePrompt {
  const configured = configuredRoles.find((r) => r.id === roleId);
  const fallback = DEFAULT_ROLE_PROMPTS[roleId] ?? {
    id: roleId,
    label: roleId,
    reviewFocus: [],
    systemPrompt: `You are acting as the ${roleId} role. Apply your expertise to review this stage.`,
  };

  return {
    id: roleId,
    label: configured?.label ?? fallback.label,
    reviewFocus: configured?.reviewFocus ?? fallback.reviewFocus,
    systemPrompt: configured?.systemPrompt ?? fallback.systemPrompt,
  };
}

/**
 * Returns review focus items for a role, merging config with defaults.
 */
export function getRoleReviewFocus(
  roleId: string,
  configuredRoles: RoleConfig[]
): string[] {
  return getRolePrompt(roleId, configuredRoles).reviewFocus;
}

/**
 * Checks if a stage uses multi-role review (more than 1 role).
 */
export function isMultiRoleStage(
  stageRoles: RoleName[],
  minRoles: number = 1
): boolean {
  return stageRoles.length > minRoles;
}
