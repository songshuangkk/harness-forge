'use client';

import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

const STEP_PATHS = [
  '/wizard',
  '/wizard/architecture',
  '/wizard/flow',
  '/wizard/integration',
  '/wizard/generate',
];

const FRAMEWORKS = [
  { value: 'next', label: 'Next.js' },
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'flutter', label: 'Flutter' },
  { value: 'custom', label: 'Custom' },
] as const;

const LANGUAGES = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'dart', label: 'Dart' },
  { value: 'go', label: 'Go' },
] as const;

const PACKAGE_MANAGERS = [
  { value: 'npm', label: 'npm' },
  { value: 'yarn', label: 'Yarn' },
  { value: 'pnpm', label: 'pnpm' },
  { value: 'bun', label: 'Bun' },
] as const;

export default function ProjectBasicsPage() {
  const router = useRouter();
  const setCurrentStep = useProjectConfig((s) => s.setCurrentStep);
  const project = useProjectConfig((s) => s.config.project);
  const setProject = useProjectConfig((s) => s.setProject);

  const updateTechStack = (key: string, value: string | null) => {
    if (value != null) {
      setProject({ techStack: { ...project.techStack, [key]: value } });
    }
  };

  const goNext = () => {
    setCurrentStep(1);
    router.push(STEP_PATHS[1]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Basics</CardTitle>
        <CardDescription>Define your project name, description, and tech stack.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Project Name */}
        <div className="space-y-2">
          <Label htmlFor="project-name">Project Name</Label>
          <Input
            id="project-name"
            placeholder="my-awesome-project"
            value={project.name}
            onChange={(e) => setProject({ name: e.target.value })}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="project-description">Description</Label>
          <Textarea
            id="project-description"
            placeholder="A brief description of your project..."
            value={project.description}
            onChange={(e) => setProject({ description: e.target.value })}
            rows={3}
          />
        </div>

        {/* Tech Stack */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Framework */}
          <div className="space-y-2">
            <Label>Framework</Label>
            <Select
              value={project.techStack.framework}
              onValueChange={(val) => updateTechStack('framework', val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select framework" />
              </SelectTrigger>
              <SelectContent>
                {FRAMEWORKS.map((fw) => (
                  <SelectItem key={fw.value} value={fw.value}>
                    {fw.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Language */}
          <div className="space-y-2">
            <Label>Language</Label>
            <Select
              value={project.techStack.language}
              onValueChange={(val) => updateTechStack('language', val)}
            >
              <SelectTrigger className="w-full">
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

          {/* Package Manager */}
          <div className="space-y-2">
            <Label>Package Manager</Label>
            <Select
              value={project.techStack.packageManager}
              onValueChange={(val) => updateTechStack('packageManager', val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select package manager" />
              </SelectTrigger>
              <SelectContent>
                {PACKAGE_MANAGERS.map((pm) => (
                  <SelectItem key={pm.value} value={pm.value}>
                    {pm.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Git Init */}
        <div className="flex items-center gap-3">
          <Switch
            checked={project.gitInit}
            onCheckedChange={(checked) => setProject({ gitInit: checked })}
          />
          <Label>Initialize Git repository</Label>
        </div>

        {/* Navigation */}
        <div className="flex justify-end">
          <Button onClick={goNext}>
            Next: Architecture →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
