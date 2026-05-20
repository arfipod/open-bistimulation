# Seguridad y privacidad

## Estado actual del MVP

Este MVP está pensado para uso privado inicial, no para operar como producto clínico público.

Incluye:

- tokens aleatorios separados para terapeuta y cliente,
- sesiones con expiración,
- RLS activado,
- acceso a tablas bloqueado para `anon`,
- operaciones mediante RPC `security definer`,
- no almacenamiento de datos clínicos por defecto.

## Qué se guarda

En `sessions.state` y `sessions.preferences` sólo se guardan parámetros técnicos:

- color,
- fondo,
- velocidad,
- dirección,
- sonido,
- volumen,
- táctil activado,
- duración de pulso,
- estado start/pause/resume/stop.

No guardes:

- nombres de pacientes,
- diagnósticos,
- notas de terapia,
- material clínico,
- identificadores personales.

## Riesgos actuales

### Enlaces como secretos

Los tokens van en la URL. Quien tenga el enlace de terapeuta puede controlar la sesión. Quien tenga el enlace de cliente puede ver la sesión y vincular móviles.

Mitigación para MVP:

- usar enlaces sólo durante la sesión,
- finalizar sesión al terminar,
- no reutilizar sesiones,
- no enviar enlaces por canales inseguros si hay datos sensibles.

### Realtime Broadcast público

El canal usa un identificador aleatorio de sesión. Para un MVP privado es suficiente, pero no es una autorización robusta para producto público.

Mejora recomendada:

- Supabase Auth,
- canales privados,
- Realtime Authorization,
- políticas por usuario/rol.

### Logs del navegador

Evita imprimir tokens o URLs completas en logs si más adelante añades observabilidad.

## Checklist antes de uso con terceros

- [ ] Añadir Auth para terapeutas.
- [ ] Implementar sesiones privadas con autorización server-side.
- [ ] Rotación/invalidación explícita de tokens.
- [ ] Expiración corta configurable.
- [ ] Política de privacidad.
- [ ] Consentimiento informado.
- [ ] Revisión legal sobre GDPR/HIPAA u otra normativa aplicable.
- [ ] Validación clínica de latencia y precisión.
