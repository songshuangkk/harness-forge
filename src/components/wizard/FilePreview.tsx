'use client';

import { useState, useCallback } from 'react';
import { FileIcon, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleCopy}
      className="shrink-0"
    >
      {copied ? (
        <Check className="size-3.5 text-green-500" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  );
}

export function FilePreview({ files }: FilePreviewProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedFile = files[selectedIndex];

  return (
    <div className="flex h-[520px] rounded-lg border border-border overflow-hidden">
      {/* Left panel: file tree */}
      <div className="w-64 shrink-0 border-r border-border bg-muted/30">
        <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
          Files ({files.length})
        </div>
        <ScrollArea className="h-[calc(520px-37px)]">
          <div className="py-1">
            {files.map((file, index) => (
              <button
                key={file.path}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                  index === selectedIndex
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                <FileIcon className="size-3.5 shrink-0 opacity-60" />
                <span className="truncate">{file.path}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right panel: code preview */}
      <div className="flex min-w-0 flex-1 flex-col">
        {selectedFile ? (
          <>
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="truncate text-sm font-medium">
                {selectedFile.path}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatBytes(new Blob([selectedFile.content]).size)}
                </span>
                <CopyButton text={selectedFile.content} />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <pre className="p-4 text-sm leading-relaxed font-mono whitespace-pre overflow-x-auto">
                <code>{selectedFile.content}</code>
              </pre>
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            No files generated
          </div>
        )}
      </div>
    </div>
  );
}
