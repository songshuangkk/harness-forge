import type { ProjectConfig, OutputFile, AIEngine, Language } from '@/types';

// ── Engine-to-config-filename mapping (shared across generators) ──

const ENGINE_CONFIG_FILE: Record<AIEngine, string> = {
  'claude-code': 'CLAUDE.md',
  codex: 'AGENTS.md',
  cursor: '.cursorrules',
  custom: 'AI_CONFIG.md',
};

export function getConfigFilename(engine: AIEngine): string {
  return ENGINE_CONFIG_FILE[engine];
}

// ── Label maps ──

const LANGUAGE_LABELS: Record<Language, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  go: 'Go',
  java: 'Java',
  rust: 'Rust',
  dart: 'Dart',
};

// ── Section generators ──

function generateTechStack(config: ProjectConfig): string {
  const { techStack } = config.project;
  const lines: string[] = ['## Tech Stack', ''];
  lines.push(`- **Language**: ${LANGUAGE_LABELS[techStack.language]}`);
  if (techStack.stackDescription) {
    lines.push(`- **Stack**: ${techStack.stackDescription}`);
  }
  lines.push('');
  return lines.join('\n');
}

function generateArchitecture(config: ProjectConfig): string {
  const { session, harness, sandbox } = config.architecture;

  const paragraph = `This project follows a three-layer agent architecture: ` +
    `**Session** (event log stored via ${session.storage}, ${session.eventRetention} events retained, recovery via ${session.recoveryStrategy}), ` +
    `**Harness** (${harness.engine} engine, ${harness.contextStrategy} context strategy, ${harness.maxRetries} max retries), ` +
    `and **Sandbox** (${sandbox.type} execution, ${sandbox.credentialPolicy} credential policy).`;

  return [
    '## Architecture',
    '',
    paragraph,
    '',
    `- **Session**: ${session.storage} storage, ${session.eventRetention} events, ${session.recoveryStrategy} recovery`,
    `- **Harness**: ${harness.engine}, ${harness.contextStrategy} context, ${harness.maxRetries} retries`,
    `- **Sandbox**: ${sandbox.type}, ${sandbox.credentialPolicy} credentials`,
    '',
  ].join('\n');
}

function generateSprintFlow(config: ProjectConfig): string {
  const enabledStages = config.flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  if (enabledStages.length === 0) {
    return '## Sprint Flow\n\nNo sprint stages configured.\n';
  }

  const flowDiagram = enabledStages
    .map((s) => s.name.charAt(0).toUpperCase() + s.name.slice(1))
    .join(' \u2192 ');

  const commandList = enabledStages
    .map((s) => `- \`/${s.name}\` \u2014 ${s.name.charAt(0).toUpperCase() + s.name.slice(1)}`)
    .join('\n');

  return [
    '## Sprint Flow',
    '',
    '```',
    flowDiagram,
    '```',
    '',
    '### Slash Commands',
    '',
    commandList,
    '',
  ].join('\n');
}

function generateEnforcedConstraints(config: ProjectConfig): string {
  const enforced = config.flow.constraints.filter((c) => c.enforced);
  if (enforced.length === 0) return '';

  const lines: string[] = ['## Enforced Constraints', ''];
  for (const c of enforced) {
    lines.push(`- [${c.type}] ${c.description}`);
  }
  lines.push('');
  return lines.join('\n');
}

function generateAdvisoryConstraints(config: ProjectConfig): string {
  const advisory = config.flow.constraints.filter((c) => !c.enforced);
  if (advisory.length === 0) return '';

  const lines: string[] = ['## Advisory Constraints', ''];
  for (const c of advisory) {
    lines.push(`- [${c.type}] ${c.description}`);
  }
  lines.push('');
  return lines.join('\n');
}

function generateMcpServers(config: ProjectConfig): string {
  const servers = [
    ...config.integration.mcpServers,
    ...config.architecture.sandbox.mcpServers,
  ];
  // Deduplicate by name
  const seen = new Set<string>();
  const unique = servers.filter((s) => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });

  if (unique.length === 0) return '';

  const lines: string[] = ['## MCP Servers', ''];
  for (const server of unique) {
    const args = server.args.length > 0 ? ` ${server.args.join(' ')}` : '';
    lines.push(`- **${server.name}**: \`${server.command}${args}\``);
  }
  lines.push('');
  return lines.join('\n');
}

function generateFileStructure(config: ProjectConfig): string {
  const enabledStages = config.flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  const stageFiles = enabledStages
    .map((s) => `      ${s.name}.md`)
    .join('\n');

  return [
    '## File Structure',
    '',
    '```',
    `${config.project.name || 'project'}/`,
    '  CLAUDE.md',
    '  .claude/',
    '    settings.json',
    '    commands/',
    ...enabledStages.map((s) => `      ${s.name}.md`),
    '    hooks/',
    '      constraint-check.sh',
    '  .harness/',
    '    config.yaml',
    '    roles/',
    '    flows/',
    ...enabledStages.map((s) => `      ${s.name}.md`),
    '    constraints/',
    '```',
    '',
  ].join('\n');
}

// ── Main export ──

export function generateClaudeMd(config: ProjectConfig): OutputFile {
  const sections = [
    `# ${config.project.name || 'Project'}`,
    '',
    config.project.description || '',
    '',
    generateTechStack(config),
    generateArchitecture(config),
    generateSprintFlow(config),
    generateEnforcedConstraints(config),
    generateAdvisoryConstraints(config),
    generateMcpServers(config),
    generateFileStructure(config),
  ].filter(Boolean);

  return {
    path: 'CLAUDE.md',
    content: sections.join('\n'),
  };
}
