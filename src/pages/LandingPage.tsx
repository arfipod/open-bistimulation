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
        <section className="hero">
          <div className="hero-copy">
            <h1>
              <span>Open</span>
              Bistimulation
            </h1>
            <p className="hero-description">{t('landing.description')}</p>
            <p className="landing-context">{t('landing.eyebrow')}</p>

            {!isSupabaseConfigured ? (
              <div className="warning-box" role="status">
                {t('landing.supabaseWarning')}
              </div>
            ) : null}

            {error ? <div className="error-box" role="alert">{error}</div> : null}

            <button className="primary-button hero-button" type="button" onClick={handleCreate} disabled={isCreating || !isSupabaseConfigured}>
              {isCreating ? t('landing.creating') : t('landing.create')}
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="signal-figure" aria-hidden="true">
            <div className="signal-axis">
              <span className="signal-end signal-end-left">L</span>
              <span className="signal-line" />
              <span className="signal-pulse signal-pulse-left" />
              <span className="signal-center" />
              <span className="signal-pulse signal-pulse-right" />
              <span className="signal-end signal-end-right">R</span>
            </div>
            <div className="signal-readout">
              <span>{t('landing.visualTitle')}</span>
              <span>{t('landing.audioTitle')}</span>
              <span>{t('landing.tactileTitle')}</span>
            </div>
          </div>
        </section>

        <section className="landing-details">
          <div className="landing-information">
            <section className="public-content" aria-labelledby="landing-public-content-title">
            <h2 id="landing-public-content-title">{t('landing.publicContentTitle')}</h2>
            <p>{t('landing.publicContentBody')}</p>
            </section>

            <div className="modality-list">
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
          </div>

          <aside className="legal-disclaimer" aria-labelledby="landing-legal-title">
            <strong id="landing-legal-title">{t('landing.disclaimerTitle')}</strong>
            <ul>
              <li>{t('landing.disclaimerExperimental')}</li>
              <li>{t('landing.disclaimerAdvice')}</li>
              <li>{t('landing.disclaimerDevice')}</li>
              <li>{t('landing.disclaimerProfessional')}</li>
              <li>{t('landing.disclaimerIndependent')}</li>
            </ul>
          </aside>
        </section>
      </main>
    </>
  );
}
