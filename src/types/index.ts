export type Language = 'typescript' | 'javascript' | 'python' | 'dart' | 'go' | 'java' | 'rust';

export type SessionStorage = 'local-file' | 'git-based' | 'custom';
export type RecoveryStrategy = 'last-event' | 'last-checkpoint' | 'custom';
export type AIEngine = 'claude-code' | 'codex' | 'cursor' | 'custom';
export type ContextStrategy = 'compaction' | 'sliding-window' | 'full';
export type SandboxType = 'local' | 'docker' | 'remote';
export type CredentialPolicy = 'vault' | 'bundled' | 'none';

export interface TechStack {
  language: Language;
  stackDescription: string;
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

// ── Stage-specific configuration interfaces ──
// Synthesized from Anthropic Managed Agents + GStack + Superpowers
// Each stage config has: Architecture (how 3-layer infra applies) + Methodology (approach) + Roles

/** Think — Problem redefinition via forcing questions */
export interface ThinkConfig {
  /** Interrogation dimensions to cover */
  dimensions: string[];
  /** Analysis depth */
  depth: 'quick' | 'deep';
}

/** Plan — Multi-role architecture review */
export interface PlanConfig {
  /** Which review types to run */
  reviewTypes: string[];
  /** How structured the task breakdown must be */
  taskStructure: 'simple' | 'structured';
}

/** Build — Implementation strategy */
export interface BuildConfig {
  /** Execution strategy */
  executionStrategy: 'single-agent' | 'subagent-parallel';
  /** TDD enforcement level */
  tddMode: 'enforced' | 'optional';
}

/** Review — Multi-dimensional quality audit */
export interface ReviewConfig {
  /** Review dimensions to check */
  reviewDimensions: string[];
  /** Auto-fix policy */
  autoFix: 'auto' | 'report-only';
  /** Minimum severity to report */
  severityThreshold: 'all' | 'critical-major' | 'critical-only';
}

/** Test — Evidence-based verification */
export interface TestConfig {
  /** Test methodologies */
  testMethods: string[];
  /** Coverage target percentage */
  coverageTarget: number;
  /** Test type categories */
  testTypes: string[];
  /** Execution environment */
  environment: string;
  /** Command to run tests (e.g. "npm test", "pytest", "go test ./...") */
  testCommand: string;
  /** Command to measure coverage (e.g. "npm run coverage", "pytest --cov") */
  coverageCommand: string;
}

/** Ship — Release pipeline */
export interface ShipConfig {
  /** Pipeline steps to include */
  pipeline: string[];
  /** Semantic versioning strategy */
  versionStrategy: string;
  /** Deployment targets */
  deploymentTargets: string[];
}

/** 阶段输出的具体产物，驱动 gate 检查 */
export interface OutputArtifact {
  path: string;
  description: string;
  verification: 'exists' | 'non-empty' | 'contains-section';
  sectionMarker?: string;
}

/** Reflect — Retrospective with learning */
export interface ReflectConfig {
  /** Retrospective dimensions */
  dimensions: string[];
  /** Whether to persist learnings across sessions */
  persistLearning: 'project-memory' | 'session-only';
}

export type StageSpecificConfig = ThinkConfig | PlanConfig | BuildConfig | ReviewConfig | TestConfig | ShipConfig | ReflectConfig;

export interface SprintStage {
  id: string;
  name: StageName;
  order: number;
  enabled: boolean;
  roles: RoleName[];
  gates: string[];
  outputFormat?: string;
  /** Concrete artifacts this stage must produce (drives gate generation) */
  outputArtifacts?: OutputArtifact[];
  stageConfig?: StageSpecificConfig;
}

export interface RoleConfig {
  id: RoleName;
  label: string;
  description: string;
  defaultConstraints: string[];
  /** Dimensions this role focuses on when reviewing */
  reviewFocus?: string[];
  /** Behavioral system prompt for this role */
  systemPrompt?: string;
}

export type ConstraintType = 'gate' | 'checklist' | 'output-requirement';

/** 约束的结构化执行参数，驱动 hook 生成 */
export interface ConstraintEnforcement {
  checkType: 'file-exists' | 'file-contains' | 'command-blocklist';
  targets?: string[];
  pattern?: string;
  message?: string;
}

export interface ConstraintRule {
  id: string;
  stageId: string;
  type: ConstraintType;
  description: string;
  enforced: boolean;
  enforcement?: ConstraintEnforcement;
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
