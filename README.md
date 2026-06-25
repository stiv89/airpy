# Viadrop — Snapdrop Clone

Clon funcional de [Snapdrop](https://snapdrop.net) para transferencia de archivos P2P en la misma red local.

**Viadrop** — diseñado y desarrollado por [Esteban Jara](https://www.estebanjara.com/).

## Arquitectura

```
┌─────────────┐     WebSocket (signaling)     ┌─────────────┐
│  Angular    │◄───────────────────────────►│  Node.js    │
│  Frontend   │                             │  Backend    │
└──────┬──────┘                             └─────────────┘
       │                                           │
       │         WebRTC Data Channel (P2P)         │
       └───────────────────────────────────────────┘
                    (archivos en chunks)
```

- **Backend:** agrupa clientes por IP pública en "salas" y reenvía ofertas/respuestas/ICE de WebRTC.
- **Frontend:** establece conexión P2P con `RTCPeerConnection` + `RTCDataChannel`, segmenta archivos en chunks de 64 KB y muestra progreso con Angular Signals.

## Requisitos

- Node.js 20+ (LTS recomendado)
- npm 10+

## Estructura del monorepo

```
airpy/
├── backend/          # Servidor de señalización
│   ├── src/server.js
│   └── package.json
└── frontend/         # Cliente Angular
    └── src/app/
        ├── core/
        │   ├── models/
        │   └── services/
        └── features/dashboard/
```

## Configuración

### Backend

```bash
cd backend
cp .env.example .env
npm install
```

Variables en `.env`:

| Variable        | Descripción              | Valor dev                 |
|-----------------|--------------------------|---------------------------|
| `PORT`          | Puerto del servidor      | `3000`                    |
| `CLIENT_ORIGIN` | Origen CORS del frontend | `http://localhost:4200`   |

### Frontend

```bash
cd frontend
npm install
```

Edita `src/environments/environment.ts` si el backend corre en otro host/puerto:

```typescript
export const environment = {
  production: false,
  signalingUrl: 'http://localhost:3000',
};
```

## Ejecución en desarrollo

**Terminal 1 — Backend:**

```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**

```bash
cd frontend
ng serve
```

Abre `http://localhost:4200` en **dos pestañas o navegadores** en la misma máquina para probar la transferencia.

## Cómo probar la transferencia P2P

1. Abre la app en dos pestañas; ambas comparten IP → misma sala.
2. Verás los peers en el radar circular.
3. Haz clic en un peer para seleccionarlo.
4. Arrastra un archivo al radar o usa **Seleccionar archivo**.
5. El receptor verá la barra de progreso y la descarga automática al completar.

## Stack técnico

| Capa       | Tecnología                                      |
|------------|-------------------------------------------------|
| Frontend   | Angular 19, Standalone Components, Signals, Material |
| Backend    | Node.js, Express, Socket.io                     |
| P2P        | WebRTC (`RTCPeerConnection`, `RTCDataChannel`)  |
| Estado UI  | Angular Signals (OnPush en todos los componentes) |

## Despliegue (portfolio)

1. **Backend:** Railway, Render o Fly.io con HTTPS.
2. **Frontend:** Vercel o Netlify.
3. Actualiza `environment.prod.ts` con la URL del signaling.
4. Configura `CLIENT_ORIGIN` en el backend al dominio del frontend.
5. El servidor ya incluye `trust proxy` para leer `x-forwarded-for` detrás de un reverse proxy.

## Limitaciones conocidas

- Sin servidor TURN, la conexión P2P puede fallar entre redes NAT simétricas distintas.
- En producción, WebRTC requiere contexto HTTPS.
- La agrupación por IP pública simula "misma red local"; en localhost todos los clientes comparten sala.

## Licencia

MIT
