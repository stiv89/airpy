export type TransferDirection = 'incoming' | 'outgoing';

export type StorageLocation = 'in_app' | 'downloads' | 'user_picked' | 'sent_record';

export interface TransferHistoryRecord {
  id: string;
  direction: TransferDirection;
  fileName: string;
  fileSize: number;
  mimeType: string;
  peerName: string;
  createdAt: number;
  hasLocalCopy: boolean;
  storageLocation: StorageLocation;
  storageLabel: string;
  downloadedAt?: number;
}

export type HistoryFilter = 'all' | 'incoming' | 'outgoing';
