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

function isOriginAllowed(origin) {
  if (!origin) return true;
  return CLIENT_ORIGINS.includes(origin);
}

const app = express();
app.set('trust proxy', 1);
app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  }),
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGINS,
    methods: ['GET', 'POST'],
  },
  transports: ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

/** @type {Map<string, Map<string, { id: string; displayName: string }>>} */
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
  return Array.from(room.values());
}

function broadcastPeers(roomId) {
  const peers = getRoomPeers(roomId);
  io.to(roomId).emit('peers-updated', peers);
}

io.on('connection', (socket) => {
  const roomId = resolveClientIp(socket);
  const displayName = socket.handshake.query.displayName?.toString().trim() || 'Anónimo';

  socket.data.roomId = roomId;
  socket.data.displayName = displayName;

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  rooms.get(roomId).set(socket.id, { id: socket.id, displayName });

  socket.join(roomId);

  socket.emit('room-joined', {
    roomId,
    selfId: socket.id,
    peers: getRoomPeers(roomId).filter((p) => p.id !== socket.id),
  });

  socket.to(roomId).emit('peer-joined', { id: socket.id, displayName });
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
    const { roomId: rid } = socket.data;
    const room = rooms.get(rid);
    if (room) {
      room.delete(socket.id);
      if (room.size === 0) {
        rooms.delete(rid);
      }
    }
    socket.to(rid).emit('peer-left', { id: socket.id });
    broadcastPeers(rid);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Signaling server listening on http://localhost:${PORT}`);
});
