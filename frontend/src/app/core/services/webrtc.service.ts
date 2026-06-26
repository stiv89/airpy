import { Injectable, inject, signal } from '@angular/core';
import {
  FileControlPayload,
  FileMetaPayload,
  FileTransferState,
} from '../models/file-transfer.model';
import { ReceivedFilePreview } from '../models/received-file.model';
import { getPreviewKind } from '../utils/file-preview.util';
import { saveFileToDisk } from '../utils/file-download.util';
import { NotificationService } from './notification.service';
import { SocketService } from './socket.service';
import { TransferHistoryService } from './transfer-history.service';

const CHUNK_SIZE = 65536;
const CHANNEL_OPEN_TIMEOUT_MS = 30000;
const TEXT_PREVIEW_MAX_BYTES = 512_000;
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

@Injectable({ providedIn: 'root' })
export class WebRtcService {
  private readonly socket = inject(SocketService);
  private readonly notifications = inject(NotificationService);
  private readonly history = inject(TransferHistoryService);

  private readonly peerConnections = new Map<string, RTCPeerConnection>();
  private readonly peerNames = new Map<string, string>();
  private readonly iceCandidateQueues = new Map<string, RTCIceCandidateInit[]>();
  private initialized = false;
  private teardownHandlers: Array<() => void> = [];

