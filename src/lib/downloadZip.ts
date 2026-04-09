import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { OutputFile } from '@/types';

export async function downloadZip(files: OutputFile[], projectName: string) {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${projectName || 'project'}.zip`);
}
