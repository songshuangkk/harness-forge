import type { TemplatePreset } from '@/types';

export const gstackSprint: TemplatePreset = {
  id: 'gstack-sprint',
  name: 'GStack Sprint',
  description: 'Full 7-stage sprint with all roles. Team-scale delivery pipeline inspired by GStack methodology.',
  icon: '🚀',
  config: {
    architecture: {
      session: { storage: 'git-based', eventRetention: 200, recoveryStrategy: 'last-checkpoint' },
      harness: { engine: 'claude-code', contextStrategy: 'sliding-window', maxRetries: 5 },
      sandbox: { type: 'docker', mcpServers: [], credentialPolicy: 'bundled' },
    },
    flow: {
      sprint: [
        { id: 'think', name: 'think', order: 0, enabled: true, roles: ['ceo'], gates: ['Problem statement defined', 'Success metrics agreed'] },
        { id: 'plan', name: 'plan', order: 1, enabled: true, roles: ['ceo', 'designer'], gates: ['Architecture doc approved', 'UI wireframes signed off'] },
        { id: 'build', name: 'build', order: 2, enabled: true, roles: ['eng-manager'], gates: ['Feature branch created', 'Core logic implemented'] },
        { id: 'review', name: 'review', order: 3, enabled: true, roles: ['eng-manager'], gates: ['Code review passed', 'No critical code smells'] },
        { id: 'test', name: 'test', order: 4, enabled: true, roles: ['qa'], gates: ['All test cases executed', 'Zero critical defects', 'Performance benchmarks met'] },
        { id: 'ship', name: 'ship', order: 5, enabled: true, roles: ['release'], gates: ['CI pipeline green', 'Changelog updated', 'Release tag created'] },
        { id: 'reflect', name: 'reflect', order: 6, enabled: true, roles: ['eng-manager'], gates: ['Retrospective notes written', 'Action items documented'] },
      ],
      roles: [
        { id: 'ceo', label: 'CEO / Product Lead', description: 'Defines vision, prioritizes features, and drives decision-making.', defaultConstraints: ['Must approve all scope changes'] },
        { id: 'designer', label: 'Designer', description: 'Owns UX flows, wireframes, and design system consistency.', defaultConstraints: ['All designs must pass accessibility audit'] },
        { id: 'eng-manager', label: 'Engineering Manager', description: 'Leads development, reviews code, and manages technical debt.', defaultConstraints: ['Must maintain test coverage above 80%'] },
        { id: 'qa', label: 'QA Engineer', description: 'Ensures quality through testing strategies and defect triage.', defaultConstraints: ['Must log all test results'] },
        { id: 'release', label: 'Release Engineer', description: 'Manages CI/CD pipelines, deployments, and release artifacts.', defaultConstraints: ['Must follow semantic versioning'] },
      ],
      constraints: [
        { id: 'no-skip-stages', stageId: '*', type: 'gate', description: 'No stage may be skipped — all must run in order.', enforced: true },
        { id: 'review-required', stageId: 'ship', type: 'gate', description: 'At least one code review approval required before shipping.', enforced: true },
      ],
    },
  },
};
