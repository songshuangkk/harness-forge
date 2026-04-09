'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { TemplatePreset } from '@/types';

interface TemplateCardProps {
  template: TemplatePreset;
  onSelect: (template: TemplatePreset) => void;
}

export function TemplateCard({ template, onSelect }: TemplateCardProps) {
  return (
    <Card className="flex flex-col transition-shadow hover:shadow-lg">
      <CardHeader>
        <div className="text-4xl mb-2">{template.icon}</div>
        <CardTitle className="text-xl">{template.name}</CardTitle>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        <Button className="w-full" onClick={() => onSelect(template)}>
          Use Template
        </Button>
      </CardContent>
    </Card>
  );
}
