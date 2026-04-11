import type { ProjectConfig, OutputFile, AIEngine, Language, RoleName } from '@/types';
import { getRolePrompt } from '@/generators/core/rolePrompts';

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

// ── Harness Protocol generator (P0: Brain 层接线) ──

function generateHarnessProtocol(config: ProjectConfig): string {
  const enabledStages = config.flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  if (enabledStages.length === 0) return '';

  const configuredRoles = config.flow.roles;

  // Stage → role mapping (dynamic from config)
  const roleMappingLines = enabledStages
    .filter((s) => s.roles.length > 0)
    .map((s) => {
      const stageLabel = s.name.charAt(0).toUpperCase() + s.name.slice(1);
      const roleLabels = s.roles.map((r: RoleName) => getRolePrompt(r, configuredRoles).label);
      return `${stageLabel} → ${roleLabels.join(' + ')}`;
    })
    .join('\n');

  // Build stage TDD check (only when tddMode is enforced)
  const buildStage = enabledStages.find((s) => s.name === 'build');
  const buildConfig = buildStage?.stageConfig as { tddMode?: string } | undefined;
  const tddBlock = buildConfig?.tddMode === 'enforced'
    ? `
### Build 阶段完成条件（必须全部满足）

1. 读取 \`.harness/constraints/\` 下所有约束文件
2. 验证 coverage_min：运行测试并确认覆盖率达标
3. 验证 test_must_pass：所有指定类型的测试必须全部通过
4. 验证 no_skip_allowed：不允许跳过任何测试用例
5. 以上全部通过后，才能声明 Build 阶段完成
`
    : '';

  // Reflect stage log reading
  const hasReflect = enabledStages.some((s) => s.name === 'reflect');
  const reflectNote = hasReflect
    ? '- Reflect 阶段必须读取 \`.harness/log/events.jsonl\`（如存在），基于数据生成回顾报告，而非纯文字反思'
    : '';

  return [
    '## Harness 运行协议',
    '',
    '### 文件引用',
    '',
    '- **角色定义**：进入每个阶段前，读取 `.harness/roles/{当前阶段角色}.md` 作为本阶段的行为约束',
    '- **流程节点**：读取 `.harness/flows/sprint.md` 作为 Sprint 执行顺序的权威来源',
    '- **质量约束**：每步完成后读取 `.harness/constraints/` 下的约束文件作为校验标准',
    '',
    '### Sprint 阶段推进协议',
    '',
    '1. 开始每个阶段前，声明：「进入 [阶段名] 阶段，角色切换为 [角色名]」',
    '2. 读取对应的 `.harness/roles/[角色].md`，遵守其中的行为限制',
    '3. 将当前阶段写入 `.harness/current-stage`（供 hooks 读取）',
    '4. 按照 `.harness/flows/sprint.md` 的节点定义完成本阶段任务',
    '5. 完成后必须读取 `.harness/constraints/`，验证所有门禁通过',
    '6. 所有门禁通过后，声明：「[阶段名] 阶段完成，准备进入 [下一阶段]」',
    '',
    '### 阶段 → 角色映射',
    '',
    roleMappingLines,
    tddBlock,
    reflectNote,
    '',
    '## State Machine Protocol',
    '',
    'This project uses a file-based state machine for sprint enforcement:',
    '',
    '1. **Initialization**: Run `bash .claude/scripts/session-init.sh` at session start',
    '2. **Stage Entry**: Use slash commands (`/think`, `/plan`, etc.) — each calls `transition.sh`',
    '3. **Gate Enforcement**: `guard.sh` blocks disallowed tools; `advance.sh` checks gates after each action',
    '4. **State**: Stored in `.harness/state.json` — you CANNOT modify this file directly',
    '5. **Status**: Run `bash .harness/scripts/check.sh` anytime to see current state',
    '',
    '### Rules',
    '- NEVER attempt to edit `.harness/state.json` or `.harness/constraints.yaml` — they are read-only to you',
    '- NEVER attempt to edit `.claude/hooks/` or `.claude/scripts/` — enforcement scripts are read-only to you',
    '- If `transition.sh` blocks you, complete the current stage gates first',
    '- Each stage has specific tool and path restrictions — `guard.sh` enforces them',
  ].filter((line) => line !== '').join('\n') + '\n';
}

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

  const lines: string[] = [
    '## Architecture',
    '',
    `This project follows a three-layer agent architecture: ` +
      `**Session** (${session.storage}), **Harness** (${harness.engine}), **Sandbox** (${sandbox.type}).`,
    '',
    `- **Session**: ${session.storage} storage, ${session.eventRetention} events, ${session.recoveryStrategy} recovery`,
    `- **Harness**: ${harness.engine}, ${harness.contextStrategy} context, ${harness.maxRetries} retries`,
    `- **Sandbox**: ${sandbox.type}, ${sandbox.credentialPolicy} credentials`,
  ];

  // Session commands
  lines.push('', '### Session Commands', '');
  lines.push('- `bash .claude/scripts/session-init.sh` — Initialize session storage');
  lines.push('- `bash .claude/scripts/session-save.sh` — Save event to session log');
  if (session.storage === 'git-based' || session.storage === 'custom') {
    lines.push('- `bash .claude/scripts/session-recover.sh` — Recover session state');
  }

  // Sandbox commands
  if (sandbox.type === 'docker') {
    lines.push('', '### Sandbox Commands', '');
    lines.push('- `docker compose -f docker-compose.sandbox.yml run sandbox <cmd>` — Run command in sandbox');
    lines.push('- `docker compose -f docker-compose.sandbox.yml build` — Build sandbox image');
  }

  lines.push('');
  return lines.join('\n');
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

  // Role Assignments
  const configuredRoles = config.flow.roles;
  const roleAssignmentLines = enabledStages
    .filter((s) => s.roles.length > 0)
    .map((s) => {
      const stageLabel = s.name.charAt(0).toUpperCase() + s.name.slice(1);
      const roleLabels = s.roles.map((r: RoleName) => getRolePrompt(r, configuredRoles).label);
      return `- ${stageLabel}: ${roleLabels.join(', ')}`;
    })
    .join('\n');

  const roleSection = roleAssignmentLines
    ? ['', '### Role Assignments', '', roleAssignmentLines, ''].join('\n')
    : '';

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
    roleSection,
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

  // Collect role sub-commands for plan and review stages
  const roleSubCommands: string[] = [];
  for (const stage of enabledStages) {
    if ((stage.name === 'plan' || stage.name === 'review') && stage.roles.length > 1) {
      for (const roleId of stage.roles) {
        const slug = roleId.replace(/[^a-z0-9]+/g, '-');
        roleSubCommands.push(`      ${stage.name}:${slug}-review.md`);
      }
    }
  }

  // Sandbox files
  const sandboxFiles: string[] = [];
  if (config.architecture.sandbox.type === 'docker') {
    sandboxFiles.push('  docker-compose.sandbox.yml');
    sandboxFiles.push('  Dockerfile.sandbox');
  }

  // Hook files
  const hookFiles: string[] = ['      constraint-check.sh', '      role-check.sh', '      emit-event.sh'];
  if (config.architecture.sandbox.credentialPolicy === 'vault') {
    hookFiles.push('      secret-check.sh');
  }

  // Session files
  const sessionFiles: string[] = ['      session-init.sh', '      session-save.sh'];
  if (config.architecture.session.storage !== 'local-file') {
    sessionFiles.push('      session-recover.sh');
  }

  return [
    '## File Structure',
    '',
    '```',
    `${config.project.name || 'project'}/`,
    '  CLAUDE.md',
    ...sandboxFiles,
    '  .claude/',
    '    settings.json',
    '    commands/',
    ...enabledStages.map((s) => `      ${s.name}.md`),
    ...roleSubCommands,
    '    hooks/',
    ...hookFiles,
    '    scripts/',
    ...sessionFiles,
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
    generateHarnessProtocol(config),
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
