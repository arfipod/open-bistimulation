# Checklist de QA manual

## Setup

- [ ] `npm install` funciona.
- [ ] `.env.local` configurado.
- [ ] `supabase/schema.sql` ejecutado sin errores.
- [ ] `npm run dev` arranca.
- [ ] `npm run build` genera `dist`.

## Sesión

- [ ] Crear sesión desde landing.
- [ ] Panel terapeuta carga.
- [ ] Enlace de cliente se copia.
- [ ] Cliente abre en otra pestaña.
- [ ] Terapeuta detecta cliente conectado.
- [ ] Cliente detecta Realtime conectado.

## Visual

- [ ] Start mueve la bola.
- [ ] Stop detiene sin romper estado.
- [ ] Pause detiene el contador.
- [ ] Resume continúa desde la misma posición temporal.
- [ ] Cambiar color se replica en cliente.
- [ ] Cambiar fondo se replica en cliente.
- [ ] Cambiar velocidad se replica en cliente.
- [ ] Horizontal funciona.
- [ ] Vertical funciona.
- [ ] Diagonal funciona.
- [ ] Infinito funciona.

## Audio

- [ ] Cliente pulsa Activar audio.
- [ ] Audio suena en cada medio ciclo.
- [ ] Paneo izquierda/derecha perceptible con auriculares.
- [ ] Cambiar sonido funciona.
- [ ] Cambiar volumen funciona.
- [ ] Silenciar terapeuta no afecta al cliente.

## Táctil

- [ ] Cliente muestra QR táctil.
- [ ] Móvil izquierdo se vincula.
- [ ] Móvil derecho se vincula.
- [ ] Panel terapeuta muestra ambos dispositivos conectados.
- [ ] Botón Probar vibración funciona en cada móvil.
- [ ] Al iniciar BLS, cada móvil vibra sólo en su lado.
- [ ] Si navegador no soporta vibración, muestra aviso claro.

## Preferencias

- [ ] Cambiar parámetros.
- [ ] Guardar preferencias.
- [ ] Crear nueva sesión en el mismo navegador.
- [ ] Nueva sesión arranca con preferencias locales.

## Deploy

- [ ] Vercel build correcto.
- [ ] Rutas profundas no devuelven 404.
- [ ] Variables de entorno cargadas.
- [ ] Realtime funciona en producción.
