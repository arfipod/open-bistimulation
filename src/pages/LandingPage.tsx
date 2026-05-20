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
        <span className="eyebrow">Private remote BLS MVP</span>
        <h1>Open Binstimulation</h1>
        <p>
          Therapist-controlled bilateral stimulation sessions: visual, auditory, and tactile using two
          companion phones with browser vibration.
        </p>

        {!isSupabaseConfigured ? (
          <div className="warning-box">
            Supabase environment variables are missing. Copy <code>.env.example</code> to <code>.env.local</code> and fill in
            <code> SUPABASE_URL</code> and <code> SUPABASE_ANON_KEY</code>.
          </div>
        ) : null}

        {error ? <div className="error-box">{error}</div> : null}

        <button className="primary-button hero-button" type="button" onClick={handleCreate} disabled={isCreating || !isSupabaseConfigured}>
          {isCreating ? 'Creating session…' : 'Create BLS session'}
        </button>

        <div className="hero-grid">
          <article>
            <strong>Visual</strong>
            <span>Color, background, speed, position, and horizontal, vertical, diagonal, and infinity directions.</span>
          </article>
          <article>
            <strong>Auditory</strong>
            <span>Synthetic sounds with left/right stereo panning using the Web Audio API.</span>
          </article>
          <article>
            <strong>Tactile</strong>
            <span>QR pairing for two phones with alternating vibration via JavaScript.</span>
          </article>
        </div>
      </section>
    </main>
  );
}
