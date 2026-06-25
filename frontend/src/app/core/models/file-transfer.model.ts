export type TransferDirection = 'incoming' | 'outgoing';

export interface FileTransferState {
  peerId: string;
  peerName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  direction: TransferDirection;
  bytesTransferred: number;
  progress: number;
  status: 'pending' | 'transferring' | 'completed' | 'error';
  errorMessage?: string;
}

export interface FileMetaPayload {
  type: 'meta';
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface FileDonePayload {
  type: 'done';
}

export type FileControlPayload = FileMetaPayload | FileDonePayload;
