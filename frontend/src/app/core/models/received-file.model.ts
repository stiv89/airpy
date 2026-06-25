export type FilePreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'generic';

export interface ReceivedFilePreview {
  fileName: string;
  fileSize: number;
  mimeType: string;
  peerName: string;
  blobUrl: string;
  previewKind: FilePreviewKind;
  textContent: string | null;
  historyId?: string;
}
