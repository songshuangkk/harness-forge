export type Framework = 'next' | 'react' | 'vue' | 'flutter' | 'custom';
export type Language = 'typescript' | 'javascript' | 'python' | 'dart' | 'go';
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

export type SessionStorage = 'local-file' | 'git-based' | 'custom';
export type RecoveryStrategy = 'last-event' | 'last-checkpoint' | 'custom';
export type AIEngine = 'claude-code' | 'codex' | 'custom';
export type ContextStrategy = 'compaction' | 'sliding-window' | 'full';
export type SandboxType = 'local' | 'docker' | 'remote';
export type CredentialPolicy = 'vault' | 'bundled' | 'none';

export interface TechStack {
  framework: Framework;
  language: Language;
  packageManager: PackageManager;
}

export interface ProjectInfo {
  name: string;
  description: string;
  techStack: TechStack;
  gitInit: boolean;
}

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface SessionConfig {
  storage: SessionStorage;
  eventRetention: number;
  recoveryStrategy: RecoveryStrategy;
}

export interface HarnessConfig {
  engine: AIEngine;
  contextStrategy: ContextStrategy;
  maxRetries: number;
}

export interface SandboxConfig {
  type: SandboxType;
  mcpServers: MCPServerConfig[];
  credentialPolicy: CredentialPolicy;
}

export interface ArchitectureConfig {
  session: SessionConfig;
  harness: HarnessConfig;
  sandbox: SandboxConfig;
}

export type StageName = 'think' | 'plan' | 'build' | 'review' | 'test' | 'ship' | 'reflect';
export type RoleName = 'ceo' | 'designer' | 'eng-manager' | 'qa' | 'security' | 'release' | 'doc-engineer';

export interface SprintStage {
  id: string;
  name: StageName;
  order: number;
  enabled: boolean;
  roles: RoleName[];
  gates: string[];
  outputFormat?: string;
}

export interface RoleConfig {
  id: RoleName;
  label: string;
  description: string;
  defaultConstraints: string[];
}

export type ConstraintType = 'gate' | 'checklist' | 'output-requirement';

export interface ConstraintRule {
  id: string;
  stageId: string;
  type: ConstraintType;
  description: string;
  enforced: boolean;
}

export interface FlowConfig {
  sprint: SprintStage[];
  roles: RoleConfig[];
  constraints: ConstraintRule[];
}

export interface IntegrationConfig {
  mcpServers: MCPServerConfig[];
  hooks: HookConfig[];
}

export interface HookConfig {
  event: string;
  command: string;
}

export interface ProjectConfig {
  project: ProjectInfo;
  architecture: ArchitectureConfig;
  flow: FlowConfig;
  integration: IntegrationConfig;
}

export interface OutputFile {
  path: string;
  content: string;
}

export interface TemplatePreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: Partial<ProjectConfig>;
}
