import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TransferHistoryService } from '../../../core/services/transfer-history.service';
import { WebRtcService } from '../../../core/services/webrtc.service';
import { NotificationService } from '../../../core/services/notification.service';
import { HistoryFilter, TransferHistoryRecord } from '../../../core/models/transfer-history.model';
import { getFileExtension } from '../../../core/utils/file-preview.util';
import { AppIconName, IconComponent } from '../../../shared/components/icon/icon.component';

interface SidebarItem {
  id: HistoryFilter;
  label: string;
  icon: AppIconName;
  count: () => number;
}

@Component({
  selector: 'app-transfer-library',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './transfer-library.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferLibraryComponent {
  private readonly history = inject(TransferHistoryService);
  private readonly webrtc = inject(WebRtcService);
  private readonly notifications = inject(NotificationService);

  readonly open = input(false);
  readonly closed = output<void>();

  readonly records = this.history.filteredRecords;
  readonly isLoading = this.history.isLoading;
  readonly filter = this.history.filter;
  readonly incomingCount = this.history.incomingCount;
  readonly outgoingCount = this.history.outgoingCount;
  readonly librarySizeLabel = this.history.librarySizeLabel;

  readonly searchQuery = signal('');
  readonly selectedId = signal<string | null>(null);

  readonly sidebarItems: SidebarItem[] = [
    { id: 'all', label: 'Todos', icon: 'folder', count: () => this.history.records().length },
    { id: 'incoming', label: 'Recibidos', icon: 'inbox', count: () => this.incomingCount() },
    { id: 'outgoing', label: 'Enviados', icon: 'upload', count: () => this.outgoingCount() },
  ];

  readonly displayRecords = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const items = this.records();
    if (!q) return items;
    return items.filter(
      (r) =>
        r.fileName.toLowerCase().includes(q) ||
        r.peerName.toLowerCase().includes(q) ||
        r.storageLabel.toLowerCase().includes(q),
    );
  });

  readonly selectedRecord = computed(
    () => this.displayRecords().find((r) => r.id === this.selectedId()) ?? null,
  );

  readonly filterTitle = computed(() => {
    switch (this.filter()) {
      case 'incoming':
        return 'Recibidos';
      case 'outgoing':
        return 'Enviados';
      default:
        return 'Biblioteca';
    }
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.close();
    }
  }

  close(): void {
    this.searchQuery.set('');
    this.selectedId.set(null);
    this.closed.emit();
  }

  setFilter(filter: HistoryFilter): void {
    this.history.setFilter(filter);
    this.selectedId.set(null);
  }

  selectRecord(id: string): void {
    this.selectedId.set(this.selectedId() === id ? null : id);
  }

  fileExtension(fileName: string): string {
    return getFileExtension(fileName);
  }

  fileIcon(record: TransferHistoryRecord): AppIconName {
    const type = record.mimeType;
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    if (type.includes('zip') || type.includes('compressed')) return 'archive';
    return 'document';
  }

  formatBytes(bytes: number): string {
    return this.history.formatBytes(bytes);
  }

  formatDate(timestamp: number): string {
    return this.history.formatDate(timestamp);
  }

  directionLabel(record: TransferHistoryRecord): string {
    return record.direction === 'incoming' ? 'Recibido' : 'Enviado';
  }

  sidebarItemClasses(active: boolean): string {
    const base =
      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.8125rem] transition-colors';
    return active
      ? `${base} bg-apple-blue/12 font-medium text-apple-blue`
      : `${base} text-apple-text hover:bg-black/[0.04]`;
  }

  listRowClasses(selected: boolean): string {
    const base =
      'group grid cursor-default grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-black/[0.04] px-3 py-2 text-sm transition-colors sm:grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)_auto_auto] sm:gap-4 sm:px-4';
    return selected ? `${base} bg-apple-blue text-white` : `${base} hover:bg-apple-blue/8`;
  }

  listMetaClasses(selected: boolean): string {
    return selected ? 'text-white/75' : 'text-apple-muted';
  }

  fileIconBoxClasses(record: TransferHistoryRecord, selected: boolean): string {
    const base = 'grid h-8 w-8 shrink-0 place-items-center rounded-lg';
    if (selected) return `${base} bg-white/20 text-white`;
    return record.direction === 'incoming'
      ? `${base} bg-emerald-100 text-emerald-700`
      : `${base} bg-sky-100 text-sky-700`;
  }

  async viewRecord(record: TransferHistoryRecord): Promise<void> {
    if (record.direction === 'incoming' && record.hasLocalCopy) {
      await this.webrtc.openPreviewFromHistory(record.id);
      this.close();
    }
  }

  async downloadRecord(record: TransferHistoryRecord): Promise<void> {
    if (record.hasLocalCopy) {
      await this.webrtc.downloadFromHistory(record.id, record.fileName);
      return;
    }
    this.notifications.show('Los envíos no guardan copia del archivo en la biblioteca', 'info');
  }

  async deleteRecord(id: string): Promise<void> {
    await this.history.deleteRecord(id);
    if (this.selectedId() === id) {
      this.selectedId.set(null);
    }
  }

  async clearAll(): Promise<void> {
    await this.history.clearAll();
    this.selectedId.set(null);
  }
}
