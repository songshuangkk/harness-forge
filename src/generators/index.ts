import type { ProjectConfig, OutputFile } from '@/types';

// Core generators (always generated, engine-agnostic)
import { generateCoreConfig } from './core/config';
import { generateCoreRoles } from './core/roles';
import { generateCoreFlows } from './core/flows';
import { generateCoreConstraints } from './core/constraints';

// Claude Code engine adapter
import { generateClaudeMd } from './engines/claude/claudeMd';
import { generateClaudeCommands, generateSprintCommand, generateNewTaskCommand } from './engines/claude/commands';
import { generateClaudeHooks } from './engines/claude/hooks';
import { generateCodeReviewCommand } from './engines/claude/codeReview';
import { generateClaudeSettings } from './engines/claude/settings';
import { generateSessionScripts } from './engines/claude/sessionScripts';
import { generateSandboxScripts } from './engines/claude/sandboxScripts';
import { generateNegotiateScript } from './engines/claude/negotiateScript';

// Cursor engine adapter
import { generateCursorrules } from './engines/cursor/cursorrules';
import { generateCursorRules } from './engines/cursor/rules';
import { generateCursorMcp } from './engines/cursor/mcp';

// Codex engine adapter
import { generateAgentsMd } from './engines/codex/agentsMd';
import { generateCodexSkills } from './engines/codex/skills';
import { generateCodexHookScripts, generateCodexHooksJson } from './engines/codex/hooks';
import { generateCodexConfig } from './engines/codex/config';

// Scaffold (always generated)
import { generateScaffold } from './scaffold';

// Merge mode
import { generateMergeScript } from './mergeScript';

export interface GenerateOptions {
  /** When true, generates a harness-import.sh merge script instead of flat files */
  mergeMode?: boolean;
}

export function generateAll(config: ProjectConfig, options?: GenerateOptions): OutputFile[] {
  const files: OutputFile[] = [];
  const { mergeMode = false } = options ?? {};

  // 1. Core files (always)
  files.push(generateCoreConfig(config));
  files.push(...generateCoreRoles(config));
  files.push(...generateCoreFlows(config));
  files.push(...generateCoreConstraints(config));

  // 2. Engine adapter files
  const engine = config.architecture.harness.engine;

  switch (engine) {
    case 'claude-code':
      files.push(generateClaudeMd(config));
      files.push(...generateClaudeCommands(config));
      const sprintCmd = generateSprintCommand(config);
      if (sprintCmd) files.push(sprintCmd);
      files.push(generateNewTaskCommand());
      const codeReviewCmd = generateCodeReviewCommand(config);
      if (codeReviewCmd) files.push(codeReviewCmd);
      files.push(...generateClaudeHooks(config));
      files.push(generateClaudeSettings(config));
      files.push(...generateSessionScripts(config));
      files.push(...generateSandboxScripts(config));
      const negotiateScript = generateNegotiateScript(config);
      if (negotiateScript) files.push(negotiateScript);
      break;

    case 'cursor':
      files.push(generateCursorrules(config));
      files.push(...generateCursorRules(config));
      files.push(generateCursorMcp(config));
      break;

    case 'codex':
      files.push(generateAgentsMd(config));
      files.push(...generateCodexSkills(config));
      files.push(...generateCodexHookScripts(config));
      files.push(generateCodexHooksJson(config));
      files.push(generateCodexConfig(config));
      break;

    case 'custom':
      // Core + scaffold only
      break;
  }

  // 3. Scaffold files (always)
  files.push(...generateScaffold(config));

  // 4. Merge mode: add import script
  if (mergeMode) {
    files.push(generateMergeScript(config));
  }

  // 5. Deduplicate by path — last writer wins
  const seen = new Map<string, number>();
  for (let i = 0; i < files.length; i++) {
    const prev = seen.get(files[i].path);
    if (prev !== undefined) {
      files.splice(prev, 1);
      i--; // adjust index after splice
    }
    seen.set(files[i].path, i);
  }

  return files;
}
