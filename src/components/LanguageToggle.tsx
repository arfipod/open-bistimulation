import { useI18n } from '../lib/i18n';

export function LanguageToggle() {
  const { language, t, toggleLanguage } = useI18n();

  return (
    <button className="language-toggle" type="button" onClick={toggleLanguage} aria-label={t('app.languageToggle')}>
      <span aria-hidden="true">{language === 'en' ? '🇬🇧' : '🇪🇸'}</span>
      <span>{language.toUpperCase()}</span>
    </button>
  );
}
