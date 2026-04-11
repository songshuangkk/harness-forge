'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileIcon, GitMerge, Package } from 'lucide-react';
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

const ENGINE_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  'codex': 'OpenAI Codex',
  'cursor': 'Cursor',
  'custom': 'Custom',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function categorizeFile(path: string): 'core' | 'adapter' | 'docs' {
  // Core: .harness/ prefix
  if (path.startsWith('.harness/')) return 'core';
  // Docs: README.md or docs/
  if (path === 'README.md' || path.startsWith('docs/')) return 'docs';
  // Adapter: .claude/, .cursor/, .codex/, or engine entry files
  if (
    path.startsWith('.claude/') ||
    path.startsWith('.cursor/') ||
    path.startsWith('.codex/') ||
    path === 'CLAUDE.md' ||
    path === '.cursorrules' ||
    path === 'AGENTS.md' ||
    path === 'AI_CONFIG.md'
  ) {
    return 'adapter';
  }
  // Default remaining to adapter (settings, configs)
  return 'adapter';
}

export default function GeneratePage() {
  const router = useRouter();
  const setCurrentStep = useProjectConfig((s) => s.setCurrentStep);
  const config = useProjectConfig((s) => s.config);
  const [downloading, setDownloading] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);

  const files = useMemo(() => generateAll(config, { mergeMode }), [config, mergeMode]);

  const totalSize = useMemo(
    () => files.reduce((sum, f) => sum + new Blob([f.content]).size, 0),
    [files]
  );

  const counts = useMemo(() => {
    let core = 0;
    let adapter = 0;
    let docs = 0;
    for (const f of files) {
      const cat = categorizeFile(f.path);
      if (cat === 'core') core++;
      else if (cat === 'adapter') adapter++;
      else docs++;
    }
    return { core, adapter, docs };
  }, [files]);

  const engineLabel = ENGINE_LABELS[config.architecture.harness.engine] ?? config.architecture.harness.engine;
  const isAdvisory = config.architecture.harness.engine === 'codex' || config.architecture.harness.engine === 'cursor';

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
    <div className="space-y-10">
      {/* Section header */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-copper">
          Generate
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-ink">
          Preview & Download
        </h1>
        <p className="mt-2 text-base text-ink-secondary">
          Review your generated project files, then download.
        </p>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 rounded-lg bg-paper-warm px-5 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-copper/10 text-copper">
          <Package className="size-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-ink">
            {config.project.name || 'project'} — {files.length} files
          </p>
          <p className="text-xs text-ink-muted">
            {engineLabel}{isAdvisory ? ' (advisory)' : ''} &middot; {counts.core} core &middot; {counts.adapter} adapter &middot; {counts.docs} docs &middot; {formatBytes(totalSize)}
          </p>
        </div>
        <button
          onClick={() => setMergeMode(!mergeMode)}
          className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-precise active:scale-[0.98] ${
            mergeMode
              ? 'bg-copper/15 text-copper ring-1 ring-copper/30'
              : 'text-ink-secondary hover:bg-secondary'
          }`}
          title={mergeMode ? 'Merge mode: ON — generates harness-import.sh for existing projects' : 'Click to enable merge mode for existing projects'}
        >
          <GitMerge className="size-4" />
          {mergeMode ? 'Merge Mode' : 'New Project'}
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 rounded-md bg-copper px-5 py-2.5 text-sm font-medium text-primary-foreground transition-precise hover:bg-copper/90 active:scale-[0.98] disabled:opacity-50"
        >
          <Download className="size-4" />
          {downloading ? 'Generating...' : 'Download ZIP'}
        </button>
      </div>

      {mergeMode && (
        <div className="rounded-lg border border-copper/20 bg-copper/5 px-4 py-3 text-sm text-ink-secondary">
          <strong className="text-copper">Merge mode enabled.</strong> The ZIP will include a <code className="rounded bg-paper px-1 py-0.5 text-xs">harness-import.sh</code> script that safely merges harness infrastructure into an existing project without overwriting files. Run it with <code className="rounded bg-paper px-1 py-0.5 text-xs">--dry-run</code> to preview first.
        </div>
      )}

      {/* File preview */}
      <FilePreview files={files} />

      {/* Navigation */}
      <div className="flex justify-between border-t border-border pt-6">
        <button
          onClick={goPrev}
          className="rounded-md px-5 py-2.5 text-sm font-medium text-ink-secondary transition-precise hover:bg-secondary"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
