# Configuración de Supabase

Este MVP usa Supabase como backend gratuito inicial:

- Postgres para persistir sesiones, tokens y preferencias.
- RPC SQL para crear/cargar/actualizar sesiones sin exponer acceso directo a tablas.
- Realtime Broadcast para sincronizar terapeuta, cliente y móviles táctiles.

## 1. Crear proyecto

1. Entra en Supabase.
2. Crea un proyecto nuevo.
3. Guarda la contraseña de base de datos.
4. Espera a que el proyecto esté activo.

## 2. Ejecutar SQL

Abre:

```txt
supabase/schema.sql
```

En Supabase:

1. Ve a **SQL Editor**.
2. Pulsa **New Query**.
3. Pega todo el contenido de `schema.sql`.
4. Ejecuta la query.

El script crea:

```txt
public.sessions
public.tactile_devices
public.get_server_time_ms()
public.create_bls_session(...)
public.get_bls_session(...)
public.therapist_save_state(...)
public.therapist_save_preferences(...)
public.end_bls_session(...)
public.upsert_tactile_device(...)
```

## 3. Obtener variables de entorno

En Supabase Dashboard:

```txt
Project Settings → API
```

Copia:

```txt
Project URL
anon public key
```

Y rellena `.env.local`:

```bash
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_SUPABASE_ANON_KEY
```

## 4. Comprobar RPC

Después de ejecutar SQL, la landing debería poder crear sesiones. Si ves un error como:

```txt
Could not find the function public.create_bls_session
```

revisa que el SQL se haya ejecutado en el proyecto correcto.

## 5. RLS y permisos

Las tablas tienen RLS activado y políticas que bloquean acceso directo desde `anon`. La app usa funciones `security definer`, que validan tokens de sesión.

Esto no convierte el MVP en un sistema clínico final, pero evita que la anon key pueda leer tablas directamente.

## 6. Realtime

El código usa canales Broadcast:

```txt
session:${sessionId}
```

Los mensajes no contienen información clínica. Sólo contienen configuración técnica de BLS.

Para producto público, el siguiente paso es activar canales privados y autorización Realtime por rol/usuario.
