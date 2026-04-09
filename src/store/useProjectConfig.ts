import { create } from 'zustand';
import type {
  ProjectConfig,
  ProjectInfo,
  ArchitectureConfig,
  FlowConfig,
  IntegrationConfig,
} from '@/types';

const defaultConfig: ProjectConfig = {
  project: {
    name: '',
    description: '',
    techStack: {
      framework: 'next',
      language: 'typescript',
      packageManager: 'pnpm',
    },
    gitInit: true,
  },
  architecture: {
    session: {
      storage: 'local-file',
      eventRetention: 100,
      recoveryStrategy: 'last-event',
    },
    harness: {
      engine: 'claude-code',
      contextStrategy: 'compaction',
      maxRetries: 3,
    },
    sandbox: {
      type: 'local',
      mcpServers: [],
      credentialPolicy: 'none',
    },
  },
  flow: {
    sprint: [],
    roles: [],
    constraints: [],
  },
  integration: {
    mcpServers: [],
    hooks: [],
  },
};

interface ProjectConfigStore {
  config: ProjectConfig;
  currentStep: number;

  setProject: (project: Partial<ProjectInfo>) => void;
  setArchitecture: (architecture: Partial<ArchitectureConfig>) => void;
  setFlow: (flow: Partial<FlowConfig>) => void;
  setIntegration: (integration: Partial<IntegrationConfig>) => void;
  loadTemplate: (config: Partial<ProjectConfig>) => void;
  setCurrentStep: (step: number) => void;
  reset: () => void;
}

export const useProjectConfig = create<ProjectConfigStore>((set) => ({
  config: defaultConfig,
  currentStep: 0,

  setProject: (project) =>
    set((state) => ({
      config: { ...state.config, project: { ...state.config.project, ...project } },
    })),

  setArchitecture: (architecture) =>
    set((state) => ({
      config: { ...state.config, architecture: { ...state.config.architecture, ...architecture } },
    })),

  setFlow: (flow) =>
    set((state) => ({
      config: { ...state.config, flow: { ...state.config.flow, ...flow } },
    })),

  setIntegration: (integration) =>
    set((state) => ({
      config: { ...state.config, integration: { ...state.config.integration, ...integration } },
    })),

  loadTemplate: (template) =>
    set((state) => ({
      config: {
        ...state.config,
        ...template,
        project: { ...state.config.project, ...template.project },
        architecture: { ...state.config.architecture, ...template.architecture },
        flow: { ...state.config.flow, ...template.flow },
        integration: { ...state.config.integration, ...template.integration },
      },
    })),

  setCurrentStep: (step) => set({ currentStep: step }),

  reset: () => set({ config: defaultConfig, currentStep: 0 }),
}));
