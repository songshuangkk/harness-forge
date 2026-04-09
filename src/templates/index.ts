import type { TemplatePreset } from '@/types';
import { soloDev } from './solo-dev';
import { gstackSprint } from './gstack-sprint';
import { managedAgents } from './managed-agents';

export const templates: TemplatePreset[] = [soloDev, gstackSprint, managedAgents];
