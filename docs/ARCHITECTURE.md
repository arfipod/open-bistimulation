# Arquitectura

## Resumen

```txt
Vercel SPA React/Vite
        │
        ├── Supabase RPC → Postgres
        │       ├── sessions
        │       └── tactile_devices
        │
        └── Supabase Realtime Broadcast
                └── channel: session:{sessionId}
```

No hay servidor Node propio en el MVP.

## Roles

### Terapeuta

Ruta:

```txt
/session/:sessionId/therapist?t=:therapistToken
```

Puede:

- modificar configuración visual,
- modificar configuración auditiva,
- modificar configuración táctil,
- start/pause/resume/stop,
- guardar preferencias,
- finalizar sesión,
- copiar enlace de cliente.

### Cliente

Ruta:

```txt
/session/:sessionId/client?t=:clientToken
```

Puede:

- ver la estimulación,
- activar audio,
- abrir pantalla completa,
- generar QR para móviles táctiles.

No puede modificar la sesión.

### Móvil táctil

Ruta:

```txt
/session/:sessionId/tactile/:side?t=:clientToken
```

`side` puede ser:

```txt
left
right
```

Puede:

- vincularse,
- declarar soporte/no soporte de vibración,
- escuchar pulsos táctiles,
- vibrar cuando recibe su lado.

## Estado de sesión

El estado principal vive en `sessions.state` como JSONB:

```ts
type SessionState = {
  version: number;
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'ended';
  startedAtMs: number | null;
  pausedAtMs: number | null;
  elapsedBeforePauseMs: number;
  setsCompleted: number;
  visual: VisualSettings;
  audio: AudioSettings;
  tactile: TactileSettings;
};
```

## Realtime

Todos los participantes se suscriben a:

```txt
session:${sessionId}
```

Evento Broadcast:

```txt
bls
```

Tipos de mensajes:

```txt
STATE_UPDATED
CLIENT_READY
TACTILE_DEVICE_READY
TACTILE_DEVICE_HEARTBEAT
TACTILE_PULSE
SESSION_ENDED
```

## Por qué no se transmiten coordenadas

Enviar la posición de la bola cada frame multiplicaría mensajes y generaría jitter. En su lugar, el terapeuta envía parámetros y comandos. Cada navegador calcula:

```txt
elapsed = nowServidorEstimado - startedAtMs + elapsedBeforePauseMs
phase = elapsed / cycleMs * 2π
```

La posición sale de fórmulas deterministas por dirección.

## Movimiento

Horizontal:

```txt
x = centerX + ampX * sin(phase)
y = fixedY
```

Vertical:

```txt
x = centerX
y = centerY + ampY * sin(phase)
```

Diagonal:

```txt
x = centerX + ampX * sin(phase)
y = centerY + ampY * sin(phase)
```

Infinito:

```txt
x = centerX + ampX * sin(phase)
y = centerY + ampY * sin(phase) * cos(phase)
```

## Audio

El audio se genera con Web Audio API. Cada cambio de medio ciclo dispara un sonido paneado:

```txt
left  -> StereoPannerNode.pan = -1
right -> StereoPannerNode.pan = 1
```

## Táctil

El terapeuta emite `TACTILE_PULSE` en cada medio ciclo si `state.tactile.enabled` está activo. Cada móvil filtra por `side`.
