'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProjectConfig } from '@/store/useProjectConfig';
import { generateAll } from '@/generators';
import { downloadZip } from '@/lib/downloadZip';
import { FilePreview } from '@/components/wizard/FilePreview';

const STEP_PATHS = [
  '/wizard',
  '/wizard/architecture',
  '/wizard/flow',
  '/wizard/integration',
  '/wizard/generate',
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GeneratePage() {
  const router = useRouter();
  const setCurrentStep = useProjectConfig((s) => s.setCurrentStep);
  const config = useProjectConfig((s) => s.config);
  const [downloading, setDownloading] = useState(false);

  const files = useMemo(() => generateAll(config), [config]);

  const totalSize = useMemo(
    () => files.reduce((sum, f) => sum + new Blob([f.content]).size, 0),
    [files],
  );

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadZip(files, config.project.name);
    } finally {
      setDownloading(false);
    }
  };

  const goPrev = () => {
    setCurrentStep(3);
    router.push(STEP_PATHS[3]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Preview &amp; Generate</CardTitle>
          <CardDescription>
            Review your generated project files and download as ZIP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <FileIcon className="size-5 text-muted-foreground" />
            <span className="text-sm">
              <strong>{files.length}</strong> files — {formatBytes(totalSize)} total
            </span>
          </div>

          {/* File preview */}
          <FilePreview files={files} />

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={goPrev}>
              Previous
            </Button>
            <Button onClick={handleDownload} disabled={downloading}>
              <Download className="size-4" />
              {downloading ? 'Generating...' : 'Download ZIP'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
