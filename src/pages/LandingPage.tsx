import { useState } from 'react';
import { DEFAULT_SESSION_STATE } from '../domain/defaults';
import { createBlsSession } from '../lib/sessionApi';
import { isSupabaseConfigured } from '../lib/supabase';
import { loadLocalPreferences } from '../lib/localStorage';
import { therapistUrl } from '../lib/url';
import { useI18n } from '../lib/i18n';
import { AppHeader } from '../components/AppHeader';

export function LandingPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

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
        throw new Error(t('session.backendTokenError'));
      }

      window.location.assign(therapistUrl(session.id, session.therapistToken));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('session.createError'));
      setIsCreating(false);
    }
  };

  return (
    <>
      <AppHeader title="" />
      <main className="landing-page">
        <section className="hero panel">
          <span className="eyebrow">{t('landing.eyebrow')}</span>
          <h1>Open Binstimulation</h1>
          <p>{t('landing.description')}</p>

          {!isSupabaseConfigured ? <div className="warning-box">{t('landing.supabaseWarning')}</div> : null}

          {error ? <div className="error-box">{error}</div> : null}

          <button className="primary-button hero-button" type="button" onClick={handleCreate} disabled={isCreating || !isSupabaseConfigured}>
            {isCreating ? t('landing.creating') : t('landing.create')}
          </button>

          <div className="hero-grid">
            <article>
              <strong>{t('landing.visualTitle')}</strong>
              <span>{t('landing.visualText')}</span>
            </article>
            <article>
              <strong>{t('landing.audioTitle')}</strong>
              <span>{t('landing.audioText')}</span>
            </article>
            <article>
              <strong>{t('landing.tactileTitle')}</strong>
              <span>{t('landing.tactileText')}</span>
            </article>
          </div>
        </section>
      </main>
    </>
  );
}
