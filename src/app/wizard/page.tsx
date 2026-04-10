'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectConfig } from '@/store/useProjectConfig';
import { templates } from '@/templates';

const STEP_PATHS = [
  '/wizard',
  '/wizard/architecture',
  '/wizard/flow',
  '/wizard/integration',
  '/wizard/generate',
];

const LANGUAGES = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'rust', label: 'Rust' },
  { value: 'dart', label: 'Dart' },
] as const;

function TemplateLoader() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const loadTemplate = useProjectConfig((s) => s.loadTemplate);

  useEffect(() => {
    const templateId = searchParams.get('template');
    if (templateId) {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        loadTemplate(template.config);
        router.replace('/wizard');
      }
    }
  }, [searchParams, loadTemplate, router]);

  return null;
}

export default function ProjectBasicsPage() {
  const router = useRouter();
  const setCurrentStep = useProjectConfig((s) => s.setCurrentStep);
  const project = useProjectConfig((s) => s.config.project);
  const setProject = useProjectConfig((s) => s.setProject);

  const goNext = () => {
    setCurrentStep(1);
    router.push(STEP_PATHS[1]);
  };

  return (
    <>
      <Suspense>
        <TemplateLoader />
      </Suspense>
      <div className="space-y-10">
        {/* Section header */}
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-ink">
          Project Basics
        </h1>
        <p className="mt-2 text-base text-ink-secondary">
          Name your project and pick the tech stack.
        </p>
      </div>

      {/* Form fields */}
      <div className="max-w-xl space-y-8">
        {/* Project Name */}
        <div className="space-y-2">
          <Label htmlFor="project-name" className="text-sm font-medium text-ink">
            Project Name
          </Label>
          <Input
            id="project-name"
            placeholder="my-awesome-project"
            value={project.name}
            onChange={(e) => setProject({ name: e.target.value })}
            className="h-11 bg-paper-warm transition-precise focus-visible:copper-glow"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="project-description" className="text-sm font-medium text-ink">
            Description
          </Label>
          <Textarea
            id="project-description"
            placeholder="A brief description of your project..."
            value={project.description}
            onChange={(e) => setProject({ description: e.target.value })}
            rows={3}
            className="bg-paper-warm resize-none transition-precise focus-visible:copper-glow"
          />
        </div>

        {/* Tech Stack */}
        <div>
          <p className="mb-4 text-sm font-medium text-ink">Tech Stack</p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-ink-muted">Language</Label>
              <Select
                value={project.techStack.language}
                onValueChange={(val) =>
                  setProject({ techStack: { ...project.techStack, language: val as typeof project.techStack.language } })
                }
              >
                <SelectTrigger className="h-11 bg-paper-warm">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stack-description" className="text-xs text-ink-muted">
                Stack Description
              </Label>
              <Textarea
                id="stack-description"
                placeholder="e.g. Gin + PostgreSQL + Redis, or Next.js + Tailwind + Prisma..."
                value={project.techStack.stackDescription}
                onChange={(e) =>
                  setProject({ techStack: { ...project.techStack, stackDescription: e.target.value } })
                }
                rows={2}
                className="bg-paper-warm resize-none transition-precise focus-visible:copper-glow"
              />
              <p className="text-xs text-ink-muted">
                Frameworks, databases, tools — anything the AI agent should know about.
              </p>
            </div>
          </div>
        </div>

        {/* Git Init */}
        <div className="flex items-center gap-3 rounded-lg bg-paper-warm px-4 py-3">
          <Switch
            checked={project.gitInit}
            onCheckedChange={(checked) => setProject({ gitInit: checked })}
          />
          <div>
            <Label className="text-sm font-medium text-ink">Initialize Git repository</Label>
            <p className="text-xs text-ink-muted">Recommended for most projects</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-end border-t border-border pt-6">
        <button
          onClick={goNext}
          className="rounded-md bg-copper px-6 py-2.5 text-sm font-medium text-primary-foreground transition-precise hover:bg-copper/90 active:scale-[0.98]"
        >
          Continue to Architecture →
        </button>
      </div>
    </div>
    </>
  );
}
