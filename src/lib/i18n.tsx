import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'en' | 'es';

const LANGUAGE_STORAGE_KEY = 'open-bistimulation.language.v1';

const translations = {
  en: {
    'app.brandAria': 'Open Bistimulation home',
    'app.footer': 'made with 💙 by arrf',
    'app.languageToggle': 'Switch language to Spanish',
    'app.languageLabel': 'English',
    'app.notFoundTitle': 'Route not found',
    'app.notFoundMessage': 'Check the link or go back home.',
    'common.backHome': 'Back home',
    'common.copy': 'Copy',
    'common.copied': 'Copied',
    'common.copyLink': 'Copy link',
    'common.connected': 'Connected',
    'common.reconnecting': 'Reconnecting',
    'common.clientConnected': 'Client connected',
    'common.noClient': 'No client',
    'common.left': 'left',
    'common.right': 'right',
    'common.leftPhone': 'Left phone',
    'common.rightPhone': 'Right phone',
    'common.generatingQr': 'Generating QR...',
    'common.loading': 'Loading...',
    'error.defaultTitle': 'Could not open the session',
    'loading.therapist': 'Opening therapist panel...',
    'loading.client': 'Connecting to therapist...',
    'loading.tactile': 'Pairing tactile phone...',
    'landing.eyebrow': 'Private remote BLS MVP',
    'landing.description':
      'Therapist-controlled bilateral stimulation sessions: visual, auditory, and tactile using two companion phones with browser vibration.',
    'landing.supabaseWarning':
      'Supabase environment variables are missing. Copy .env.example to .env.local and fill in SUPABASE_URL and SUPABASE_ANON_KEY.',
    'landing.create': 'Create BLS session',
    'landing.creating': 'Creating session...',
    'landing.visualTitle': 'Visual',
    'landing.visualText': 'Color, background, speed, position, direction icons, and configurable bilateral order.',
    'landing.audioTitle': 'Auditory',
    'landing.audioText': 'Synthetic sounds with left/right stereo panning using the Web Audio API.',
    'landing.tactileTitle': 'Tactile',
    'landing.tactileText': 'QR pairing for two phones with alternating vibration via JavaScript.',
    'session.therapistPanel': 'Therapist panel',
    'session.realtimeConnected': 'Realtime connected',
    'session.realtimeDisconnected': 'Realtime disconnected',
    'session.previewClient': 'Preview client',
    'session.endSession': 'End session',
    'session.localAudioEnabled': 'Therapist audio enabled',
    'session.enableLocalAudio': 'Enable local audio',
    'session.serverClock': 'Server clock',
    'session.preferencesSaved': 'Preferences saved locally and in Supabase for this session.',
    'session.roundFinished': 'Round finished after {duration}.',
    'session.missingTherapistToken': 'Missing therapist token in the URL.',
    'session.therapistPermissions': 'This link does not have therapist permissions.',
    'session.loadError': 'Could not load the session.',
    'session.saveStateError': 'Could not save the state.',
    'session.backendTokenError': 'The backend did not return a therapist token.',
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
    'controls.durationInput': 'Round duration in minutes and seconds',
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
    'audio.muteTherapist': 'Mute for therapist',
    'audio.snap': 'Finger snap',
    'audio.beep': 'Beep',
    'audio.bell': 'Soft bell',
    'audio.heartbeat': 'Heartbeat',
    'tactile.title': 'Tactile',
    'tactile.leftPhone': 'Left phone{suffix}',
    'tactile.rightPhone': 'Right phone{suffix}',
    'tactile.withoutVibration': ' without vibration',
    'tactile.pulseDuration': 'Pulse duration: {value} ms',
    'tactile.internalPause': 'Internal pause: {value} ms',
    'tactile.note': 'Use two Android phones with Chrome/Samsung Internet. Each phone is paired from the client QR.',
    'invite.eyebrow': 'Client',
    'invite.title': 'Invitation link',
    'preview.title': 'What client sees',
    'client.missingToken': 'Missing client token in the URL.',
    'client.sessionEndedTitle': 'Session ended',
    'client.sessionEndedMessage': 'The therapist has ended this session.',
    'client.audioEnabled': 'Audio enabled',
    'client.enableAudio': 'Enable audio',
    'client.hideTactileQr': 'Hide tactile QR',
    'client.tactileQr': 'Tactile QR',
    'client.fullscreen': 'Fullscreen',
    'client.enableAudioTitle': 'Enable audio',
    'client.enableAudioBody': 'The browser requires a user gesture to allow stereo audio.',
    'client.enterEnableAudio': 'Enter and enable audio',
    'client.pairTactile': 'Pair tactile phones',
    'client.pairTactileBody': 'Scan each QR with a different phone. Recommended: Android + Chrome/Samsung Internet.',
    'client.leftPhoneHelper': 'This phone will vibrate on left pulses.',
    'client.rightPhoneHelper': 'This phone will vibrate on right pulses.',
    'tactileDevice.title': 'Tactile device',
    'tactileDevice.description': 'This phone will vibrate when the therapist emits {side}.',
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
  },
  es: {
    'app.brandAria': 'Inicio de Open Bistimulation',
    'app.footer': 'made with 💙 by arrf',
    'app.languageToggle': 'Cambiar idioma a ingles',
    'app.languageLabel': 'Espanol',
    'app.notFoundTitle': 'Ruta no encontrada',
    'app.notFoundMessage': 'Comprueba el enlace o vuelve al inicio.',
    'common.backHome': 'Volver al inicio',
    'common.copy': 'Copiar',
    'common.copied': 'Copiado',
    'common.copyLink': 'Copiar enlace',
    'common.connected': 'Conectado',
    'common.reconnecting': 'Reconectando',
    'common.clientConnected': 'Cliente conectado',
    'common.noClient': 'Sin cliente',
    'common.left': 'izquierda',
    'common.right': 'derecha',
    'common.leftPhone': 'Telefono izquierdo',
    'common.rightPhone': 'Telefono derecho',
    'common.generatingQr': 'Generando QR...',
    'common.loading': 'Cargando...',
    'error.defaultTitle': 'No se pudo abrir la sesion',
    'loading.therapist': 'Abriendo panel del terapeuta...',
    'loading.client': 'Conectando con el terapeuta...',
    'loading.tactile': 'Emparejando telefono tactil...',
    'landing.eyebrow': 'MVP privado de BLS remoto',
    'landing.description':
      'Sesiones de estimulacion bilateral controladas por terapeuta: visual, auditiva y tactil usando dos telefonos auxiliares con vibracion del navegador.',
    'landing.supabaseWarning':
      'Faltan las variables de entorno de Supabase. Copia .env.example a .env.local y completa SUPABASE_URL y SUPABASE_ANON_KEY.',
    'landing.create': 'Crear sesion BLS',
    'landing.creating': 'Creando sesion...',
    'landing.visualTitle': 'Visual',
    'landing.visualText': 'Color, fondo, velocidad, posicion, iconos de direccion y orden bilateral configurable.',
    'landing.audioTitle': 'Auditivo',
    'landing.audioText': 'Sonidos sinteticos con paneo estereo izquierda/derecha mediante Web Audio API.',
    'landing.tactileTitle': 'Tactil',
    'landing.tactileText': 'Emparejamiento QR para dos telefonos con vibracion alterna via JavaScript.',
    'session.therapistPanel': 'Panel del terapeuta',
    'session.realtimeConnected': 'Realtime conectado',
    'session.realtimeDisconnected': 'Realtime desconectado',
    'session.previewClient': 'Previsualizar cliente',
    'session.endSession': 'Terminar sesion',
    'session.localAudioEnabled': 'Audio del terapeuta activado',
    'session.enableLocalAudio': 'Activar audio local',
    'session.serverClock': 'Reloj servidor',
    'session.preferencesSaved': 'Preferencias guardadas localmente y en Supabase para esta sesion.',
    'session.roundFinished': 'Tanda terminada despues de {duration}.',
    'session.missingTherapistToken': 'Falta el token de terapeuta en la URL.',
    'session.therapistPermissions': 'Este enlace no tiene permisos de terapeuta.',
    'session.loadError': 'No se pudo cargar la sesion.',
    'session.saveStateError': 'No se pudo guardar el estado.',
    'session.backendTokenError': 'El backend no devolvio el token de terapeuta.',
    'session.createError': 'No se pudo crear la sesion.',
    'controls.time': 'Tiempo',
    'controls.passes': 'Pases',
    'controls.sets': 'Tandas',
    'controls.start': 'Iniciar BLS',
    'controls.pause': 'Pausar',
    'controls.resume': 'Reanudar',
    'controls.stop': 'Stop',
    'controls.stopping': 'Stopping...',
    'controls.reset': 'Reset',
    'controls.savePreferences': 'Guardar preferencias',
    'controls.roundDuration': 'Duracion de tanda',
    'controls.remaining': 'Restante',
    'controls.durationInput': 'Duracion de tanda en minutos y segundos',
    'controls.minusTen': '-10s',
    'controls.plusTen': '+10s',
    'controls.presets': 'Presets',
    'visual.title': 'Visual',
    'visual.color': 'Color BLS',
    'visual.colorAria': 'Color {color}',
    'visual.background': 'Fondo',
    'visual.backgroundAria': 'Fondo {color}',
    'visual.speed': 'Velocidad: {value}',
    'visual.direction': 'Direccion',
    'visual.motionOrder': 'Orden bilateral',
    'visual.position': 'Posicion vertical',
    'visual.size': 'Tamano: {value}px',
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
    'audio.muteTherapist': 'Silenciar para terapeuta',
    'audio.snap': 'Chasquido',
    'audio.beep': 'Beep',
    'audio.bell': 'Campana suave',
    'audio.heartbeat': 'Latido',
    'tactile.title': 'Tactil',
    'tactile.leftPhone': 'Telefono izquierdo{suffix}',
    'tactile.rightPhone': 'Telefono derecho{suffix}',
    'tactile.withoutVibration': ' sin vibracion',
    'tactile.pulseDuration': 'Duracion del pulso: {value} ms',
    'tactile.internalPause': 'Pausa interna: {value} ms',
    'tactile.note': 'Usa dos telefonos Android con Chrome/Samsung Internet. Cada telefono se empareja desde el QR del cliente.',
    'invite.eyebrow': 'Cliente',
    'invite.title': 'Enlace de invitacion',
    'preview.title': 'Lo que ve el cliente',
    'client.missingToken': 'Falta el token de cliente en la URL.',
    'client.sessionEndedTitle': 'Sesion terminada',
    'client.sessionEndedMessage': 'El terapeuta ha terminado esta sesion.',
    'client.audioEnabled': 'Audio activado',
    'client.enableAudio': 'Activar audio',
    'client.hideTactileQr': 'Ocultar QR tactil',
    'client.tactileQr': 'QR tactil',
    'client.fullscreen': 'Pantalla completa',
    'client.enableAudioTitle': 'Activar audio',
    'client.enableAudioBody': 'El navegador requiere una accion del usuario para permitir audio estereo.',
    'client.enterEnableAudio': 'Entrar y activar audio',
    'client.pairTactile': 'Emparejar telefonos tactiles',
    'client.pairTactileBody': 'Escanea cada QR con un telefono distinto. Recomendado: Android + Chrome/Samsung Internet.',
    'client.leftPhoneHelper': 'Este telefono vibrara con los pulsos izquierdos.',
    'client.rightPhoneHelper': 'Este telefono vibrara con los pulsos derechos.',
    'tactileDevice.title': 'Dispositivo tactil',
    'tactileDevice.description': 'Este telefono vibrara cuando el terapeuta emita {side}.',
    'tactileDevice.supported': 'Este navegador expone navigator.vibrate(). Pulsa activar para permitir vibraciones.',
    'tactileDevice.unsupported': 'Este navegador no soporta la API de vibracion. Usa Android con Chrome o Samsung Internet.',
    'tactileDevice.enableNotice':
      'Este navegador no expone la API de vibracion. Prueba Chrome o Samsung Internet en Android.',
    'tactileDevice.rejected':
      'El navegador rechazo la vibracion. Revisa modo silencio, No molestar y ajustes de vibracion del sistema.',
    'tactileDevice.realtime': 'Realtime',
    'tactileDevice.status': 'Estado',
    'tactileDevice.vibrationEnabled': 'Vibracion activada',
    'tactileDevice.pendingActivation': 'Pendiente de activacion',
    'tactileDevice.pulsesReceived': 'Pulsos recibidos',
    'tactileDevice.lastPulse': 'Ultimo pulso',
    'tactileDevice.enableVibration': 'Activar vibracion',
    'tactileDevice.testVibration': 'Probar vibracion',
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
