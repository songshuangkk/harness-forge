// ============================================================
// Project Configuration Types
// ============================================================

// ---------------------
// Project Info
// ---------------------
export interface TechStack {
  framework: 'next' | 'nuxt' | 'sveltekit' | 'remix' | 'astro' | 'vite-react' | 'vite-vue';
  language: 'typescript' | 'javascript';
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun';
}

export interface ProjectInfo {
  name: string;
  description: string;
  techStack: TechStack;
  gitInit: boolean;
}

// ---------------------
// Architecture Config
// ---------------------
export interface SessionConfig {
  storage: 'local-file' | 'sqlite' | 'memory' | 'custom';
  eventRetention: number;
  recoveryStrategy: 'last-event' | 'snapshot' | 'full-replay';
}

export interface HarnessConfig {
  engine: 'claude-code' | 'codex' | 'custom';
  contextStrategy: 'compaction' | 'sliding-window' | 'rag' | 'full';
  maxRetries: number;
}

export interface SandboxConfig {
  type: 'local' | 'docker' | 'remote' | 'none';
  mcpServers: MCPServerConfig[];
  credentialPolicy: 'none' | 'env-only' | 'vault' | 'custom';
}

export interface ArchitectureConfig {
  session: SessionConfig;
  harness: HarnessConfig;
  sandbox: SandboxConfig;
}

// ---------------------
// Flow Config
// ---------------------
export interface FlowRole {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
}

export interface FlowConstraint {
  id: string;
  type: 'file-guard' | 'test-requirement' | 'review-rule' | 'custom';
  config: Record<string, unknown>;
}

export interface SprintStep {
  id: string;
  role: string;
  task: string;
  dependsOn: string[];
}

export interface FlowConfig {
  sprint: SprintStep[];
  roles: FlowRole[];
  constraints: FlowConstraint[];
}

// ---------------------
// Integration Config
// ---------------------
export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface HookConfig {
  event: 'pre-step' | 'post-step' | 'on-error' | 'on-complete';
  command: string;
  args: string[];
}

export interface IntegrationConfig {
  mcpServers: MCPServerConfig[];
  hooks: HookConfig[];
}

// ---------------------
// Root Config
// ---------------------
export interface ProjectConfig {
  project: ProjectInfo;
  architecture: ArchitectureConfig;
  flow: FlowConfig;
  integration: IntegrationConfig;
}
