import type { OutputFile, ProjectConfig, StageName } from '@/types';

const STAGE_ORDER: StageName[] = ['think', 'plan', 'build', 'review', 'test', 'ship', 'reflect'];

export function generateCursorrules(config: ProjectConfig): OutputFile {
  const { project, architecture, flow } = config;

  const sections: string[] = [];

  // Header
  sections.push(`# ${project.name || 'Project'}`);
  if (project.description) {
    sections.push(project.description);
  }

  // Advisory notice
  sections.push('');
  sections.push('> **Enforcement Level: Advisory** — Cursor rules are prompt-level guidelines without runtime hooks. Constraints may be ignored by the AI. For full enforcement with gate checks, use Claude Code engine.');
  sections.push('');

  // Architecture
  sections.push(`## Architecture`);
  sections.push(
    `Session: ${architecture.session.storage} | Harness: ${architecture.harness.engine} | Sandbox: ${architecture.sandbox.type}`
  );

  // Sprint Flow
  const enabledStages = STAGE_ORDER
    .filter((name) => flow.sprint.some((s) => s.name === name && s.enabled));
  sections.push(`## Sprint Flow`);
  sections.push(enabledStages.map((n) => n.charAt(0).toUpperCase() + n.slice(1)).join(' → '));
  sections.push(
    `Reference stage rules via @think, @plan, @build, @review, @test, @ship, @reflect in your prompts.`
  );

  // Enforced constraints
  const enforced = flow.constraints.filter((c) => c.enforced);
  if (enforced.length > 0) {
    sections.push(`## Enforced Constraints`);
    for (const c of enforced) {
      sections.push(`- ${c.description}`);
    }
  }

  return {
    path: '.cursorrules',
    content: sections.join('\n') + '\n',
  };
}
