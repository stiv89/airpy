import { Injectable, computed, inject, signal } from '@angular/core';
import {
  HistoryFilter,
  TransferHistoryRecord,
} from '../models/transfer-history.model';
import { NotificationService } from './notification.service';

const DB_NAME = 'viadrop-library';
const DB_VERSION = 1;
const RECORDS_STORE = 'records';
const BLOBS_STORE = 'blobs';
const MAX_RECORDS = 80;

interface IncomingPayload {
  fileName: string;
  fileSize: number;
  mimeType: string;
  peerName: string;
}

interface OutgoingPayload {
  fileName: string;
  fileSize: number;
  mimeType: string;
  peerName: string;
}

@Injectable({ providedIn: 'root' })
export class TransferHistoryService {
  private readonly notifications = inject(NotificationService);

  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  readonly records = signal<TransferHistoryRecord[]>([]);
  readonly isLoading = signal(false);
  readonly filter = signal<HistoryFilter>('all');

  readonly filteredRecords = computed(() => {
    const items = this.records();
    const f = this.filter();
    if (f === 'all') return items;
    return items.filter((r) => r.direction === f);
  });

  readonly incomingCount = computed(
    () => this.records().filter((r) => r.direction === 'incoming').length,
  );

  readonly outgoingCount = computed(
    () => this.records().filter((r) => r.direction === 'outgoing').length,
  );

  readonly librarySizeLabel = computed(() => {
    const bytes = this.records()
      .filter((r) => r.hasLocalCopy)
      .reduce((sum, r) => sum + r.fileSize, 0);
    return this.formatBytes(bytes);
  });

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.openDatabase();
    }
    await this.initPromise;
    await this.refresh();
  }

  async addIncoming(blob: Blob, payload: IncomingPayload): Promise<string> {
    await this.init();
    const id = crypto.randomUUID();
    const record: TransferHistoryRecord = {
      id,
      direction: 'incoming',
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      mimeType: payload.mimeType,
      peerName: payload.peerName,
      createdAt: Date.now(),
      hasLocalCopy: true,
      storageLocation: 'in_app',
      storageLabel: 'Biblioteca ViaDrop · almacenamiento local del navegador',
    };

    await this.putRecord(record);
    await this.putBlob(id, blob);
    await this.refresh();
    await this.enforceLimit();
    return id;
  }

  async addOutgoing(payload: OutgoingPayload): Promise<string> {
    await this.init();
    const id = crypto.randomUUID();
    const record: TransferHistoryRecord = {
      id,
      direction: 'outgoing',
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      mimeType: payload.mimeType,
      peerName: payload.peerName,
      createdAt: Date.now(),
      hasLocalCopy: false,
      storageLocation: 'sent_record',
      storageLabel: 'Registro de envío · el archivo sigue en tu dispositivo',
    };

    await this.putRecord(record);
    await this.refresh();
    await this.enforceLimit();
    return id;
  }

  async markDownloaded(id: string, location: TransferHistoryRecord['storageLocation'], label: string): Promise<void> {
    await this.init();
    const record = this.records().find((r) => r.id === id);
    if (!record) return;

    const updated: TransferHistoryRecord = {
      ...record,
      storageLocation: location,
      storageLabel: label,
      downloadedAt: Date.now(),
    };

    await this.putRecord(updated);
    await this.refresh();
  }

  async getBlob(id: string): Promise<Blob | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(BLOBS_STORE, 'readonly');
      const request = tx.objectStore(BLOBS_STORE).get(id);
      request.onsuccess = () => resolve((request.result as Blob) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRecord(id: string): Promise<void> {
    await this.deleteRecordInternal(id);
    await this.refresh();
    this.notifications.show('Eliminado de la biblioteca', 'info', 2500);
  }

  async clearAll(): Promise<void> {
    await this.init();
    if (!this.db) return;

    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction([RECORDS_STORE, BLOBS_STORE], 'readwrite');
      tx.objectStore(RECORDS_STORE).clear();
      tx.objectStore(BLOBS_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await this.refresh();
    this.notifications.show('Biblioteca vaciada', 'info');
  }

  setFilter(filter: HistoryFilter): void {
    this.filter.set(filter);
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** i;
    return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
  }

  formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat('es', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  }

  private async openDatabase(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      this.notifications.show('Tu navegador no soporta almacenamiento local', 'warning');
      return;
    }

    this.isLoading.set(true);

    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(RECORDS_STORE)) {
            db.createObjectStore(RECORDS_STORE, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(BLOBS_STORE)) {
            db.createObjectStore(BLOBS_STORE);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  private async refresh(): Promise<void> {
    if (!this.db) {
      this.records.set([]);
      return;
    }

    const records = await new Promise<TransferHistoryRecord[]>((resolve, reject) => {
      const tx = this.db!.transaction(RECORDS_STORE, 'readonly');
      const request = tx.objectStore(RECORDS_STORE).getAll();
      request.onsuccess = () => {
        const items = (request.result as TransferHistoryRecord[]).sort(
          (a, b) => b.createdAt - a.createdAt,
        );
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });

    this.records.set(records);
  }

  private putRecord(record: TransferHistoryRecord): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(RECORDS_STORE, 'readwrite');
      const request = tx.objectStore(RECORDS_STORE).put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private putBlob(id: string, blob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(BLOBS_STORE, 'readwrite');
      const request = tx.objectStore(BLOBS_STORE).put(blob, id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async enforceLimit(): Promise<void> {
    const items = [...this.records()].sort((a, b) => b.createdAt - a.createdAt);
    const overflow = items.slice(MAX_RECORDS);
    for (const item of overflow) {
      await this.deleteRecordInternal(item.id);
    }
    if (overflow.length) {
      await this.refresh();
    }
  }

  private async deleteRecordInternal(id: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction([RECORDS_STORE, BLOBS_STORE], 'readwrite');
      tx.objectStore(RECORDS_STORE).delete(id);
      tx.objectStore(BLOBS_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
