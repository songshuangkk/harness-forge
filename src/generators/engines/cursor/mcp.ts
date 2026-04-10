import type { OutputFile, ProjectConfig, MCPServerConfig } from '@/types';

export function generateCursorMcp(config: ProjectConfig): OutputFile {
  const merged: Record<string, { command: string; args?: string[]; env?: Record<string, string> }> = {};

  const allServers: MCPServerConfig[] = [
    ...config.integration.mcpServers,
    ...config.architecture.sandbox.mcpServers,
  ];

  for (const server of allServers) {
    if (merged[server.name]) continue; // dedupe by name, first wins
    const entry: (typeof merged)[string] = { command: server.command };
    if (server.args.length > 0) entry.args = server.args;
    if (server.env && Object.keys(server.env).length > 0) entry.env = server.env;
    merged[server.name] = entry;
  }

  return {
    path: '.cursor/mcp.json',
    content: JSON.stringify({ mcpServers: merged }, null, 2) + '\n',
  };
}
