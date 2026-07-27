import { useI18n } from '../lib/i18n';

export function LanguageToggle() {
  const { language, t, toggleLanguage } = useI18n();
  const nextLanguage = language === 'en' ? 'ES' : 'EN';

  return (
    <button className="language-toggle" type="button" onClick={toggleLanguage} aria-label={t('app.languageToggle')}>
      <span className="language-current">{language.toUpperCase()}</span>
      <span className="language-divider" aria-hidden="true">/</span>
      <span className="language-next" aria-hidden="true">{nextLanguage}</span>
    </button>
  );
}
