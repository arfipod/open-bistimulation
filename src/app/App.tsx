import { useEffect, useState } from 'react';
import { parseCurrentRoute } from '../lib/url';
import type { RouteInfo } from '../domain/sessionTypes';
import { LandingPage } from '../pages/LandingPage';
import { TherapistSessionPage } from '../pages/TherapistSessionPage';
import { ClientSessionPage } from '../pages/ClientSessionPage';
import { TactileDevicePage } from '../pages/TactileDevicePage';
import { AppFooter } from '../components/AppFooter';
import { ErrorView } from '../components/ErrorView';
import { KoFiWidget } from '../components/KoFiWidget';
import { useI18n } from '../lib/i18n';

export default function App() {
  const [route, setRoute] = useState<RouteInfo>(() => parseCurrentRoute());
  const { t } = useI18n();

  useEffect(() => {
    const handlePopState = () => setRoute(parseCurrentRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  let page;

  if (route.page === 'landing') {
    page = <LandingPage />;
  } else if (route.page === 'therapist' && route.sessionId) {
    page = <TherapistSessionPage sessionId={route.sessionId} token={route.token} />;
  } else if (route.page === 'client' && route.sessionId) {
    page = <ClientSessionPage sessionId={route.sessionId} token={route.token} />;
  } else if (route.page === 'tactile' && route.sessionId && route.side) {
    page = <TactileDevicePage sessionId={route.sessionId} token={route.token} side={route.side} />;
  } else {
    page = <ErrorView title={t('app.notFoundTitle')} message={t('app.notFoundMessage')} />;
  }

  const showSupportWidget = route.page === 'landing' || route.page === 'therapist';

  return (
    <div className={`app-shell app-shell-${route.page}`}>
      {page}
      <AppFooter />
      {showSupportWidget ? <KoFiWidget /> : null}
    </div>
  );
}
