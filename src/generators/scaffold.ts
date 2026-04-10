import type { OutputFile, ProjectConfig } from '@/types';
import { getConfigFilename } from './engines/claude/claudeMd';

/**
 * Generates project scaffold files — README and architecture doc.
 * Framework-specific boilerplate is intentionally NOT generated;
 * users create those with their own tooling after downloading the ZIP.
 */
export function generateScaffold(config: ProjectConfig): OutputFile[] {
  return [
    generateReadme(config),
    generateArchitectureDoc(config),
  ];
}

// ---------------------------------------------------------------------------
// README
// ---------------------------------------------------------------------------

function generateReadme(config: ProjectConfig): OutputFile {
  const { language, stackDescription } = config.project.techStack;
  const stackLine = stackDescription
    ? `${language} — ${stackDescription}`
    : language;
  const engine = config.architecture.harness.engine;
  const configFile = getConfigFilename(engine);

  let engineSpecificGettingStarted = '';
  if (engine === 'claude-code') {
    engineSpecificGettingStarted = `Use \`/think\`, \`/plan\`, \`/build\`, \`/review\`, \`/test\`, \`/ship\`, \`/reflect\` to drive each stage.`;
  } else if (engine === 'cursor') {
    engineSpecificGettingStarted = `Stage rules are loaded automatically via \`.cursor/rules/\`. Reference them with \`@think\`, \`@plan\`, etc. in your prompts.`;
  } else if (engine === 'codex') {
    engineSpecificGettingStarted = `Skills are defined in \`.codex/skills/\`. Each skill contains gates, constraints, and configuration for its sprint stage.`;
  }

  const content = `# ${config.project.name}

${config.project.description}

## Tech Stack

${stackLine}

## Getting Started

This project uses an AI-assisted development workflow.

- The \`.harness/\` directory contains engine-agnostic definitions (config, roles, flows, constraints).
- Engine-specific files are in ${engine === 'claude-code' ? '`.claude/` (commands, hooks, settings)' : engine === 'cursor' ? '`.cursor/` (rules, mcp)' : engine === 'codex' ? '`.codex/` (skills, hooks, config)' : 'the project root'}.
- See \`${configFile}\` for the full configuration.
${engineSpecificGettingStarted ? `\n${engineSpecificGettingStarted}` : ''}
`;
  return { path: 'README.md', content };
}

// ---------------------------------------------------------------------------
// Architecture doc
// ---------------------------------------------------------------------------

function generateFileStructureTree(config: ProjectConfig): string {
  const engine = config.architecture.harness.engine;
  const enabledStages = config.flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  const lines: string[] = [
    '.harness/          Engine-agnostic definitions',
    '  config.yaml      Full project configuration',
    '  roles/            Role definitions',
    '  flows/            Stage flow definitions',
    '  constraints/      Constraint rules',
  ];

  if (engine === 'claude-code') {
    lines.push(
      '.claude/           Claude Code adapter',
      '  settings.json    Permissions, MCP servers, hooks',
      '  commands/        Slash commands for each stage',
      '  hooks/           Gate and constraint hook scripts',
      'CLAUDE.md          Entry document',
    );
  } else if (engine === 'cursor') {
    lines.push(
      '.cursor/           Cursor adapter',
      '  rules/           Stage rules (.mdc files)',
      '  mcp.json         MCP server configuration',
      '.cursorrules       Entry document',
    );
  } else if (engine === 'codex') {
    lines.push(
      '.codex/            Codex adapter',
      '  skills/          Skill definitions per stage',
      '  hooks/           Hook scripts',
      '  hooks.json       Hook registrations',
      '  config.toml      Codex configuration',
      'AGENTS.md          Entry document',
    );
  } else {
    lines.push(
      'AI_CONFIG.md       Entry document',
    );
  }

  return lines.join('\n');
}

function generateArchitectureDoc(config: ProjectConfig): OutputFile {
  const { architecture, flow } = config;

  const enabledStages = flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      const configHint = s.stageConfig ? ` — see config for details` : '';
      return `- **${s.name}** (order ${s.order}): roles ${s.roles.join(', ')}${configHint}`;
    })
    .join('\n');

  const fileStructure = generateFileStructureTree(config);

  const content = `# Architecture

## Agent Architecture

The project follows a three-layer agent architecture:

| Layer     | Storage / Type            | Details                                      |
|-----------|---------------------------|----------------------------------------------|
| Session   | ${architecture.session.storage.padEnd(24)} | Retention: ${architecture.session.eventRetention} events, recovery: ${architecture.session.recoveryStrategy} |
| Harness   | ${architecture.harness.engine.padEnd(24)} | Context strategy: ${architecture.harness.contextStrategy}, max retries: ${architecture.harness.maxRetries} |
| Sandbox   | ${architecture.sandbox.type.padEnd(24)} | Credential policy: ${architecture.sandbox.credentialPolicy}, MCP servers: ${architecture.sandbox.mcpServers.length} |

## Sprint Flow

Enabled stages:

${enabledStages}

## Key Design Decisions

- **AI Engine**: ${architecture.harness.engine}
- **Context Strategy**: ${architecture.harness.contextStrategy}
- **Sandbox Type**: ${architecture.sandbox.type}
- **Session Recovery**: ${architecture.session.recoveryStrategy}
- **Credential Policy**: ${architecture.sandbox.credentialPolicy}
- **Constraint Rules**: ${flow.constraints.length} configured

## File Structure

\`\`\`
${fileStructure}
\`\`\`
`;

  return { path: 'docs/plans/ARCHITECTURE.md', content };
}
