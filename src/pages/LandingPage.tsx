import { useState } from 'react';
import { DEFAULT_SESSION_STATE } from '../domain/defaults';
import { createBlsSession } from '../lib/sessionApi';
import { isSupabaseConfigured } from '../lib/supabase';
import { loadLocalPreferences } from '../lib/localStorage';
import { therapistUrl } from '../lib/url';

export function LandingPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    setIsCreating(true);

    try {
      const preferences = loadLocalPreferences();
      const state = {
        ...DEFAULT_SESSION_STATE,
        visual: preferences.visual,
        audio: preferences.audio,
        tactile: preferences.tactile,
      };
      const session = await createBlsSession(state, preferences);

      if (!session.therapistToken) {
        throw new Error('The backend did not return a therapist token.');
      }

      window.location.assign(therapistUrl(session.id, session.therapistToken));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not create session.');
      setIsCreating(false);
    }
  };

  return (
    <main className="landing-page">
      <section className="hero panel">
        <span className="eyebrow">MVP privado de BLS remoto</span>
        <h1>Open Binstimulation</h1>
        <p>
          Sesiones de estimulación bilateral controladas por terapeuta: visual, auditivo y táctil mediante dos móviles
          auxiliares con vibración del navegador.
        </p>

        {!isSupabaseConfigured ? (
          <div className="warning-box">
            Faltan variables de entorno de Supabase. Copia <code>.env.example</code> a <code>.env.local</code> y rellena
            <code> VITE_SUPABASE_URL</code> y <code> VITE_SUPABASE_ANON_KEY</code>.
          </div>
        ) : null}

        {error ? <div className="error-box">{error}</div> : null}

        <button className="primary-button hero-button" type="button" onClick={handleCreate} disabled={isCreating || !isSupabaseConfigured}>
          {isCreating ? 'Creando sesión…' : 'Crear sesión BLS'}
        </button>

        <div className="hero-grid">
          <article>
            <strong>Visual</strong>
            <span>Color, fondo, velocidad, posición y direcciones horizontal, vertical, diagonal e infinito.</span>
          </article>
          <article>
            <strong>Auditivo</strong>
            <span>Sonidos sintéticos con paneo estéreo izquierda/derecha usando Web Audio API.</span>
          </article>
          <article>
            <strong>Táctil</strong>
            <span>QR para vincular dos móviles y emitir vibración alterna mediante JavaScript.</span>
          </article>
        </div>
      </section>
    </main>
  );
}
