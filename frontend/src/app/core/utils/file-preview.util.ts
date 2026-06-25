import { FilePreviewKind } from '../models/received-file.model';

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'json',
  'xml',
  'csv',
  'log',
  'html',
  'css',
  'js',
  'ts',
  'yaml',
  'yml',
]);

export function getPreviewKind(mimeType: string, fileName: string): FilePreviewKind {
  const mime = mimeType.toLowerCase();
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('text/') || TEXT_EXTENSIONS.has(ext)) return 'text';

  return 'generic';
}

export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()!.toUpperCase() : 'FILE';
}
