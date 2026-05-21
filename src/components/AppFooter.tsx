import { useI18n } from '../lib/i18n';

export function AppFooter() {
  const { t } = useI18n();

  return (
    <footer className="app-footer">
      <nav aria-label={t('footer.navLabel')}>
        <a href="/legal">{t('footer.legal')}</a>
        <a href="/privacy">{t('footer.privacy')}</a>
        <a href="/terms">{t('footer.terms')}</a>
        <a href="/disclaimer">{t('footer.disclaimer')}</a>
        <a href="https://github.com/arfipod/open-bistimulation" rel="noreferrer" target="_blank">
          {t('footer.github')}
        </a>
        <a href="https://ko-fi.com/anrubiof" rel="noreferrer" target="_blank">
          {t('footer.support')}
        </a>
      </nav>
      <p>{t('app.footer')}</p>
      <p>{t('footer.credit')}</p>
    </footer>
  );
}
