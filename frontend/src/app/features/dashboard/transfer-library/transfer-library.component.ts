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
import { AppIconName, IconComponent } from '../../../shared/components/icon/icon.component';

interface FilterTab {
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
  readonly librarySizeLabel = this.history.librarySizeLabel;

  readonly searchQuery = signal('');
  readonly selectedId = signal<string | null>(null);

  readonly filterTabs: FilterTab[] = [
    { id: 'all', label: 'Todos', icon: 'folder', count: () => this.history.records().length },
    { id: 'incoming', label: 'Recibidos', icon: 'inbox', count: () => this.history.incomingCount() },
    { id: 'outgoing', label: 'Enviados', icon: 'upload', count: () => this.history.outgoingCount() },
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

  filterChipClasses(active: boolean): string {
    const base =
      'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-200 sm:text-sm';
    return active
      ? `${base} bg-apple-blue text-white shadow-send-btn`
      : `${base} bg-black/5 text-apple-text hover:bg-black/10`;
  }

  desktopCardClasses(selected: boolean): string {
    const base =
      'flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-all duration-200 sm:p-3.5';
    return selected
      ? `${base} border-apple-blue/30 bg-apple-blue/8 ring-2 ring-apple-blue/15`
      : `${base} border-black/5 bg-white/50 hover:border-apple-blue/20 hover:bg-white/80`;
  }

  mobileRowClasses(selected: boolean): string {
    const base =
      'flex w-full items-center gap-3 border-b border-black/[0.05] px-4 py-3.5 text-left transition-colors active:bg-black/[0.03]';
    return selected ? `${base} bg-apple-blue/8` : base;
  }

  fileIconBoxClasses(record: TransferHistoryRecord, selected: boolean): string {
    const base = 'grid h-11 w-11 shrink-0 place-items-center rounded-2xl sm:h-10 sm:w-10 sm:rounded-xl';
    if (selected) return `${base} bg-apple-blue/15 text-apple-blue`;
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
