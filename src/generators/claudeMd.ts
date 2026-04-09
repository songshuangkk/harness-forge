import type { ProjectConfig, OutputFile, SessionStorage, RecoveryStrategy, AIEngine, ContextStrategy, SandboxType, CredentialPolicy, StageName } from '@/types';

const STORAGE_LABELS: Record<SessionStorage, string> = {
  'local-file': 'Local File — events stored as local JSON files',
  'git-based': 'Git Based — events committed to git history',
  custom: 'Custom — user-defined storage backend',
};

const RECOVERY_LABELS: Record<RecoveryStrategy, string> = {
  'last-event': 'Last Event — resume from the most recent event',
  'last-checkpoint': 'Last Checkpoint — resume from last saved checkpoint',
  custom: 'Custom — user-defined recovery logic',
};

const ENGINE_LABELS: Record<AIEngine, string> = {
  'claude-code': 'Claude Code',
  codex: 'OpenAI Codex CLI',
  custom: 'Custom AI engine',
};

const CONTEXT_LABELS: Record<ContextStrategy, string> = {
  compaction: 'Compaction — summarize old context to save space',
  'sliding-window': 'Sliding Window — keep recent N messages',
  full: 'Full — retain complete context without truncation',
};

const SANDBOX_LABELS: Record<SandboxType, string> = {
  local: 'Local — run code in the local environment',
  docker: 'Docker — run code in isolated containers',
  remote: 'Remote — execute on a remote server',
};

const CREDENTIAL_LABELS: Record<CredentialPolicy, string> = {
  vault: 'Vault — credentials stored in a secure vault, never in sandbox',
  bundled: 'Bundled — credentials injected at sandbox init',
  none: 'None — no credential isolation',
};

const STAGE_LABELS: Record<StageName, string> = {
  think: 'Think',
  plan: 'Plan',
  build: 'Build',
  review: 'Review',
  test: 'Test',
  ship: 'Ship',
  reflect: 'Reflect',
};

const ROLE_LABELS: Record<string, string> = {
  ceo: 'CEO / Founder',
  designer: 'Designer',
  'eng-manager': 'Eng Manager',
  qa: 'QA Lead',
  security: 'Security Officer',
  release: 'Release Engineer',
  'doc-engineer': 'Doc Engineer',
};

function generateArchitectureSection(config: ProjectConfig): string {
  const { session, harness, sandbox } = config.architecture;
  return `## Architecture

Based on Anthropic's Managed Agents: Session/Harness/Sandbox decoupled design.

### Session
- **Storage**: ${STORAGE_LABELS[session.storage]}
- **Event Retention**: ${session.eventRetention} events
- **Recovery**: ${RECOVERY_LABELS[session.recoveryStrategy]}

### Harness (Brain)
- **Engine**: ${ENGINE_LABELS[harness.engine]}
- **Context Strategy**: ${CONTEXT_LABELS[harness.contextStrategy]}
- **Max Retries**: ${harness.maxRetries}

### Sandbox (Hands)
- **Type**: ${SANDBOX_LABELS[sandbox.type]}
- **Credential Policy**: ${CREDENTIAL_LABELS[sandbox.credentialPolicy]}`;
}

function generateFlowSection(config: ProjectConfig): string {
  const enabledStages = config.flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  if (enabledStages.length === 0) {
    return '## Sprint Flow\n\nNo sprint stages configured.';
  }

  const header = '| Stage | Roles | Gates |';
  const separator = '|-------|-------|-------|';
  const rows = enabledStages.map((stage) => {
    const stageLabel = STAGE_LABELS[stage.name] || stage.name;
    const roles = stage.roles.map((r) => ROLE_LABELS[r] || r).join(', ') || '—';
    const gates = stage.gates.length > 0 ? stage.gates.join('; ') : '—';
    return `| ${stageLabel} | ${roles} | ${gates} |`;
  });

  const flowDiagram = enabledStages
    .map((s) => STAGE_LABELS[s.name] || s.name)
    .join(' → ');

  return `## Sprint Flow

\`${flowDiagram}\`

${header}
${separator}
${rows.join('\n')}`;
}

function generateConstraintsSection(config: ProjectConfig): string {
  const constraints = config.flow.constraints;
  if (constraints.length === 0) return '';

  const grouped = new Map<string, typeof constraints>();
  for (const c of constraints) {
    const list = grouped.get(c.stageId) || [];
    list.push(c);
    grouped.set(c.stageId, list);
  }

  const lines: string[] = ['## Constraints', ''];
  for (const [stageId, stageConstraints] of grouped) {
    const stage = config.flow.sprint.find((s) => s.id === stageId);
    const stageLabel = stage ? STAGE_LABELS[stage.name] : stageId;
    lines.push(`### ${stageLabel}`);
    for (const c of stageConstraints) {
      const badge = c.enforced ? '[ENFORCED]' : '[ADVISORY]';
      lines.push(`- ${badge} (${c.type}) ${c.description}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function generateIntegrationSection(config: ProjectConfig): string {
  const { mcpServers, hooks } = config.integration;
  if (mcpServers.length === 0 && hooks.length === 0) return '';

  const lines: string[] = ['## Integration', ''];

  if (mcpServers.length > 0) {
    lines.push('### MCP Servers');
    for (const server of mcpServers) {
      const args = server.args.length > 0 ? ` (args: ${server.args.join(' ')})` : '';
      lines.push(`- **${server.name}**: \`${server.command}\`${args}`);
    }
    lines.push('');
  }

  if (hooks.length > 0) {
    lines.push('### Hooks');
    for (const hook of hooks) {
      lines.push(`- **${hook.event}**: \`${hook.command}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function generateClaudeMd(config: ProjectConfig): OutputFile[] {
  const { project } = config;

  const sections = [
    `# ${project.name || 'Project'}`,
    project.description || '',
    generateArchitectureSection(config),
    generateFlowSection(config),
    generateConstraintsSection(config),
    generateIntegrationSection(config),
  ].filter(Boolean);

  return [
    {
      path: 'CLAUDE.md',
      content: sections.join('\\n') + '\n',
    },
  ];
}
