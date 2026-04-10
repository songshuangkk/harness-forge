import type { ProjectConfig, OutputFile, SandboxType, CredentialPolicy } from '@/types';

const SANDBOX_MODE_MAP: Record<SandboxType, string> = {
  local: 'workspace-write',
  docker: 'docker',
  remote: 'danger-full-access',
};

const APPROVAL_POLICY_MAP: Record<CredentialPolicy, string> = {
  vault: 'on-request',
  bundled: 'on-request',
  none: 'untrusted',
};

function formatMcpServers(config: ProjectConfig): string {
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

  return unique.map((server) => {
    const lines: string[] = [
      `[mcp_servers.${server.name}]`,
      `command = "${server.command}"`,
    ];
    if (server.args.length > 0) {
      lines.push(`args = ${JSON.stringify(server.args)}`);
    }
    return lines.join('\n');
  }).join('\n\n');
}

export function generateCodexConfig(config: ProjectConfig): OutputFile {
  const { sandbox, harness } = config.architecture;

  const sandboxMode = SANDBOX_MODE_MAP[sandbox.type];
  const approvalPolicy = APPROVAL_POLICY_MAP[sandbox.credentialPolicy];

  const sections: string[] = [
    `model = "o3"`,
    `sandbox_mode = "${sandboxMode}"`,
    `approval_policy = "${approvalPolicy}"`,
    '',
    '[features]',
    'codex_hooks = true',
  ];

  const mcpSection = formatMcpServers(config);
  if (mcpSection) {
    sections.push('', mcpSection);
  }

  return {
    path: '.codex/config.toml',
    content: sections.join('\n') + '\n',
  };
}
