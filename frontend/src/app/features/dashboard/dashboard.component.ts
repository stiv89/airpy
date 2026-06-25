import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocketService } from '../../core/services/socket.service';
import { WebRtcService } from '../../core/services/webrtc.service';
import { NotificationService } from '../../core/services/notification.service';
import { FileTransferState } from '../../core/models/file-transfer.model';
import { NotificationTone } from '../../core/models/app-notification.model';
import { FilePreviewModalComponent } from './file-preview-modal/file-preview-modal.component';
import { TransferLibraryComponent } from './transfer-library/transfer-library.component';
import { TransferHistoryService } from '../../core/services/transfer-history.service';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { PwaService } from '../../core/services/pwa.service';
import { ParticleBackgroundComponent } from './particle-background/particle-background.component';
import { IconComponent, AppIconName } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FilePreviewModalComponent, TransferLibraryComponent, ParticleBackgroundComponent, IconComponent],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly socket = inject(SocketService);
  private readonly webrtc = inject(WebRtcService);
  private readonly notifications = inject(NotificationService);
  private readonly history = inject(TransferHistoryService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly pwa = inject(PwaService);

  readonly isOffline = this.connectivity.isOffline;
  readonly canInstallPwa = this.pwa.canInstall;
  readonly isPwaInstalled = this.pwa.isInstalled;

  readonly peers = this.socket.peers;
  readonly roomId = this.socket.roomId;
  readonly isConnected = this.socket.isConnected;
  readonly isReconnecting = this.socket.isReconnecting;
  readonly connectionStatus = this.socket.connectionStatus;
  readonly connectionError = this.socket.connectionError;
  readonly activeTransfer = this.webrtc.activeTransfer;
  readonly toastStack = this.notifications.notifications;

  readonly selectedPeerId = signal<string | null>(null);
  readonly isDragOver = signal(false);
  readonly pendingFile = signal<File | null>(null);
  readonly isEditingName = signal(false);
  readonly isLibraryOpen = signal(false);
  readonly displayName = signal(this.generateDisplayName());

  private readonly taglines = [
    'Arrastra tu archivo',
    'Suéltalo en el radar',
    'Elige un dispositivo',
    'Envía al instante',
  ];

  readonly taglineIndex = signal(0);
  readonly taglineVisible = signal(true);
  readonly taglineAnimKey = signal(0);

  private taglineInterval?: ReturnType<typeof setInterval>;
  private taglineFadeTimeout?: ReturnType<typeof setTimeout>;
  private taglineReducedMotion = false;

  readonly headlineTagline = computed(() => {
    if (this.isDragOver()) return 'Suelta para compartir';
    if (this.pendingFile()) return 'Elige quién lo recibe';
    if (this.isTransferBusy()) return 'Transfiriendo…';
    if (this.taglineReducedMotion) return 'Arrastra, suelta y envía';
    return this.taglines[this.taglineIndex()];
  });

  readonly selectedPeer = computed(
    () => this.peers().find((peer) => peer.id === this.selectedPeerId()) ?? null,
  );

  readonly peerCount = computed(() => this.peers().length);

  readonly truncatedRoomId = computed(() => {
    const id = this.roomId();
    if (!id) return '—';
    return id.length > 16 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
  });

  readonly statusLabel = computed(() => {
    switch (this.connectionStatus()) {
      case 'connected':
        return 'En línea';
      case 'connecting':
        return 'Conectando';
      case 'reconnecting':
        return 'Reconectando';
      case 'offline':
        return 'Sin internet';
      case 'error':
        return 'Servidor no disponible';
      default:
        return 'Desconectado';
    }
  });

  readonly canPickFile = computed(() => {
    return this.isConnected() && !this.isOffline() && !this.webrtc.isTransferring();
  });

  readonly isChoosingRecipient = computed(() => !!this.pendingFile());

  readonly isTransferBusy = computed(() => {
    const t = this.activeTransfer();
    return t?.status === 'transferring' || t?.status === 'pending';
  });

  readonly showTransferSheet = computed(() => {
    const t = this.activeTransfer();
    if (!t) return false;
    return t.direction === 'outgoing' || t.status === 'transferring' || t.status === 'pending' || t.status === 'error';
  });

  readonly historyCount = computed(() => this.history.records().length);

  readonly showInstallBanner = computed(
    () => this.pwa.canInstall() && !this.pwa.isInstalled(),
  );

  constructor() {
    effect(() => {
      if (this.connectivity.isOnline()) {
        this.socket.resumeWhenOnline();
      }
    });
  }

  ngOnInit(): void {
    void this.history.init();
    this.pwa.init();
    this.socket.connect(this.displayName());
    this.webrtc.initialize();
    document.addEventListener('keydown', this.onDocumentKeydown);
    this.taglineReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!this.taglineReducedMotion) {
      this.taglineInterval = setInterval(() => this.advanceTagline(), 3200);
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.onDocumentKeydown);
    if (this.taglineInterval) clearInterval(this.taglineInterval);
    if (this.taglineFadeTimeout) clearTimeout(this.taglineFadeTimeout);
    this.webrtc.destroy();
    this.socket.disconnect();
  }

  selectPeer(peerId: string): void {
    if (this.webrtc.isTransferring()) {
      this.notifications.show('Espera a que termine la transferencia actual', 'warning');
      return;
    }

    const pending = this.pendingFile();
    if (pending) {
      void this.sendToPeer(peerId, pending);
      return;
    }

    this.selectedPeerId.set(this.selectedPeerId() === peerId ? null : peerId);
  }

  cancelPendingFile(): void {
    this.pendingFile.set(null);
    this.selectedPeerId.set(null);
  }

  startEditingName(): void {
    this.isEditingName.set(true);
  }

  commitDisplayName(value: string): void {
    const name = value.trim() || 'Usuario';
    this.displayName.set(name);
    this.isEditingName.set(false);
    if (this.isConnected()) {
      this.socket.retryConnection();
      this.notifications.show('Nombre actualizado', 'info', 2500);
    }
  }

  onNameKeydown(event: KeyboardEvent, input: HTMLInputElement): void {
    if (event.key === 'Enter') input.blur();
    if (event.key === 'Escape') this.isEditingName.set(false);
  }

  retryConnection(): void {
    this.socket.retryConnection();
  }

  openLibrary(): void {
    this.isLibraryOpen.set(true);
  }

  closeLibrary(): void {
    this.isLibraryOpen.set(false);
  }

  async installPwa(): Promise<void> {
    const installed = await this.pwa.install();
    if (installed) {
      this.notifications.show('ViaDrop instalada en tu dispositivo', 'success');
    }
  }

  dismissInstallBanner(): void {
    this.pwa.dismissInstallOffer();
  }

  triggerFileInput(input: HTMLInputElement): void {
    if (!this.guardConnection()) return;
    if (this.webrtc.isTransferring()) {
      this.notifications.show('Ya hay una transferencia en curso', 'warning');
      return;
    }
    input.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.queueOrSendFile(file);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    const files = event.dataTransfer?.files;
    if (!files?.length) return;
    if (files.length > 1) {
      this.notifications.show('Solo se envía un archivo a la vez', 'info', 3000);
    }
    this.queueOrSendFile(files[0]);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.canAcceptDrop()) {
      this.isDragOver.set(true);
    }
  }

  onDragLeave(event: DragEvent): void {
    const related = event.relatedTarget as Node | null;
    const current = event.currentTarget as Node;
    if (related && current.contains(related)) return;
    this.isDragOver.set(false);
  }

  onPageDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.canAcceptDrop()) {
      this.isDragOver.set(true);
    }
  }

  onPageDragLeave(event: DragEvent): void {
    const related = event.relatedTarget as Node | null;
    if (related && document.documentElement.contains(related)) return;
    this.isDragOver.set(false);
  }

  onPageDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    const files = event.dataTransfer?.files;
    if (!files?.length) return;
    if (files.length > 1) {
      this.notifications.show('Solo se envía un archivo a la vez', 'info', 3000);
    }
    this.queueOrSendFile(files[0]);
  }

  dismissToast(id: string): void {
    this.notifications.dismiss(id);
  }

  clearTransfer(): void {
    this.webrtc.clearTransfer();
  }

  retryTransfer(): void {
    this.notifications.show('Vuelve a seleccionar el archivo para reintentar', 'info');
    this.webrtc.clearTransfer();
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** i;
    return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
  }

  transferStatusLabel(transfer: FileTransferState): string {
    if (transfer.status === 'completed') {
      return transfer.direction === 'outgoing' ? 'Enviado' : 'Recibido';
    }
    if (transfer.status === 'error') return 'Error';
    if (transfer.status === 'pending') return 'Preparando';
    return transfer.direction === 'outgoing' ? 'Enviando' : 'Recibiendo';
  }

  peerInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  peerTransform(index: number, total: number, selected: boolean, choosing: boolean): string {
    const angle = (360 / total) * index;
    const radius = window.innerWidth < 520 ? 140 : Math.min(window.innerWidth * 0.36, 168);
    const scale = choosing ? 1.08 : selected ? 1.06 : 1;
    return `translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius}px) rotate(-${angle}deg) scale(${scale})`;
  }

  fileIcon(file: File): AppIconName {
    const type = file.type;
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    if (type.includes('pdf')) return 'document';
    if (type.includes('zip') || type.includes('compressed')) return 'archive';
    return 'document';
  }

  radarHint(): string | null {
    if (this.pendingFile() && this.peerCount() === 0 && this.isConnected()) {
      return 'Esperando dispositivos en tu red…';
    }
    if (this.selectedPeer() && !this.pendingFile()) {
      return `Listo para enviar a ${this.selectedPeer()!.displayName}`;
    }
    if (this.peerCount() === 0 && this.isConnected() && !this.pendingFile()) {
      return 'Buscando dispositivos cercanos en tu red…';
    }
    if (!this.isConnected() && this.connectionStatus() !== 'reconnecting') {
      return 'Conectando con el servidor…';
    }
    return null;
  }

  radarHintClasses(): string {
    const base = 'm-0 max-w-xs px-4 text-center text-sm leading-relaxed animate-fade-in';
    if (this.pendingFile() && this.peerCount() > 0) return `${base} font-medium text-apple-blue`;
    if (this.selectedPeer()) return `${base} text-apple-muted`;
    return `${base} text-apple-muted`;
  }

  toastClasses(tone: NotificationTone): string {
    const base =
      'glass pointer-events-auto px-4 py-2.5 rounded-full text-sm font-medium text-center cursor-pointer animate-toast-in transition-opacity hover:opacity-90';
    const tones: Record<NotificationTone, string> = {
      info: 'text-apple-text',
      success: 'border-apple-green/30 text-emerald-700',
      warning: 'border-apple-orange/35 text-amber-700',
      error: 'border-apple-red/30 text-red-700',
    };
    return `${base} ${tones[tone]}`;
  }

  radarClasses(): string {
    const base =
      'glass relative mx-auto grid aspect-square w-radar place-items-center rounded-full transition-all duration-500 ease-spring animate-fade-up-delayed';
    if (this.isTransferBusy()) return `${base} opacity-90 pointer-events-none`;
    if (this.isChoosingRecipient()) return `${base} scale-[1.02] border-apple-blue/50 shadow-glow animate-glow-pulse`;
    if (this.isDragOver()) return `${base} scale-105 shadow-glow border-apple-blue/45`;
    if (this.selectedPeerId()) return `${base} border-apple-blue/25`;
    return base;
  }

  peerButtonClasses(selected: boolean, choosing: boolean): string {
    const base =
      'absolute left-1/2 top-1/2 z-10 flex flex-col items-center gap-1.5 rounded-2xl border border-white/80 bg-white/55 px-2.5 py-2 backdrop-blur-md transition-all duration-500 ease-spring hover:bg-white/85 hover:shadow-lg animate-fade-up cursor-pointer';
    if (choosing) {
      return `${base} bg-white/90 ring-2 ring-apple-blue/40 shadow-peer-selected animate-peer-pulse hover:scale-105`;
    }
    return selected ? `${base} bg-white/95 ring-2 ring-apple-blue shadow-peer-selected` : base;
  }

  dropOverlayClasses(): string {
    return 'fixed inset-0 z-40 flex items-center justify-center bg-white/45 backdrop-blur-sm animate-fade-in pointer-events-none';
  }

  sendButtonClasses(): string {
    const base =
      'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-300 ease-spring sm:px-4 sm:text-sm';
    if (this.canPickFile()) {
      return `${base} bg-apple-blue text-white shadow-send-btn hover:-translate-y-px hover:shadow-send-btn-hover active:scale-95`;
    }
    return `${base} bg-black/5 text-apple-muted cursor-not-allowed opacity-70`;
  }

  transferSheetClasses(transfer: FileTransferState): string {
    const base =
      'glass fixed bottom-5 left-1/2 z-20 w-sheet -translate-x-1/2 rounded-4xl px-4 py-4 animate-sheet-up';
    if (transfer.status === 'error') return `${base} border-apple-red/25`;
    if (transfer.status === 'completed') return `${base} border-apple-green/25`;
    return base;
  }

  transferIconClasses(transfer: FileTransferState): string {
    const base = 'grid h-9 w-9 shrink-0 place-items-center rounded-full text-base font-semibold';
    if (transfer.status === 'completed') return `${base} bg-apple-green/15 text-apple-green animate-pop`;
    if (transfer.status === 'error') return `${base} bg-apple-red/10 text-apple-red`;
    if (transfer.status === 'transferring' || transfer.status === 'pending') {
      return `${base} bg-apple-blue/10 text-apple-blue animate-spin`;
    }
    return `${base} bg-apple-blue/10 text-apple-blue`;
  }

  progressBarClasses(transfer: FileTransferState): string {
    const base =
      'h-full rounded-full bg-gradient-to-r from-sky-400 to-apple-blue transition-all duration-300 ease-out';
    return transfer.status === 'error' ? `${base} !bg-apple-red` : base;
  }

  statusPillClasses(): string {
    const base =
      'inline-flex items-center gap-1 text-[0.65rem] font-medium px-2 py-1 rounded-full sm:text-xs sm:px-2.5';
    if (this.isConnected()) {
      return `${base} text-[#248a3d] bg-apple-green/10`;
    }
    if (this.isOffline()) {
      return `${base} text-amber-800 bg-amber-100/80`;
    }
    if (this.isReconnecting() || this.connectionStatus() === 'error') {
      return `${base} text-[#b25000] bg-apple-orange/10`;
    }
    return `${base} text-apple-muted bg-black/5`;
  }

  statusDotClasses(): string {
    if (this.isConnected()) {
      return 'w-1.5 h-1.5 rounded-full bg-apple-green shadow-[0_0_8px_rgba(52,199,89,0.6)]';
    }
    if (this.isOffline()) {
      return 'w-1.5 h-1.5 rounded-full bg-amber-500';
    }
    if (this.isReconnecting() || this.connectionStatus() === 'error') {
      return 'w-1.5 h-1.5 rounded-full bg-apple-orange animate-pulse-dot';
    }
    return 'w-1.5 h-1.5 rounded-full bg-black/20';
  }

  private queueOrSendFile(file: File): void {
    if (!this.guardConnection()) return;
    if (this.webrtc.isTransferring()) {
      this.notifications.show('Ya hay una transferencia en curso', 'warning');
      return;
    }
    if (file.size === 0) {
      this.notifications.show('El archivo está vacío', 'warning');
      return;
    }

    const peerId = this.selectedPeerId();
    if (peerId) {
      void this.sendToPeer(peerId, file);
      return;
    }

    if (this.peerCount() === 0) {
      this.notifications.show('Esperando dispositivos… suelta cuando aparezcan en el radar', 'info', 3500);
    }

    this.pendingFile.set(file);
    this.selectedPeerId.set(null);

    if (this.peerCount() > 0) {
      this.notifications.show('Archivo listo — toca un dispositivo en el radar', 'info', 3200);
    }
  }

  private async sendToPeer(peerId: string, file: File): Promise<void> {
    const peer = this.peers().find((p) => p.id === peerId);
    if (!peer) {
      this.notifications.show('El dispositivo ya no está disponible', 'error');
      this.pendingFile.set(null);
      return;
    }

    this.pendingFile.set(null);
    this.selectedPeerId.set(peerId);

    try {
      await this.webrtc.sendFile(peerId, file);
    } catch {
      // surfaced via notification + transfer panel
    }
  }

  private canAcceptDrop(): boolean {
    return this.guardConnection(false) && !this.webrtc.isTransferring();
  }

  private guardConnection(notify = true): boolean {
    if (this.isOffline()) {
      if (notify) this.notifications.show('Sin internet. Revisa tu biblioteca offline mientras tanto', 'info');
      return false;
    }
    if (!this.isConnected()) {
      if (notify) this.notifications.show('Sin conexión al servidor', 'error');
      return false;
    }
    return true;
  }

  headlineTaglineClasses(): string {
    const base =
      'm-0 min-h-[1.5rem] text-sm font-medium transition-opacity duration-300 sm:text-base';
    if (this.taglineVisible()) return `${base} text-apple-blue opacity-100 animate-tagline-in`;
    return `${base} text-apple-blue opacity-0`;
  }

  private advanceTagline(): void {
    if (this.pendingFile() || this.isDragOver() || this.isTransferBusy()) return;

    this.taglineVisible.set(false);
    this.taglineFadeTimeout = setTimeout(() => {
      this.taglineIndex.update((i) => (i + 1) % this.taglines.length);
      this.taglineAnimKey.update((k) => k + 1);
      this.taglineVisible.set(true);
    }, 280);
  }

  private readonly onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.pendingFile()) {
      this.cancelPendingFile();
    }
  };

  private generateDisplayName(): string {
    const names = ['Aurora', 'Nébula', 'Brisa', 'Eco', 'Lumen', 'Vértice', 'Pulso', 'Orbit'];
    return names[Math.floor(Math.random() * names.length)];
  }
}
