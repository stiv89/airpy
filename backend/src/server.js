import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';

const PORT = Number(process.env.PORT ?? 3000);

function parseOrigins(value) {
  return (value ?? 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const CLIENT_ORIGINS = parseOrigins(process.env.CLIENT_ORIGIN);
const ALLOW_VERCEL = process.env.ALLOW_VERCEL !== 'false';
const ALLOWED_DOMAINS = parseOrigins(process.env.ALLOWED_DOMAINS ?? 'viadrop.lat');

function hostnameMatchesDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function isOriginAllowed(origin) {
  if (!origin) return true;

  if (CLIENT_ORIGINS.includes(origin)) return true;

  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (ALLOW_VERCEL && hostname.endsWith('.vercel.app')) return true;
    if (ALLOWED_DOMAINS.some((domain) => hostnameMatchesDomain(hostname, domain))) return true;
  } catch {
    return false;
  }

  return false;
}

function corsOriginCallback(origin, callback) {
  if (isOriginAllowed(origin)) {
    callback(null, true);
    return;
  }
  console.warn(`CORS blocked for origin: ${origin}`);
  callback(null, false);
}

const app = express();
app.set('trust proxy', 1);
app.use(
  cors({
    origin: corsOriginCallback,
  }),
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: corsOriginCallback,
    methods: ['GET', 'POST'],
  },
  transports: ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

/** @type {Map<string, Map<string, { id: string; displayName: string; deviceId: string }>>} */
const rooms = new Map();

function resolveClientIp(socket) {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return socket.handshake.address.replace('::ffff:', '');
}

function getRoomPeers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.values()).map(({ id, displayName }) => ({ id, displayName }));
}

function removePeer(roomId, socketId, deviceId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const entry = room.get(deviceId);
  if (entry?.id === socketId) {
    room.delete(deviceId);
  }

  if (room.size === 0) {
    rooms.delete(roomId);
  }
}

function broadcastPeers(roomId) {
  const peers = getRoomPeers(roomId);
  io.to(roomId).emit('peers-updated', peers);
}

io.on('connection', (socket) => {
  const roomId = resolveClientIp(socket);
  const displayName = socket.handshake.query.displayName?.toString().trim() || 'Anónimo';
  const deviceId = socket.handshake.query.deviceId?.toString().trim() || socket.id;

  socket.data.roomId = roomId;
  socket.data.displayName = displayName;
  socket.data.deviceId = deviceId;

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }

  const room = rooms.get(roomId);
  const previous = room.get(deviceId);
  const isNewDevice = !previous;

  if (previous && previous.id !== socket.id) {
    const oldSocket = io.sockets.sockets.get(previous.id);
    oldSocket?.disconnect(true);
  }

  room.set(deviceId, { id: socket.id, displayName, deviceId });

  socket.join(roomId);

  socket.emit('room-joined', {
    roomId,
    selfId: socket.id,
    peers: getRoomPeers(roomId).filter((p) => p.id !== socket.id),
  });

  if (isNewDevice) {
    socket.to(roomId).emit('peer-joined', { id: socket.id, displayName });
  }

  broadcastPeers(roomId);

  socket.on('webrtc-offer', ({ targetId, offer }) => {
    io.to(targetId).emit('webrtc-offer', {
      fromId: socket.id,
      fromName: socket.data.displayName,
      offer,
    });
  });

  socket.on('webrtc-answer', ({ targetId, answer }) => {
    io.to(targetId).emit('webrtc-answer', {
      fromId: socket.id,
      answer,
    });
  });

  socket.on('webrtc-ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('webrtc-ice-candidate', {
      fromId: socket.id,
      candidate,
    });
  });

  socket.on('disconnect', () => {
    const { roomId: rid, deviceId } = socket.data;
    removePeer(rid, socket.id, deviceId);
    socket.to(rid).emit('peer-left', { id: socket.id });
    broadcastPeers(rid);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Signaling server listening on http://localhost:${PORT}`);
});
