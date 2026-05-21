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
    'footer.navLabel': 'Legal and project links',
    'footer.legal': 'Legal',
    'footer.privacy': 'Privacy',
    'footer.terms': 'Terms',
    'footer.disclaimer': 'Disclaimer',
    'footer.github': 'GitHub',
    'footer.support': 'Support development',
    'footer.credit': 'Made with 💙 by arrf',
    'support.button': 'Leave a tip',
    'support.ariaLabel': 'Leave an optional tip to support independent development',
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
    'common.leftPhone': 'Left device',
    'common.rightPhone': 'Right device',
    'common.generatingQr': 'Generating QR...',
    'common.loading': 'Loading...',
    'error.defaultTitle': 'Could not open the session',
    'loading.therapist': 'Opening controller panel...',
    'loading.client': 'Connecting to controller...',
    'loading.tactile': 'Pairing tactile device...',
    'landing.eyebrow': 'Independent experimental BLS tool',
    'landing.description':
      'BLS here means browser-based bilateral sensory cues: visual, auditory, and optional tactile pulses coordinated by a controller for a participant.',
    'landing.publicContentTitle': 'What this tool provides',
    'landing.publicContentBody':
      'Open Bistimulation is free independent software for browser-based bilateral sensory cues. It provides configurable visual, auditory, and optional tactile cues coordinated by a controller for a participant. Optional tips support independent development and maintenance only; they do not purchase access, professional services, medical services, warranties, or outcome guarantees.',
    'landing.supabaseWarning':
      'Supabase environment variables are missing. Copy .env.example to .env.local and fill in SUPABASE_URL and SUPABASE_ANON_KEY.',
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
    'landing.tactileText': 'QR pairing for two companion devices with alternating browser vibration where supported.',
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
    'session.backendTokenError': 'The backend did not return a controller token.',
    'session.createError': 'Could not create session.',
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
    'tactile.leftPhone': 'Left device{suffix}',
    'tactile.rightPhone': 'Right device{suffix}',
    'tactile.withoutVibration': ' without vibration',
    'tactile.pulseDuration': 'Pulse duration: {value} ms',
    'tactile.internalPause': 'Internal pause: {value} ms',
    'tactile.note': 'Use two Android devices with Chrome/Samsung Internet. Each device is paired from the participant QR.',
    'invite.eyebrow': 'Participant',
    'invite.title': 'Invitation link',
    'preview.title': 'Participant view',
    'client.missingToken': 'Missing participant token in the URL.',
    'client.sessionEndedTitle': 'Session ended',
    'client.sessionEndedMessage': 'The controller has ended this session.',
    'client.audioEnabled': 'Audio enabled',
    'client.enableAudio': 'Enable audio',
    'client.hideTactileQr': 'Hide tactile QR',
    'client.tactileQr': 'Tactile QR',
    'client.fullscreen': 'Fullscreen',
    'client.enableAudioTitle': 'Enable audio',
    'client.enableAudioBody': 'The browser requires a user gesture to allow stereo audio.',
    'client.enterEnableAudio': 'Enter and enable audio',
    'client.pairTactile': 'Pair tactile devices',
    'client.pairTactileBody': 'Scan each QR with a different device. Recommended: Android + Chrome/Samsung Internet.',
    'client.leftPhoneHelper': 'This device will vibrate on left pulses.',
    'client.rightPhoneHelper': 'This device will vibrate on right pulses.',
    'tactileDevice.title': 'Tactile device',
    'tactileDevice.description': 'This device will vibrate when the controller sends {side}.',
    'tactileDevice.supported': 'This browser exposes navigator.vibrate(). Press activate to allow vibrations.',
    'tactileDevice.unsupported': 'This browser does not support the Vibration API. Use Android with Chrome or Samsung Internet.',
    'tactileDevice.enableNotice':
      'This browser does not expose the vibration API. Try Chrome or Samsung Internet on Android.',
    'tactileDevice.rejected':
      'The browser rejected vibration. Check silent mode, Do Not Disturb, and system vibration settings.',
    'tactileDevice.realtime': 'Realtime',
    'tactileDevice.status': 'Status',
    'tactileDevice.vibrationEnabled': 'Vibration enabled',
    'tactileDevice.pendingActivation': 'Pending activation',
    'tactileDevice.pulsesReceived': 'Pulses received',
    'tactileDevice.lastPulse': 'Last pulse',
    'tactileDevice.enableVibration': 'Enable vibration',
    'tactileDevice.testVibration': 'Test vibration',
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
      'Supabase stores session id, controller and participant tokens, session state, preferences, tactile device metadata, and timestamps.',
    'legal.privacy.item2':
      'Tactile device metadata may include side, generated device id, browser support status, connection status, and last-seen timestamps.',
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
    'legal.terms.item3': 'Optional tips support independent development only; they do not buy access, professional services, medical services, warranties, or outcome guarantees.',
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
    'footer.navLabel': 'Enlaces legales y del proyecto',
    'footer.legal': 'Legal',
    'footer.privacy': 'Privacidad',
    'footer.terms': 'Términos',
    'footer.disclaimer': 'Aviso',
    'footer.github': 'GitHub',
    'footer.support': 'Apoyar desarrollo',
    'footer.credit': 'Hecho con 💙 por arrf',
    'support.button': 'Dejar propina',
    'support.ariaLabel': 'Dejar una propina opcional para apoyar el desarrollo independiente',
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
    'common.leftPhone': 'Dispositivo izquierdo',
    'common.rightPhone': 'Dispositivo derecho',
    'common.generatingQr': 'Generando QR...',
    'common.loading': 'Cargando...',
    'error.defaultTitle': 'No se pudo abrir la sesión',
    'loading.therapist': 'Abriendo panel de control...',
    'loading.client': 'Conectando con el controlador...',
    'loading.tactile': 'Emparejando dispositivo táctil...',
    'landing.eyebrow': 'Herramienta BLS experimental independiente',
    'landing.description':
      'Aquí BLS significa señales sensoriales bilaterales en el navegador: visuales, auditivas y pulsos táctiles opcionales coordinados por un controlador para un participante.',
    'landing.publicContentTitle': 'Qué proporciona esta herramienta',
    'landing.publicContentBody':
      'Open Bistimulation es software libre e independiente para señales sensoriales bilaterales en el navegador. Proporciona señales visuales, auditivas y pulsos táctiles opcionales configurables, coordinados por un controlador para un participante. Las propinas opcionales solo apoyan el desarrollo y mantenimiento independiente; no compran acceso, servicios profesionales, servicios médicos, garantías ni promesas de resultados.',
    'landing.supabaseWarning':
      'Faltan las variables de entorno de Supabase. Copia .env.example a .env.local y completa SUPABASE_URL y SUPABASE_ANON_KEY.',
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
    'landing.tactileText': 'Emparejamiento QR para dos dispositivos auxiliares con vibración alterna del navegador si está soportada.',
    'session.therapistPanel': 'Panel de control',
    'session.realtimeConnected': 'Realtime conectado',
    'session.realtimeDisconnected': 'Realtime desconectado',
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
    'session.backendTokenError': 'El backend no devolvio el token de controlador.',
    'session.createError': 'No se pudo crear la sesión.',
    'controls.time': 'Tiempo',
    'controls.passes': 'Pases',
    'controls.sets': 'Tandas',
    'controls.start': 'Iniciar BLS',
    'controls.pause': 'Pausar',
    'controls.resume': 'Reanudar',
    'controls.stop': 'Stop',
    'controls.stopping': 'Deteniendo...',
    'controls.reset': 'Reset',
    'controls.savePreferences': 'Guardar preferencias',
    'controls.roundDuration': 'Duración de tanda',
    'controls.remaining': 'Restante',
    'controls.durationInput': 'Duración de tanda en minutos y segundos, o libre',
    'controls.free': 'Libre',
    'controls.minusTen': '-10s',
    'controls.plusTen': '+10s',
    'controls.presets': 'Presets',
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
    'tactile.leftPhone': 'Dispositivo izquierdo{suffix}',
    'tactile.rightPhone': 'Dispositivo derecho{suffix}',
    'tactile.withoutVibration': ' sin vibración',
    'tactile.pulseDuration': 'Duración del pulso: {value} ms',
    'tactile.internalPause': 'Pausa interna: {value} ms',
    'tactile.note': 'Usa dos dispositivos Android con Chrome/Samsung Internet. Cada dispositivo se empareja desde el QR del participante.',
    'invite.eyebrow': 'Participante',
    'invite.title': 'Enlace de invitación',
    'preview.title': 'Vista del participante',
    'client.missingToken': 'Falta el token de participante en la URL.',
    'client.sessionEndedTitle': 'Sesión terminada',
    'client.sessionEndedMessage': 'El controlador ha terminado esta sesión.',
    'client.audioEnabled': 'Audio activado',
    'client.enableAudio': 'Activar audio',
    'client.hideTactileQr': 'Ocultar QR táctil',
    'client.tactileQr': 'QR táctil',
    'client.fullscreen': 'Pantalla completa',
    'client.enableAudioTitle': 'Activar audio',
    'client.enableAudioBody': 'El navegador requiere una acción del usuario para permitir audio estéreo.',
    'client.enterEnableAudio': 'Entrar y activar audio',
    'client.pairTactile': 'Emparejar dispositivos táctiles',
    'client.pairTactileBody': 'Escanea cada QR con un dispositivo distinto. Recomendado: Android + Chrome/Samsung Internet.',
    'client.leftPhoneHelper': 'Este dispositivo vibrará con los pulsos izquierdos.',
    'client.rightPhoneHelper': 'Este dispositivo vibrará con los pulsos derechos.',
    'tactileDevice.title': 'Dispositivo táctil',
    'tactileDevice.description': 'Este dispositivo vibrará cuando el controlador envíe {side}.',
    'tactileDevice.supported': 'Este navegador expone navigator.vibrate(). Pulsa activar para permitir vibraciones.',
    'tactileDevice.unsupported': 'Este navegador no soporta la API de vibración. Usa Android con Chrome o Samsung Internet.',
    'tactileDevice.enableNotice':
      'Este navegador no expone la API de vibración. Prueba Chrome o Samsung Internet en Android.',
    'tactileDevice.rejected':
      'El navegador rechazó la vibración. Revisa modo silencio, No molestar y ajustes de vibración del sistema.',
    'tactileDevice.realtime': 'Realtime',
    'tactileDevice.status': 'Estado',
    'tactileDevice.vibrationEnabled': 'Vibración activada',
    'tactileDevice.pendingActivation': 'Pendiente de activación',
    'tactileDevice.pulsesReceived': 'Pulsos recibidos',
    'tactileDevice.lastPulse': 'Último pulso',
    'tactileDevice.enableVibration': 'Activar vibración',
    'tactileDevice.testVibration': 'Probar vibración',
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
      'Supabase almacena id de sesión, tokens de controlador y participante, estado de sesión, preferencias, metadatos de dispositivos táctiles y marcas de tiempo.',
    'legal.privacy.item2':
      'Los metadatos táctiles pueden incluir lado, id de dispositivo generado, soporte del navegador, estado de conexión y última marca de actividad.',
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
      'Las propinas opcionales solo apoyan el desarrollo independiente; no compran acceso, servicios profesionales, servicios médicos, garantías ni promesas de resultados.',
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
  if (typeof localStorage === 'undefined') {
    return getSystemLanguage();
  }

  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isLanguage(stored) ? stored : getSystemLanguage();
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
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
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
