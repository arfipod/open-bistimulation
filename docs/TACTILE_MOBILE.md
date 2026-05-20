# Táctil con móviles auxiliares

El MVP usa dos móviles como sustituto temporal de hardware dedicado.

## Flujo

1. El cliente abre su vista.
2. Pulsa **QR táctil**.
3. Aparecen dos QR:
   - móvil izquierdo,
   - móvil derecho.
4. Cada QR se escanea con un móvil diferente.
5. En cada móvil se pulsa **Activar vibración**.
6. El terapeuta activa **Táctil** e inicia la BLS.

## Rutas

```txt
/session/:sessionId/tactile/left?t=:clientToken
/session/:sessionId/tactile/right?t=:clientToken
```

## API usada

```ts
navigator.vibrate(durationMs)
```

## Compatibilidad

La API de vibración no funciona en todos los navegadores. Para el MVP, la ruta recomendada es:

```txt
Android + Chrome
Android + Samsung Internet
```

No cuentes con iPhone/Safari para esta parte.

## Limitaciones

- Latencia variable por red móvil/Wi-Fi.
- Intensidad no controlable de forma precisa; se simula con duración de pulso.
- Algunos navegadores pueden ignorar vibraciones si la pestaña está en segundo plano.
- La vibración requiere gesto de usuario.

## Evolución hacia hardware dedicado

Cuando pases a USB/Bluetooth, mantén la misma semántica de evento:

```ts
{
  kind: 'TACTILE_PULSE',
  side: 'left' | 'right',
  durationMs: number,
  sequence: number,
  emittedAtMs: number
}
```

Y sustituye el handler de móvil por:

```txt
WebSerial / WebUSB / WebBluetooth → dispositivo físico
```

## Protocolo futuro sugerido

Mensaje mínimo por puerto serie:

```txt
PULSE L 120\n
PULSE R 120\n
STOP\n
PING\n
```

Donde:

- `L` = izquierdo,
- `R` = derecho,
- `120` = duración en ms.
