import type { StageName, RoleName, RoleConfig } from '@/types';
import { getRolePrompt } from './rolePrompts';

// ── Stage context: what documents each negotiation stage reads ──

const STAGE_INPUT_DOCS: Record<string, string[]> = {
  think: ['The user\'s original request or task description'],
  plan: ['docs/design/problem-statement.md', 'docs/design/scope.md', 'docs/design/success-metrics.md'],
  review: ['docs/reports/build-report.md', 'docs/plans/implementation-plan.md'],
  reflect: ['docs/reports/build-report.md', 'docs/reviews/quality-audit.md', 'docs/reports/test-report.md'],
};

// ── Default negotiation roles for Think/Plan ──

const DEFAULT_NEGOTIATION_ROLES: Partial<Record<StageName, RoleName[]>> = {
  think: ['ceo', 'eng-manager', 'qa'],
  plan: ['ceo', 'eng-manager', 'qa'],
};

export function getNegotiationRoles(
  stageName: StageName,
  stageRoles: RoleName[],
  configuredNegotiationRoles?: RoleName[],
): RoleName[] {
  // User explicitly configured negotiation roles via wizard UI
  if (configuredNegotiationRoles && configuredNegotiationRoles.length > 0) {
    return configuredNegotiationRoles;
  }

  // Fall back to defaults for Think/Plan
  const defaults = DEFAULT_NEGOTIATION_ROLES[stageName];
  if (!defaults || stageRoles.length >= 2) return stageRoles;

  const merged = [...stageRoles];
  for (const r of defaults) {
    if (!merged.includes(r)) {
      merged.push(r);
    }
  }
  return merged;
}

// ── Helpers ──

export function isNegotiationStage(stageName: StageName, roles: RoleName[], configuredNegotiationRoles?: RoleName[]): boolean {
  return getNegotiationRoles(stageName, roles, configuredNegotiationRoles).length >= 2;
}

function roleSlug(roleId: string): string {
  return roleId.replace(/[^a-z0-9]+/g, '-');
}

// ── Sub-agent prompt for a single role in a specific round ──

export function renderNegotiationSubAgentPrompt(
  stageName: StageName,
  roleId: RoleName,
  round: 1 | 2,
  allRoles: RoleName[],
  configuredRoles: RoleConfig[],
): string {
  const prompt = getRolePrompt(roleId, configuredRoles);
  const inputDocs = STAGE_INPUT_DOCS[stageName] ?? [];
  const stageLabel = stageName.charAt(0).toUpperCase() + stageName.slice(1);
  const slug = roleSlug(roleId);

  const lines: string[] = [];

  lines.push(`You are the **${prompt.label}** participating in Round ${round} of a multi-role negotiation for the **${stageLabel}** stage.`);
  lines.push('');

  // Role system prompt
  lines.push('## Your Role');
  lines.push('');
  lines.push(prompt.systemPrompt);
  lines.push('');

  // Review focus
  if (prompt.reviewFocus.length > 0) {
    lines.push('## Review Focus');
    lines.push('');
    for (const focus of prompt.reviewFocus) {
      lines.push(`- ${focus}`);
    }
    lines.push('');
  }

  if (round === 1) {
    lines.push('## Task');
    lines.push('');

    if (inputDocs.length > 0) {
      lines.push('Read the following stage input documents using the Read tool:');
      for (const doc of inputDocs) {
        lines.push(`- ${doc}`);
      }
    } else {
      lines.push('Read any relevant documents from previous stages using the Read tool.');
    }
    lines.push('');
    lines.push('Write your independent assessment to `docs/negotiation/round-1/' + slug + '.md`.');
    lines.push('');
    lines.push('Structure your output:');
    lines.push('```markdown');
    lines.push(`## ${prompt.label} Assessment`);
    lines.push('');
    lines.push('### Key Observations');
    lines.push('- [your observations based on your review focus]');
    lines.push('');
    lines.push('### Concerns');
    lines.push('- [concerns from your role\'s perspective]');
    lines.push('');
    lines.push('### Recommendations');
    lines.push('- [specific, actionable recommendations]');
    lines.push('');
    lines.push('### Decision');
    lines.push('[APPROVE / FLAG / BLOCK — with one-sentence justification]');
    lines.push('```');
  } else {
    lines.push('## Task');
    lines.push('');
    lines.push('Read ALL Round 1 perspectives using the Read tool:');
    for (const r of allRoles) {
      const s = roleSlug(r);
      const rLabel = getRolePrompt(r, configuredRoles).label;
      lines.push(`- \`docs/negotiation/round-1/${s}.md\` (${rLabel})`);
    }
    lines.push('');
    lines.push('Consider what you missed, areas of agreement, and areas of disagreement.');
    lines.push('Write your revised assessment to `docs/negotiation/round-2/' + slug + '.md`.');
    lines.push('');
    lines.push('Structure your output:');
    lines.push('```markdown');
    lines.push(`## ${prompt.label} Revised Assessment`);
    lines.push('');
    lines.push('### Revised Key Observations');
    lines.push('- [updated based on cross-reading]');
    lines.push('');
    lines.push('### Points of Agreement');
    lines.push('- [where all roles align]');
    lines.push('');
    lines.push('### Points of Disagreement');
    lines.push('- [where perspectives diverge, and your position]');
    lines.push('');
    lines.push('### Revised Recommendations');
    lines.push('- [updated recommendations considering all perspectives]');
    lines.push('');
    lines.push('### Revised Decision');
    lines.push('[APPROVE / APPROVE_WITH_CONDITIONS / BLOCK — with justification]');
    lines.push('```');
  }

  return lines.join('\n');
}

