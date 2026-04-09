import type { OutputFile, ProjectConfig } from '@/types';

interface SettingsJson {
  permissions: {
    allow: string[];
    deny: string[];
  };
  mcpServers: Record<string, {
    command: string;
    args: string[];
    env?: Record<string, string>;
  }>;
  hooks: Record<string, Array<{
    matcher: string;
    hooks: Array<{ type: string; command: string }>;
  }>>;
}

export function generateSettings(config: ProjectConfig): OutputFile[] {
  const files: OutputFile[] = [];

  // 1. Always generate .claude/settings.json
  const settings: SettingsJson = {
    permissions: {
      allow: [
        'Bash(npm run *)',
        'Bash(npx *)',
        'Bash(git *)',
        'Read',
        'Write',
        'Edit',
      ],
      deny: [
        'Bash(rm -rf *)',
        'Bash(DROP *)',
      ],
    },
    mcpServers: {},
    hooks: {},
  };

  // Build mcpServers entries from integration config
  for (const server of config.integration.mcpServers) {
    const entry: SettingsJson['mcpServers'][string] = {
      command: server.command,
      args: server.args,
    };
    if (server.env && Object.keys(server.env).length > 0) {
      entry.env = server.env;
    }
    settings.mcpServers[server.name] = entry;
  }

  // Also include MCP servers from sandbox config
  for (const server of config.architecture.sandbox.mcpServers) {
    if (!settings.mcpServers[server.name]) {
      const entry: SettingsJson['mcpServers'][string] = {
        command: server.command,
        args: server.args,
      };
      if (server.env && Object.keys(server.env).length > 0) {
        entry.env = server.env;
      }
      settings.mcpServers[server.name] = entry;
    }
  }

  // Build hooks entries grouped by event
  for (const hook of config.integration.hooks) {
    if (!settings.hooks[hook.event]) {
      settings.hooks[hook.event] = [];
    }
    settings.hooks[hook.event].push({
      matcher: '',
      hooks: [{ type: 'command', command: hook.command }],
    });
  }

  files.push({
    path: '.claude/settings.json',
    content: JSON.stringify(settings, null, 2),
  });

  // 2. If harness engine is 'codex', also generate .codex/config.yaml
  if (config.architecture.harness.engine === 'codex') {
    files.push({
      path: '.codex/config.yaml',
      content: `# Codex configuration\nmodel: o3\nsandbox: true\n`,
    });
  }

  return files;
}
