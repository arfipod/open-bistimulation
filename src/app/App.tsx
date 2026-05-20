import { useEffect, useState } from 'react';
import { parseCurrentRoute } from '../lib/url';
import type { RouteInfo } from '../domain/sessionTypes';
import { LandingPage } from '../pages/LandingPage';
import { TherapistSessionPage } from '../pages/TherapistSessionPage';
import { ClientSessionPage } from '../pages/ClientSessionPage';
import { TactileDevicePage } from '../pages/TactileDevicePage';
import { ErrorView } from '../components/ErrorView';

export default function App() {
  const [route, setRoute] = useState<RouteInfo>(() => parseCurrentRoute());

  useEffect(() => {
    const handlePopState = () => setRoute(parseCurrentRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (route.page === 'landing') {
    return <LandingPage />;
  }

  if (route.page === 'therapist' && route.sessionId) {
    return <TherapistSessionPage sessionId={route.sessionId} token={route.token} />;
  }

  if (route.page === 'client' && route.sessionId) {
    return <ClientSessionPage sessionId={route.sessionId} token={route.token} />;
  }

  if (route.page === 'tactile' && route.sessionId && route.side) {
    return <TactileDevicePage sessionId={route.sessionId} token={route.token} side={route.side} />;
  }

  return <ErrorView title="Ruta no encontrada" message="Comprueba el enlace o vuelve al inicio." />;
}
