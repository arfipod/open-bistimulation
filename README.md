# Open Binstimulation

MVP open-source para sesiones remotas de estimulación bilateral controladas por terapeuta.

El proyecto está pensado para arrancar con coste cero usando:

- **Frontend:** React + TypeScript + Vite.
- **Hosting:** Vercel, como aplicación estática SPA.
- **Backend:** Supabase Free, usando Postgres + funciones RPC + Supabase Realtime Broadcast.
- **Táctil inicial:** dos móviles auxiliares vinculados por QR y vibración con `navigator.vibrate()`.

> Aviso: este repositorio es un MVP técnico. No es una herramienta clínica certificada ni sustituye criterio profesional, consentimiento informado, evaluación de seguridad ni validación terapéutica.

## Funcionalidades incluidas

### Sesión remota

- Crear sesión desde `/`.
- Panel de terapeuta en `/session/:sessionId/therapist?t=:therapistToken`.
- Vista de cliente en `/session/:sessionId/client?t=:clientToken`.
- Canal Realtime por sesión: `session:${sessionId}`.
- Tokens separados para terapeuta y cliente.
- Expiración de sesión por defecto: 24 horas.

### Visual

- Activar/desactivar estímulo visual.
- Color de bola.
- Color de fondo.
- Tamaño.
- Velocidad.
- Posición vertical: arriba, centro, abajo.
- Direcciones:
  - horizontal,
  - vertical,
  - diagonal,
  - infinito.

### Auditivo

- Activar/desactivar audio.
- Sonidos sintéticos:
  - finger snap,
  - beep,
  - soft bell,
  - heartbeat.
- Volumen.
- Silenciar para terapeuta.
- Paneo estéreo izquierda/derecha mediante Web Audio API.

### Táctil con móviles

- El cliente muestra QR para móvil izquierdo y móvil derecho.
- Cada móvil abre `/session/:sessionId/tactile/:side?t=:clientToken`.
- Cada móvil se vincula a la sesión y escucha pulsos táctiles.
- Si el navegador soporta Vibration API, vibra sólo cuando recibe el pulso de su lado.
- Botón de prueba de vibración.

### Controles premium incluidos en el MVP

- Pausa.
- Reanudación.
- Guardado de preferencias local y en Supabase para la sesión.

## Estructura del repositorio

```txt
open-binstimulation/
  src/
    app/                 Router SPA simple
    components/          Paneles, QR, controles y estímulo visual
    domain/              Tipos, defaults, movimiento y audio
    hooks/               Realtime, reloj servidor, audio, táctil
    lib/                 Supabase, RPC, localStorage y URLs
    pages/               Landing, terapeuta, cliente y móvil táctil
    styles/              CSS global
  supabase/
    schema.sql           Tablas, RLS y funciones RPC
  docs/
    ARCHITECTURE.md
    SUPABASE_SETUP.md
    VERCEL_DEPLOY.md
    TACTILE_MOBILE.md
    SECURITY.md
    ROADMAP.md
    QA_CHECKLIST.md
```

## Puesta en marcha local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear proyecto Supabase

1. Crea un proyecto en Supabase.
2. Ve a **SQL Editor**.
3. Crea una nueva query.
4. Copia y ejecuta el contenido de:

```txt
supabase/schema.sql
```

Más detalle en [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

### 3. Configurar variables de entorno

Copia el ejemplo:

```bash
cp .env.example .env.local
```

Rellena:

```bash
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_SUPABASE_ANON_KEY
```

Estos valores están en Supabase Dashboard → Project Settings → API.

### 4. Ejecutar en local

```bash
npm run dev
```

Abre:

```txt
http://localhost:5173
```

### 5. Probar una sesión completa

1. Pulsa **Crear sesión BLS**.
2. Se abrirá el panel del terapeuta.
3. Copia el enlace de cliente o pulsa **Previsualizar cliente**.
4. En la vista de cliente, pulsa **Activar audio** si quieres probar sonido.
5. Pulsa **QR táctil** para mostrar los QR de móviles.
6. Escanea cada QR con un móvil Android compatible.
7. En cada móvil, pulsa **Activar vibración**.
8. En el terapeuta, activa Táctil e inicia la BLS.

## Deploy en Vercel

El repo incluye `vercel.json` con:

- framework: `vite`,
- build command: `npm run build`,
- output directory: `dist`,
- rewrite SPA hacia `index.html`.

Pasos resumidos:

1. Sube este repo a GitHub.
2. En Vercel, importa el proyecto.
3. Framework preset: **Vite**.
4. Añade las variables de entorno:
   - `VITE_SUPABASE_URL`,
   - `VITE_SUPABASE_ANON_KEY`.
5. Deploy.

Más detalle en [docs/VERCEL_DEPLOY.md](docs/VERCEL_DEPLOY.md).

## Scripts disponibles

```bash
npm run dev        # servidor local Vite
npm run build      # typecheck + build de producción
npm run preview    # previsualizar dist localmente
npm run typecheck  # sólo TypeScript
```

## Notas técnicas importantes

### No se transmite la posición cada frame

El terapeuta no envía coordenadas de la bola 60 veces por segundo. Sólo se transmite estado paramétrico:

- start,
- pause,
- resume,
- stop,
- velocidad,
- dirección,
- color,
- fondo,
- audio,
- táctil.

Cada navegador calcula localmente la posición con `requestAnimationFrame`.

### Reloj servidor

El frontend llama a la RPC `get_server_time_ms()` para estimar el desfase entre reloj local y servidor Supabase. Los comandos start/resume usan timestamp de servidor para mejorar sincronía.

### Audio y vibración requieren interacción del usuario

Los navegadores suelen bloquear audio/vibración automática hasta que el usuario pulse un botón. Por eso existen botones de **Activar audio** y **Activar vibración**.

### Compatibilidad táctil

`navigator.vibrate()` no está disponible en todos los navegadores. El MVP está pensado principalmente para móviles Android con Chrome o Samsung Internet. iOS/Safari no debe considerarse fiable para esta parte.

## Limitaciones actuales

- No hay autenticación de usuario final.
- Los enlaces contienen tokens; trátalos como secretos.
- Realtime Broadcast usa canales públicos con identificadores de sesión aleatorios. Es suficiente para un MVP privado, pero no para producto clínico público sin endurecimiento adicional.
- No guardar información clínica sensible en el estado de sesión.
- El táctil por móvil tendrá más latencia que hardware dedicado USB/BLE.
- El audio es sintético; no usa una librería profesional de muestras.

## Próximos hitos recomendados

1. Añadir Supabase Auth para terapeutas.
2. Convertir canales Realtime en privados con autorización explícita.
3. Guardar preferencias por terapeuta y cliente, no sólo por sesión/localStorage.
4. Añadir protocolo para hardware USB/BLE.
5. Añadir tests unitarios para movimiento y estado.
6. Añadir auditoría de seguridad antes de cualquier uso con terceros.

## Primer commit sugerido

```bash
git init
git add .
git commit -m "feat: initial open-binstimulation mvp"
```
