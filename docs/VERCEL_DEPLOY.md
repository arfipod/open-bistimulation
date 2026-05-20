# Deploy en Vercel

Este proyecto está preparado para desplegarse como SPA de Vite en Vercel.

## 1. Subir a GitHub

```bash
git init
git add .
git commit -m "feat: initial open-binstimulation mvp"
git branch -M main
git remote add origin git@github.com:TU-USUARIO/open-binstimulation.git
git push -u origin main
```

## 2. Importar en Vercel

1. Entra en Vercel.
2. Pulsa **Add New Project**.
3. Importa el repo `open-binstimulation`.
4. Framework preset: **Vite**.
5. Build Command: `npm run build`.
6. Output Directory: `dist`.

El archivo `vercel.json` ya define estos valores.

## 3. Variables de entorno

En Vercel, dentro del proyecto:

```txt
Settings → Environment Variables
```

Añade:

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Usa los mismos valores de `.env.local`.

## 4. Rewrites SPA

El `vercel.json` contiene:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Esto permite abrir directamente rutas como:

```txt
/session/:sessionId/client?t=:token
/session/:sessionId/tactile/left?t=:token
```

sin que Vercel devuelva 404.

## 5. Verificación post-deploy

1. Abre la URL pública de Vercel.
2. Crea una sesión.
3. Abre el cliente en otra pestaña.
4. Comprueba que el indicador Realtime esté conectado.
5. Inicia BLS y revisa que la bola se mueve en ambas pestañas.
6. Escanea QR táctil desde móvil Android y prueba vibración.
