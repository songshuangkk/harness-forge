import type { TemplatePreset } from '@/types';

export const managedAgents: TemplatePreset = {
  id: 'managed-agents',
  name: 'Managed Agents',
  description: 'Anthropic Managed Agents architecture with full replay, Docker sandbox, and vault credentials.',
  icon: '🤖',
  config: {
    architecture: {
      session: { storage: 'git-based', eventRetention: 500, recoveryStrategy: 'custom' },
      harness: { engine: 'claude-code', contextStrategy: 'full', maxRetries: 5 },
      sandbox: { type: 'docker', mcpServers: [], credentialPolicy: 'vault' },
    },
    flow: {
      sprint: [
        { id: 'plan', name: 'plan', order: 0, enabled: true, roles: ['ceo'],
          gates: ['Agent instructions defined', 'Tool permissions configured'],
          stageConfig: { reviewTypes: ['ceo-review', 'eng-review'], taskStructure: 'structured' } },
        { id: 'build', name: 'build', order: 1, enabled: true, roles: ['eng-manager'],
          gates: ['Agent session started', 'All tool calls validated'],
          stageConfig: { executionStrategy: 'subagent-parallel', tddMode: 'enforced', writePaths: ['**/src/**', '**/test/**', 'docs/**'] } },
        { id: 'ship', name: 'ship', order: 2, enabled: true, roles: ['release'],
          gates: ['Session replay verified', 'Artifacts stored in vault'],
          stageConfig: { pipeline: ['run-tests', 'create-pr', 'deploy'], versionStrategy: 'semver-patch', deploymentTargets: ['production'] } },
      ],
      roles: [
        { id: 'ceo', label: 'Agent Operator', description: 'Configures agent instructions and monitors autonomous execution.', defaultConstraints: ['Must review agent output before proceeding'],
          reviewFocus: ['agent alignment', 'instruction clarity', 'output correctness', 'safety compliance'],
          systemPrompt: 'You are the Agent Operator. Your job is to ensure the autonomous agent operates within its configured boundaries. Verify output matches instructions before proceeding.' },
        { id: 'eng-manager', label: 'Build Agent', description: 'Autonomous agent executing tasks within sandboxed environment.', defaultConstraints: ['Must operate within sandbox boundaries'],
          reviewFocus: ['sandbox compliance', 'tool usage', 'error recovery', 'task completion'],
          systemPrompt: 'You are the Build Agent operating in a sandboxed environment. Execute tasks autonomously within your configured permissions. Report any boundary violations immediately.' },
        { id: 'release', label: 'Release Agent', description: 'Handles artifact verification and deployment.', defaultConstraints: ['Must validate all outputs against original instructions'],
          reviewFocus: ['artifact integrity', 'vault compliance', 'deployment verification', 'rollback readiness'],
          systemPrompt: 'You are the Release Agent. Validate all build artifacts against original instructions. Ensure credentials come from vault only. Verify deployment success with smoke tests.' },
      ],
      constraints: [
        { id: 'sandbox-enforced', stageId: 'build', type: 'gate', description: 'All build operations must run inside Docker sandbox.', enforced: true,
          enforcement: { checkType: 'command-blocklist', pattern: 'docker run', message: 'Build commands must use Docker sandbox' } },
        { id: 'credential-vault', stageId: '*', type: 'gate', description: 'All credentials must be fetched from vault — never hardcoded.', enforced: true },
      ],
    },
  },
};
