import { LanguageToggle } from './LanguageToggle';
import { useI18n } from '../lib/i18n';

interface ErrorViewProps {
  title?: string;
  message: string;
}

export function ErrorView({ title, message }: ErrorViewProps) {
  const { t } = useI18n();

  return (
    <main className="centered-page">
      <div className="panel error-panel">
        <div className="centered-language-toggle">
          <LanguageToggle />
        </div>
        <h1>{title ?? t('error.defaultTitle')}</h1>
        <p>{message}</p>
        <a className="secondary-button inline-link-button" href="/">
          {t('common.backHome')}
        </a>
      </div>
    </main>
  );
}
