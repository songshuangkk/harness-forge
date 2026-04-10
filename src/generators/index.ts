import type { ProjectConfig, OutputFile } from '@/types';

// Core generators (always generated, engine-agnostic)
import { generateCoreConfig } from './core/config';
import { generateCoreRoles } from './core/roles';
import { generateCoreFlows } from './core/flows';
import { generateCoreConstraints } from './core/constraints';

// Claude Code engine adapter
import { generateClaudeMd } from './engines/claude/claudeMd';
import { generateClaudeCommands } from './engines/claude/commands';
import { generateClaudeHooks } from './engines/claude/hooks';
import { generateClaudeSettings } from './engines/claude/settings';

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

export function generateAll(config: ProjectConfig): OutputFile[] {
  const files: OutputFile[] = [];

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
      files.push(...generateClaudeHooks(config));
      files.push(generateClaudeSettings(config));
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

  return files;
}