  readonly activeTransfer = signal<FileTransferState | null>(null);
  readonly receivedFilePreview = signal<ReceivedFilePreview | null>(null);

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    this.teardownHandlers = [
      this.socket.onWebRtcOffer((payload) => {
        void this.handleOffer(payload.fromId, payload.fromName, payload.offer);
      }),
      this.socket.onWebRtcAnswer((payload) => {
        void this.handleAnswer(payload.fromId, payload.answer);
      }),
      this.socket.onWebRtcIceCandidate((payload) => {
        void this.handleIceCandidate(payload.fromId, payload.candidate);
      }),
      this.socket.onPeerLeft((peerId) => {
        this.handlePeerDisconnected(peerId);
      }),
      this.socket.onReconnect(() => {
        this.peerConnections.forEach((_, peerId) => this.closePeerConnection(peerId));
      }),
    ];
  }

  destroy(): void {
    this.teardownHandlers.forEach((teardown) => teardown());
    this.teardownHandlers = [];
    this.peerConnections.forEach((_, peerId) => this.closePeerConnection(peerId));
    this.dismissReceivedPreview();
    this.initialized = false;
  }

  isTransferring(): boolean {
    const transfer = this.activeTransfer();
    return transfer?.status === 'pending' || transfer?.status === 'transferring';
  }

  async sendFile(targetPeerId: string, file: File): Promise<void> {
    if (!this.socket.isConnected()) {
      throw new Error('Sin conexión al servidor');
    }

    if (this.isTransferring()) {
      throw new Error('Ya hay una transferencia en curso');
    }

    if (file.size === 0) {
      throw new Error('El archivo está vacío');
    }

    const peer = this.socket.peers().find((p) => p.id === targetPeerId);
    if (!peer) {
      throw new Error('El dispositivo ya no está disponible');
    }

    const peerName = peer.displayName;

    this.activeTransfer.set({
      peerId: targetPeerId,
      peerName,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      direction: 'outgoing',
      bytesTransferred: 0,
      progress: 0,
      status: 'pending',
    });

    try {
      this.closePeerConnection(targetPeerId);
      const pc = this.getOrCreatePeerConnection(targetPeerId, true);
      const channel = pc.createDataChannel('file-transfer', { ordered: true });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.sendOffer(targetPeerId, offer);

      await this.bindOutgoingChannel(channel, file);
      const transfer = this.activeTransfer();
      if (transfer) {
        void this.history.addOutgoing({
          fileName: transfer.fileName,
          fileSize: transfer.fileSize,
          mimeType: transfer.mimeType,
          peerName: transfer.peerName,
        });
      }
      this.notifications.show(`Enviado a ${peerName}`, 'success');
    } catch (error) {
      this.setTransferError(error);
      throw error;
    }
  }

  clearTransfer(): void {
    this.activeTransfer.set(null);
  }

  async downloadReceivedFile(): Promise<void> {
    const preview = this.receivedFilePreview();
    if (!preview) return;

    const blob = await fetch(preview.blobUrl).then((r) => r.blob());
    const result = await saveFileToDisk(blob, preview.fileName);

    if (!result) return;

    if (preview.historyId) {
      await this.history.markDownloaded(preview.historyId, result.location, result.label);
    }

    this.notifications.show(`Guardado en: ${result.label}`, 'success', 4500);
  }

  async downloadFromHistory(historyId: string, fileName: string): Promise<void> {
    const blob = await this.history.getBlob(historyId);
    if (!blob) {
      this.notifications.show('El archivo ya no está en la biblioteca', 'warning');
      return;
    }

    const result = await saveFileToDisk(blob, fileName);
    if (!result) return;

    await this.history.markDownloaded(historyId, result.location, result.label);
    this.notifications.show(`Guardado en: ${result.label}`, 'success', 4500);
  }

  async openPreviewFromHistory(historyId: string): Promise<void> {
    const record = this.history.records().find((r) => r.id === historyId);
    const blob = await this.history.getBlob(historyId);

    if (!record || !blob) {
      this.notifications.show('No se encontró el archivo en la biblioteca', 'warning');
      return;
    }

    this.openPreviewFromBlob(blob, {
      fileName: record.fileName,
      fileSize: record.fileSize,
      mimeType: record.mimeType,
      peerName: record.peerName,
      historyId,
    });
  }

  dismissReceivedPreview(): void {
    const preview = this.receivedFilePreview();
    if (preview) {
      URL.revokeObjectURL(preview.blobUrl);
    }
    this.receivedFilePreview.set(null);
  }

  private async handleOffer(
    fromId: string,
    fromName: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<void> {
    try {
      this.peerNames.set(fromId, fromName);
      this.closePeerConnection(fromId);
      const pc = this.getOrCreatePeerConnection(fromId, false);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await this.flushIceCandidates(fromId, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket.sendAnswer(fromId, answer);
    } catch {
      this.notifications.show('No se pudo aceptar la conexión entrante', 'error');
    }
  }

  private async handleAnswer(fromId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peerConnections.get(fromId);
    if (!pc) {
      return;
    }
    try {
      if (pc.signalingState !== 'have-local-offer') {
        return;
      }
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await this.flushIceCandidates(fromId, pc);
    } catch {
      this.setTransferError(
        new Error(
          'Error al negociar la conexión P2P. Prueba en la misma red WiFi o vuelve a enviar el archivo.',
        ),
      );
    }
  }

  private async handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(fromId);
    if (!pc || !candidate) {
      return;
    }

    if (!pc.remoteDescription) {
      const queue = this.iceCandidateQueues.get(fromId) ?? [];
      queue.push(candidate);
      this.iceCandidateQueues.set(fromId, queue);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // ICE candidates can arrive late; safe to ignore
    }
  }

  private async flushIceCandidates(peerId: string, pc: RTCPeerConnection): Promise<void> {
    const queued = this.iceCandidateQueues.get(peerId) ?? [];
    this.iceCandidateQueues.delete(peerId);

    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore stale candidates
      }
    }
  }

  private handlePeerDisconnected(peerId: string): void {
    const transfer = this.activeTransfer();
    if (transfer?.peerId === peerId && transfer.status !== 'completed') {
      this.setTransferError(new Error('El dispositivo se desconectó durante la transferencia'));
      this.notifications.show('Dispositivo desconectado', 'warning');
    }
    this.closePeerConnection(peerId);
  }

  private getOrCreatePeerConnection(peerId: string, initiator: boolean): RTCPeerConnection {
    const existing = this.peerConnections.get(peerId);
    if (existing && existing.connectionState !== 'closed') {
      return existing;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.sendIceCandidate(peerId, event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        this.handlePeerDisconnected(peerId);
        this.setTransferError(
          new Error(
            'No se pudo conectar P2P. Usa la misma red WiFi en ambos dispositivos e inténtalo de nuevo.',
          ),
        );
      }
      if (pc.connectionState === 'closed') {
        this.closePeerConnection(peerId);
      }
    };

    if (!initiator) {
      pc.ondatachannel = (event) => {
        const fromName = this.peerNames.get(peerId) ?? 'Dispositivo';
        this.bindIncomingChannel(event.channel, peerId, fromName);
      };
    }

    this.peerConnections.set(peerId, pc);
    return pc;
  }

  private bindOutgoingChannel(channel: RTCDataChannel, file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tiempo de espera agotado al conectar con el dispositivo'));
      }, CHANNEL_OPEN_TIMEOUT_MS);

      channel.onopen = () => {
        clearTimeout(timeout);
        this.patchTransfer({ status: 'transferring', bytesTransferred: 0, progress: 0 });

        const meta = {
          type: 'meta' as const,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
        };

        channel.send(JSON.stringify(meta));
        void this.pumpChunks(channel, file)
          .then(() => {
            this.patchTransfer({
              status: 'completed',
              bytesTransferred: file.size,
              progress: 100,
            });
            resolve();
          })
          .catch((error) => {
            this.setTransferError(error);
            reject(error);
          });
      };

      channel.onclose = () => {
        clearTimeout(timeout);
        const transfer = this.activeTransfer();
        if (transfer?.direction === 'outgoing' && transfer.status === 'transferring') {
          this.setTransferError(new Error('La conexión se cerró antes de completar el envío'));
          reject(new Error('Canal cerrado'));
        }
      };

      channel.onerror = () => {
        clearTimeout(timeout);
        const error = new Error('Error en el canal de datos');
        this.setTransferError(error);
        reject(error);
      };
    });
  }

  private bindIncomingChannel(channel: RTCDataChannel, peerId: string, peerName: string): void {
    const chunks: Uint8Array[] = [];
    let received = 0;
    let meta: FileMetaPayload | null = null;

    channel.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
      if (typeof event.data === 'string') {
        try {
          const message = JSON.parse(event.data) as FileControlPayload;

          if (message.type === 'meta') {
            meta = message;
            this.activeTransfer.set({
              peerId,
              peerName,
              fileName: message.fileName,
              fileSize: message.fileSize,
              mimeType: message.mimeType,
              direction: 'incoming',
              bytesTransferred: 0,
              progress: 0,
              status: 'transferring',
            });
          }

          if (message.type === 'done' && meta) {
            void this.stageReceivedPreview(chunks, meta, peerName);
            this.activeTransfer.set(null);
          }
        } catch {
          this.setTransferError(new Error('Datos de archivo corruptos'));
        }
        return;
      }

      const chunk = new Uint8Array(event.data as ArrayBuffer);
      chunks.push(chunk);
      received += chunk.byteLength;

      const fileSize = meta?.fileSize ?? received;
      const progress = fileSize > 0 ? Math.min(100, Math.round((received / fileSize) * 100)) : 0;

      this.patchTransfer({
        bytesTransferred: received,
        progress,
        status: 'transferring',
      });
    };

    channel.onerror = () => {
      this.setTransferError(new Error('Error al recibir el archivo'));
    };

    channel.onclose = () => {
      const transfer = this.activeTransfer();
      if (transfer?.direction === 'incoming' && transfer.status === 'transferring') {
        this.setTransferError(new Error('La transferencia se interrumpió'));
      }
    };
  }

  private async pumpChunks(channel: RTCDataChannel, file: File): Promise<void> {
    let offset = 0;

    while (offset < file.size) {
      if (channel.readyState !== 'open') {
        throw new Error('Canal de datos cerrado inesperadamente');
      }

      if (channel.bufferedAmount > CHUNK_SIZE * 8) {
        await this.waitForBufferDrain(channel);
      }

      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await slice.arrayBuffer();
      channel.send(buffer);
      offset += buffer.byteLength;

      const progress = file.size > 0 ? Math.min(100, Math.round((offset / file.size) * 100)) : 100;
      this.patchTransfer({
        bytesTransferred: offset,
        progress,
        status: 'transferring',
      });
    }

    channel.send(JSON.stringify({ type: 'done' }));
  }

  private waitForBufferDrain(channel: RTCDataChannel): Promise<void> {
    return new Promise((resolve, reject) => {
      let elapsed = 0;
      const maxWait = 60000;

      const check = (): void => {
        if (channel.readyState !== 'open') {
          reject(new Error('Canal de datos cerrado'));
          return;
        }
        if (channel.bufferedAmount <= CHUNK_SIZE * 2) {
          resolve();
          return;
        }
        elapsed += 50;
        if (elapsed >= maxWait) {
          reject(new Error('El dispositivo receptor no responde'));
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });
  }

  private async stageReceivedPreview(
    chunks: Uint8Array[],
    meta: FileMetaPayload,
    peerName: string,
  ): Promise<void> {
    try {
      this.dismissReceivedPreview();

      const blob = new Blob(chunks, { type: meta.mimeType });
      const historyId = await this.history.addIncoming(blob, {
        fileName: meta.fileName,
        fileSize: meta.fileSize,
        mimeType: meta.mimeType,
        peerName,
      });

      this.openPreviewFromBlob(blob, {
        fileName: meta.fileName,
        fileSize: meta.fileSize,
        mimeType: meta.mimeType,
        peerName,
        historyId,
      });

      this.notifications.show(`Archivo de ${peerName} guardado en tu biblioteca`, 'info', 3500);
    } catch {
      this.setTransferError(new Error('No se pudo preparar la vista previa del archivo'));
    }
  }

  private openPreviewFromBlob(
    blob: Blob,
    meta: {
      fileName: string;
      fileSize: number;
      mimeType: string;
      peerName: string;
      historyId?: string;
    },
  ): void {
    const blobUrl = URL.createObjectURL(blob);
    const previewKind = getPreviewKind(meta.mimeType, meta.fileName);

    const preview: ReceivedFilePreview = {
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      mimeType: meta.mimeType,
      peerName: meta.peerName,
      blobUrl,
      previewKind,
      textContent: null,
      historyId: meta.historyId,
    };

    this.receivedFilePreview.set(preview);

    if (previewKind === 'text' && meta.fileSize <= TEXT_PREVIEW_MAX_BYTES) {
      void blob.text().then((text) => {
        this.receivedFilePreview.update((current) =>
          current?.blobUrl === blobUrl
            ? { ...current, textContent: text.slice(0, 50_000) }
            : current,
        );
      });
    }
  }

  private patchTransfer(patch: Partial<FileTransferState>): void {
    this.activeTransfer.update((current) => (current ? { ...current, ...patch } : current));
  }

  private setTransferError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'La transferencia falló';
    this.patchTransfer({ status: 'error', errorMessage: message });
    this.notifications.show(message, 'error', 6000);
  }

  private closePeerConnection(peerId: string): void {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    this.peerNames.delete(peerId);
    this.iceCandidateQueues.delete(peerId);
  }
}
