'use client';

import { useState, useCallback, useMemo } from 'react';
import { FileIcon, FolderIcon, Copy, Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { OutputFile } from '@/types';

interface FilePreviewProps {
  files: OutputFile[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileGroup {
  dir: string;
  files: { file: OutputFile; index: number }[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-secondary hover:text-ink"
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-600" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}

export function FilePreview({ files }: FilePreviewProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const selectedFile = files[selectedIndex];

  const groups = useMemo<FileGroup[]>(() => {
    const sorted = files
      .map((file, index) => ({ file, index }))
      .sort((a, b) => a.file.path.localeCompare(b.file.path));

    const map = new Map<string, { file: OutputFile; index: number }[]>();
    for (const entry of sorted) {
      const slashIndex = entry.file.path.indexOf('/');
      const dir = slashIndex > 0 ? entry.file.path.substring(0, slashIndex) : '(root)';
      if (!map.has(dir)) map.set(dir, []);
      map.get(dir)!.push(entry);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dir, files]) => ({ dir, files }));
  }, [files]);

  const toggleDir = (dir: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });
  };

  return (
    <div className="surface-etched rounded-xl overflow-hidden md:h-[520px]">
      <div className="flex h-full flex-col md:flex-row">
        {/* File tree */}
        <div className="w-full shrink-0 border-b border-border bg-paper-warm md:w-64 md:border-b-0 md:border-r">
          <div className="border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
            Files ({files.length})
          </div>
          <ScrollArea className="h-48 md:h-[calc(520px-37px)]">
            <div className="py-1">
              {groups.map((group) => {
                const isCollapsed = collapsedDirs.has(group.dir);
                return (
                  <div key={group.dir}>
                    <button
                      onClick={() => toggleDir(group.dir)}
                      className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs font-medium text-ink-muted transition-colors hover:bg-secondary/50"
                    >
                      <ChevronRight
                        className={cn(
                          'size-3 shrink-0 transition-transform',
                          !isCollapsed && 'rotate-90'
                        )}
                      />
                      <FolderIcon className="size-3.5 shrink-0 opacity-60" />
                      <span className="truncate font-mono">
                        {group.dir === '(root)' ? 'Root files' : group.dir + '/'}
                      </span>
                      <span className="ml-auto text-[10px] text-ink-muted/60">
                        {group.files.length}
                      </span>
                    </button>
                    {!isCollapsed &&
                      group.files.map(({ file, index }) => (
                        <button
                          key={file.path}
                          onClick={() => setSelectedIndex(index)}
                          className={cn(
                            'flex w-full items-center gap-2 pl-8 pr-3 py-1 text-left text-sm transition-colors',
                            index === selectedIndex
                              ? 'bg-copper/10 text-copper font-medium'
                              : 'text-ink-secondary hover:bg-paper-warm'
                          )}
                        >
                          <FileIcon className="size-3 shrink-0 opacity-50" />
                          <span className="truncate font-mono text-xs">
                            {group.dir === '(root)'
                              ? file.path
                              : file.path.substring(group.dir.length + 1)}
                          </span>
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Code preview */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {selectedFile ? (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <span className="truncate font-mono text-xs font-medium text-ink">
                  {selectedFile.path}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-ink-muted">
                    {formatBytes(new Blob([selectedFile.content]).size)}
                  </span>
                  <CopyButton text={selectedFile.content} />
                </div>
              </div>
              <ScrollArea className="flex-1 overflow-hidden bg-paper">
                <pre className="p-4 text-[13px] leading-relaxed font-mono whitespace-pre text-ink-secondary overflow-x-auto">
                  <code>{selectedFile.content}</code>
                </pre>
              </ScrollArea>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-ink-muted">
              No files generated
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
