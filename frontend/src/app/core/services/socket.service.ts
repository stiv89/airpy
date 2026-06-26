import { Injectable, computed, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { Peer } from '../models/peer.model';
import { NotificationService } from './notification.service';
import { ConnectivityService } from './connectivity.service';
import { getDeviceId } from '../utils/device-id.util';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'offline';

export interface RoomJoinedPayload {
  roomId: string;
  selfId: string;
  peers: Peer[];
}

export interface WebRtcOfferPayload {
  fromId: string;
  fromName: string;
  offer: RTCSessionDescriptionInit;
}

export interface WebRtcAnswerPayload {
  fromId: string;
  answer: RTCSessionDescriptionInit;
}

export interface WebRtcIceCandidatePayload {
  fromId: string;
  candidate: RTCIceCandidateInit;
}

@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly notifications = inject(NotificationService);
  private readonly connectivity = inject(ConnectivityService);

  private socket: Socket | null = null;
  private lastDisplayName = 'Usuario';
  private manualDisconnect = false;

  private readonly offerHandlers = new Set<(payload: WebRtcOfferPayload) => void>();
  private readonly answerHandlers = new Set<(payload: WebRtcAnswerPayload) => void>();
  private readonly iceCandidateHandlers = new Set<(payload: WebRtcIceCandidatePayload) => void>();
  private readonly peerLeftHandlers = new Set<(peerId: string) => void>();
  private readonly reconnectHandlers = new Set<() => void>();

  readonly connectionStatus = signal<ConnectionStatus>('disconnected');
  readonly connectionError = signal<string | null>(null);
  readonly selfId = signal<string | null>(null);
  readonly roomId = signal<string | null>(null);
  readonly peers = signal<Peer[]>([]);

  readonly isConnected = computed(() => this.connectionStatus() === 'connected');
  readonly isReconnecting = computed(() => this.connectionStatus() === 'reconnecting');

  connect(displayName: string): void {
    this.lastDisplayName = displayName.trim() || 'Usuario';
    this.manualDisconnect = false;

    if (this.connectivity.isOffline()) {
      this.connectionStatus.set('offline');
      this.connectionError.set(
        'Sin internet. Puedes usar la biblioteca offline; las transferencias se reanudan al conectar.',
      );
      return;
    }

    if (this.socket?.connected) {
      return;
    }

    void this.openSocket();
  }

  private async openSocket(): Promise<void> {
    this.teardownSocket();
    this.connectionStatus.set('connecting');
    this.connectionError.set(null);

    if (environment.production) {
      this.connectionError.set('Despertando servidor… (plan gratis, puede tardar ~1 min)');
      await this.wakeSignalingServer();
    }

    this.socket = io(environment.signalingUrl, {
      query: { displayName: this.lastDisplayName, deviceId: getDeviceId() },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1200,
      reconnectionDelayMax: 8000,
      timeout: 60000,
    });

    this.bindSocketEvents();
  }

  private bindSocketEvents(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      const wasReconnecting = this.connectionStatus() === 'reconnecting';
      this.connectionStatus.set('connected');
      this.connectionError.set(null);

      if (wasReconnecting) {
        this.notifications.show('Conexión restablecida', 'success');
        this.reconnectHandlers.forEach((handler) => handler());
      }
    });

    this.socket.io.on('reconnect_attempt', () => {
      if (this.connectivity.isOffline()) {
        this.connectionStatus.set('offline');
        this.connectionError.set('Sin internet. Reintentaremos cuando vuelvas en línea.');
        return;
      }
      this.connectionStatus.set('reconnecting');
      this.connectionError.set('Reconectando con el servidor…');
    });

    this.socket.on('connect_error', () => {
      if (this.manualDisconnect) return;

      if (this.connectivity.isOffline()) {
        this.connectionStatus.set('offline');
        this.connectionError.set('Sin internet. La app sigue disponible offline.');
        return;
      }

      this.connectionStatus.set('reconnecting');
      this.connectionError.set('Servidor no disponible. Reintentando… (el plan gratis puede tardar ~1 min)');
    });

    this.socket.on('disconnect', (reason) => {
      this.peers.set([]);

      if (this.manualDisconnect) {
        this.connectionStatus.set('disconnected');
        return;
      }

      if (this.connectivity.isOffline()) {
        this.connectionStatus.set('offline');
        this.connectionError.set('Sin internet. Tu biblioteca local sigue disponible.');
        return;
      }

      if (reason === 'io server disconnect') {
        this.connectionStatus.set('error');
        this.connectionError.set('El servidor cerró la conexión');
        this.notifications.show('Sesión finalizada por el servidor', 'warning');
        return;
      }

      this.connectionStatus.set('reconnecting');
      this.connectionError.set('Conexión perdida. Reintentando…');
    });

    this.socket.on('room-joined', (payload: RoomJoinedPayload) => {
      this.selfId.set(payload.selfId);
      this.roomId.set(payload.roomId);
      this.peers.set(payload.peers);
    });

    this.socket.on('peers-updated', (peers: Peer[]) => {
      const id = this.selfId();
      this.peers.set(id ? peers.filter((peer) => peer.id !== id) : peers);
    });

    this.socket.on('peer-joined', ({ displayName: name }: { id: string; displayName: string }) => {
      this.notifications.show(`${name} se unió a la red`, 'info', 3000);
    });

    this.socket.on('peer-left', ({ id }: { id: string }) => {
      this.peers.update((current) => current.filter((peer) => peer.id !== id));
      this.peerLeftHandlers.forEach((handler) => handler(id));
    });

    this.socket.on('webrtc-offer', (payload: WebRtcOfferPayload) => {
      this.offerHandlers.forEach((handler) => handler(payload));
    });

    this.socket.on('webrtc-answer', (payload: WebRtcAnswerPayload) => {
      this.answerHandlers.forEach((handler) => handler(payload));
    });

    this.socket.on('webrtc-ice-candidate', (payload: WebRtcIceCandidatePayload) => {
      this.iceCandidateHandlers.forEach((handler) => handler(payload));
    });
  }

  private async wakeSignalingServer(): Promise<void> {
    const deadline = Date.now() + 90_000;

    while (Date.now() < deadline) {
      if (this.manualDisconnect || this.connectivity.isOffline()) return;

      try {
        const response = await fetch(`${environment.signalingUrl}/health`, {
          method: 'GET',
          cache: 'no-store',
        });
        if (response.ok) return;
      } catch {
        // Render free tier puede responder 504 mientras despierta
      }

      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
  }

  retryConnection(): void {
    if (this.connectivity.isOffline()) {
      this.connectionStatus.set('offline');
      this.connectionError.set('Sin internet. Intenta de nuevo cuando tengas conexión.');
      return;
    }
    this.connect(this.lastDisplayName);
  }

  resumeWhenOnline(): void {
    if (this.manualDisconnect || this.connectivity.isOffline()) return;
    if (!this.isConnected()) {
      this.connect(this.lastDisplayName);
    }
  }

  disconnect(): void {
    this.manualDisconnect = true;
    this.teardownSocket();
    this.connectionStatus.set('disconnected');
    this.connectionError.set(null);
    this.selfId.set(null);
    this.roomId.set(null);
    this.peers.set([]);
  }

  sendOffer(targetId: string, offer: RTCSessionDescriptionInit): void {
    if (!this.socket?.connected) {
      throw new Error('Sin conexión al servidor');
    }
    this.socket.emit('webrtc-offer', { targetId, offer });
  }

  sendAnswer(targetId: string, answer: RTCSessionDescriptionInit): void {
    if (!this.socket?.connected) {
      throw new Error('Sin conexión al servidor');
    }
    this.socket.emit('webrtc-answer', { targetId, answer });
  }

  sendIceCandidate(targetId: string, candidate: RTCIceCandidateInit): void {
    this.socket?.emit('webrtc-ice-candidate', { targetId, candidate });
  }

  onWebRtcOffer(handler: (payload: WebRtcOfferPayload) => void): () => void {
    this.offerHandlers.add(handler);
    return () => this.offerHandlers.delete(handler);
  }

  onWebRtcAnswer(handler: (payload: WebRtcAnswerPayload) => void): () => void {
    this.answerHandlers.add(handler);
    return () => this.answerHandlers.delete(handler);
  }

  onWebRtcIceCandidate(handler: (payload: WebRtcIceCandidatePayload) => void): () => void {
    this.iceCandidateHandlers.add(handler);
    return () => this.iceCandidateHandlers.delete(handler);
  }

  onPeerLeft(handler: (peerId: string) => void): () => void {
    this.peerLeftHandlers.add(handler);
    return () => this.peerLeftHandlers.delete(handler);
  }

  onReconnect(handler: () => void): () => void {
    this.reconnectHandlers.add(handler);
    return () => this.reconnectHandlers.delete(handler);
  }

  private teardownSocket(): void {
    if (!this.socket) {
      return;
    }
    this.socket.removeAllListeners();
    this.socket.io.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
  }
}
