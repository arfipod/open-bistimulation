import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { LanguageProvider } from './lib/i18n';
import './styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
