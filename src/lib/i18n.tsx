import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'en' | 'es';

const LANGUAGE_STORAGE_KEY = 'open-bistimulation.language.v1';

const translations = {
  en: {
    'app.brandAria': 'Open Bistimulation home',
    'app.footer': 'Open Bistimulation is independent open-source software.',
    'app.languageToggle': 'Switch language to Spanish',
    'app.languageLabel': 'English',
    'app.notFoundTitle': 'Route not found',
    'app.notFoundMessage': 'Check the link or go back home.',
    'app.unexpectedErrorTitle': 'The app hit an unexpected problem',
    'app.unexpectedErrorMessage': 'Output has been stopped. Return home and open the session link again.',
    'footer.navLabel': 'Legal and project links',
    'footer.legal': 'Legal',
    'footer.privacy': 'Privacy',
    'footer.terms': 'Terms',
    'footer.disclaimer': 'Disclaimer',
    'footer.github': 'GitHub',
    'footer.credit': 'Made with 💙 by arrf — laus deo virginique matri',
    'common.backHome': 'Back home',
    'common.copy': 'Copy',
    'common.copied': 'Copied',
    'common.copyLink': 'Copy link',
    'common.connected': 'Connected',
    'common.reconnecting': 'Reconnecting',
    'common.clientConnected': 'Participant connected',
    'common.noClient': 'No participant',
    'common.left': 'left',
    'common.right': 'right',
    'common.loading': 'Loading...',
    'common.cancel': 'Cancel',
    'common.expandPanel': 'Expand panel',
    'common.collapsePanel': 'Collapse panel',
    'error.defaultTitle': 'Could not open the session',
    'loading.therapist': 'Opening controller panel...',
    'loading.client': 'Connecting to controller...',
    'landing.eyebrow': 'Independent experimental BLS tool',
    'landing.description':
      'BLS here means browser-based bilateral sensory cues: visual, auditory, and optional tactile pulses coordinated by a controller for a participant.',
    'landing.publicContentTitle': 'What this tool provides',
    'landing.publicContentBody':
      'Open Bistimulation is free independent software for browser-based bilateral sensory cues. It provides configurable visual, auditory, and optional tactile cues coordinated by a controller for a participant. It is supplied without professional services, medical services, warranties, or outcome guarantees.',
    'landing.supabaseWarning': 'Session creation is unavailable on this deployment. Please contact the site operator.',
    'landing.create': 'Create BLS session',
    'landing.creating': 'Creating session...',
    'landing.disclaimerTitle': 'Legal and safety notice',
    'landing.disclaimerExperimental': 'Independent experimental tool.',
    'landing.disclaimerAdvice': 'Not medical advice.',
    'landing.disclaimerDevice': 'Not a medical device.',
    'landing.disclaimerProfessional': 'Use only under the responsibility of qualified professionals.',
    'landing.disclaimerIndependent':
      'No affiliation, endorsement, sponsorship, or connection exists with bilateralstimulation.io or BLS GmbH.',
    'landing.visualTitle': 'Visual',
    'landing.visualText': 'Configurable color, background, speed, position, direction, and bilateral cue order.',
    'landing.audioTitle': 'Auditory',
    'landing.audioText': 'Synthetic browser sounds with left/right stereo panning using the Web Audio API.',
    'landing.tactileTitle': 'Tactile',
    'landing.tactileText': 'Optional Joy-Con tactile output can run directly in supported browsers with WebHID.',
    'session.therapistPanel': 'Controller panel',
    'session.realtimeConnected': 'Realtime connected',
    'session.realtimeDisconnected': 'Realtime disconnected',
    'session.previewClient': 'Preview participant',
    'session.endSession': 'End session',
    'session.localAudioEnabled': 'Controller audio enabled',
    'session.enableLocalAudio': 'Enable local audio',
    'session.serverClock': 'Server clock',
    'session.preferencesSaved': 'Preferences saved locally and in Supabase for this session.',
    'session.roundFinished': 'Round finished after {duration}.',
    'session.missingTherapistToken': 'Missing controller token in the URL.',
    'session.therapistPermissions': 'This link does not have controller permissions.',
    'session.loadError': 'Could not load the session.',
    'session.saveStateError': 'Could not save the state.',
    'session.syncError': 'The live connection could not be reconciled. Controls remain available; please try again.',
    'session.heartbeatError': 'Controller presence could not be verified. Participant output will stop unless it recovers.',
    'session.concurrentUpdate':
      'This session changed in another controller. The latest saved state has been restored; review it before trying again.',
    'session.startError': 'Could not start the round.',
    'session.pauseError': 'Could not pause the round.',
    'session.resumeError': 'Could not resume the round.',
    'session.stopError': 'Could not stop the round.',
    'session.resetError': 'Could not reset the counters.',
    'session.preferencesError': 'Could not save the preferences.',
    'session.endError': 'Could not end the session.',
    'session.endConfirmTitle': 'End this session?',
    'session.endConfirmBody': 'All participant output will stop and this invitation link will no longer work.',
    'session.endConfirmAction': 'End session',
    'session.endedTitle': 'Session ended',
    'session.endedMessage': 'This session was ended from another controller.',
    'session.backendTokenError': 'The backend did not return a controller token.',
    'session.createError': 'Could not create session.',
    'controls.sessionActions': 'Round controls and status',
    'controls.time': 'Time',
    'controls.passes': 'Passes',
    'controls.sets': 'Sets',
    'controls.start': 'Start BLS',
    'controls.pause': 'Pause',
    'controls.resume': 'Resume',
    'controls.stop': 'Stop',
    'controls.stopping': 'Stopping...',
    'controls.reset': 'Reset',
    'controls.savePreferences': 'Save preferences',
    'controls.roundDuration': 'Round duration',
    'controls.remaining': 'Remaining',
    'controls.durationInput': 'Round duration in minutes and seconds, or free',
    'controls.free': 'Free',
    'controls.minusTen': '-10s',
    'controls.plusTen': '+10s',
    'controls.presets': 'Presets',
    'visual.title': 'Visual',
    'visual.color': 'BLS color',
    'visual.colorAria': 'Color {color}',
    'visual.background': 'Background',
    'visual.backgroundAria': 'Background {color}',
    'visual.speed': 'Speed: {value}',
    'visual.direction': 'Direction',
    'visual.motionOrder': 'Bilateral order',
    'visual.position': 'Vertical position',
    'visual.size': 'Size: {value}px',
    'visual.stimulus': 'Stimulus',
    'visual.stimulusHint': 'Emoji stimuli can change according to the current movement direction.',
    'visual.stimulusAlternateSides': 'Use different emoji for left and right',
    'visual.stimulus.dot': 'Dot',
    'visual.stimulus.dog': 'Dog',
    'visual.stimulus.flower': 'Flower',
    'visual.stimulus.sun': 'Sun',
    'visual.stimulus.star': 'Star',
    'visual.stimulus.heart': 'Heart',
    'visual.stimulus.smile': 'Smile',
    'visual.horizontal': 'Horizontal',
    'visual.vertical': 'Vertical',
    'visual.diagonal': 'Diagonal',
    'visual.diagonalDown': 'Diagonal down',
    'visual.diagonalUp': 'Diagonal up',
    'visual.infinity': 'Infinity',
    'visual.leftToRight': 'Left to right',
    'visual.rightToLeft': 'Right to left',
    'visual.randomOrder': 'Random',
    'visual.top': 'Top',
    'visual.center': 'Center',
    'visual.bottom': 'Bottom',
    'audio.title': 'Auditory',
    'audio.sound': 'Sound',
    'audio.volume': 'Volume: {value}%',
    'audio.muteTherapist': 'Mute for controller',
    'audio.snap': 'Finger snap',
    'audio.beep': 'Beep',
    'audio.bell': 'Soft bell',
    'audio.heartbeat': 'Heartbeat',
    'tactile.title': 'Tactile',
    'tactile.browserJoyConAccess': 'Browser Joy-Con access',
    'tactile.webHidUnsupported': 'WebHID unavailable',
    'tactile.joyConsReady': 'Joy-Cons ready',
    'tactile.joyConsMissing': 'Joy-Cons not added',
    'tactile.leftJoyCon': 'Left Joy-Con',
    'tactile.rightJoyCon': 'Right Joy-Con',
    'tactile.batteryUnknown': 'Battery unknown',
    'tactile.testLeft': 'Test left',
    'tactile.testRight': 'Test right',
    'tactile.testBoth': 'Test both',
    'tactile.addJoyCons': 'Add Joy-Cons',
    'tactile.disconnectJoyCons': 'Disconnect Joy-Cons',
    'tactile.refreshDevices': 'Refresh devices',
    'tactile.notDetected': 'Not detected',
    'tactile.webHidRequirement': 'Pair both Joy-Cons over Bluetooth on the participant computer, then add them from the participant browser.',
    'tactile.instructionsTitle': 'Joy-Con quick instructions',
    'tactile.instructions.pairBluetooth': 'Pair the left and right Joy-Con in the participant computer Bluetooth settings.',
    'tactile.instructions.openParticipant': 'Open the participant link in Chrome or Edge over HTTPS or localhost.',
    'tactile.instructions.addJoyCons': 'Press Add Joy-Cons from this panel and approve the browser device prompt.',
    'tactile.instructions.selectBoth': 'Select both the left and right Joy-Con. If the browser asks once per controller, repeat Add Joy-Cons.',
    'tactile.instructions.testBoth': 'Use Test left, Test right, and Test both before starting the round.',
    'tactile.instructions.keepTabOpen': 'Keep the participant tab awake and visible while tactile output is enabled.',
    'tactile.expandPanel': 'Expand tactile panel',
    'tactile.collapsePanel': 'Collapse tactile panel',
    'tactile.intensity': 'Intensity',
    'tactile.intensity.low': 'Low',
    'tactile.intensity.medium': 'Medium',
    'tactile.intensity.high': 'High',
    'tactile.pulseDuration': 'Pulse duration: {value} ms',
    'tactile.outputError': 'Tactile error: {error}',
    'invite.eyebrow': 'Participant',
    'invite.title': 'Invitation link',
    'invite.copyError': 'The link could not be copied. Select the address and copy it manually.',
    'preview.title': 'Participant view',
    'client.missingToken': 'Missing participant token in the URL.',
    'client.permissions': 'This link does not have participant permissions.',
    'client.syncError': 'The live connection is out of sync. Output has been stopped while it reconnects.',
    'client.clockSyncError': 'Server timing could not be verified. Output is stopped until timing sync recovers.',
    'client.controllerAway': 'The controller is offline. Output is stopped until it reconnects.',
    'client.sessionEndedTitle': 'Session ended',
    'client.sessionEndedMessage': 'The controller has ended this session.',
    'client.controls': 'Participant controls',
    'client.localStop': 'Stop output now',
    'client.localResume': 'Resume output',
    'client.roundExpired': 'This timed round has finished. Output is stopped.',
    'client.audioEnabled': 'Audio enabled',
    'client.enableAudio': 'Enable audio',
    'client.fullscreen': 'Fullscreen',
    'client.exitFullscreen': 'Exit fullscreen',
    'client.fullscreenAudioRequired': 'Enable audio before entering fullscreen.',
    'client.fullscreenAudioEnabled': 'The controller enabled audio. Leaving fullscreen so you can enable it safely.',
    'client.fullscreenAudioExitFailed':
      'Audio was enabled, but fullscreen could not be closed. Use Exit fullscreen or Stop output now.',
    'client.fullscreenUnavailable': 'Fullscreen is not available in this browser.',
    'client.fullscreenFailed': 'Fullscreen could not be opened.',
    'client.enableAudioTitle': 'Enable audio',
    'client.enableAudioBody': 'The browser requires a user gesture to allow stereo audio.',
    'client.enterEnableAudio': 'Enter and enable audio',
    'legal.legal.title': 'Legal',
    'legal.legal.intro':
      'Open Bistimulation is an independent experimental web tool for browser-based bilateral sensory cues. It is provided for evaluation by qualified professionals who remain responsible for their own work.',
    'legal.legal.item1': 'It is not medical advice, and it is not offered as medical-device software.',
    'legal.legal.item2': 'It must not be used for diagnostic decisions, therapeutic decisions, urgent situations, or emergencies.',
    'legal.legal.item3': 'No warranty is made about professional, health, therapeutic, or operational outcomes.',
    'legal.legal.item4':
      'No affiliation, endorsement, sponsorship, or connection exists with bilateralstimulation.io or BLS GmbH.',
    'legal.privacy.title': 'Privacy',
    'legal.privacy.intro':
      'The app is designed to avoid intentional storage of participant identity or sensitive professional records.',
    'legal.privacy.item1':
      'Supabase stores session id, controller and participant tokens, session state, preferences, and timestamps.',
    'legal.privacy.item2':
      'Tactile preferences may include whether tactile output is enabled, pulse duration, and intensity; Joy-Con detection and rumble details stay in the participant browser.',
    'legal.privacy.item3':
      'The app does not intentionally store participant names, professional notes, diagnostic labels, symptoms, care plans, or transcripts.',
    'legal.privacy.item4':
      'Session rows expire by timestamp. Operators can run the cleanup function manually or schedule it in Supabase.',
    'legal.terms.title': 'Terms',
    'legal.terms.intro':
      'By using this MVP, you accept that it is experimental software supplied without warranties.',
    'legal.terms.item1':
      'Qualified professionals and operators are responsible for deciding whether, when, and how the tool is appropriate in their own context.',
    'legal.terms.item2': 'Do not use it for emergencies, crisis response, or situations needing immediate help.',
    'legal.terms.item3': 'The software is supplied without professional services, medical services, warranties, or outcome guarantees.',
    'legal.terms.item4': 'Use the software only where you can comply with applicable law and professional obligations.',
    'legal.disclaimer.title': 'Disclaimer',
    'legal.disclaimer.intro':
      'Open Bistimulation provides configurable browser cues only. It does not replace professional judgment or participant consent.',
    'legal.disclaimer.item1': 'It is not medical advice and is not a medical device.',
    'legal.disclaimer.item2': 'It is not for diagnostic, therapeutic, crisis, or emergency use.',
    'legal.disclaimer.item3': 'There is no clinical warranty or guarantee of effectiveness.',
    'legal.disclaimer.item4':
      'It is independent from bilateralstimulation.io and BLS GmbH; no affiliation, endorsement, sponsorship, or connection exists.',
  },
  es: {
    'app.brandAria': 'Inicio de Open Bistimulation',
    'app.footer': 'Open Bistimulation es software libre independiente.',
    'app.languageToggle': 'Cambiar idioma a inglés',
    'app.languageLabel': 'Español',
    'app.notFoundTitle': 'Ruta no encontrada',
    'app.notFoundMessage': 'Comprueba el enlace o vuelve al inicio.',
    'app.unexpectedErrorTitle': 'La aplicación encontró un problema inesperado',
    'app.unexpectedErrorMessage': 'La salida se ha detenido. Vuelve al inicio y abre de nuevo el enlace de sesión.',
    'footer.navLabel': 'Enlaces legales y del proyecto',
    'footer.legal': 'Legal',
    'footer.privacy': 'Privacidad',
    'footer.terms': 'Términos',
    'footer.disclaimer': 'Aviso',
    'footer.github': 'GitHub',
    'footer.credit': 'Hecho con 💙 por arrf — laus deo virginique matri',
    'common.backHome': 'Volver al inicio',
    'common.copy': 'Copiar',
    'common.copied': 'Copiado',
    'common.copyLink': 'Copiar enlace',
    'common.connected': 'Conectado',
    'common.reconnecting': 'Reconectando',
    'common.clientConnected': 'Participante conectado',
    'common.noClient': 'Sin participante',
    'common.left': 'izquierda',
    'common.right': 'derecha',
    'common.loading': 'Cargando...',
    'common.cancel': 'Cancelar',
    'common.expandPanel': 'Expandir panel',
    'common.collapsePanel': 'Contraer panel',
    'error.defaultTitle': 'No se pudo abrir la sesión',
    'loading.therapist': 'Abriendo panel de control...',
    'loading.client': 'Conectando con el controlador...',
    'landing.eyebrow': 'Herramienta BLS experimental independiente',
    'landing.description':
      'Aquí BLS significa señales sensoriales bilaterales en el navegador: visuales, auditivas y pulsos táctiles opcionales coordinados por un controlador para un participante.',
    'landing.publicContentTitle': 'Qué proporciona esta herramienta',
    'landing.publicContentBody':
      'Open Bistimulation es software libre e independiente para señales sensoriales bilaterales en el navegador. Proporciona señales visuales, auditivas y pulsos táctiles opcionales configurables, coordinados por un controlador para un participante. Se suministra sin servicios profesionales, servicios médicos, garantías ni promesas de resultados.',
    'landing.supabaseWarning':
      'No se pueden crear sesiones en este despliegue. Ponte en contacto con quien gestiona el sitio.',
    'landing.create': 'Crear sesión BLS',
    'landing.creating': 'Creando sesión...',
    'landing.disclaimerTitle': 'Aviso legal y de seguridad',
    'landing.disclaimerExperimental': 'Herramienta experimental independiente.',
    'landing.disclaimerAdvice': 'No es consejo médico.',
    'landing.disclaimerDevice': 'No es un dispositivo médico.',
    'landing.disclaimerProfessional': 'Usar solo bajo la responsabilidad de profesionales cualificados.',
    'landing.disclaimerIndependent':
      'No existe afiliación, respaldo, patrocinio ni conexión con bilateralstimulation.io ni con BLS GmbH.',
    'landing.visualTitle': 'Visual',
    'landing.visualText': 'Color, fondo, velocidad, posición, dirección y orden bilateral configurables.',
    'landing.audioTitle': 'Auditivo',
    'landing.audioText': 'Sonidos sintéticos del navegador con paneo estéreo izquierda/derecha mediante Web Audio API.',
    'landing.tactileTitle': 'Táctil',
    'landing.tactileText': 'La salida táctil Joy-Con opcional puede funcionar directamente en navegadores compatibles con WebHID.',
    'session.therapistPanel': 'Panel de control',
    'session.realtimeConnected': 'Conexión en directo activa',
    'session.realtimeDisconnected': 'Conexión en directo interrumpida',
    'session.previewClient': 'Previsualizar participante',
    'session.endSession': 'Terminar sesión',
    'session.localAudioEnabled': 'Audio del controlador activado',
    'session.enableLocalAudio': 'Activar audio local',
    'session.serverClock': 'Reloj del servidor',
    'session.preferencesSaved': 'Preferencias guardadas localmente y en Supabase para esta sesión.',
    'session.roundFinished': 'Tanda terminada después de {duration}.',
    'session.missingTherapistToken': 'Falta el token de controlador en la URL.',
    'session.therapistPermissions': 'Este enlace no tiene permisos de controlador.',
    'session.loadError': 'No se pudo cargar la sesión.',
    'session.saveStateError': 'No se pudo guardar el estado.',
    'session.syncError':
      'No se pudo reconciliar la conexión en directo. Los controles siguen disponibles; inténtalo de nuevo.',
    'session.heartbeatError':
      'No se pudo verificar la presencia del controlador. La salida del participante se detendrá si no se recupera.',
    'session.concurrentUpdate':
      'La sesión cambió en otro controlador. Se ha restaurado el último estado guardado; revísalo antes de intentarlo de nuevo.',
    'session.startError': 'No se pudo iniciar la tanda.',
    'session.pauseError': 'No se pudo pausar la tanda.',
    'session.resumeError': 'No se pudo reanudar la tanda.',
    'session.stopError': 'No se pudo detener la tanda.',
    'session.resetError': 'No se pudieron reiniciar los contadores.',
    'session.preferencesError': 'No se pudieron guardar las preferencias.',
    'session.endError': 'No se pudo terminar la sesión.',
    'session.endConfirmTitle': '¿Terminar esta sesión?',
    'session.endConfirmBody':
      'Toda la salida del participante se detendrá y este enlace de invitación dejará de funcionar.',
    'session.endConfirmAction': 'Terminar sesión',
    'session.endedTitle': 'Sesión terminada',
    'session.endedMessage': 'Esta sesión se terminó desde otro controlador.',
    'session.backendTokenError': 'El backend no devolvió el token de controlador.',
    'session.createError': 'No se pudo crear la sesión.',
    'controls.sessionActions': 'Controles y estado de la tanda',
    'controls.time': 'Tiempo',
    'controls.passes': 'Pases',
    'controls.sets': 'Tandas',
    'controls.start': 'Iniciar BLS',
    'controls.pause': 'Pausar',
    'controls.resume': 'Reanudar',
    'controls.stop': 'Detener',
    'controls.stopping': 'Deteniendo...',
    'controls.reset': 'Reiniciar',
    'controls.savePreferences': 'Guardar preferencias',
    'controls.roundDuration': 'Duración de tanda',
    'controls.remaining': 'Restante',
    'controls.durationInput': 'Duración de tanda en minutos y segundos, o libre',
    'controls.free': 'Libre',
    'controls.minusTen': '-10s',
    'controls.plusTen': '+10s',
    'controls.presets': 'Duraciones',
    'visual.title': 'Visual',
    'visual.color': 'Color BLS',
    'visual.colorAria': 'Color {color}',
    'visual.background': 'Fondo',
    'visual.backgroundAria': 'Fondo {color}',
    'visual.speed': 'Velocidad: {value}',
    'visual.direction': 'Dirección',
    'visual.motionOrder': 'Orden bilateral',
    'visual.position': 'Posición vertical',
    'visual.size': 'Tamaño: {value}px',
    'visual.stimulus': 'Estímulo',
    'visual.stimulusHint': 'Los estímulos emoji pueden cambiar según el sentido actual del movimiento.',
    'visual.stimulusAlternateSides': 'Usar emoji diferente para izquierda y derecha',
    'visual.stimulus.dot': 'Bolita',
    'visual.stimulus.dog': 'Perro',
    'visual.stimulus.flower': 'Flor',
    'visual.stimulus.sun': 'Sol',
    'visual.stimulus.star': 'Estrella',
    'visual.stimulus.heart': 'Corazón',
    'visual.stimulus.smile': 'Cara',
    'visual.horizontal': 'Horizontal',
    'visual.vertical': 'Vertical',
    'visual.diagonal': 'Diagonal',
    'visual.diagonalDown': 'Diagonal abajo',
    'visual.diagonalUp': 'Diagonal arriba',
    'visual.infinity': 'Infinito',
    'visual.leftToRight': 'Izq. a der.',
    'visual.rightToLeft': 'Der. a izq.',
    'visual.randomOrder': 'Aleatorio',
    'visual.top': 'Arriba',
    'visual.center': 'Centro',
    'visual.bottom': 'Abajo',
    'audio.title': 'Auditivo',
    'audio.sound': 'Sonido',
    'audio.volume': 'Volumen: {value}%',
    'audio.muteTherapist': 'Silenciar para controlador',
    'audio.snap': 'Chasquido',
    'audio.beep': 'Pitido',
    'audio.bell': 'Campana suave',
    'audio.heartbeat': 'Latido',
    'tactile.title': 'Táctil',
    'tactile.browserJoyConAccess': 'Acceso Joy-Con del navegador',
    'tactile.webHidUnsupported': 'WebHID no disponible',
    'tactile.joyConsReady': 'Joy-Con listos',
    'tactile.joyConsMissing': 'Joy-Con no agregados',
    'tactile.leftJoyCon': 'Joy-Con izquierdo',
    'tactile.rightJoyCon': 'Joy-Con derecho',
    'tactile.batteryUnknown': 'Batería desconocida',
    'tactile.testLeft': 'Probar izquierdo',
    'tactile.testRight': 'Probar derecho',
    'tactile.testBoth': 'Probar ambos',
    'tactile.addJoyCons': 'Agregar Joy-Con',
    'tactile.disconnectJoyCons': 'Desconectar Joy-Con',
    'tactile.refreshDevices': 'Actualizar mandos',
    'tactile.notDetected': 'No detectado',
    'tactile.webHidRequirement': 'Empareja ambos Joy-Con por Bluetooth en el ordenador del participante y luego agrégalos desde su navegador.',
    'tactile.instructionsTitle': 'Instrucciones rápidas Joy-Con',
    'tactile.instructions.pairBluetooth': 'Empareja el Joy-Con izquierdo y el derecho en los ajustes Bluetooth del ordenador del participante.',
    'tactile.instructions.openParticipant': 'Abre el enlace de participante en Chrome o Edge mediante HTTPS o localhost.',
    'tactile.instructions.addJoyCons': 'Pulsa Agregar Joy-Con desde este panel y acepta el aviso de dispositivos del navegador.',
    'tactile.instructions.selectBoth': 'Selecciona el Joy-Con izquierdo y el derecho. Si el navegador pide un mando cada vez, repite Agregar Joy-Con.',
    'tactile.instructions.testBoth': 'Usa Probar izquierdo, Probar derecho y Probar ambos antes de iniciar la tanda.',
    'tactile.instructions.keepTabOpen': 'Mantén la pestaña del participante activa y visible mientras la salida táctil esté habilitada.',
    'tactile.expandPanel': 'Expandir panel táctil',
    'tactile.collapsePanel': 'Contraer panel táctil',
    'tactile.intensity': 'Intensidad',
    'tactile.intensity.low': 'Baja',
    'tactile.intensity.medium': 'Media',
    'tactile.intensity.high': 'Alta',
    'tactile.pulseDuration': 'Duración del pulso: {value} ms',
    'tactile.outputError': 'Error táctil: {error}',
    'invite.eyebrow': 'Participante',
    'invite.title': 'Enlace de invitación',
    'invite.copyError': 'No se pudo copiar el enlace. Selecciona la dirección y cópiala manualmente.',
    'preview.title': 'Vista del participante',
    'client.missingToken': 'Falta el token de participante en la URL.',
    'client.permissions': 'Este enlace no tiene permisos de participante.',
    'client.syncError':
      'La conexión en directo no está sincronizada. La salida se ha detenido mientras vuelve a conectar.',
    'client.clockSyncError':
      'No se pudo verificar el tiempo del servidor. La salida se detiene hasta recuperar la sincronización.',
    'client.controllerAway':
      'El controlador no está conectado. La salida está detenida hasta que vuelva a conectar.',
    'client.sessionEndedTitle': 'Sesión terminada',
    'client.sessionEndedMessage': 'El controlador ha terminado esta sesión.',
    'client.controls': 'Controles del participante',
    'client.localStop': 'Detener salida ahora',
    'client.localResume': 'Reanudar salida',
    'client.roundExpired': 'Esta tanda cronometrada ha terminado. La salida está detenida.',
    'client.audioEnabled': 'Audio activado',
    'client.enableAudio': 'Activar audio',
    'client.fullscreen': 'Pantalla completa',
    'client.exitFullscreen': 'Salir de pantalla completa',
    'client.fullscreenAudioRequired': 'Activa el audio antes de entrar en pantalla completa.',
    'client.fullscreenAudioEnabled':
      'El controlador activó el audio. Saliendo de pantalla completa para que puedas activarlo de forma segura.',
    'client.fullscreenAudioExitFailed':
      'Se activó el audio, pero no se pudo cerrar la pantalla completa. Usa Salir de pantalla completa o Detener salida ahora.',
    'client.fullscreenUnavailable': 'La pantalla completa no está disponible en este navegador.',
    'client.fullscreenFailed': 'No se pudo abrir la pantalla completa.',
    'client.enableAudioTitle': 'Activar audio',
    'client.enableAudioBody': 'El navegador requiere una acción del usuario para permitir audio estéreo.',
    'client.enterEnableAudio': 'Entrar y activar audio',
    'legal.legal.title': 'Legal',
    'legal.legal.intro':
      'Open Bistimulation es una herramienta web experimental independiente para señales sensoriales bilaterales en el navegador. Se ofrece para evaluación por profesionales cualificados que mantienen la responsabilidad de su propio trabajo.',
    'legal.legal.item1': 'No es consejo médico y no se ofrece como software de dispositivo médico.',
    'legal.legal.item2': 'No debe usarse para decisiones diagnósticas, decisiones terapéuticas, situaciones urgentes ni emergencias.',
    'legal.legal.item3': 'No se ofrece garantía sobre resultados profesionales, de salud, terapéuticos u operativos.',
    'legal.legal.item4':
      'No existe afiliación, respaldo, patrocinio ni conexión con bilateralstimulation.io ni con BLS GmbH.',
    'legal.privacy.title': 'Privacidad',
    'legal.privacy.intro':
      'La app está diseñada para evitar el almacenamiento intencional de identidad de participantes o registros profesionales sensibles.',
    'legal.privacy.item1':
      'Supabase almacena id de sesión, tokens de controlador y participante, estado de sesión, preferencias y marcas de tiempo.',
    'legal.privacy.item2':
      'Las preferencias táctiles pueden incluir si la salida táctil está activada, la duración del pulso y la intensidad; la detección Joy-Con y los detalles de rumble permanecen en el navegador del participante.',
    'legal.privacy.item3':
      'La app no almacena intencionalmente nombres de participantes, notas profesionales, etiquetas diagnósticas, síntomas, planes de atención ni transcripciones.',
    'legal.privacy.item4':
      'Las filas de sesión caducan por marca de tiempo. Los operadores pueden ejecutar la función de limpieza manualmente o programarla en Supabase.',
    'legal.terms.title': 'Términos',
    'legal.terms.intro':
      'Al usar este MVP aceptas que es software experimental suministrado sin garantías.',
    'legal.terms.item1':
      'Los profesionales cualificados y operadores son responsables de decidir si, cuándo y cómo la herramienta es adecuada en su propio contexto.',
    'legal.terms.item2': 'No la uses para emergencias, respuesta a crisis o situaciones que necesiten ayuda inmediata.',
    'legal.terms.item3':
      'El software se suministra sin servicios profesionales, servicios médicos, garantías ni promesas de resultados.',
    'legal.terms.item4': 'Usa el software solo donde puedas cumplir la ley aplicable y tus obligaciones profesionales.',
    'legal.disclaimer.title': 'Aviso',
    'legal.disclaimer.intro':
      'Open Bistimulation solo proporciona señales configurables del navegador. No sustituye el criterio profesional ni el consentimiento del participante.',
    'legal.disclaimer.item1': 'No es consejo médico y no es un dispositivo médico.',
    'legal.disclaimer.item2': 'No es para uso diagnóstico, terapéutico, de crisis ni de emergencia.',
    'legal.disclaimer.item3': 'No existe garantía clínica ni garantía de efectividad.',
    'legal.disclaimer.item4':
      'Es independiente de bilateralstimulation.io y BLS GmbH; no existe afiliación, respaldo, patrocinio ni conexión.',
  },
} as const;

type TranslationKey = keyof typeof translations.en;
type TranslationParams = Record<string, string | number>;

interface I18nContextValue {
  language: Language;
  toggleLanguage: () => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function isLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'es';
}

function getSystemLanguage(): Language {
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('es')) {
    return 'es';
  }

  return 'en';
}

function getInitialLanguage(): Language {
  try {
    if (typeof localStorage === 'undefined') {
      return getSystemLanguage();
    }

    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(stored) ? stored : getSystemLanguage();
  } catch {
    return getSystemLanguage();
  }
}

function translate(language: Language, key: TranslationKey, params?: TranslationParams): string {
  let value: string = translations[language][key] ?? translations.en[key];

  if (!params) {
    return value;
  }

  for (const [paramKey, paramValue] of Object.entries(params)) {
    value = value.split(`{${paramKey}}`).join(String(paramValue));
  }

  return value;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Language selection remains available in memory when storage is unavailable.
    }
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      toggleLanguage: () => setLanguage((current) => (current === 'en' ? 'es' : 'en')),
      t: (key, params) => translate(language, key, params),
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used inside LanguageProvider.');
  }

  return context;
}