// ── Full negotiation protocol for embedding in stage commands ──

export function renderNegotiationProtocol(
  stageName: StageName,
  stageRoles: RoleName[],
  configuredRoles: RoleConfig[],
  configuredNegotiationRoles?: RoleName[],
): string {
  const negotiationRoles = getNegotiationRoles(stageName, stageRoles, configuredNegotiationRoles);
  if (negotiationRoles.length < 2) return '';

  const roleList = negotiationRoles.map(r => getRolePrompt(r, configuredRoles).label).join(', ');
  const roleIds = negotiationRoles.map(r => roleSlug(r)).join(',');

  const lines: string[] = [];

  lines.push('## Negotiation Protocol');
  lines.push('');
  lines.push(`This stage has multiple roles: **${roleList}**.`);
  lines.push('Run a two-round negotiation to build cross-role consensus before proceeding.');
  lines.push('');

  // Setup
  lines.push('### Setup');
  lines.push('');
  lines.push(`Run: \`bash .claude/scripts/negotiate.sh init ${stageName} ${roleIds}\``);
  lines.push('');

  // Round 1
  lines.push('### Round 1: Independent Perspectives');
  lines.push('');
  lines.push('Spawn one sub-agent per role in a **single message with multiple Agent tool calls** (parallel execution).');
  lines.push('Use `subagent_type: "general-purpose"` for each.');
  lines.push('');

  for (const roleId of negotiationRoles) {
    const prompt = getRolePrompt(roleId, configuredRoles);
    lines.push(`**${prompt.label} sub-agent:**`);
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>Click to expand prompt</summary>');
    lines.push('');
    lines.push('```');
    lines.push(renderNegotiationSubAgentPrompt(stageName, roleId, 1, negotiationRoles, configuredRoles));
    lines.push('```');
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  lines.push('After all sub-agents complete, verify: `bash .claude/scripts/negotiate.sh check-round 1`');
  lines.push('');

  // Round 2
  lines.push('### Round 2: Cross-Reading and Revision');
  lines.push('');
  lines.push('Spawn sub-agents again (parallel). Each reads ALL Round 1 perspectives and revises.');
  lines.push('');

  for (const roleId of negotiationRoles) {
    const prompt = getRolePrompt(roleId, configuredRoles);
    lines.push(`**${prompt.label} sub-agent:**`);
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>Click to expand prompt</summary>');
    lines.push('');
    lines.push('```');
    lines.push(renderNegotiationSubAgentPrompt(stageName, roleId, 2, negotiationRoles, configuredRoles));
    lines.push('```');
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  lines.push('After all sub-agents complete, verify: `bash .claude/scripts/negotiate.sh check-round 2`');
  lines.push('');

  // Synthesis
  lines.push('### Synthesis');
  lines.push('');
  lines.push('Read all Round 2 files:');
  for (const roleId of negotiationRoles) {
    const slug = roleSlug(roleId);
    const label = getRolePrompt(roleId, configuredRoles).label;
    lines.push(`- \`docs/negotiation/round-2/${slug}.md\` (${label})`);
  }
  lines.push('');
  lines.push('Identify: areas of consensus, trade-off decisions needed, remaining blockers.');
  lines.push('Write `docs/negotiation/consensus.md`:');
  lines.push('');
  lines.push('```markdown');
  lines.push('## Consensus');
  lines.push('');
  lines.push('### Agreed Points');
  lines.push('- [list items all roles agree on]');
  lines.push('');
  lines.push('### Trade-off Decisions');
  lines.push('- [list with rationale for each trade-off]');
  lines.push('');
  lines.push('### Remaining Concerns');
  lines.push('- [unresolved issues, if any]');
  lines.push('');
  lines.push('### Resolution');
  lines.push('[How concerns were addressed or deferred]');
  lines.push('```');
  lines.push('');
  lines.push('Use this consensus to inform the stage process below.');
  lines.push('');

  return lines.join('\n');
}
