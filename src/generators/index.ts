import type { ProjectConfig, OutputFile } from '@/types';
import { generateClaudeMd } from './claudeMd';
import { generateSettings } from './settings';
import { generateScaffold } from './scaffold';

export function generateAll(config: ProjectConfig): OutputFile[] {
  return [
    ...generateClaudeMd(config),
    ...generateSettings(config),
    ...generateScaffold(config),
  ];
}
