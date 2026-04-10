import type { OutputFile, ProjectConfig, MCPServerConfig } from '@/types';
import { buildClaudeHookRegistrations } from './hooks';

// ── MCP server merging ──

function buildMcpServers(
  config: ProjectConfig
): Record<string, { command: string; args: string[]; env?: Record<string, string> }> {
  const mcpServers: Record<
    string,
    { command: string; args: string[]; env?: Record<string, string> }
  > = {};

  const addServer = (server: MCPServerConfig) => {
    if (mcpServers[server.name]) return; // first one wins
    const entry: { command: string; args: string[]; env?: Record<string, string> } = {
      command: server.command,
      args: server.args,
    };
    if (server.env && Object.keys(server.env).length > 0) {
      entry.env = server.env;
    }
    mcpServers[server.name] = entry;
  };

  for (const server of config.integration.mcpServers) {
    addServer(server);
  }
  for (const server of config.architecture.sandbox.mcpServers) {
    addServer(server);
  }

  return mcpServers;
}

// ── Main generator ──

export function generateClaudeSettings(config: ProjectConfig): OutputFile {
  // Build permission rules based on sandbox config
  const allowRules = [
    'Bash(npm run *)',
    'Bash(npx *)',
    'Bash(git *)',
    'Read',
    'Write',
    'Edit',
  ];

  // Docker sandbox: allow docker compose commands
  if (config.architecture.sandbox.type === 'docker') {
    allowRules.push('Bash(docker compose *)');
    allowRules.push('Bash(docker build *)');
  }

  const settings = {
    permissions: {
      allow: allowRules,
      deny: [
        'Bash(rm -rf *)',
        'Bash(DROP *)',
      ],
    },
    mcpServers: buildMcpServers(config),
    hooks: buildClaudeHookRegistrations(config),
  };

  return {
    path: '.claude/settings.json',
    content: JSON.stringify(settings, null, 2),
  };
}
