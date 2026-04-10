import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { OutputFile } from '@/types';

const EXECUTABLE_EXTENSIONS = new Set(['.sh', '.bash']);

export async function downloadZip(files: OutputFile[], projectName: string) {
  const zip = new JSZip();
  for (const file of files) {
    const isExecutable = EXECUTABLE_EXTENSIONS.has(
      file.path.slice(file.path.lastIndexOf('.'))
    );
    zip.file(file.path, file.content, {
      unixPermissions: isExecutable ? 0o755 : 0o644,
    });
  }
  const blob = await zip.generateAsync({
    type: 'blob',
    platform: 'UNIX',
  });
  saveAs(blob, `${projectName || 'project'}.zip`);
}
